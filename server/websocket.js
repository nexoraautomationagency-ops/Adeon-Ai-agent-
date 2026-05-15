const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const whatsappService = require('./services/whatsapp');

const JWT_SECRET = process.env.JWT_SECRET;

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  const clients = new Set();

  wss.on('connection', (ws, req) => {
    // Fix Bug 11: Authenticate WebSocket connection
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      console.warn('[WS] Connection rejected: No token');
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      ws.tutor_id = decoded.id;
      clients.add(ws);
      console.log(`[WS] Tutor ${ws.tutor_id} connected. Total: ${clients.size}`);
    } catch (err) {
      console.warn('[WS] Connection rejected: Invalid token');
      ws.close(4002, 'Invalid token');
      return;
    }

    // Send initial status for THIS tutor
    const currentStatus = whatsappService.getStatus();
    ws.send(JSON.stringify({
      type: 'wa_status',
      data: currentStatus
    }));

    if (currentStatus.qrCode) {
      ws.send(JSON.stringify({
        type: 'wa_qr',
        data: { qrCode: currentStatus.qrCode }
      }));
    }

    ws.on('close', () => {
      clients.delete(ws);
      console.log('[WS] Client disconnected.');
    });

    ws.on('error', (err) => {
      console.error('[WS] Error:', err.message);
      clients.delete(ws);
    });
  });

  function broadcast(type, data, targetTutorId = null) {
    const message = JSON.stringify({ type, data });
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        // Fix Bug 11: Filter broadcasts by tutor_id
        if (!targetTutorId || client.tutor_id === targetTutorId) {
          client.send(message);
        }
      }
    });
  }

  // Forward WhatsApp events to WebSocket clients
  whatsappService.on('status_change', (data) => {
    // Status is global for now (per instance), so broadcast to all or filter if instance-per-tutor
    broadcast('wa_status', data);
  });

  whatsappService.on('qr', (qrCode) => {
    broadcast('wa_qr', { qrCode });
  });

  whatsappService.on('message', (msg) => {
    // Only broadcast if we can determine the tutor_id from the message log or student
    // This is handled in whatsapp.js where it emits with tutor_id if possible
    if (msg.tutor_id) {
       broadcast('wa_message', msg, msg.tutor_id);
    }
  });

  whatsappService.on('db_update', (data) => {
    // Assume data includes tutor_id for proper filtering
    if (data.tutor_id) {
      broadcast('db_update', data, data.tutor_id);
    } else {
      // Fallback for global or untagged updates
      broadcast('db_update', data);
    }
  });

  return wss;
}

module.exports = { setupWebSocket };
