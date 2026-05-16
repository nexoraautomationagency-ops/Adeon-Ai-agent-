const { Client, LocalAuth, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const SupabaseSessionStore = require('./supabase-store');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { dbRun, dbGet, dbAll, supabase } = require('../db/connection');
const aiService = require('./ai');
const retrievalService = require('./retrieval');
const normalizationService = require('./normalization');
const EventEmitter = require('events');

class WhatsAppService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isReady = false;
    this.isInitializing = false;
    this.qrCode = null;
    this.status = 'disconnected';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectTimeout = null;
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.processedMessages = new Set();
    this.inboundRateBuckets = new Map();
    this.pendingMessages = new Map(); // For message grouping (debouncing)
    this._adminCache = new Map(); // Fix Bug 47: Map of Set (tutorId -> Set of adminPhones)
    this._lastAdminUpdate = new Map();

    setInterval(() => {
      if (this.processedMessages.size > 2000) this.processedMessages.clear();
      const now = Date.now();
      for (const [from, bucket] of this.inboundRateBuckets.entries()) {
        if (now - bucket.windowStart > 120000) this.inboundRateBuckets.delete(from);
      }
      // Fix Bug 44: Cleanup stale pending messages (older than 1 minute)
      for (const [chatId, pending] of this.pendingMessages.entries()) {
        if (now - pending.timestamp > 60000) this.pendingMessages.delete(chatId);
      }
    }, 60000);
  }

  clearTutorCache() {
    this._tutorCache = null;
    this._settingsCache = null;
    this._lastCacheUpdate = 0;
  }

  async initialize() {
    if (this.isInitializing || this.isReady) return;
    this.isInitializing = true;
    try {
      const sessionPath = path.resolve(process.env.WA_SESSION_PATH || './.wwebjs_auth');
      this._clearLockFiles(sessionPath);
    } catch (e) { }

    this.status = 'initializing';
    this.emit('status_change', { status: this.status });

    try {
      await this._forceCleanup();
      const isProd = process.env.NODE_ENV === 'production';
      const baseSessionPath = isProd 
        ? path.resolve('./.wwebjs_auth') 
        : 'C:\\AdeonSessions'; 
      
      if (!fs.existsSync(baseSessionPath)) fs.mkdirSync(baseSessionPath, { recursive: true });

      // Fix Bug 46: Support for multitenant sessions if needed
      let tutorId = 1;
      try {
         const tutor = await dbGet("SELECT id FROM tutors ORDER BY role = 'developer' DESC, id ASC LIMIT 1");
         if (tutor) tutorId = tutor.id;
      } catch(e) {}
      
      const sessionPath = path.join(baseSessionPath, `session-${tutorId}`);
      this._clearLockFiles(sessionPath);
      if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

      const store = new SupabaseSessionStore();
      
      // DEPLOYMENT PROTECTION: Ensure the Supabase bucket exists before using RemoteAuth
      if (isProd) {
        try {
            const { data: buckets } = await supabase.storage.listBuckets();
            const exists = buckets?.find(b => b.name === 'whatsapp-sessions');
            if (!exists) {
                await supabase.storage.createBucket('whatsapp-sessions', { public: false });
                console.log('[Supabase] ☁️ Created missing whatsapp-sessions bucket.');
            }
        } catch (e) {
            console.warn('[Supabase] ☁️ Bucket check failed, falling back to LocalAuth for safety.');
        }
      }

      this.client = new Client({
        authStrategy: new LocalAuth({ 
          clientId: `tutor-${tutorId}`, 
          dataPath: baseSessionPath
        }),
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        },
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--disable-gpu',
            '--disable-extensions',
            '--no-first-run',
            '--no-default-browser-check',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          ],
          executablePath: process.env.NODE_ENV === 'production' 
            ? (fs.existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : '/usr/bin/chromium-browser') 
            : undefined
        }
      });


      this.client.on('remote_session_saved', () => {
        console.log('[WhatsApp] ✅ Session backed up to Supabase');
      });

      this._setupEvents();
      await this.client.initialize();
      this.isInitializing = false;
      this.reconnectAttempts = 0;
    } catch (err) {
      console.error('[WhatsApp] Init error:', err.message);
      this.status = 'disconnected';
      this.isInitializing = false;
      this._scheduleReconnect();
    }
  }

  async _forceCleanup() {
    if (!this.client) return;
    try {
      if (this.client.pupBrowser) await this.client.pupBrowser.close();
    } catch (e) { }
    try { await this.client.destroy(); } catch (e) { }
    this.client = null;
  }

  _clearLockFiles(sessionPath) {
    try {
      const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
      const dirs = [path.join(sessionPath, 'session', 'Default'), path.join(sessionPath, 'session')];
      for (const dir of dirs) {
        if (fs.existsSync(dir)) {
          for (const f of lockFiles) {
            const fp = path.join(dir, f);
            try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (e) { }
          }
        }
      }
    } catch (e) { }
  }

  _setupEvents() {
    this.client.removeAllListeners();
    this.client.on('qr', async (qr) => {
      this.status = 'qr_pending';
      this.qrCode = await qrcode.toDataURL(qr);
      console.log('[WhatsApp] 📱 QR Code generated. Please scan in the dashboard.');
      this.emit('qr', this.qrCode);
      this.emit('status_change', { status: this.status });
    });

    this.client.on('authenticated', () => {
      console.log('[WhatsApp] 🔐 Authenticated. Loading session...');
      this.status = 'connecting';
      this.emit('status_change', { status: this.status });
    });

    this.client.on('ready', async () => {
      console.log('[WhatsApp] ✅ Client is READY!');
      this.isReady = true;
      this.status = 'ready';
      this.qrCode = null;
      this.reconnectAttempts = 0;

      // Force cache all chats to ensure group IDs are ready
      try {
        console.log('[WhatsApp] 🔄 Syncing chats and groups...');
        await this.client.getChats();
        console.log('[WhatsApp] 🔄 Sync complete.');
      } catch (e) {
        console.warn('[WhatsApp] 🔄 Initial chat sync failed:', e.message);
      }

      this.emit('status_change', { status: this.status });
      this._processQueue();
    });

    this.client.on('auth_failure', (msg) => {
      console.error('[WhatsApp] ❌ Auth failure:', msg);
      this.isReady = false;
      this.status = 'disconnected';
      this.emit('status_change', { status: this.status, error: 'Auth failed' });
    });

    this.client.on('disconnected', async (reason) => {
      console.warn('[WhatsApp] 🔌 Disconnected:', reason);
      this.isReady = false;
      this.status = 'disconnected';
      this.qrCode = null;
      this.isInitializing = false;
      this.client = null;
      this.emit('status_change', { status: this.status });
      this._scheduleReconnect();
    });

    this.client.on('message', async (msg) => {
      // Filter system/broadcast messages, statuses, and groups
      if (msg.fromMe || 
          msg.from === 'status@broadcast' || 
          msg.from.includes('@newsletter') ||
          msg.from.includes('@g.us') || // DO NOT process or log group messages
          msg.isStatus // DO NOT process status replies/updates
      ) return;

      if (this.processedMessages.has(msg.id._serialized)) return;
      if (this._isRateLimited(msg.from)) return;

      if (!this.pendingMessages.has(msg.from)) {
        this.pendingMessages.set(msg.from, { body: msg.body, timestamp: Date.now(), msgObj: msg });
        const isLikelyAdmin = Array.from(this._adminCache || []).some(a => a === msg.from || a === (msg.author || '').split('@')[0]);
        const delay = isLikelyAdmin ? 0 : 1000;

        setTimeout(async () => {
          try {
            const pending = this.pendingMessages.get(msg.from);
            if (!pending) return;
            this.pendingMessages.delete(msg.from);
            await this._handleMessageGroup(pending.msgObj, pending.body);
            // Mark as processed ONLY after successful async work
            this.processedMessages.add(msg.id._serialized);
          } catch (e) {
            console.error('[WhatsApp] Group process error:', e.message);
          }
        }, delay);
      } else {
        const pending = this.pendingMessages.get(msg.from);
        if (msg.type === 'chat') pending.body += "\n" + msg.body;
        pending.timestamp = Date.now();
        if (msg.type === 'image') {
          this.pendingMessages.delete(msg.from);
          this._handleMessageGroup(msg, msg.body)
            .then(() => this.processedMessages.add(msg.id._serialized))
            .catch(e => console.error('[WhatsApp] Image process error:', e.message));
        }
      }
    });

    this.client.on('message_create', async (msg) => { if (msg.fromMe) await this._logMessage(msg, 'outgoing'); });
  }

  async _handleMessageGroup(msg, combinedBody) {
    let senderId = msg.from;
    let actualPhone = senderId.split('@')[0].split(':')[0];
    
    try {
      const contact = await msg.getContact();
      if (contact && contact.number) actualPhone = contact.number.split(':')[0];
    } catch (e) { }

    const nowTs = Date.now();
    // Identify tutor associated with THIS WhatsApp connection
    if (!this._tutorCache || !this._settingsCache || (nowTs - (this._lastCacheUpdate || 0) > 300000)) {
      const myPhone = this.client?.info?.wid?.user || '';
      const myPhoneNormalized = normalizationService.normalizePhone(myPhone);
      
      let tutor;
      if (myPhoneNormalized) {
        tutor = await dbGet('SELECT * FROM tutors WHERE phone = ? OR phone LIKE ?', [myPhone, '%' + myPhoneNormalized.slice(-9)]);
      }
      if (!tutor) tutor = await dbGet("SELECT * FROM tutors ORDER BY role = 'developer' DESC, id ASC LIMIT 1");
      
      if (tutor) {
        const settings = await dbGet('SELECT * FROM settings WHERE tutor_id = ?', [tutor.id]);
        this._tutorCache = tutor;
        this._settingsCache = settings;
        this._lastCacheUpdate = nowTs;
      }
    }

    const tutorId = this._tutorCache?.id || 1;
    const normalizedActual = normalizationService.normalizePhone(actualPhone);
    await this._logMessage(msg, 'incoming', 0, null, null, tutorId);
    const isGroup = msg.from.includes('@g.us');
    this.emit('message', { tutor_id: tutorId, from: senderId, body: combinedBody, isGroup, timestamp: msg.timestamp, type: msg.type, chatId: msg.from, msgId: msg.id._serialized });

    const adminPhones = await this._getAdminPhones(tutorId);
    const isAdmin = adminPhones.has(senderId) || adminPhones.has(normalizedActual) || adminPhones.has(actualPhone);

    // Always log incoming messages to help diagnose silent drops in production
    console.log(`[WhatsApp] Message from ${senderId} (Phone: ${actualPhone}, Norm: ${normalizedActual}), isAdmin: ${isAdmin}, autoReply: ${this._settingsCache?.auto_reply_enabled}`);

    if (isAdmin && !isGroup && msg.type === 'chat') {
      const lowerBody = (combinedBody || '').toLowerCase().trim();
      if (lowerBody === 'adminhelp') { 
        const helpMsg = `🛠️ *ADMIN PANEL COMMANDS*
 
✅ *approve <phone> <month>*
Approve a student's payment and add them to the monthly group.
 
❌ *reject <phone> <month> <reason>*
Reject a student's payment with a specific reason.
_Example: reject 0771234567 May Blurry receipt_
 
📋 *pendinglist*
Show all students waiting for payment approval.
 
ℹ️ *adminhelp*
Show this help message.`;
        await this.sendMessage(senderId, helpMsg); 
        return; 
      }
      if (lowerBody.startsWith('approve ')) {
        const parts = combinedBody.split(/\s+/);
        const phone = parts[1];
        const monthInput = parts[2] || new Date().toLocaleString('en-US', { month: 'long' });
        const month = normalizationService.normalizeMonth(monthInput);
        const year = new Date().getFullYear();
        const variants = [senderId, senderId.replace('@c.us', '@lid'), senderId.replace('@lid', '@c.us')];
        const phoneSuffix = (phone && phone.length >= 9) ? phone.slice(-9) : (phone || '');

        const student = await dbGet(`
          SELECT * FROM students 
          WHERE whatsapp_id IN (?, ?, ?) 
          OR normalized_phone = ? 
          OR phone = ?
        `, [...variants, normalizedActual, phone]);

        if (student) {
          // 0. Auto-assign fee/class if missing or 0
          if (!student.monthly_fee || student.monthly_fee === 0) {
            const matchedClass = await dbGet('SELECT id, fee FROM classes WHERE tutor_id = ? AND grade = ? AND is_active = 1 LIMIT 1', [student.tutor_id, student.grade]);
            if (matchedClass) {
              await dbRun('UPDATE students SET monthly_fee = ? WHERE id = ?', [matchedClass.fee, student.id]);
              student.monthly_fee = matchedClass.fee;
              await dbRun('INSERT INTO student_classes (student_id, class_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [student.id, matchedClass.id]);
            }
          }

          await dbRun("UPDATE students SET status = 'active' WHERE id = ?", [student.id]);
          const existingPayment = await dbGet('SELECT id, tutor_id, amount, month, year FROM payments WHERE student_id = ? AND month = ? AND year = ?', [student.id, month, year]);
          let payId;
          if (existingPayment) {
            await dbRun("UPDATE payments SET status = 'paid', paid_date = CURRENT_TIMESTAMP WHERE id = ?", [existingPayment.id]);
            payId = existingPayment.id;
          } else {
            const res = await dbRun("INSERT INTO payments (tutor_id, student_id, amount, month, year, status, paid_date) VALUES (?,?,?,?,?,?, CURRENT_TIMESTAMP) RETURNING id",
              [student.tutor_id, student.id, student.monthly_fee || 0, month, year, 'paid']);
            payId = res.lastInsertRowid;
          }

          const deliveryExists = await dbGet('SELECT id FROM tute_deliveries WHERE student_id = ? AND month = ? AND year = ?', [student.id, month, year]);
          if (!deliveryExists) {
            await dbRun('INSERT INTO tute_deliveries (tutor_id, student_id, payment_id, month, year, status) VALUES (?,?,?,?,?,?)', [student.tutor_id, student.id, payId, month, year, 'pending']);
            this.emit('db_update', { tutor_id: tutorId, table: 'tute_deliveries', action: 'new_delivery', name: student.name });
          }

          await this.syncStudentToMonthlyGroup(student.id, month, year);
          await this.sendMessage(senderId, `✅ Approved student: ${student.name} for ${month}.`);
          const target = student.whatsapp_id && student.whatsapp_id.includes('@') ? student.whatsapp_id : student.phone;
          await this.sendToPhone(target, `Your registration for ${month} has been approved. Welcome to the class! ✅`);
        } else await this.sendMessage(senderId, `❌ Student not found with ID/Phone: ${phone}`);
        return;
      }
      if (lowerBody.startsWith('reject ')) {
        const parts = combinedBody.split(/\s+/);
        if (parts.length < 3) {
          await this.sendMessage(senderId, "❌ Usage: *reject <phone> <month> [reason]*");
          return;
        }
        const phone = parts[1];
        const monthInput = parts[2];
        const reason = parts.slice(3).join(' ') || "Payment could not be verified.";
        
        const month = normalizationService.normalizeMonth(monthInput);
        const year = new Date().getFullYear();
        
        const phoneSuffix = (phone && phone.length >= 9) ? phone.slice(-9) : (phone || '');
        const student = await dbGet(`SELECT id, name, whatsapp_id, phone FROM students WHERE normalized_phone = ? OR whatsapp_id LIKE ?`, [normalizedActual, '%' + phone]);

        if (student) {
          await dbRun("UPDATE payments SET status = 'unpaid', notes = ? WHERE student_id = ? AND month = ? AND year = ?", [reason, student.id, month, year]);
          await this.sendMessage(senderId, `❌ Rejected payment for ${student.name} (${month}). Reason: ${reason}`);
          const target = student.whatsapp_id && student.whatsapp_id.includes('@') ? student.whatsapp_id : student.phone;
          await this.sendToPhone(target, `⚠️ Your payment for ${month} was rejected.\n\n*Reason:* ${reason}\n\nPlease re-upload a clear receipt or contact the admin.`);
        } else await this.sendMessage(senderId, `❌ Student not found.`);
        return;
      }

      if (lowerBody === 'pendinglist') {
        const currentMonth = normalizationService.normalizeMonth();
        const currentYear = new Date().getFullYear();
        const pending = await dbAll(`
          SELECT s.name, s.phone, p.month 
          FROM payments p
          JOIN students s ON p.student_id = s.id
          WHERE p.status = 'pending' AND p.month = ? AND p.year = ?
        `, [currentMonth, currentYear]);

        if (pending.length === 0) {
          await this.sendMessage(senderId, `✅ No pending approvals for ${currentMonth}.`);
        } else {
          let txt = `📋 *PENDING APPROVALS (${currentMonth})*\n\n`;
          pending.forEach((p, i) => {
            txt += `${i+1}. *${p.name}*\n📱 ${p.phone}\n\n`;
          });
          txt += `To approve: *approve <phone> ${currentMonth}*`;
          await this.sendMessage(senderId, txt);
        }
        return;
      }
    }

    if (!isGroup) {
      if (isAdmin) return;
      if (!this._settingsCache?.auto_reply_enabled) return;

      if (msg.type === 'chat' && (combinedBody || '').trim().length > 0) {
        const chat = await msg.getChat(); 
        chat.sendStateTyping().catch(e => console.warn('[WhatsApp] Typing error:', e.message)); // Non-blocking
        
        const aiResponse = await aiService.processMessage(combinedBody, senderId, tutorId);
        if (aiResponse && aiResponse.text) {
          await this.sendMessage(senderId, aiResponse.text, 1, aiResponse.intent);
          if (aiResponse.command === 'REGISTER_STUDENT' && aiResponse.data) {
            await this._handleRegistration(aiResponse.data, senderId, actualPhone);
          } else if (aiResponse.command === 'ESCALATE' || aiResponse.intent === 'COMPLAIN') {
            const cleanPhone = actualPhone.replace(/\D/g, '');
            const suffix = (cleanPhone && cleanPhone.length >= 9) ? cleanPhone.slice(-9) : (cleanPhone || '');
            const student = await dbGet('SELECT name, grade FROM students WHERE whatsapp_id = ? OR phone LIKE ?', [senderId, `%${suffix}`]);
            const displayName = student?.name ? `${student.name} (Grade ${student.grade})` : actualPhone;
            await this.notifyAdmin(`⚠️ *Alert from Chat*\n👤 *From:* ${displayName}\n💬 *Message:* "${combinedBody}"\nPlease check the chat!`);
          } else if (aiResponse.command === 'CONFIRM_DELIVERY') {
             try {
                // Smart Lookup: Try WhatsApp ID, then Normalized Phone
                let student = await dbGet('SELECT id, name FROM students WHERE whatsapp_id = ?', [senderId]);
                
                if (!student) {
                  const cleanPhone = actualPhone.replace(/\D/g, '');
                  const suffix = (cleanPhone && cleanPhone.length >= 9) ? cleanPhone.slice(-9) : (cleanPhone || '');
                  student = await dbGet('SELECT id, name FROM students WHERE phone LIKE ? OR phone LIKE ?', [`%${suffix}`, `%${cleanPhone}`]);
                }

                if (student) {
                  const delivery = await dbGet("SELECT id FROM tute_deliveries WHERE student_id = ? AND status != 'delivered' ORDER BY created_at DESC LIMIT 1", [student.id]);
                  if (delivery) {
                    await dbRun("UPDATE tute_deliveries SET status = 'delivered', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [delivery.id]);
                    console.log(`✅ Tute delivered for ${student.name}`);
                    this.emit('db_update', { tutor_id: tutorId, table: 'tute_deliveries', action: 'delivered', name: student.name });
                  } else {
                    console.warn(`[WhatsApp] No pending delivery found for ${student.name}`);
                  }
                } else {
                  console.warn(`[WhatsApp] Could not identify student for delivery confirm: ${actualPhone}`);
                }
              } catch (e) {
                console.error('[WhatsApp] Delivery Confirm Error:', e.message);
              }
          }
        }
      } else if (msg.type === 'image') {
        await this._handleReceipt(msg, senderId, actualPhone);
      }
    }
  }

  async _handleReceipt(msg, senderId, actualPhone) {
    try {
      const media = await msg.downloadMedia();
      if (!media) return;
      const filename = `receipt_${Date.now()}_${actualPhone}.${media.mimetype.split('/')[1]}`;
      const { error } = await supabase.storage.from('receipts').upload(filename, Buffer.from(media.data, 'base64'), { contentType: media.mimetype, upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filename);
      await this._logMessage(msg, 'incoming', 0, publicUrl);

      const phoneOnly = actualPhone.split('@')[0];
      const normalizedActual = normalizationService.normalizePhone(phoneOnly);
      const phoneSuffix = (phoneOnly && phoneOnly.length >= 9) ? phoneOnly.slice(-9) : (phoneOnly || '');
      const variants = [senderId, senderId.replace('@c.us', '@lid'), senderId.replace('@lid', '@c.us')];
      
      let student = await dbGet(`
        SELECT id FROM students 
        WHERE whatsapp_id IN (?, ?, ?) 
        OR normalized_phone = ?
      `, [...variants, normalizedActual]);

      if (!student) {
        const res = await dbRun('INSERT INTO students (tutor_id, whatsapp_id, status, normalized_phone, phone, notes) VALUES (?, ?, ?, ?, ?, ?)', 
          [1, senderId, 'lead', normalizedActual, actualPhone, 'Uploaded receipt before registration']);
        student = { id: res.lastInsertRowid };
      }

      const currentMonth = normalizationService.normalizeMonth();
      const currentYear = new Date().getFullYear();
      let payment = await dbGet('SELECT id, receipt_url FROM payments WHERE student_id = ? AND month = ? AND year = ?', [student.id, currentMonth, currentYear]);
      if (payment) {
        const updatedUrls = payment.receipt_url ? `${payment.receipt_url},${publicUrl}` : publicUrl;
        await dbRun("UPDATE payments SET receipt_url = ?, status = 'pending' WHERE id = ?", [updatedUrls, payment.id]);
      } else {
        await dbRun("INSERT INTO payments (tutor_id, student_id, amount, month, year, status, receipt_url) VALUES (?, ?, ?, ?, ?, 'pending', ?)", [1, student.id, 0, currentMonth, currentYear, publicUrl]);
      }

      const studentInfo = await dbGet('SELECT name, phone FROM students WHERE id = ?', [student.id]);
      
      // Fixed: Send a warm acknowledgment message
      const ackMessage = "Hari 😊 Receipt එක ලැබුණා. Admin ඒක check කරලා ඉක්මනටම ඔයාව group එකට add කරයි. පැය 24ක් ඇතුළත ඔයාට confirmation message එකක් ලැබෙයි. 👍";

      if (studentInfo.name) {
        await this.notifyAdmin(`📸 *Payment Receipt Received*\n👤 *Student:* ${studentInfo.name}\n📱 *Phone:* ${studentInfo.phone}\n📅 *Month:* ${currentMonth}\n🔗 *Receipt:* ${publicUrl}\n\nTo approve, type: *approve ${studentInfo.phone} ${currentMonth}*`, media);
        await this.sendMessage(senderId, ackMessage);
      } else {
        await this.notifyAdmin(`📸 *Receipt from Unknown Student*\n📱 From: ${actualPhone}\n🔗 Link: ${publicUrl}`, media);
        const unknownSOP = "ඔයාගේ receipt එක ලැබුණා 😊 හැබැයි ඔයා තාම register වෙලා නැහැ වගේ. කරුණාකරලා ඔයාගේ විස්තර ටික එවන්න. (Name, Grade, School, Phone, Address සහ join වෙන Month එක)";
        await this.sendMessage(senderId, unknownSOP);
      }
      this.emit('db_update', { tutor_id: this._tutorCache?.id || 1, table: 'payments', action: 'receipt_received', student_id: student.id });
    } catch (e) { console.error('[WhatsApp] Receipt Error:', e.message); }
  }

  async _handleRegistration(data, senderId, actualPhone) {
    const name = data.name || 'Unknown';
    const grade = data.grade || 'N/A';
    const school = data.school || 'N/A';
    const month = normalizationService.normalizeMonth(data.month);
    const year = new Date().getFullYear();

    try {
      const tutor = await dbGet("SELECT id FROM tutors ORDER BY role = 'developer' DESC, id ASC LIMIT 1");
      const tutorId = tutor?.id || 1;
      const settings = await dbGet('SELECT basic_fee FROM settings WHERE tutor_id = ?', [tutorId]);
      const normalizedGrade = normalizationService.normalizeGrade(grade);
      const studentPhone = data.contact || data.phone || actualPhone;
      const formattedPhone = normalizationService.normalizePhone(studentPhone);
      if (!formattedPhone) {
        throw new Error('Invalid phone number provided');
      }
      const phoneSuffix = formattedPhone.length >= 9 ? formattedPhone.slice(-9) : formattedPhone;

      const variants = [senderId, senderId.replace('@c.us', '@lid'), senderId.replace('@lid', '@c.us')];

      const studentByWa = await dbGet(`SELECT * FROM students WHERE whatsapp_id IN (?, ?, ?)`, variants);
      const studentByPhone = await dbGet(`SELECT * FROM students WHERE normalized_phone = ?`, [formattedPhone]);

      let student = studentByPhone || studentByWa;
      let studentId = student?.id;

      if (studentByWa && studentByPhone && studentByWa.id !== studentByPhone.id) {
        const leadId = studentByWa.id;
        const mainId = studentByPhone.id;
        const leadPayments = await dbAll('SELECT id, month, year, receipt_url FROM payments WHERE student_id = ?', [leadId]);
        for (const lp of leadPayments) {
          const mainPayment = await dbGet('SELECT id, receipt_url FROM payments WHERE student_id = ? AND month = ? AND year = ?', [mainId, lp.month, lp.year]);
          if (mainPayment) {
            const newUrl = mainPayment.receipt_url ? (lp.receipt_url ? `${mainPayment.receipt_url},${lp.receipt_url}` : mainPayment.receipt_url) : lp.receipt_url;
            await dbRun("UPDATE payments SET receipt_url = ?, status = 'pending' WHERE id = ?", [newUrl, mainPayment.id]);
            await dbRun("DELETE FROM payments WHERE id = ?", [lp.id]);
          } else {
            await dbRun("UPDATE payments SET student_id = ? WHERE id = ?", [mainId, lp.id]);
          }
        }
        await dbRun('UPDATE message_logs SET student_id = ? WHERE student_id = ?', [mainId, leadId]);
        await dbRun('DELETE FROM students WHERE id = ?', [leadId]);
        student = studentByPhone; studentId = mainId;
      }

      if (studentId) {
        const finalName = (name && name !== 'Unknown') ? name : student.name;
        const finalGrade = (normalizedGrade && normalizedGrade !== 'N/A') ? normalizedGrade : student.grade;
        await dbRun('UPDATE students SET name=?, phone=?, normalized_phone=?, grade=?, school=?, address=?, whatsapp_id=? WHERE id=?',
          [finalName, formattedPhone, formattedPhone, finalGrade, school||student.school, data.address||student.address, senderId, studentId]);
      } else {
        const result = await dbRun(`INSERT INTO students (tutor_id, name, phone, normalized_phone, grade, school, address, whatsapp_id, status, monthly_fee) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id`, [tutorId, name, formattedPhone, formattedPhone, normalizedGrade, school, data.address || '', senderId, 'inactive', settings?.basic_fee || 0]);
        student = { id: result.lastInsertRowid };
      }

      const sid = studentId || student.id;
      
      // Auto-assign Class and Fee based on Grade
      if (sid && normalizedGrade && normalizedGrade !== 'N/A') {
        const matchedClass = await dbGet('SELECT id, fee FROM classes WHERE tutor_id = ? AND grade = ? AND is_active = 1 LIMIT 1', [tutorId, normalizedGrade]);
        if (matchedClass) {
          // 1. Update student fee
          await dbRun('UPDATE students SET monthly_fee = ? WHERE id = ?', [matchedClass.fee || settings?.basic_fee || 0, sid]);
          // VALIDATION: Ensure class belongs to correct grade
          if (matchedClass.grade === normalizedGrade) {
            await dbRun('INSERT INTO student_classes (student_id, class_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [sid, matchedClass.id]);
          }
        }
      }

      if (sid) {
        // Dynamic Fee Calculation
        const student = await dbGet('SELECT grade FROM students WHERE id = ?', [sid]);
        const gradeNum = parseInt(student?.grade);
        let dynamicFee = settings?.basic_fee || 1500;
        
        if (gradeNum >= 6 && gradeNum <= 9) dynamicFee = 1200;
        else if (gradeNum >= 10 && gradeNum <= 11) dynamicFee = 1500;

        const existingPayment = await dbGet('SELECT id FROM payments WHERE student_id = ? AND month = ? AND year = ?', [sid, month, year]);
        if (!existingPayment) {
          await dbRun('INSERT INTO payments (tutor_id, student_id, amount, month, year, status) VALUES (?,?,?,?,?,?)', [tutorId, sid, dynamicFee, month, year, 'unpaid']);
        }
        this.emit('db_update', { tutor_id: tutorId, table: 'students', action: studentId ? 'update_enrollment' : 'new_enrollment', name });
      }
    } catch (e) { console.error('[WhatsApp] Registration Error:', e.message); }
  }

  async _logMessage(msg, direction, isAi = 0, mediaUrl = null, intent = null) {
    try {
      const chatId = direction === 'incoming' ? msg.from : msg.to;
      const student = await dbGet('SELECT id, tutor_id FROM students WHERE whatsapp_id = ?', [chatId]);
      await dbRun('INSERT INTO message_logs (tutor_id, student_id, direction, message_type, content, whatsapp_chat_id, whatsapp_msg_id, is_group, is_ai, detected_intent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (whatsapp_msg_id) DO NOTHING', [student?.tutor_id || 1, student?.id || null, direction, msg.type === 'chat' ? 'text' : msg.type, mediaUrl || msg.body || '', chatId, msg.id?._serialized || null, chatId.includes('@g.us') ? 1 : 0, isAi, intent]);
    } catch (err) { }
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts++), 60000);
    this.reconnectTimeout = setTimeout(() => {
      this.initialize().catch(err => console.error('[WhatsApp] Reconnect failed:', err.message));
    }, delay);
  }

  async sendMessage(chatId, message, isAi = 0, intent = null) {
    if (!this.isReady) return;
    const target = this._normalizePhone(chatId);
    if (!target) return;
    try {
      this.messageQueue.push({ chatId: target, message });
      if (!this.isProcessingQueue) this._processQueue();
      return { success: true, queued: true };
    } catch (e) {
      console.error('[WhatsApp] sendMessage error:', e.message);
      return { success: false, error: e.message };
    }
  }

  async sendMedia(chatId, url, caption = '') {
    if (!this.isReady) return;
    const target = this._normalizePhone(chatId);
    if (!target) return;
    try {
      const media = await MessageMedia.fromUrl(url);
      this.messageQueue.push({ chatId: target, message: media, options: { caption }, mediaUrl: url });
      if (!this.isProcessingQueue) this._processQueue();
      return { success: true, queued: true };
    } catch (e) {
      console.error('[WhatsApp] sendMedia error:', e.message);
      // Fallback to text message if media fails
      return this.sendMessage(target, `${caption}\n\n(Photo: ${url})`);
    }
  }

  async sendToPhone(phone, message) { return this.sendMessage(this._normalizePhone(phone), message); }

  async syncStudentToMonthlyGroup(studentId, month, year) {
    try {
      const student = await dbGet('SELECT * FROM students WHERE id = ?', [studentId]);
      if (!student || student.status !== 'active') return false;
      
      // CRITICAL: @lid IDs cannot be used to add participants to groups.
      // They are WhatsApp internal privacy IDs. We MUST use the @c.us format derived from the real phone number.
      // Only use whatsapp_id if it's already in @c.us format.
      let participantId = null;
      if (student.whatsapp_id && student.whatsapp_id.includes('@c.us')) {
        participantId = student.whatsapp_id;
      } else if (student.phone) {
        participantId = this._normalizePhone(student.phone);
      } else if (student.whatsapp_id && student.whatsapp_id.includes('@lid')) {
        // Last resort: extract the number portion and try as @c.us
        // This may not work but is better than nothing
        const numPart = student.whatsapp_id.split('@')[0];
        // Only use if it looks like a real phone number (under 15 digits)
        if (numPart.length <= 15) participantId = numPart + '@c.us';
      }

      if (!participantId) {
        console.error(`[WhatsApp] Cannot add student ${studentId} to group: no valid phone/ID found. whatsapp_id=${student.whatsapp_id}, phone=${student.phone}`);
        return false;
      }

      const dbGroup = await dbGet(`SELECT whatsapp_group_id FROM whatsapp_groups WHERE (grade = ?) AND (month IS NULL OR month = ?) LIMIT 1`, [student.grade, month]);
      if (dbGroup?.whatsapp_group_id) {
          console.log(`[WhatsApp] Adding ${participantId} (from phone: ${student.phone}) to group for Grade ${student.grade}`);
          await this.addParticipantToGroup(dbGroup.whatsapp_group_id, participantId);
      } else {
          console.warn(`[WhatsApp] No group found for Grade ${student.grade}, Month ${month}`);
      }
      return true;
    } catch (err) { 
      console.error('[WhatsApp] Group Sync Error:', err.message);
      return false; 
    }
  }

  async createGroup(name, participants = []) {
    if (!this.isReady) return { success: false, error: 'WhatsApp not ready' };
    try {
      // Get Tutor's phone to add them as admin
      const tutor = await dbGet("SELECT phone FROM tutors ORDER BY role = 'developer' DESC, id ASC LIMIT 1");
      let finalParticipants = [...participants];
      if (tutor?.phone) {
          const tutorId = this._normalizePhone(tutor.phone);
          if (!finalParticipants.includes(tutorId)) finalParticipants.push(tutorId);
      }

      console.log(`[WhatsApp] Creating group: ${name}`);
      const result = await this.client.createGroup(name, finalParticipants);
      
      // ULTRA-SAFE ID EXTRACTION: Handle different wwebjs versions
      let groupId = null;
      if (typeof result === 'string') groupId = result;
      else if (result?.gid?._serialized) groupId = result.gid._serialized;
      else if (result?.id?._serialized) groupId = result.id._serialized;
      else if (result?.gid) groupId = result.gid;
      else if (result?.id) groupId = result.id;
      
      if (!groupId) throw new Error('Could not extract Group ID from WhatsApp response');

      // Promote the tutor to admin
      if (tutor?.phone) {
          // WAIT 3 SECONDS for server sync before promoting
          await new Promise(r => setTimeout(r, 3000));
          try {
            const chat = await this.client.getChatById(groupId);
            const tutorId = this._normalizePhone(tutor.phone);
            await chat.promoteParticipants([tutorId]);
            console.log(`[WhatsApp] Promoted tutor ${tutorId} to admin in ${name}`);
          } catch (err) { 
            console.warn('[WhatsApp] Could not promote tutor immediately, retrying in 2s...', err.message); 
            await new Promise(r => setTimeout(r, 2000));
            try {
               const chat = await this.client.getChatById(groupId);
               const tutorId = this._normalizePhone(tutor.phone);
               await chat.promoteParticipants([tutorId]);
               console.log(`[WhatsApp] ✅ Promotion retry successful.`);
            } catch (retryErr) { console.error('[WhatsApp] ❌ Promotion retry failed:', retryErr.message); }
          }
      }

      console.log(`[WhatsApp] Group created successfully: ${groupId}`);
      return { success: true, gid: groupId };
    } catch (e) {
      console.error('[WhatsApp] createGroup error:', e.message);
      return { success: false, error: e.message };
    }
  }

  async addParticipantToGroup(groupId, participantId) {
    if (!this.isReady) return;
    try {
      console.log(`[WhatsApp] Attempting to add ${participantId} to group ${groupId}...`);
      const chat = await this.client.getChatById(groupId);
      
      if (!chat.isGroup) {
          console.error(`[WhatsApp] ID ${groupId} is NOT a group.`);
          return;
      }

      // Pre-check: Is the bot an admin?
      const participant = chat.participants.find(p => p.id._serialized === this.client.info.wid._serialized);
      if (!participant || (!participant.isAdmin && !participant.isSuperAdmin)) {
          console.error(`[WhatsApp] 🛑 BOT IS NOT ADMIN in group ${chat.name}. Please make the bot an admin.`);
          await this.notifyAdmin(`⚠️ *Group Sync Failed*\nI am not an admin in *${chat.name}*. Please make me an admin to add students automatically.`);
          return;
      }

      // Pre-check: Is student already in the group?
      const alreadyIn = chat.participants.find(p => p.id._serialized === participantId || p.id.user === participantId.split('@')[0]);
      if (alreadyIn) {
          console.log(`[WhatsApp] ℹ️ ${participantId} is already in group ${chat.name}`);
          await this.notifyAdmin(`ℹ️ *Already in Group*\n\n*${participantId.split('@')[0]}* is already a member of *${chat.name}*. No action needed.`);
          return;
      }

      await chat.addParticipants([participantId]);
      console.log(`[WhatsApp] ✅ Successfully added ${participantId} to group ${chat.name}`);
    } catch (e) {
      console.error(`[WhatsApp] ❌ Direct add failed for ${participantId}:`, e.message);
      // If it's a specific error like 'not-authorized', notify admin
      if (e.message.includes('not-authorized') || e.message.includes('403')) {
          await this.notifyAdmin(`⚠️ *Add Failed*\nCould not add student to group. They might have privacy blocks.`);
      }
    }
  }

  async notifyAdmin(message, media = null) {
    const tutor = await dbGet("SELECT phone FROM tutors ORDER BY role = 'developer' DESC, id ASC LIMIT 1");
    if (!tutor?.phone) return;
    const target = this._normalizePhone(tutor.phone);
    try { if (media) await this.client.sendMessage(target, media, { caption: message }); else await this.client.sendMessage(target, message); } catch (e) { }
  }

  _normalizePhone(phone) {
    if (!phone) return null;
    if (phone.includes('@')) return phone;
    let c = phone.replace(/[^0-9]/g, '');
    if (c.startsWith('0')) c = '94' + c.substring(1);
    return c + '@c.us';
  }

  getStatus() { return { status: this.status, isReady: this.isReady }; }

  _isRateLimited(from) {
    const now = Date.now();
    const bucket = this.inboundRateBuckets.get(from);
    if (!bucket || now - bucket.windowStart > 60000) { this.inboundRateBuckets.set(from, { count: 1, windowStart: now }); return false; }
    return (++bucket.count) > 20;
  }

    async _processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;
    while (this.messageQueue.length > 0) {
      const { chatId, message, options, mediaUrl } = this.messageQueue.shift();
      try { 
        const sent = await this.client.sendMessage(chatId, message, options || {}); 
        await this._logMessage(sent, 'outgoing', 0, mediaUrl || null);
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000)); 
      } catch (e) {
        console.error('[WhatsApp] Queue send error:', e.message);
      }
    }
    this.isProcessingQueue = false;
  }

  async _getAdminPhones(tutorId) {
    const now = Date.now();
    const cacheKey = tutorId;
    if (this._adminCache.has(cacheKey) && (now - (this._lastAdminUpdate.get(cacheKey) || 0) < 300000)) {
      return this._adminCache.get(cacheKey);
    }

    try {
      const admins = await dbAll('SELECT phone FROM tutors WHERE id = ? UNION SELECT phone FROM tutor_admins WHERE tutor_id = ?', [tutorId, tutorId]);
      const adminSet = new Set();
      
      admins.forEach(a => {
        if (!a.phone) return;
        
        const waId = this._normalizePhone(a.phone); 
        if (waId) {
          adminSet.add(waId);
          adminSet.add(waId.replace('@c.us', '@lid'));
        }
        
        const local = normalizationService.normalizePhone(a.phone); 
        if (local) adminSet.add(local);
        
        const numeric = a.phone.replace(/[^0-9]/g, '');
        if (numeric.length >= 9) adminSet.add(numeric);
      });
      
      this._adminCache.set(cacheKey, adminSet);
      this._lastAdminUpdate.set(cacheKey, now);
      return adminSet;
    } catch (e) {
      console.error('[WhatsApp] Admin phones fetch error:', e.message);
      return this._adminCache.get(cacheKey) || new Set();
    }
  }

  async getGroupChats() {
    if (!this.isReady) return [];
    try {
      const chats = await this.client.getChats();
      return chats.filter(chat => chat.isGroup);
    } catch (e) {
      console.error('[WhatsApp] Get groups error:', e.message);
      return [];
    }
  }

  async getAdminGroups() {
    if (!this.isReady) return [];
    try {
      const groups = await this.getGroupChats();
      const adminGroups = [];
      for (const group of groups) {
        const me = group.participants.find(p => p.id._serialized === this.client.info.wid._serialized);
        if (me && (me.isAdmin || me.isSuperAdmin)) {
          adminGroups.push({ id: group.id._serialized, name: group.name });
        }
      }
      return adminGroups;
    } catch (e) { return []; }
  }

  async broadcastMessage(chatIds, message) {
    if (!this.isReady) return [];
    const results = [];
    for (const chatId of chatIds) {
      try {
        const res = await this.sendMessage(chatId, message);
        results.push({ chatId, success: true, ...res });
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        results.push({ chatId, success: false, error: e.message });
      }
    }
    return results;
  }

  async logout() {
    if (this.client) {
      try {
        await this.client.logout();
        await this.destroy();
      } catch (e) {
        await this.destroy();
      }
    }
  }

  async destroy() {
    if (this.reconnectTimeout) { clearTimeout(this.reconnectTimeout); this.reconnectTimeout = null; }
    await this._forceCleanup();
    this.isReady = false; this.isInitializing = false; this.status = 'disconnected'; this.emit('status_change', { status: 'disconnected' });
  }
}

module.exports = new WhatsAppService();