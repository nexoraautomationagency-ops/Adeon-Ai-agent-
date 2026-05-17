const express = require('express');
const { dbRun, dbGet, dbAll, supabase } = require('../db/connection');
const normalizationService = require('../services/normalization');
const whatsappService = require('../services/whatsapp');
const router = express.Router();

// Get all tute deliveries
router.get('/', async (req, res) => {
  try {
    const { month: monthInput, year, status, grade } = req.query;
    
    // If month is 'all', we skip the month/year filter
    const isAll = !monthInput || monthInput === 'all';
    const month = !isAll ? normalizationService.normalizeMonth(monthInput) : null;
    const currentYear = year || new Date().getFullYear();

    console.log(`[Tutes API] Fetching for Tutor: ${req.tutor.id}, Month: ${month || 'ALL'}, Grade: ${grade || 'ALL'}`);

    let where = 'WHERE td.tutor_id = ?';
    const params = [req.tutor.id];

    if (!isAll) {
      where += ' AND td.month = ? AND td.year = ?';
      params.push(month, parseInt(currentYear));
    }

    if (status && status !== 'all') {
      where += ' AND td.status = ?';
      params.push(status);
    }

    if (grade && grade !== 'all') {
      where += ' AND s.grade = ?';
      params.push(grade);
    }

    const query = `
      SELECT td.*, s.name as student_name, s.phone as student_phone, s.grade as student_grade, s.address as student_address,
      (SELECT string_agg(c.subject || ' (' || c.grade || ')', ', ') 
       FROM student_classes sc 
       JOIN classes c ON sc.class_id = c.id 
       WHERE sc.student_id = s.id) as student_classes_list
      FROM tute_deliveries td
      JOIN students s ON s.id = td.student_id
      ${where}
      ORDER BY td.created_at DESC
    `;

    const deliveries = await dbAll(query, params);
    console.log(`[Tutes API] Found ${deliveries.length} records`);

    res.json({ deliveries, month: month || 'All', year: currentYear });
  } catch (err) {
    console.error('[Tutes API Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update delivery status/tracking
router.patch('/:id', async (req, res) => {
  let { status, tracking_code, photo_url, courier_name } = req.body;
  const delivery = await dbGet('SELECT * FROM tute_deliveries WHERE id = ? AND tutor_id = ?', [req.params.id, req.tutor.id]);
  
  if (!delivery) return res.status(404).json({ error: 'Delivery record not found' });

  // Fix Bug 22: Base64 "Buffer Bomb" protection
  if (photo_url && photo_url.startsWith('data:')) {
    if (photo_url.length > 5 * 1024 * 1024) { // 5MB limit for Base64 string
      return res.status(400).json({ error: 'Photo is too large. Max 5MB.' });
    }
    try {
      const [header, content] = photo_url.split(',');
      const mime = header.match(/:(.*?);/)[1];
      
      // Strict MIME validation
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
        return res.status(400).json({ error: 'Invalid file type. Only JPG, PNG and WEBP allowed.' });
      }

      const ext = mime.split('/')[1] || 'jpg';
      const filename = `tute_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const buffer = Buffer.from(content, 'base64');

      const { error } = await supabase.storage
        .from('receipts')
        .upload(filename, buffer, { contentType: mime, upsert: true });

      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filename);
        photo_url = publicUrl;
      }
    } catch (e) {
      console.error('[Storage Error]', e.message);
    }
  }

  await dbRun(`
    UPDATE tute_deliveries 
    SET status = ?, 
        tracking_code = ?, 
        photo_url = ?,
        courier_name = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    status !== undefined ? status : delivery.status,
    tracking_code !== undefined ? tracking_code : delivery.tracking_code,
    photo_url !== undefined ? photo_url : delivery.photo_url,
    courier_name !== undefined ? courier_name : delivery.courier_name,
    req.params.id
  ]);

  const updated = await dbGet('SELECT * FROM tute_deliveries WHERE id = ?', [req.params.id]);
  const student = await dbGet('SELECT name, phone, whatsapp_id FROM students WHERE id = ?', [delivery.student_id]);

  // Fix: Only notify if status changed to 'shipped' in this update
  if (status === 'shipped' && delivery.status !== 'shipped') {
    let target = student.whatsapp_id || student.phone;
    if (target && !target.includes('@')) {
       // Normalize phone number to 94XXXXXXXXX@c.us format
       const clean = target.replace(/\D/g, '');
       const normalized = clean.length === 9 ? '94' + clean : (clean.startsWith('0') ? '94' + clean.slice(1) : clean);
       target = `${normalized}@c.us`;
    }

    const msg = `🌟 *ADEON SCIENCE ACADEMY* 🌟
------------------------------------------
📦 *TUTE SHIPMENT ALERT*

Hello *${student.name}*, your printed material for *${delivery.month}* has been dispatched!

🚚 *Courier:* ${courier_name || 'Domex'}
🔢 *Tracking:* *${tracking_code || 'Update soon'}*

📸 *Shipment Evidence attached below.*

ඔයාට tute එක ලැබුණාම "Tute එක ලැබුණා" කියලා reply එකක් එවන්න. 😊
------------------------------------------`;
    
    try {
      if (updated.photo_url) {
        await whatsappService.sendMedia(target, updated.photo_url, msg);
      } else {
        await whatsappService.sendMessage(target, msg);
      }
    } catch (e) {
      console.error('[Notification Error]', e.message);
    }
  }

  res.json({ delivery: updated });
});

// Bulk generate deliveries from approved payments
router.post('/sync', async (req, res) => {
  const { month: monthInput, year } = req.body;
  const month = normalizationService.normalizeMonth(monthInput);
  const currentYear = year || new Date().getFullYear();

  // Find all paid students for this month who don't have a delivery record yet
  const paidStudents = await dbAll(`
    SELECT p.student_id, p.id as payment_id 
    FROM payments p
    LEFT JOIN tute_deliveries td ON td.student_id = p.student_id AND td.month = p.month AND td.year = p.year
    WHERE p.tutor_id = ? AND p.month = ? AND p.year = ? AND p.status = 'paid' AND td.id IS NULL
  `, [req.tutor.id, month, parseInt(currentYear)]);

  let created = 0;
  for (const p of paidStudents) {
    await dbRun(`
      INSERT INTO tute_deliveries (tutor_id, student_id, payment_id, month, year, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `, [req.tutor.id, p.student_id, p.payment_id, month, currentYear]);
    created++;
  }

  res.json({ created, total_eligible: paidStudents.length });
});

// Delete delivery record
router.delete('/:id', async (req, res) => {
  try {
    const result = await dbRun('DELETE FROM tute_deliveries WHERE id = ? AND tutor_id = ?', [req.params.id, req.tutor.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
