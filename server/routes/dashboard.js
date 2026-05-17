const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/connection');
const router = express.Router();

router.get('/summary', async (req, res) => {
  const tid = req.tutor.id;
  const studentStats = await dbGet('SELECT COUNT(*) as total, SUM(CASE WHEN status=\'active\' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status=\'inactive\' THEN 1 ELSE 0 END) as inactive, SUM(CASE WHEN status=\'suspended\' THEN 1 ELSE 0 END) as suspended FROM students WHERE tutor_id=?', [tid]);

  // Fix Bug 51: Standardize to Sri Lanka Timezone
  const colomboTime = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Colombo', month: 'long', year: 'numeric' });
  const parts = colomboTime.formatToParts(new Date());
  const currentMonth = parts.find(p => p.type === 'month').value;
  const currentYear = parseInt(parts.find(p => p.type === 'year').value);

  const paymentStats = await dbGet(`SELECT COUNT(*) as total, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid, SUM(CASE WHEN status='unpaid' THEN 1 ELSE 0 END) as unpaid, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) as collected, SUM(amount) as expected FROM payments WHERE tutor_id=? AND month=? AND year=?`, [tid, currentMonth, currentYear]);

  const classRes = await dbGet('SELECT COUNT(*) as total FROM classes WHERE tutor_id=? AND is_active=1', [tid]);
  const classCount = classRes ? classRes.total : 0;
  
  const msgRes = await dbGet("SELECT COUNT(*) as total FROM message_logs WHERE tutor_id=? AND created_at > NOW() - INTERVAL '1 day'", [tid]);
  const recentMessages = msgRes ? msgRes.total : 0;
  
  const aiRes = await dbGet("SELECT COUNT(*) as total FROM message_logs WHERE tutor_id=? AND is_ai=1", [tid]);
  const aiMessages = aiRes ? aiRes.total : 0;

  const revenueTrend = await dbAll(`SELECT month, year, SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) as collected, SUM(amount) as expected, COUNT(*) as total_records FROM payments WHERE tutor_id=? GROUP BY year, month ORDER BY year DESC, CASE month WHEN 'January' THEN 1 WHEN 'February' THEN 2 WHEN 'March' THEN 3 WHEN 'April' THEN 4 WHEN 'May' THEN 5 WHEN 'June' THEN 6 WHEN 'July' THEN 7 WHEN 'August' THEN 8 WHEN 'September' THEN 9 WHEN 'October' THEN 10 WHEN 'November' THEN 11 WHEN 'December' THEN 12 END DESC LIMIT 6`, [tid]);

  const studentsByGrade = await dbAll('SELECT grade, COUNT(*) as count FROM students WHERE tutor_id=? AND grade IS NOT NULL GROUP BY grade ORDER BY grade', [tid]);
  const secondaryAdmins = await dbAll('SELECT id, phone, name FROM tutor_admins WHERE tutor_id = ?', [tid]);
  const primaryAdmin = await dbGet('SELECT phone, name FROM tutors WHERE id = ?', [tid]);

  res.json({
    students: studentStats,
    payments: { ...paymentStats, month: currentMonth, year: currentYear },
    classCount,
    recentMessages,
    aiMessages,
    revenueTrend: revenueTrend.reverse(),
    studentsByGrade,
    admins: {
      primary: primaryAdmin,
      secondary: secondaryAdmins,
      // Fix Bug 52: PII Leak - only show system admin phones to developers
      system: req.tutor.role === 'developer' 
        ? (process.env.ADMIN_PHONE || '').split(',').map(p => p.trim()).filter(Boolean)
        : []
    },
    aiProvider: 'openai'
  });
});

router.get('/settings', async (req, res) => {
  let settings = await dbGet('SELECT * FROM settings WHERE tutor_id=?', [req.tutor.id]);
  if (!settings) {
    await dbRun('INSERT INTO settings (tutor_id) VALUES (?)', [req.tutor.id]);
    settings = await dbGet('SELECT * FROM settings WHERE tutor_id=?', [req.tutor.id]);
  }
  const tutor = await dbGet('SELECT institute_name FROM tutors WHERE id=?', [req.tutor.id]);
  res.json({ settings: { ...settings, institute_name: tutor ? tutor.institute_name : '' } });
});

router.put('/settings', async (req, res) => {
  const { 
    auto_reply_enabled, auto_reply_message, welcome_message, 
    payment_reminder_enabled, payment_reminder_day, ai_tone, 
    bank_name, bank_account, bank_branch, bank_account_holder,
    institute_name, tutor_name, basic_fee, tute_fee, final_grade
  } = req.body;

  // Update tutor institute name if provided
  if (institute_name) {
    await dbRun('UPDATE tutors SET institute_name=? WHERE id=?', [institute_name, req.tutor.id]);
  }

  await dbRun(`UPDATE settings SET 
    auto_reply_enabled=COALESCE(?,auto_reply_enabled),
    auto_reply_message=COALESCE(?,auto_reply_message),
    welcome_message=COALESCE(?,welcome_message),
    payment_reminder_enabled=COALESCE(?,payment_reminder_enabled),
    payment_reminder_day=COALESCE(?,payment_reminder_day),
    ai_tone=COALESCE(?,ai_tone),
    bank_name=COALESCE(?,bank_name),
    bank_account=COALESCE(?,bank_account),
    bank_branch=COALESCE(?,bank_branch),
    bank_account_holder=COALESCE(?,bank_account_holder),
    tutor_name=COALESCE(?,tutor_name),
    basic_fee=COALESCE(?,basic_fee),
    tute_fee=COALESCE(?,tute_fee),
    final_grade=COALESCE(?,final_grade),
    updated_at=CURRENT_TIMESTAMP 
    WHERE tutor_id=?`,
    [
      auto_reply_enabled??null, auto_reply_message||null, welcome_message||null, 
      payment_reminder_enabled??null, payment_reminder_day??null, ai_tone||null, 
      bank_name||null, bank_account||null, bank_branch||null, bank_account_holder||null,
      tutor_name||null, basic_fee??null, tute_fee??null, final_grade??null,
      req.tutor.id
    ]
  );

  const settings = await dbGet('SELECT * FROM settings WHERE tutor_id=?', [req.tutor.id]);
  const tutor = await dbGet('SELECT institute_name FROM tutors WHERE id=?', [req.tutor.id]);
  
  const whatsappService = require('../services/whatsapp');
  if (typeof whatsappService.clearTutorCache === 'function') {
    whatsappService.clearTutorCache();
  }

  res.json({ settings: { ...settings, institute_name: tutor ? tutor.institute_name : '' } });
});

