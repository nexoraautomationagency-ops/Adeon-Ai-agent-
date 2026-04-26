const express = require('express');
const { dbAll } = require('../db/connection');
const router = express.Router();

router.get('/', (req, res) => {
  const { student_id, direction, limit = 100, before } = req.query;
  let where = 'WHERE ml.tutor_id = ?';
  const params = [req.tutor.id];
  if (student_id) { where += ' AND ml.student_id = ?'; params.push(parseInt(student_id)); }
  if (direction) { where += ' AND ml.direction = ?'; params.push(direction); }
  if (before) { where += ' AND ml.created_at < ?'; params.push(before); }
  const messages = dbAll(`SELECT ml.*, s.name as student_name, s.phone as student_phone FROM message_logs ml LEFT JOIN students s ON s.id = ml.student_id ${where} ORDER BY ml.created_at DESC LIMIT ?`, [...params, parseInt(limit)]);
  res.json({ messages });
});

router.get('/conversations', (req, res) => {
  const conversations = dbAll(`SELECT ml.whatsapp_chat_id, s.name as student_name, s.phone as student_phone, s.id as student_id, ml.content as last_message, ml.direction as last_direction, ml.created_at as last_message_time, (SELECT COUNT(*) FROM message_logs m2 WHERE m2.whatsapp_chat_id = ml.whatsapp_chat_id) as message_count FROM message_logs ml LEFT JOIN students s ON s.id = ml.student_id WHERE ml.tutor_id = ? AND ml.id IN (SELECT MAX(id) FROM message_logs WHERE tutor_id = ? GROUP BY whatsapp_chat_id) ORDER BY ml.created_at DESC LIMIT 50`, [req.tutor.id, req.tutor.id]);
  res.json({ conversations });
});

module.exports = router;
