const WebSocket = require('ws');
const whatsappService = require('./services/whatsapp');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  const clients = new Set();

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('[WS] Client connected. Total:', clients.size);

    // Send current WhatsApp status immediately
    ws.send(JSON.stringify({
      type: 'wa_status',
      data: whatsappService.getStatus()
    }));

    ws.on('close', () => {
      clients.delete(ws);
      console.log('[WS] Client disconnected. Total:', clients.size);
    });

    ws.on('error', (err) => {
      console.error('[WS] Error:', err.message);
      clients.delete(ws);
    });
  });

  function broadcast(type, data) {
    const message = JSON.stringify({ type, data });
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Forward WhatsApp events to WebSocket clients
  whatsappService.on('status_change', (data) => {
    broadcast('wa_status', data);
  });

  whatsappService.on('qr', (qrCode) => {
    broadcast('wa_qr', { qrCode });
  });

  whatsappService.on('message', (msg) => {
    broadcast('wa_message', msg);
  });

  return wss;
}

module.exports = { setupWebSocket };
