const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/connection');
const router = express.Router();

router.get('/summary', (req, res) => {
  const tid = req.tutor.id;
  const studentStats = dbGet('SELECT COUNT(*) as total, SUM(CASE WHEN status=\'active\' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status=\'inactive\' THEN 1 ELSE 0 END) as inactive, SUM(CASE WHEN status=\'suspended\' THEN 1 ELSE 0 END) as suspended FROM students WHERE tutor_id=?', [tid]);

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const currentMonth = MONTHS[new Date().getMonth()];
  const currentYear = new Date().getFullYear();

  const paymentStats = dbGet(`SELECT COUNT(*) as total, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid, SUM(CASE WHEN status='unpaid' THEN 1 ELSE 0 END) as unpaid, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) as collected, SUM(amount) as expected FROM payments WHERE tutor_id=? AND month=? AND year=?`, [tid, currentMonth, currentYear]);

  const classCount = dbGet('SELECT COUNT(*) as total FROM classes WHERE tutor_id=? AND is_active=1', [tid]).total;
  const recentMessages = dbGet("SELECT COUNT(*) as total FROM message_logs WHERE tutor_id=? AND created_at > datetime('now','-1 day')", [tid]).total;

  const revenueTrend = dbAll(`SELECT month, year, SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) as collected, SUM(amount) as expected, COUNT(*) as total_records FROM payments WHERE tutor_id=? GROUP BY year, month ORDER BY year DESC, CASE month WHEN 'January' THEN 1 WHEN 'February' THEN 2 WHEN 'March' THEN 3 WHEN 'April' THEN 4 WHEN 'May' THEN 5 WHEN 'June' THEN 6 WHEN 'July' THEN 7 WHEN 'August' THEN 8 WHEN 'September' THEN 9 WHEN 'October' THEN 10 WHEN 'November' THEN 11 WHEN 'December' THEN 12 END DESC LIMIT 6`, [tid]);

  const studentsByGrade = dbAll('SELECT grade, COUNT(*) as count FROM students WHERE tutor_id=? AND grade IS NOT NULL GROUP BY grade ORDER BY grade', [tid]);

  res.json({
    students: studentStats,
    payments: { ...paymentStats, month: currentMonth, year: currentYear },
    classCount,
    recentMessages,
    revenueTrend: revenueTrend.reverse(),
    studentsByGrade
  });
});

router.get('/settings', (req, res) => {
  let settings = dbGet('SELECT * FROM settings WHERE tutor_id=?', [req.tutor.id]);
  if (!settings) {
    dbRun('INSERT INTO settings (tutor_id) VALUES (?)', [req.tutor.id]);
    settings = dbGet('SELECT * FROM settings WHERE tutor_id=?', [req.tutor.id]);
  }
  res.json({ settings });
});

router.put('/settings', (req, res) => {
  const { auto_reply_enabled, auto_reply_message, welcome_message, payment_reminder_enabled, payment_reminder_day, ai_tone } = req.body;
  dbRun('UPDATE settings SET auto_reply_enabled=COALESCE(?,auto_reply_enabled),auto_reply_message=COALESCE(?,auto_reply_message),welcome_message=COALESCE(?,welcome_message),payment_reminder_enabled=COALESCE(?,payment_reminder_enabled),payment_reminder_day=COALESCE(?,payment_reminder_day),ai_tone=COALESCE(?,ai_tone),updated_at=CURRENT_TIMESTAMP WHERE tutor_id=?',
    [auto_reply_enabled??null, auto_reply_message||null, welcome_message||null, payment_reminder_enabled??null, payment_reminder_day??null, ai_tone||null, req.tutor.id]);
  res.json({ settings: dbGet('SELECT * FROM settings WHERE tutor_id=?', [req.tutor.id]) });
});

module.exports = router;
