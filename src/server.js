const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const wsServer = require('./websocket/wsServer');
const gpsService = require('./services/gps.service');
const alertsService = require('./services/alerts.service');

/**
 * Verificar conexión a la base de datos y arrancar el servidor.
 */
async function start() {
  try {
    // Verificar que PostgreSQL + PostGIS estén accesibles
    const result = await db.raw('SELECT PostGIS_Version() as version');
    console.log(`  ✅ PostGIS conectado (v${result.rows[0].version})`);
  } catch (error) {
    console.error('  ❌ No se pudo conectar a la base de datos:');
    console.error(`     ${error.message}`);
    console.error('');
    console.error('  Asegurate de que PostgreSQL + PostGIS estén corriendo.');
    console.error('  Podés levantarlos con: docker-compose up -d');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`
  ╔══════════════════════════════════════════════════╗
  ║   🛡️  GeoGuard — Monitoreo de Áreas Restringidas ║
  ║   Servidor corriendo en puerto ${String(config.port).padEnd(17)}║
  ║   HTTP:  http://localhost:${String(config.port).padEnd(22)}║
  ║   WS:    ws://localhost:${String(config.port).padEnd(24)}║
  ╚══════════════════════════════════════════════════╝
    `);
  });

  // ─── Inicializar WebSocket ──────────────────────────────────────────────
  wsServer.init(server);

  // Inyectar broadcast en los servicios que lo necesitan
  gpsService.setWsBroadcast(wsServer.broadcast);
  alertsService.setWsBroadcast(wsServer.broadcast);

  // ─── Graceful Shutdown ──────────────────────────────────────────────────

  async function shutdown(signal) {
    console.log(`\n  ⏳ Recibida señal ${signal}. Cerrando servidor...`);

    server.close(async () => {
      console.log('  ✅ Servidor HTTP cerrado.');

      try {
        await db.destroy();
        console.log('  ✅ Pool de base de datos cerrado.');
      } catch (error) {
        console.error('  ❌ Error cerrando pool de DB:', error.message);
      }

      process.exit(0);
    });

    // Forzar cierre si tarda más de 10 segundos
    setTimeout(() => {
      console.error('  ❌ Cierre forzado tras 10s.');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
