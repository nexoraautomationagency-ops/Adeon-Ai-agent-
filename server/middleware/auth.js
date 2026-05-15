const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET === 'fallback-secret-change-me') {
  console.error('🚨 CRITICAL ERROR: JWT_SECRET is not set in environment variables!');
  console.error('Production deployment will fail without a secure secret.');
  process.exit(1);
}


function generateToken(tutor) {
  return jwt.sign(
    { id: tutor.id, email: tutor.email, name: tutor.name, role: tutor.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryToken = req.query?.token;
  const tokenSource = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken;
  if (!tokenSource) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(tokenSource, JWT_SECRET);
    // Fix Bug 60: Real-time role check (prevents stale tokens from blocking role changes)
    const { dbGet } = require('../db/connection');
    const actualTutor = await dbGet('SELECT id, email, role, institute_name FROM tutors WHERE id = ?', [decoded.id]);
    
    if (!actualTutor) throw new Error('Tutor no longer exists');
    
    req.tutor = actualTutor;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid, expired, or stale token' });
  }
}

function developerOnly(req, res, next) {
  if (req.tutor && req.tutor.role === 'developer') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied: This action requires developer privileges.' });
  }
}

module.exports = { generateToken, authMiddleware, developerOnly };
