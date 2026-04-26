const express = require('express');
const { dbAll } = require('../db/connection');
const whatsappService = require('../services/whatsapp');
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
    const { message, student_ids, group_id, grade } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    let phones = [];
    if (student_ids && student_ids.length > 0) {
      const placeholders = student_ids.map(() => '?').join(',');
      phones = dbAll(`SELECT phone FROM students WHERE id IN (${placeholders}) AND tutor_id=?`, [...student_ids, req.tutor.id]).map(s => s.phone);
    } else if (group_id) {
      phones = dbAll('SELECT s.phone FROM students s JOIN student_groups sg ON sg.student_id=s.id WHERE sg.group_id=? AND s.status=?', [group_id, 'active']).map(s => s.phone);
    } else if (grade) {
      phones = dbAll('SELECT phone FROM students WHERE tutor_id=? AND grade=? AND status=?', [req.tutor.id, grade, 'active']).map(s => s.phone);
    } else {
      phones = dbAll('SELECT phone FROM students WHERE tutor_id=? AND status=?', [req.tutor.id, 'active']).map(s => s.phone);
    }
    if (phones.length === 0) return res.status(400).json({ error: 'No students found' });
    const chatIds = phones.map(p => { let c = p.replace(/[^0-9]/g, ''); if (c.startsWith('0')) c = '94' + c.substring(1); if (!c.startsWith('94')) c = '94' + c; return c + '@c.us'; });
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

router.post('/restart', async (req, res, next) => {
  try { await whatsappService.destroy(); setTimeout(() => whatsappService.initialize(), 2000); res.json({ success: true, message: 'Restarting...' }); }
  catch (err) { next(err); }
});

module.exports = router;
