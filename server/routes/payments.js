const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/connection');
const normalizationService = require('../services/normalization');
const router = express.Router();

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

router.get('/', async (req, res) => {
  const { month: monthInput, year, status, student_id, page = 1, limit = 50 } = req.query;
  const month = monthInput ? normalizationService.normalizeMonth(monthInput) : null;
  const offset = (page - 1) * limit;
  let where = 'WHERE p.tutor_id = ?';
  const params = [req.tutor.id];
  if (month) { where += ' AND p.month = ?'; params.push(month); }
  if (year) { where += ' AND p.year = ?'; params.push(parseInt(year)); }
  if (status) { where += ' AND p.status = ?'; params.push(status); }
  if (student_id) { where += ' AND p.student_id = ?'; params.push(parseInt(student_id)); }

  const totalRes = await dbGet(`SELECT COUNT(*) as total FROM payments p JOIN students s ON s.id = p.student_id ${where}`, params);
  const total = totalRes ? totalRes.total : 0;
  const payments = await dbAll(`SELECT p.*, s.name as student_name, s.phone as student_phone, s.grade as student_grade, 
    (SELECT string_agg(c.subject || ' (' || c.grade || ')', ', ') 
     FROM student_classes sc 
     JOIN classes c ON sc.class_id = c.id 
     WHERE sc.student_id = s.id) as student_classes_list 
    FROM payments p JOIN students s ON s.id = p.student_id ${where} ORDER BY p.year DESC, p.month DESC, s.name ASC LIMIT ? OFFSET ?`, [...params, parseInt(limit), parseInt(offset)]);
  res.json({ payments, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/summary', async (req, res) => {
  const { month: monthInput, year } = req.query;
  const m = normalizationService.normalizeMonth(monthInput || MONTHS[new Date().getMonth()]);
  const y = year || new Date().getFullYear();
  const summary = await dbGet(`SELECT COUNT(*) as total_records, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_count, SUM(CASE WHEN status='unpaid' THEN 1 ELSE 0 END) as unpaid_count, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending_count, SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) as total_collected, SUM(CASE WHEN status!='paid' THEN amount ELSE 0 END) as total_outstanding, SUM(amount) as total_expected FROM payments WHERE tutor_id=? AND month=? AND year=?`, [req.tutor.id, m, parseInt(y)]);
  const byGrade = await dbAll(`SELECT s.grade, COUNT(*) as total, SUM(CASE WHEN p.status='paid' THEN 1 ELSE 0 END) as paid, SUM(CASE WHEN p.status!='paid' THEN 1 ELSE 0 END) as unpaid, SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END) as collected FROM payments p JOIN students s ON s.id=p.student_id WHERE p.tutor_id=? AND p.month=? AND p.year=? GROUP BY s.grade ORDER BY s.grade`, [req.tutor.id, m, parseInt(y)]);
  res.json({ summary, byGrade, month: m, year: y });
});

// Unified Automation: Handle Activation, Notification, Class Enrollment, and Tute Creation
async function handlePaymentSuccess(tutor, paymentId, studentId, month, year) {
  try {
    const student = await dbGet('SELECT * FROM students WHERE id = ?', [studentId]);
    if (!student) return;

    // 1. Activate Student
    await dbRun("UPDATE students SET status = 'active' WHERE id = ?", [student.id]);

    // 2. Auto-Enroll in Class (Fallback only if no classes exist)
    if (student.grade) {
      const existingClasses = await dbGet('SELECT COUNT(*) as count FROM student_classes WHERE student_id = ?', [student.id]);
      if (!existingClasses || existingClasses.count === 0) {
        const matchingClass = await dbGet('SELECT id FROM classes WHERE tutor_id = ? AND grade = ? LIMIT 1', [tutor.id, student.grade]);
        if (matchingClass) {
          await dbRun('INSERT INTO student_classes (student_id, class_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [student.id, matchingClass.id]);
        }
      }
    }

    // 3. Create Tute Delivery record
    const deliveryExists = await dbGet('SELECT id FROM tute_deliveries WHERE student_id = ? AND month = ? AND year = ?', [student.id, month, year]);
    if (!deliveryExists) {
      await dbRun(`
        INSERT INTO tute_deliveries (tutor_id, student_id, payment_id, month, year, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `, [tutor.id, student.id, paymentId, month, year]);
      console.log(`📦 Tute delivery created for ${student.name} (${month})`);
    }

    // 4. Group Sync & WhatsApp Notification
    const whatsappService = require('../services/whatsapp');
    
    // Add to group first
    let groupAdded = false;
    let groupName = 'their class group';
    try {
        groupAdded = await whatsappService.syncStudentToMonthlyGroup(student.id, month, year);
        // Try to get the actual group name for the admin notification
        const { dbGet: dg } = require('../db/connection');
        const grp = await dg(`SELECT name FROM whatsapp_groups WHERE grade = ? AND (month IS NULL OR month = ?) LIMIT 1`, [student.grade, month]);
        if (grp?.name) groupName = grp.name;
    } catch (e) {
        console.error('[Automation] Group sync failed:', e.message);
    }

    // Notify ADMIN only — student does NOT get a message
    try {
        const statusMsg = groupAdded
            ? `✅ *Payment Approved*\n\n*Student:* ${student.name}\n*Grade:* ${student.grade}\n*Month:* ${month}\n\nStudent has been added to *${groupName}* successfully.`
            : `✅ *Payment Approved*\n\n*Student:* ${student.name}\n*Grade:* ${student.grade}\n*Month:* ${month}\n\n⚠️ Could not add to group automatically. Please add manually.\n*(Check: student has a valid phone number saved)*`;
        await whatsappService.notifyAdmin(statusMsg);

        // Notify STUDENT (Requested by user)
        const target = student.whatsapp_id && student.whatsapp_id.includes('@') ? student.whatsapp_id : student.phone;
        if (target) {
            await whatsappService.sendToPhone(target, `Your registration for ${month} has been approved. Welcome to the class! ✅`);
        }
    } catch (e) {
        console.error('[Automation] Notify failed:', e.message);
    }
  } catch (err) {
    console.error('[Payment Automation Error]', err.message);
  }
}

router.post('/generate', async (req, res) => {
  const { month: monthInput, year } = req.body;
  if (!monthInput || !year) return res.status(400).json({ error: 'month and year required' });
  const month = normalizationService.normalizeMonth(monthInput);

  try {
    const students = await dbAll('SELECT id, monthly_fee FROM students WHERE tutor_id = ? AND status = ?', [req.tutor.id, 'active']);
    let created = 0;
    
    for (const student of students) {
      const existing = await dbGet('SELECT id FROM payments WHERE student_id = ? AND month = ? AND year = ?', [student.id, month, parseInt(year)]);
      if (!existing) {
        await dbRun('INSERT INTO payments (tutor_id, student_id, amount, month, year, status) VALUES (?, ?, ?, ?, ?, ?)', 
          [req.tutor.id, student.id, student.monthly_fee || 0, month, parseInt(year), 'pending']);
        created++;
      }
    }
    
    res.json({ success: true, created });
  } catch (err) {
    console.error('[Generate Payments Error]', err);
    res.status(500).json({ error: 'Failed to generate payments' });
  }
});

router.post('/', async (req, res) => {
  const { student_id, amount, month: monthInput, year, status, payment_method, notes } = req.body;
  if (!student_id || !amount || !monthInput || !year) return res.status(400).json({ error: 'student_id, amount, month, year required' });
  const month = normalizationService.normalizeMonth(monthInput);
  
  const result = await dbRun('INSERT INTO payments (tutor_id,student_id,amount,month,year,status,payment_method,notes,paid_date) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id',
    [req.tutor.id, student_id, amount, month, year, status||'unpaid', payment_method||null, notes||null, status==='paid'?new Date().toISOString():null]);
  
  const paymentId = result.lastInsertRowid;
  if (status === 'paid') {
    await handlePaymentSuccess(req.tutor, paymentId, student_id, month, year);
  }

  res.status(201).json({ payment: await dbGet('SELECT * FROM payments WHERE id=?', [paymentId]) });
});

router.put('/:id', async (req, res) => {
  const existing = await dbGet('SELECT * FROM payments WHERE id=? AND tutor_id=?', [req.params.id, req.tutor.id]);
  if (!existing) return res.status(404).json({ error: 'Payment not found' });
  
  const { status, amount, payment_method, notes } = req.body;
  const paidDate = status === 'paid' ? (existing.paid_date || new Date().toISOString()) : existing.paid_date;
  
  await dbRun('UPDATE payments SET status=COALESCE(?,status),amount=COALESCE(?,amount),payment_method=COALESCE(?,payment_method),notes=COALESCE(?,notes),paid_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tutor_id=?',
    [status||null, amount??null, payment_method||null, notes||null, paidDate, req.params.id, req.tutor.id]);

  if (status === 'paid' && existing.status !== 'paid') {
    await handlePaymentSuccess(req.tutor, req.params.id, existing.student_id, existing.month, existing.year);
  }


  // AUTOMATION: If marked as rejected
  if (status === 'unpaid' && existing.status === 'pending') {
    const student = await dbGet('SELECT * FROM students WHERE id = ?', [existing.student_id]);
    if (student) {
      const whatsappService = require('../services/whatsapp');
      const reason = notes || "Payment receipt could not be verified.";
      try {
        const target = student.whatsapp_id && student.whatsapp_id.includes('@') ? student.whatsapp_id : student.phone;
        await whatsappService.sendToPhone(target, `⚠️ Your payment receipt for *${existing.month}* was rejected.\n\n*Reason:* ${reason}\n\nPlease check and upload the correct receipt again. 🙏`);
      } catch (e) {
        console.error('[Automation] Rejection notify failed:', e.message);
      }
    }
  }

  res.json({ payment: await dbGet('SELECT * FROM payments WHERE id=?', [req.params.id]) });
});

router.get('/export', async (req, res) => {
  const { month: monthInput, year } = req.query;
  const month = monthInput ? normalizationService.normalizeMonth(monthInput) : null;
  let where = 'WHERE p.tutor_id = ?';
  const params = [req.tutor.id];
  if (month) { where += ' AND p.month = ?'; params.push(month); }
  if (year) { where += ' AND p.year = ?'; params.push(parseInt(year)); }

  const payments = await dbAll(`SELECT p.*, s.name as student_name, s.phone as student_phone, s.grade as student_grade FROM payments p JOIN students s ON s.id = p.student_id ${where} ORDER BY s.grade, s.name`, params);

  // Fix Bug 6: CSV Injection protection
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    let str = val.toString();
    if (str.includes(',') || str.includes('"') || str.includes('\n') || /^[=+\-@\t\r]/.test(str)) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const header = ['Student', 'Phone', 'Grade', 'Amount', 'Status', 'Month', 'Year', 'Paid Date'].join(',');
  const rows = payments.map(p => [
    escapeCsv(p.student_name),
    escapeCsv(p.student_phone),
    escapeCsv(p.student_grade),
    p.amount,
    p.status,
    p.month,
    p.year,
    escapeCsv(p.paid_date || '')
  ].join(','));

  const csv = [header, ...rows].join('\n');

  const filename = `payments_${month || 'all'}_${year || 'all'}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

module.exports = router;
