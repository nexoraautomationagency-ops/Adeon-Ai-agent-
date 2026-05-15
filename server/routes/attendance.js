const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/connection');
const router = express.Router();

// Get attendance for a class on a specific date
router.get('/', async (req, res) => {
  const { class_id, date } = req.query;
  if (!class_id || !date) return res.status(400).json({ error: 'class_id and date required' });

  const attendance = await dbAll(`
    SELECT s.id as student_id, s.name as student_name, a.status, a.notes, a.id as attendance_id
    FROM students s
    JOIN student_classes sc ON sc.student_id = s.id
    LEFT JOIN attendance a ON a.student_id = s.id AND a.class_id = ? AND a.date = ?
    WHERE sc.class_id = ? AND s.tutor_id = ?
    ORDER BY s.name ASC
  `, [class_id, date, class_id, req.tutor.id]);

  res.json({ attendance });
});

// Bulk update attendance
router.post('/bulk', async (req, res) => {
  const { class_id, date, records } = req.body;
  if (!class_id || !date || !records) return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Fix Bug 21: Verify class ownership
    const cls = await dbGet('SELECT id FROM classes WHERE id = ? AND tutor_id = ?', [class_id, req.tutor.id]);
    if (!cls) return res.status(403).json({ error: 'Unauthorized: This class does not belong to you.' });

    for (const record of records) {
      // Verify student ownership
      const student = await dbGet('SELECT id FROM students WHERE id = ? AND tutor_id = ?', [record.student_id, req.tutor.id]);
      if (!student) continue; // Skip unauthorized students

      await dbRun(`
        INSERT INTO attendance (tutor_id, student_id, class_id, date, status, notes)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(student_id, class_id, date) DO UPDATE SET
        status = EXCLUDED.status,
        notes = EXCLUDED.notes
      `, [req.tutor.id, record.student_id, class_id, date, record.status, record.notes || null]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get attendance summary for dashboard
router.get('/summary', async (req, res) => {
  const summary = await dbAll(`
    SELECT date, COUNT(*) as total, 
    SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present,
    SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent
    FROM attendance
    WHERE tutor_id = ?
    GROUP BY date
    ORDER BY date DESC
    LIMIT 7
  `, [req.tutor.id]);
  res.json({ summary });
});

module.exports = router;
