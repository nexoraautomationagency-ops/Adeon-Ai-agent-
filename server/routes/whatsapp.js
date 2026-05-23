const express = require('express');
const { dbAll, dbGet } = require('../db/connection');
const whatsappService = require('../services/whatsapp');
const cronService = require('../services/cron');
const normalizationService = require('../services/normalization');
const router = express.Router();

router.get('/status', (req, res) => { res.json(whatsappService.getStatus()); });

router.get('/qr', (req, res) => {
  const s = whatsappService.getStatus();
  if (s.qrCode) res.json({ qrCode: s.qrCode });
  else if (s.isReady) res.json({ message: 'Already connected', status: 'ready' });
  else res.json({ message: 'Waiting for QR code', status: s.status });
});

router.post('/send', async (req, res, next) => {
  try {
    const { phone, chat_id, message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!phone && !chat_id) return res.status(400).json({ error: 'phone or chat_id required' });
    const result = chat_id ? await whatsappService.sendMessage(chat_id, message) : await whatsappService.sendToPhone(phone, message);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/broadcast', async (req, res, next) => {
  try {
    const { message, student_ids, group_id, grade, payment_status, month: monthInput, year: yearInput } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const normalizationService = require('../services/normalization');
    const month = monthInput ? normalizationService.normalizeMonth(monthInput) : normalizationService.normalizeMonth();
    const year = yearInput || new Date().getFullYear();

    let phones = [];
    if (student_ids && student_ids.length > 0) {
      const placeholders = student_ids.map(() => '?').join(',');
      const rows = await dbAll(`SELECT phone FROM students WHERE id IN (${placeholders}) AND tutor_id=?`, [...student_ids, req.tutor.id]);
      phones = rows.map(s => s.phone);
    } else if (payment_status) {
      // Broadcast based on payment status (Paid or Unpaid for specific month)
      let query = `
        SELECT s.phone 
        FROM students s
        LEFT JOIN payments p ON s.id = p.student_id AND p.month = ? AND p.year = ?
        WHERE s.tutor_id = ? AND s.status = 'active'
      `;
      const params = [month, year, req.tutor.id];

      if (grade) { query += " AND s.grade = ?"; params.push(grade); }

      if (payment_status === 'paid') {
        query += " AND p.status = 'paid'";
      } else if (payment_status === 'unpaid') {
        // Unpaid includes both 'unpaid' status and missing payment records
        query += " AND (p.status IS NULL OR p.status = 'unpaid')";
      } else if (payment_status === 'pending') {
        query += " AND p.status = 'pending'";
      }

      const rows = await dbAll(query, params);
      phones = rows.map(s => s.phone);
    } else if (group_id) {
      const rows = await dbAll('SELECT s.phone FROM students s JOIN student_groups sg ON sg.student_id=s.id WHERE sg.group_id=? AND s.status=?', [group_id, 'active']);
      phones = rows.map(s => s.phone);
    } else if (grade) {
      const rows = await dbAll('SELECT phone FROM students WHERE tutor_id=? AND grade=? AND status=?', [req.tutor.id, grade, 'active']);
      phones = rows.map(s => s.phone);
    } else {
      const rows = await dbAll('SELECT phone FROM students WHERE tutor_id=? AND status=?', [req.tutor.id, 'active']);
      phones = rows.map(s => s.phone);
    }

    if (phones.length === 0) return res.status(400).json({ error: 'No students found matching filters' });

    // De-duplicate phones
    const uniquePhones = [...new Set(phones)];
    const chatIds = uniquePhones.map(p => {
      let c = p.replace(/[^0-9]/g, '');
      if (c.startsWith('0')) c = '94' + c.substring(1);
      if (!c.startsWith('94')) c = '94' + c;
      return c + '@c.us';
    });

    const results = await whatsappService.broadcastMessage(chatIds, message);
    const sent = results.filter(r => r.success).length;
    res.json({ total: chatIds.length, sent, failed: chatIds.length - sent, results });
  } catch (err) { next(err); }
});

router.get('/groups', async (req, res, next) => {
  try {
    const groups = await whatsappService.getGroupChats();
    res.json({ groups: groups.map(g => ({ id: g.id._serialized, name: g.name, participantCount: g.participants?.length || 0 })) });
  } catch (err) { next(err); }
});

router.get('/admin-groups', async (req, res, next) => {
  try {
    if (req.tutor.role !== 'developer') return res.status(403).json({ error: 'Forbidden' });
    const groups = await whatsappService.getAdminGroups();
    res.json({ groups });
  } catch (err) { next(err); }
});

router.post('/logout', async (req, res, next) => {
  try {
    await whatsappService.logout();
    res.json({ success: true, message: 'WhatsApp logged out. Please re-scan the QR code to reconnect.' });
  } catch (err) { next(err); }
});

router.post('/restart', async (req, res, next) => {
  try { await whatsappService.destroy(); setTimeout(() => whatsappService.initialize(), 2000); res.json({ success: true, message: 'Restarting...' }); }
  catch (err) { next(err); }
});

router.post('/remind', async (req, res, next) => {
  try {
    const { grade, month, year } = req.body;
    if (!month) return res.status(400).json({ error: 'Month required' });

    if (!whatsappService.getStatus().isReady) {
      return res.status(503).json({ error: 'WhatsApp is not connected. Scan QR and wait until status is ready.' });
    }

    const normalizedMonth = normalizationService.normalizeMonth(month);
    const paymentYear = year ? parseInt(year, 10) : new Date().getFullYear();

    const settings = await dbGet('SELECT * FROM settings WHERE tutor_id = ?', [req.tutor.id]);
    if (!settings) return res.status(404).json({ error: 'Settings not found' });

    let query = `
      SELECT p.amount, s.name, s.phone, s.whatsapp_id, s.grade
      FROM payments p
      JOIN students s ON s.id = p.student_id
      WHERE p.tutor_id = ? AND p.month = ? AND p.year = ? AND p.status = 'unpaid' AND s.status = 'active'
    `;
    const params = [req.tutor.id, normalizedMonth, paymentYear];
    if (grade) {
      query += ' AND s.grade LIKE ?';
      params.push(`%${grade}%`);
    }

    const unpaid = await dbAll(query, params);
    let sent = 0;
    let skipped = 0;

    for (const row of unpaid) {
      const chatId = row.whatsapp_id || whatsappService._normalizePhone(row.phone);
      if (!chatId) {
        skipped++;
        continue;
      }
      const reminderText = cronService._buildPaymentReminderText(
        row.name,
        normalizedMonth,
        row.amount,
        settings
      );
      await whatsappService.sendMessage(chatId, reminderText, 1);
      sent++;
      await new Promise(r => setTimeout(r, 3000));
    }

    res.json({
      success: true,
      sent,
      skipped,
      total: unpaid.length,
      month: normalizedMonth,
      year: paymentYear
    });
  } catch (err) { next(err); }
});

module.exports = router;