router.post('/reset-ai-cache', async (req, res) => {
  if (req.tutor.role !== 'developer') return res.status(403).json({ error: 'Developer only action' });
  await dbRun('DELETE FROM ai_cache');
  res.json({ success: true, message: 'AI Cache cleared' });
});

router.post('/reset-conversations', async (req, res) => {
  // Allow any authenticated tutor to clear their own history
  await dbRun('DELETE FROM message_logs WHERE tutor_id = ?', [req.tutor.id]);
  res.json({ success: true, message: 'Conversation history cleared' });
});

router.get('/admins', async (req, res) => {
  const secondary = await dbAll('SELECT * FROM tutor_admins WHERE tutor_id = ?', [req.tutor.id]);
  const primary = await dbGet('SELECT phone, name FROM tutors WHERE id = ?', [req.tutor.id]);
  const system = req.tutor.role === 'developer' 
    ? (process.env.ADMIN_PHONE || '').split(',').map(p => p.trim()).filter(Boolean)
    : [];
  
  res.json({ 
    admins: secondary, // Keep for backward compatibility
    primary,
    secondary,
    system
  });
});

router.post('/admins', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });
  await dbRun('INSERT INTO tutor_admins (tutor_id, phone) VALUES (?,?) ON CONFLICT DO NOTHING', [req.tutor.id, phone]);
  res.json({ success: true });
});

router.delete('/admins/:id', async (req, res) => {
  await dbRun('DELETE FROM tutor_admins WHERE id = ? AND tutor_id = ?', [req.params.id, req.tutor.id]);
  res.json({ success: true });
});

router.put('/tutor/phone', async (req, res) => {
  if (req.tutor.role !== 'developer') return res.status(403).json({ error: 'Forbidden' });
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });
  
  await dbRun('UPDATE tutors SET phone = ? WHERE id = ?', [phone, req.tutor.id]);
  res.json({ success: true, message: 'Primary phone updated' });
});

router.get('/group-mappings', async (req, res) => {
  const mappings = await dbAll(`
    SELECT wg.*, c.name as class_name, c.grade as class_grade, c.subject as class_subject 
    FROM whatsapp_groups wg
    LEFT JOIN classes c ON wg.class_id = c.id
    WHERE wg.tutor_id = ?
    ORDER BY wg.year DESC, wg.month DESC, c.grade ASC
  `, [req.tutor.id]);
  res.json({ mappings });
});

router.post('/create-group', async (req, res) => {
  const { classId, month, year, groupName } = req.body;
  const whatsappService = require('../services/whatsapp');
  
  if (!classId || !month || !year || !groupName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const tutor = await dbGet('SELECT phone FROM tutors WHERE id = ?', [req.tutor.id]);
    const participants = [];
    if (tutor && tutor.phone) {
      // Normalize and add tutor phone as a participant
      const normalized = tutor.phone.replace(/[^0-9]/g, '');
      participants.push(normalized.startsWith('94') ? `${normalized}@c.us` : `94${normalized.replace(/^0/, '')}@c.us`);
    }

    const result = await whatsappService.createGroup(groupName, participants);
    if (result.success) {
      // Fix Bug 53: Scope class lookup to tutor
      const cls = await dbGet('SELECT grade, subject FROM classes WHERE id = ? AND tutor_id = ?', [classId, req.tutor.id]);
      await dbRun(`
        INSERT INTO whatsapp_groups (tutor_id, name, whatsapp_group_id, class_id, month, year, grade, subject)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (class_id, month, year) 
        DO UPDATE SET whatsapp_group_id = EXCLUDED.whatsapp_group_id, name = EXCLUDED.name
      `, [req.tutor.id, groupName, result.gid, classId, month, year, cls?.grade, cls?.subject]);
      
      res.json({ success: true, groupId: result.gid });
    } else {
      res.status(500).json({ error: 'Failed to create group' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/update-mapping', async (req, res) => {
  const { classId, month, year, groupId } = req.body;
  if (!classId || !month || !year || !groupId) return res.status(400).json({ error: 'Missing fields' });

  // Fix Bug 24: Verify class ownership
  const cls = await dbGet('SELECT grade, subject, name FROM classes WHERE id = ? AND tutor_id = ?', [classId, req.tutor.id]);
  if (!cls) return res.status(403).json({ error: 'Unauthorized: This class does not belong to you.' });

  await dbRun(`
    INSERT INTO whatsapp_groups (tutor_id, name, whatsapp_group_id, class_id, month, year, grade, subject)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (class_id, month, year) 
    DO UPDATE SET whatsapp_group_id = EXCLUDED.whatsapp_group_id, name = EXCLUDED.name
  `, [req.tutor.id, cls?.name || 'Class Group', groupId, classId, month, year, cls?.grade, cls?.subject]);
  
  res.json({ success: true });
});

module.exports = router;
