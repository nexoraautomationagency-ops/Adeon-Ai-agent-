import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const [waStatus, setWaStatus] = useState({ status: 'disconnected', isReady: false });
  const [qrCode, setQrCode] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('token');
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => console.log('[WS] Connected');

      ws.onmessage = (event) => {
        try {
          const { type, data } = JSON.parse(event.data);
          switch (type) {
            case 'wa_status':
              setWaStatus(data);
              if (data.status === 'ready') setQrCode(null);
              break;
            case 'wa_qr':
              setQrCode(data.qrCode);
              break;
            case 'wa_message':
              setLastMessage(data);
              break;
            case 'db_update':
              setLastMessage({ ...data, _type: 'db_update', _ts: Date.now() });
              break;
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting in 3s...');
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('[WS] Error');
        ws.close();
      };
    } catch (e) {
      console.error('[WS] Connection failed');
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  return (
    <WebSocketContext.Provider value={{ waStatus, qrCode, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocket must be used within WebSocketProvider');
  return ctx;
}
