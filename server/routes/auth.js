const express = require('express');
const bcrypt = require('bcryptjs');
const { dbRun, dbGet } = require('../db/connection');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone, institute_name } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = dbGet('SELECT id FROM tutors WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const result = dbRun('INSERT INTO tutors (name, email, password_hash, phone, institute_name) VALUES (?,?,?,?,?)',
      [name, email, passwordHash, phone || null, institute_name || 'My Tuition Class']);

    dbRun('INSERT INTO settings (tutor_id) VALUES (?)', [result.lastInsertRowid]);

    const tutor = { id: result.lastInsertRowid, email, name };
    const token = generateToken(tutor);
    res.status(201).json({ token, tutor: { id: tutor.id, name, email, institute_name: institute_name || 'My Tuition Class' } });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const tutor = dbGet('SELECT * FROM tutors WHERE email = ?', [email]);
    if (!tutor) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, tutor.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateToken(tutor);
    res.json({ token, tutor: { id: tutor.id, name: tutor.name, email: tutor.email, phone: tutor.phone, institute_name: tutor.institute_name } });
  } catch (err) { next(err); }
});

router.get('/me', require('../middleware/auth').authMiddleware, (req, res) => {
  const tutor = dbGet('SELECT id, name, email, phone, institute_name, created_at FROM tutors WHERE id = ?', [req.tutor.id]);
  if (!tutor) return res.status(404).json({ error: 'Tutor not found' });
  res.json({ tutor });
});

module.exports = router;
