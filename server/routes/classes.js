const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/connection');
const router = express.Router();

router.get('/', async (req, res) => {
  const classes = await dbAll(`SELECT c.*, (SELECT COUNT(*) FROM student_classes sc WHERE sc.class_id = c.id) as student_count FROM classes c WHERE c.tutor_id = ? ORDER BY CASE c.day_of_week WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 WHEN 'Sunday' THEN 7 END, c.start_time ASC`, [req.tutor.id]);
  res.json({ classes });
});

router.get('/:id', async (req, res) => {
  const cls = await dbGet('SELECT * FROM classes WHERE id = ? AND tutor_id = ?', [req.params.id, req.tutor.id]);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  const students = await dbAll('SELECT s.* FROM students s JOIN student_classes sc ON sc.student_id = s.id WHERE sc.class_id = ? ORDER BY s.name ASC', [cls.id]);
  res.json({ class: cls, students });
});

router.post('/', async (req, res) => {
  const { subject, grade, day_of_week, start_time, end_time, location, max_students, notes, fee } = req.body;
  if (!subject || !grade || !day_of_week || !start_time) return res.status(400).json({ error: 'Subject, grade, day, and start time required' });
  const result = await dbRun('INSERT INTO classes (tutor_id,subject,grade,day_of_week,start_time,end_time,location,max_students,notes,fee) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id',
    [req.tutor.id, subject, grade, day_of_week, start_time, end_time||null, location||'Online', max_students||50, notes||null, fee||0]);
  res.status(201).json({ class: await dbGet('SELECT * FROM classes WHERE id = ?', [result.lastInsertRowid]) });
});

router.put('/:id', async (req, res) => {
  const existing = await dbGet('SELECT * FROM classes WHERE id = ? AND tutor_id = ?', [req.params.id, req.tutor.id]);
  if (!existing) return res.status(404).json({ error: 'Class not found' });
  const { subject, grade, day_of_week, start_time, end_time, location, max_students, is_active, notes, fee } = req.body;
  await dbRun('UPDATE classes SET subject=COALESCE(?,subject),grade=COALESCE(?,grade),day_of_week=COALESCE(?,day_of_week),start_time=COALESCE(?,start_time),end_time=COALESCE(?,end_time),location=COALESCE(?,location),max_students=COALESCE(?,max_students),is_active=COALESCE(?,is_active),notes=COALESCE(?,notes),fee=COALESCE(?,fee) WHERE id=? AND tutor_id=?',
    [subject||null,grade||null,day_of_week||null,start_time||null,end_time||null,location||null,max_students??null,is_active??null,notes||null,fee??null,req.params.id,req.tutor.id]);
  res.json({ class: await dbGet('SELECT * FROM classes WHERE id = ?', [req.params.id]) });
});

router.delete('/:id', async (req, res) => {
  const result = await dbRun('DELETE FROM classes WHERE id = ? AND tutor_id = ?', [req.params.id, req.tutor.id]);
  if (result.changes === 0) return res.status(404).json({ error: 'Class not found' });
  res.json({ success: true });
});

module.exports = router;
