const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/connection');
const whatsappService = require('../services/whatsapp');
const normalizationService = require('../services/normalization');
const { developerOnly } = require('../middleware/auth');
const router = express.Router();

router.post('/year-end', async (req, res) => {
  try {
    const settings = await dbGet('SELECT final_grade FROM settings WHERE tutor_id = ?', [req.tutor.id]);
    const finalGrade = settings?.final_grade || 11;

    // Bulk Update 1: Promote students below final grade
    const promoteRes = await dbRun(`
      UPDATE students 
      SET grade = (CAST(grade AS INTEGER) + 1)::TEXT, updated_at = CURRENT_TIMESTAMP
      WHERE tutor_id = ? AND status = 'active' AND grade ~ '^[0-9]+$' AND CAST(grade AS INTEGER) < ?
    `, [req.tutor.id, finalGrade]);

    // Bulk Update 2: Graduate students at or above final grade
    const graduateRes = await dbRun(`
      UPDATE students 
      SET status = 'graduated', updated_at = CURRENT_TIMESTAMP
      WHERE tutor_id = ? AND status = 'active' AND grade ~ '^[0-9]+$' AND CAST(grade AS INTEGER) >= ?
    `, [req.tutor.id, finalGrade]);

    const totalAffected = (promoteRes.changes || 0) + (graduateRes.changes || 0);
    res.json({ success: true, count: totalAffected, message: `Successfully processed ${totalAffected} students. (${promoteRes.changes} promoted, ${graduateRes.changes} graduated).` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const { grade, status, search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  let where = 'WHERE tutor_id = ?';
  const params = [req.tutor.id];
  if (grade) { where += ' AND grade = ?'; params.push(grade); }
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (search) { where += ' AND (name ILIKE ? OR phone ILIKE ? OR school ILIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }

  const totalRes = await dbGet(`SELECT COUNT(*) as total FROM students ${where}`, params);
  const total = totalRes ? totalRes.total : 0;
  const students = await dbAll(`
    SELECT *, 
    COALESCE(
      (SELECT STRING_AGG(subject, ', ') FROM student_classes sc JOIN classes c ON sc.class_id = c.id WHERE sc.student_id = students.id),
      'Grade ' || grade
    ) as classes
    FROM students ${where} 
    ORDER BY name ASC LIMIT ? OFFSET ?
  `, [...params, parseInt(limit), parseInt(offset)]);
  res.json({ students, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/grades/list', async (req, res) => {
  const grades = await dbAll('SELECT DISTINCT grade FROM students WHERE tutor_id = ? AND grade IS NOT NULL ORDER BY grade', [req.tutor.id]);
  res.json({ grades: grades.map(g => g.grade) });
});

router.get('/:id', async (req, res) => {
  const student = await dbGet('SELECT * FROM students WHERE id = ? AND tutor_id = ?', [req.params.id, req.tutor.id]);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const classes = await dbAll('SELECT c.* FROM classes c JOIN student_classes sc ON sc.class_id = c.id WHERE sc.student_id = ?', [student.id]);
  const payments = await dbAll('SELECT * FROM payments WHERE student_id = ? ORDER BY year DESC, month DESC LIMIT 12', [student.id]);
  const groups = await dbAll('SELECT g.* FROM whatsapp_groups g JOIN student_groups sg ON sg.group_id = g.id WHERE sg.student_id = ?', [student.id]);
  res.json({ student, classes, payments, groups });
});

router.post('/', async (req, res) => {
  const { name, phone, grade, school, parent_name, parent_phone, address, monthly_fee, notes } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
  try {
    let normalizedPhone = null;
    try { normalizedPhone = normalizationService.normalizePhone(phone); } catch (e) { }
    const result = await dbRun(
      'INSERT INTO students (tutor_id,name,phone,normalized_phone,grade,school,parent_name,parent_phone,address,monthly_fee,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id',
      [req.tutor.id, name, phone, normalizedPhone, grade||null, school||null, parent_name||null, parent_phone||null, address||null, monthly_fee||0, notes||null]
    );
    const student = await dbGet('SELECT * FROM students WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ student });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'A student with this phone number already exists.' });
    }
    res.status(500).json({ error: 'Failed to create student.' });
  }
});

router.put('/:id', async (req, res) => {
  const existing = await dbGet('SELECT * FROM students WHERE id = ? AND tutor_id = ?', [req.params.id, req.tutor.id]);
  if (!existing) return res.status(404).json({ error: 'Student not found' });
  const { name, phone, grade, school, parent_name, parent_phone, address, monthly_fee, status, notes, whatsapp_id, pending_month } = req.body;
  let normalizedPhone = null;
  if (phone) {
    try {
      normalizedPhone = normalizationService.normalizePhone(phone);
    } catch (e) {
      normalizedPhone = null;
    }
  }
  // Normalize Sinhala month names to English (e.g., "මැයි" → "May")
  let normalizedMonth = pending_month;
  if (pending_month) {
    try {
      normalizedMonth = normalizationService.normalizeMonth(pending_month);
    } catch (e) {
      normalizedMonth = pending_month;
    }
  }
  await dbRun(`UPDATE students SET name=COALESCE(?,name),phone=COALESCE(?,phone),normalized_phone=CASE WHEN ? IS NOT NULL THEN ? ELSE normalized_phone END,grade=COALESCE(?,grade),school=COALESCE(?,school),parent_name=COALESCE(?,parent_name),parent_phone=COALESCE(?,parent_phone),address=COALESCE(?,address),monthly_fee=COALESCE(?,monthly_fee),status=COALESCE(?,status),notes=COALESCE(?,notes),whatsapp_id=COALESCE(?,whatsapp_id),pending_month=COALESCE(?,pending_month),updated_at=CURRENT_TIMESTAMP WHERE id=? AND tutor_id=?`,
    [name||null,phone||null,phone||null,normalizedPhone||null,grade||null,school||null,parent_name||null,parent_phone||null,address||null,monthly_fee??null,status||null,notes||null,whatsapp_id||null,normalizedMonth||null,req.params.id,req.tutor.id]);
  
  const student = await dbGet('SELECT * FROM students WHERE id = ?', [req.params.id]);

  // Sync with WhatsApp if status changed to active
  if (status === 'active' && existing.status !== 'active') {
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
    const currentYear = new Date().getFullYear();
    const target = student.whatsapp_id && student.whatsapp_id.includes('@') ? student.whatsapp_id : student.phone;
    
    whatsappService.syncStudentToMonthlyGroup(student.id, currentMonth, currentYear).catch(err => console.error('[API] Group sync failed:', err.message));
    whatsappService.sendToPhone(target, `🎉 Your registration at *${req.tutor.institute_name || 'the class'}* is approved! Welcome! 🎓`).catch(e => {});
  }

  res.json({ student });
});

router.delete('/:id', async (req, res) => {
  const result = await dbRun('DELETE FROM students WHERE id = ? AND tutor_id = ?', [req.params.id, req.tutor.id]);
  if (result.changes === 0) return res.status(404).json({ error: 'Student not found' });
  res.json({ success: true });
});

router.post('/:id/enroll', async (req, res) => {
  const { class_id } = req.body;
  if (!class_id) return res.status(400).json({ error: 'class_id is required' });
  
  try { 
    // Fix Bug 20: Verify ownership of BOTH student and class
    const student = await dbGet('SELECT id FROM students WHERE id = ? AND tutor_id = ?', [req.params.id, req.tutor.id]);
    const cls = await dbGet('SELECT id FROM classes WHERE id = ? AND tutor_id = ?', [class_id, req.tutor.id]);
    
    if (!student || !cls) {
      return res.status(403).json({ error: 'Unauthorized: Student or Class does not belong to you.' });
    }

    await dbRun('INSERT INTO student_classes (student_id, class_id) VALUES (?,?) ON CONFLICT DO NOTHING', [req.params.id, class_id]); 
    res.json({ success: true }); 
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
