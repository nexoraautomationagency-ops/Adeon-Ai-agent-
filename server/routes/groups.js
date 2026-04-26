const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/connection');
const router = express.Router();

router.get('/', (req, res) => {
  const groups = dbAll('SELECT g.*, (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id) as member_count FROM whatsapp_groups g WHERE g.tutor_id = ? ORDER BY g.name', [req.tutor.id]);
  res.json({ groups });
});

router.post('/', (req, res) => {
  const { name, whatsapp_group_id, description, grade, subject } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name is required' });
  const result = dbRun('INSERT INTO whatsapp_groups (tutor_id,name,whatsapp_group_id,description,grade,subject) VALUES (?,?,?,?,?,?)',
    [req.tutor.id, name, whatsapp_group_id||null, description||null, grade||null, subject||null]);
  res.status(201).json({ group: dbGet('SELECT * FROM whatsapp_groups WHERE id=?', [result.lastInsertRowid]) });
});

router.put('/:id', (req, res) => {
  const { name, whatsapp_group_id, description, grade, subject } = req.body;
  dbRun('UPDATE whatsapp_groups SET name=COALESCE(?,name),whatsapp_group_id=COALESCE(?,whatsapp_group_id),description=COALESCE(?,description),grade=COALESCE(?,grade),subject=COALESCE(?,subject) WHERE id=? AND tutor_id=?',
    [name||null, whatsapp_group_id||null, description||null, grade||null, subject||null, req.params.id, req.tutor.id]);
  res.json({ group: dbGet('SELECT * FROM whatsapp_groups WHERE id=?', [req.params.id]) });
});

router.delete('/:id', (req, res) => {
  const r = dbRun('DELETE FROM whatsapp_groups WHERE id=? AND tutor_id=?', [req.params.id, req.tutor.id]);
  if (r.changes === 0) return res.status(404).json({ error: 'Group not found' });
  res.json({ success: true });
});

router.post('/:id/members', (req, res) => {
  const { student_ids } = req.body;
  if (!student_ids || !student_ids.length) return res.status(400).json({ error: 'student_ids required' });
  let added = 0;
  student_ids.forEach(sid => {
    const ex = dbGet('SELECT student_id FROM student_groups WHERE student_id=? AND group_id=?', [sid, req.params.id]);
    if (!ex) { dbRun('INSERT INTO student_groups (student_id,group_id) VALUES (?,?)', [sid, req.params.id]); added++; }
  });
  res.json({ added, total: student_ids.length });
});

router.delete('/:id/members/:studentId', (req, res) => {
  dbRun('DELETE FROM student_groups WHERE group_id=? AND student_id=?', [req.params.id, req.params.studentId]);
  res.json({ success: true });
});

router.get('/:id/members', (req, res) => {
  const members = dbAll('SELECT s.* FROM students s JOIN student_groups sg ON sg.student_id = s.id WHERE sg.group_id = ? ORDER BY s.name', [req.params.id]);
  res.json({ members });
});

module.exports = router;
