require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');

const { initDb, closeDb } = require('./db/connection');
const { migrate } = require('./db/migrate');
const { authMiddleware } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const { setupWebSocket } = require('./websocket');
const whatsappService = require('./services/whatsapp');
const aiService = require('./services/ai');
const cronService = require('./services/cron');

const app = express();
const server = http.createServer(app);

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: { error: 'Too many requests' } });
app.use('/api/', apiLimiter);

const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'AI rate limit reached' } });

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', authMiddleware, require('./routes/students'));
app.use('/api/classes', authMiddleware, require('./routes/classes'));
app.use('/api/payments', authMiddleware, require('./routes/payments'));
app.use('/api/groups', authMiddleware, require('./routes/groups'));
app.use('/api/whatsapp', authMiddleware, require('./routes/whatsapp'));
app.use('/api/messages', authMiddleware, require('./routes/messages'));
app.use('/api/ai', authMiddleware, aiLimiter, require('./routes/ai'));
app.use('/api/knowledge', authMiddleware, require('./routes/knowledge'));
app.use('/api/dashboard', authMiddleware, require('./routes/dashboard'));
app.use('/api/attendance', authMiddleware, require('./routes/attendance'));
app.use('/api/tutes', authMiddleware, require('./routes/tutes'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), whatsapp: whatsappService.getStatus().status, timestamp: new Date().toISOString() });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => { res.sendFile(path.join(__dirname, '../client/dist/index.html')); });
}

app.use(errorHandler);

// WebSocket
setupWebSocket(server);

  // Start
  const PORT = process.env.PORT || 3001;
  
  async function start() {
    // Initialize database
    await initDb();
    await migrate();
  
    server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║     🎓 Tutor WhatsApp SaaS Platform         ║
║     Server running on port ${PORT}              ║
║     API:  http://localhost:${PORT}/api           ║
╚══════════════════════════════════════════════╝
    `);

    // Initialize WhatsApp
    console.log('[Server] Initializing WhatsApp...');
    whatsappService.initialize();
    
    // Start Cron Jobs
    cronService.start();

    // Schedule cache cleanup every 6 hours
    setInterval(() => { try { aiService.cleanCache(); } catch(e) {} }, 6 * 60 * 60 * 1000);
  });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });

// Graceful shutdown — works on both Windows and Linux
async function gracefulShutdown(signal) {
  console.log(`\n[Server] ${signal} received. Shutting down...`);
  cronService.stop();
  await whatsappService.destroy();
  closeDb();
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle Windows-specific process exit (nodemon on Windows sends SIGINT, not SIGUSR2)
process.on('exit', () => {
  try { closeDb(); } catch(e) {}
});

// Prevent zombie processes from wwebjs internal errors
process.on('uncaughtException', (err) => {
  console.error('🚨 [FATAL] Uncaught Exception:', err);
  // Graceful shutdown before exit
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Warning] Unhandled Rejection at:', promise, 'reason:', reason);
  // Do NOT shut down on every rejection in production as it kills the bot for minor API errors
  if (reason && (reason.message?.includes('database') || reason.message?.includes('connection'))) {
    console.error('🚨 Critical DB error detected. Shutting down for safety...');
    gracefulShutdown('CRITICAL_UNHANDLED_REJECTION');
  }
});

module.exports = app;
