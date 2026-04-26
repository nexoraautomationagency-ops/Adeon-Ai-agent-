const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/connection');
const router = express.Router();

router.get('/', (req, res) => {
  const { grade, status, search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  let where = 'WHERE tutor_id = ?';
  const params = [req.tutor.id];
  if (grade) { where += ' AND grade = ?'; params.push(grade); }
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (search) { where += ' AND (name LIKE ? OR phone LIKE ? OR school LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }

  const total = dbGet(`SELECT COUNT(*) as total FROM students ${where}`, params).total;
  const students = dbAll(`SELECT * FROM students ${where} ORDER BY name ASC LIMIT ? OFFSET ?`, [...params, parseInt(limit), parseInt(offset)]);
  res.json({ students, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/grades/list', (req, res) => {
  const grades = dbAll('SELECT DISTINCT grade FROM students WHERE tutor_id = ? AND grade IS NOT NULL ORDER BY grade', [req.tutor.id]);
  res.json({ grades: grades.map(g => g.grade) });
});

router.get('/:id', (req, res) => {
  const student = dbGet('SELECT * FROM students WHERE id = ? AND tutor_id = ?', [req.params.id, req.tutor.id]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const classes = dbAll('SELECT c.* FROM classes c JOIN student_classes sc ON sc.class_id = c.id WHERE sc.student_id = ?', [student.id]);
  const payments = dbAll('SELECT * FROM payments WHERE student_id = ? ORDER BY year DESC, month DESC LIMIT 12', [student.id]);
  const groups = dbAll('SELECT g.* FROM whatsapp_groups g JOIN student_groups sg ON sg.group_id = g.id WHERE sg.student_id = ?', [student.id]);
  res.json({ student, classes, payments, groups });
});

router.post('/', (req, res) => {
  const { name, phone, grade, school, parent_name, parent_phone, address, monthly_fee, notes } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
  const result = dbRun('INSERT INTO students (tutor_id,name,phone,grade,school,parent_name,parent_phone,address,monthly_fee,notes) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [req.tutor.id, name, phone, grade||null, school||null, parent_name||null, parent_phone||null, address||null, monthly_fee||0, notes||null]);
  const student = dbGet('SELECT * FROM students WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json({ student });
});

router.put('/:id', (req, res) => {
  const existing = dbGet('SELECT * FROM students WHERE id = ? AND tutor_id = ?', [req.params.id, req.tutor.id]);
  if (!existing) return res.status(404).json({ error: 'Student not found' });
  const { name, phone, grade, school, parent_name, parent_phone, address, monthly_fee, status, notes, whatsapp_id } = req.body;
  dbRun(`UPDATE students SET name=COALESCE(?,name),phone=COALESCE(?,phone),grade=COALESCE(?,grade),school=COALESCE(?,school),parent_name=COALESCE(?,parent_name),parent_phone=COALESCE(?,parent_phone),address=COALESCE(?,address),monthly_fee=COALESCE(?,monthly_fee),status=COALESCE(?,status),notes=COALESCE(?,notes),whatsapp_id=COALESCE(?,whatsapp_id),updated_at=CURRENT_TIMESTAMP WHERE id=? AND tutor_id=?`,
    [name||null,phone||null,grade||null,school||null,parent_name||null,parent_phone||null,address||null,monthly_fee??null,status||null,notes||null,whatsapp_id||null,req.params.id,req.tutor.id]);
  const student = dbGet('SELECT * FROM students WHERE id = ?', [req.params.id]);
  res.json({ student });
});

router.delete('/:id', (req, res) => {
  const result = dbRun('DELETE FROM students WHERE id = ? AND tutor_id = ?', [req.params.id, req.tutor.id]);
  if (result.changes === 0) return res.status(404).json({ error: 'Student not found' });
  res.json({ success: true });
});

router.post('/:id/enroll', (req, res) => {
  const { class_id } = req.body;
  if (!class_id) return res.status(400).json({ error: 'class_id is required' });
  try { dbRun('INSERT OR IGNORE INTO student_classes (student_id, class_id) VALUES (?,?)', [req.params.id, class_id]); res.json({ success: true }); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
