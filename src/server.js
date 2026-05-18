const app = require('./app');
const config = require('./config');
const db = require('./config/database');

/**
 * Verificar conexión a la base de datos antes de arrancar el servidor.
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
  ╔══════════════════════════════════════════════╗
  ║   🛣️  Pavimento Backend API                  ║
  ║   Servidor corriendo en puerto ${String(config.port).padEnd(13)}║
  ║   http://localhost:${String(config.port).padEnd(25)}║
  ╚══════════════════════════════════════════════╝
    `);
  });

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
