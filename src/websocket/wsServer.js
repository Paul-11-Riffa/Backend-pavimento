const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

/**
 * WebSocket Server para notificaciones en tiempo real.
 *
 * Eventos emitidos:
 *  - position:update  → Nueva posición GPS de un reo
 *  - alert:new        → Un reo salió de su zona restringida 🚨
 *  - alert:update     → Una alerta cambió de estado
 */

let wss = null;

/**
 * Inicializa el WebSocket server montado sobre un HTTP server.
 */
function init(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Autenticación de WebSocket
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    
    if (!token) {
      ws.close(1008, 'Token de autenticación requerido');
      return;
    }

    try {
      const secret = process.env.JWT_SECRET || 'super-secret-geoguard-key';
      jwt.verify(token, secret);
    } catch (err) {
      ws.close(1008, 'Token inválido o expirado');
      return;
    }

    console.log('  🔌 WebSocket: Cliente conectado (Autenticado)');

    ws.on('close', () => {
      console.log('  🔌 WebSocket: Cliente desconectado');
    });

    ws.on('error', (err) => {
      console.error('  ❌ WebSocket error:', err.message);
    });

    // Enviar mensaje de bienvenida
    ws.send(JSON.stringify({
      type: 'connection',
      data: { message: 'Conectado al sistema de monitoreo GeoGuard', timestamp: new Date().toISOString() },
    }));
  });

  console.log('  🔌 WebSocket server iniciado en /ws');
}

/**
 * Broadcast: envía un evento a todos los clientes conectados.
 */
function broadcast(eventType, data) {
  if (!wss) return;

  const message = JSON.stringify({ type: eventType, data });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

/**
 * Obtiene la cantidad de clientes conectados.
 */
function getClientCount() {
  return wss ? wss.clients.size : 0;
}

module.exports = { init, broadcast, getClientCount };
