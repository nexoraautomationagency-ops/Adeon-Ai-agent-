const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/connection');
const router = express.Router();

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

router.get('/', (req, res) => {
  const { month, year, status, student_id, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  let where = 'WHERE p.tutor_id = ?';
  const params = [req.tutor.id];
  if (month) { where += ' AND p.month = ?'; params.push(month); }
  if (year) { where += ' AND p.year = ?'; params.push(parseInt(year)); }
  if (status) { where += ' AND p.status = ?'; params.push(status); }
  if (student_id) { where += ' AND p.student_id = ?'; params.push(parseInt(student_id)); }

  const total = dbGet(`SELECT COUNT(*) as total FROM payments p JOIN students s ON s.id = p.student_id ${where}`, params).total;
  const payments = dbAll(`SELECT p.*, s.name as student_name, s.phone as student_phone, s.grade as student_grade FROM payments p JOIN students s ON s.id = p.student_id ${where} ORDER BY p.year DESC, p.month DESC, s.name ASC LIMIT ? OFFSET ?`, [...params, parseInt(limit), parseInt(offset)]);
  res.json({ payments, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/summary', (req, res) => {
  const { month, year } = req.query;
  const m = month || MONTHS[new Date().getMonth()];
  const y = year || new Date().getFullYear();
  const summary = dbGet(`SELECT COUNT(*) as total_records, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_count, SUM(CASE WHEN status='unpaid' THEN 1 ELSE 0 END) as unpaid_count, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending_count, SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) as total_collected, SUM(CASE WHEN status!='paid' THEN amount ELSE 0 END) as total_outstanding, SUM(amount) as total_expected FROM payments WHERE tutor_id=? AND month=? AND year=?`, [req.tutor.id, m, parseInt(y)]);
  const byGrade = dbAll(`SELECT s.grade, COUNT(*) as total, SUM(CASE WHEN p.status='paid' THEN 1 ELSE 0 END) as paid, SUM(CASE WHEN p.status!='paid' THEN 1 ELSE 0 END) as unpaid, SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END) as collected FROM payments p JOIN students s ON s.id=p.student_id WHERE p.tutor_id=? AND p.month=? AND p.year=? GROUP BY s.grade ORDER BY s.grade`, [req.tutor.id, m, parseInt(y)]);
  res.json({ summary, byGrade, month: m, year: y });
});

router.post('/', (req, res) => {
  const { student_id, amount, month, year, status, payment_method, notes } = req.body;
  if (!student_id || !amount || !month || !year) return res.status(400).json({ error: 'student_id, amount, month, year required' });
  const result = dbRun('INSERT INTO payments (tutor_id,student_id,amount,month,year,status,payment_method,notes,paid_date) VALUES (?,?,?,?,?,?,?,?,?)',
    [req.tutor.id, student_id, amount, month, year, status||'unpaid', payment_method||null, notes||null, status==='paid'?new Date().toISOString():null]);
  res.status(201).json({ payment: dbGet('SELECT * FROM payments WHERE id=?', [result.lastInsertRowid]) });
});

router.post('/generate', (req, res) => {
  const { month, year } = req.body;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const students = dbAll('SELECT id, monthly_fee FROM students WHERE tutor_id=? AND status=? AND monthly_fee > 0', [req.tutor.id, 'active']);
  let created = 0;
  students.forEach(s => {
    const ex = dbGet('SELECT id FROM payments WHERE tutor_id=? AND student_id=? AND month=? AND year=?', [req.tutor.id, s.id, month, year]);
    if (!ex) { dbRun('INSERT INTO payments (tutor_id,student_id,amount,month,year,status) VALUES (?,?,?,?,?,?)', [req.tutor.id, s.id, s.monthly_fee, month, year, 'unpaid']); created++; }
  });
  res.json({ created, total_students: students.length, month, year });
});

router.put('/:id', (req, res) => {
  const existing = dbGet('SELECT * FROM payments WHERE id=? AND tutor_id=?', [req.params.id, req.tutor.id]);
  if (!existing) return res.status(404).json({ error: 'Payment not found' });
  const { status, amount, payment_method, notes } = req.body;
  const paidDate = status === 'paid' ? (existing.paid_date || new Date().toISOString()) : existing.paid_date;
  dbRun('UPDATE payments SET status=COALESCE(?,status),amount=COALESCE(?,amount),payment_method=COALESCE(?,payment_method),notes=COALESCE(?,notes),paid_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tutor_id=?',
    [status||null, amount??null, payment_method||null, notes||null, paidDate, req.params.id, req.tutor.id]);
  res.json({ payment: dbGet('SELECT * FROM payments WHERE id=?', [req.params.id]) });
});

module.exports = router;
