const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { dbRun, dbGet } = require('../db/connection');
const EventEmitter = require('events');

class WhatsAppService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isReady = false;
    this.qrCode = null;
    this.status = 'disconnected';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.messageQueue = [];
    this.isProcessingQueue = false;
  }

  async initialize() {
    console.log('[WhatsApp] Initializing...');
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: process.env.WA_SESSION_PATH || './.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-accelerated-2d-canvas','--no-first-run','--disable-gpu','--single-process','--no-zygote']
      }
    });
    this._setupEvents();
    try { await this.client.initialize(); }
    catch (err) { console.error('[WhatsApp] Init error:', err.message); this.status = 'disconnected'; this.emit('status_change', { status: this.status, error: err.message }); this._scheduleReconnect(); }
  }

  _setupEvents() {
    this.client.on('qr', async (qr) => { this.status = 'qr_pending'; this.qrCode = await qrcode.toDataURL(qr); this.emit('qr', this.qrCode); this.emit('status_change', { status: this.status }); });
    this.client.on('ready', () => { console.log('[WhatsApp] ✅ Ready'); this.isReady = true; this.status = 'ready'; this.qrCode = null; this.reconnectAttempts = 0; this.emit('status_change', { status: this.status }); this._processQueue(); });
    this.client.on('authenticated', () => { this.status = 'connecting'; this.emit('status_change', { status: this.status }); });
    this.client.on('auth_failure', (msg) => { console.error('[WhatsApp] Auth fail:', msg); this.isReady = false; this.status = 'disconnected'; this.emit('status_change', { status: this.status, error: 'Auth failed' }); });
    this.client.on('disconnected', (reason) => { console.log('[WhatsApp] Disconnected:', reason); this.isReady = false; this.status = 'disconnected'; this.emit('status_change', { status: this.status }); this._scheduleReconnect(); });
    this.client.on('message', async (msg) => {
      if (msg.fromMe) return;
      this._logMessage(msg, 'incoming');
      const isGroup = msg.from.includes('@g.us');
      this.emit('message', { from: msg.from, body: msg.body, isGroup, timestamp: msg.timestamp, type: msg.type, chatId: msg.from, msgId: msg.id._serialized });

      // Auto-reply for individual messages (not groups)
      if (!isGroup) {
        try {
          const settings = dbGet('SELECT auto_reply_enabled, auto_reply_message FROM settings LIMIT 1');
          if (settings && settings.auto_reply_enabled) {
            const replyText = settings.auto_reply_message || 'Thank you for your message. Sir will reply soon. 🙏';
            console.log(`[WhatsApp] Auto-replying to ${msg.from}`);
            await this.client.sendMessage(msg.from, replyText);
          }
        } catch (err) {
          console.error('[WhatsApp] Auto-reply error:', err.message);
        }
      }
    });
    this.client.on('message_create', (msg) => { if (msg.fromMe) this._logMessage(msg, 'outgoing'); });
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60000);
    this.reconnectAttempts++;
    console.log(`[WhatsApp] Reconnect in ${delay/1000}s (attempt ${this.reconnectAttempts})`);
    setTimeout(async () => { try { await this.client.destroy(); } catch(e) {} this.initialize(); }, delay);
  }

  _logMessage(msg, direction) {
    try {
      const chatId = direction === 'incoming' ? msg.from : msg.to;
      const student = dbGet('SELECT id, tutor_id FROM students WHERE whatsapp_id = ?', [chatId]);
      dbRun('INSERT OR IGNORE INTO message_logs (tutor_id,student_id,direction,message_type,content,whatsapp_chat_id,whatsapp_msg_id,is_group) VALUES (?,?,?,?,?,?,?,?)',
        [student?.tutor_id || 1, student?.id || null, direction, msg.type === 'chat' ? 'text' : msg.type, msg.body || '', chatId, msg.id?._serialized || null, chatId.includes('@g.us') ? 1 : 0]);
    } catch (err) { console.error('[WhatsApp] Log error:', err.message); }
  }

  async sendMessage(chatId, message) {
    if (!this.isReady) { this.messageQueue.push({ chatId, message }); throw new Error('WhatsApp not connected'); }
    try { const sent = await this.client.sendMessage(chatId, message); return { success: true, msgId: sent.id._serialized }; }
    catch (err) { throw err; }
  }

  async sendToPhone(phone, message) { return this.sendMessage(this._normalizePhone(phone), message); }

  async broadcastMessage(chatIds, message, delayMs = 2000) {
    const results = [];
    for (const chatId of chatIds) {
      try { results.push({ chatId, ...(await this.sendMessage(chatId, message)) }); }
      catch (err) { results.push({ chatId, success: false, error: err.message }); }
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }
    return results;
  }

  async getChats() { return this.isReady ? await this.client.getChats() : []; }
  async getGroupChats() { if (!this.isReady) return []; const chats = await this.client.getChats(); return chats.filter(c => c.isGroup); }

  getStatus() { return { status: this.status, isReady: this.isReady, qrCode: this.qrCode, queueLength: this.messageQueue.length, reconnectAttempts: this.reconnectAttempts }; }

  async _processQueue() {
    if (this.isProcessingQueue || !this.isReady) return;
    this.isProcessingQueue = true;
    while (this.messageQueue.length > 0) {
      const { chatId, message } = this.messageQueue.shift();
      try { await this.sendMessage(chatId, message); await new Promise(r => setTimeout(r, 1500)); } catch(e) {}
    }
    this.isProcessingQueue = false;
  }

  _normalizePhone(phone) {
    let c = phone.replace(/[^0-9]/g, '');
    if (c.startsWith('0')) c = '94' + c.substring(1);
    if (!c.startsWith('94')) c = '94' + c;
    return c + '@c.us';
  }

  async destroy() { if (this.client) { try { await this.client.destroy(); } catch(e) {} } this.isReady = false; this.status = 'disconnected'; }
}

module.exports = new WhatsAppService();
