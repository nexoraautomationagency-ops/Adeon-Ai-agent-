const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/connection');
const router = express.Router();

router.get('/', async (req, res) => {
  const groups = await dbAll('SELECT g.*, (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id) as member_count FROM whatsapp_groups g WHERE g.tutor_id = ? ORDER BY g.name', [req.tutor.id]);
  res.json({ groups });
});

router.post('/', async (req, res) => {
  const { name, whatsapp_group_id, description, grade, subject } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name is required' });
  
  let finalGroupId = whatsapp_group_id;

  // If no WhatsApp ID is provided, ask the service to create it
  if (!finalGroupId) {
    const whatsappService = require('../services/whatsapp');
    const result = await whatsappService.createGroup(name);
    if (result.success) {
      finalGroupId = result.gid;
    }
  }

  const result = await dbRun('INSERT INTO whatsapp_groups (tutor_id,name,whatsapp_group_id,description,grade,subject) VALUES (?,?,?,?,?,?) RETURNING id',
    [req.tutor.id, name, finalGroupId||null, description||null, grade||null, subject||null]);
  
  res.status(201).json({ group: await dbGet('SELECT * FROM whatsapp_groups WHERE id=?', [result.lastInsertRowid]) });
});

router.put('/:id', async (req, res) => {
  if (req.tutor.role !== 'admin' && req.tutor.role !== 'developer') return res.status(403).json({ error: 'Forbidden' });
  const { name, whatsapp_group_id, description, grade, subject } = req.body;
  await dbRun('UPDATE whatsapp_groups SET name=COALESCE(?,name),whatsapp_group_id=COALESCE(?,whatsapp_group_id),description=COALESCE(?,description),grade=COALESCE(?,grade),subject=COALESCE(?,subject) WHERE id=? AND tutor_id=?',
    [name||null, whatsapp_group_id||null, description||null, grade||null, subject||null, req.params.id, req.tutor.id]);
  res.json({ group: await dbGet('SELECT * FROM whatsapp_groups WHERE id=?', [req.params.id]) });
});

router.delete('/:id', async (req, res) => {
  if (req.tutor.role !== 'admin' && req.tutor.role !== 'developer') return res.status(403).json({ error: 'Forbidden' });
  const r = await dbRun('DELETE FROM whatsapp_groups WHERE id=? AND tutor_id=?', [req.params.id, req.tutor.id]);
  if (r.changes === 0) return res.status(404).json({ error: 'Group not found' });
  res.json({ success: true });
});

router.post('/:id/members', async (req, res) => {
  const { student_ids } = req.body;
  if (!student_ids || !student_ids.length) return res.status(400).json({ error: 'student_ids required' });
  let added = 0;
  for (const sid of student_ids) {
    const ex = await dbGet('SELECT student_id FROM student_groups WHERE student_id=? AND group_id=?', [sid, req.params.id]);
    if (!ex) { 
      await dbRun('INSERT INTO student_groups (student_id,group_id) VALUES (?,?)', [sid, req.params.id]); 
      added++; 
    }
  }
  res.json({ added, total: student_ids.length });
});

router.delete('/:id/members/:studentId', async (req, res) => {
  await dbRun('DELETE FROM student_groups WHERE group_id=? AND student_id=?', [req.params.id, req.params.studentId]);
  res.json({ success: true });
});

router.get('/:id/members', async (req, res) => {
  const members = await dbAll('SELECT s.* FROM students s JOIN student_groups sg ON sg.student_id = s.id WHERE sg.group_id = ? ORDER BY s.name', [req.params.id]);
  res.json({ members });
});

router.post('/mapping', async (req, res) => {
  const { mappings } = req.body;
  if (!mappings || !Array.isArray(mappings)) return res.status(400).json({ error: 'Mappings array required' });
  for (const m of mappings) {
    await dbRun(`
      INSERT INTO whatsapp_groups (tutor_id, grade, whatsapp_group_id, name)
      VALUES (?, ?, ?, ?)
    `, [req.tutor.id, m.grade, m.whatsapp_group_id, `Grade ${m.grade} Group`]);
  }
  res.json({ success: true });
});

module.exports = router;
