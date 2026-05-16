const express = require('express');
const bcrypt = require('bcryptjs');
const { dbRun, dbGet } = require('../db/connection');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone, institute_name, registration_key } = req.body;
    
    // SECURITY: Only people with the secret key from .env can register
    if (registration_key !== process.env.REGISTRATION_KEY) {
      return res.status(403).json({ error: 'Public registration is disabled. Please contact the administrator.' });
    }

    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await dbGet('SELECT id FROM tutors WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await dbRun('INSERT INTO tutors (name, email, password_hash, phone, institute_name, role) VALUES (?,?,?,?,?,?) RETURNING id',
      [name, email, passwordHash, phone || null, institute_name || 'My Tuition Class', 'tutor']);

    await dbRun('INSERT INTO settings (tutor_id) VALUES (?)', [result.lastInsertRowid]);

    const tutor = { id: result.lastInsertRowid, email, name, role: 'tutor' };
    const token = generateToken(tutor);
    res.status(201).json({ token, tutor: { id: tutor.id, name, email, role: 'tutor', institute_name: institute_name || 'My Tuition Class' } });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const tutor = await dbGet('SELECT * FROM tutors WHERE email = ?', [email]);
    if (!tutor) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, tutor.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateToken(tutor);
    res.json({ token, tutor: { id: tutor.id, name: tutor.name, email: tutor.email, phone: tutor.phone, role: tutor.role, institute_name: tutor.institute_name } });
  } catch (err) { next(err); }
});

router.get('/me', require('../middleware/auth').authMiddleware, async (req, res) => {
  const targetId = req.tutor.staff_id || req.tutor.id;
  const tutor = await dbGet('SELECT id, name, email, phone, role, institute_name, created_at FROM tutors WHERE id = ?', [targetId]);
  if (!tutor) return res.status(404).json({ error: 'Tutor not found' });
  res.json({ tutor });
});

module.exports = router;
