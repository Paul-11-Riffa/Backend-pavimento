const knex = require('knex');
const config = require('./index');

/**
 * Instancia de Knex conectada a PostgreSQL (Supabase / local).
 *
 * Pool de conexiones configurado según el entorno:
 *  - Development: min 2, max 10
 *  - Production:  min 5, max 20
 *
 * SSL habilitado automáticamente para conexiones remotas (Supabase, AWS RDS).
 * Supabase usa certificados internos, por lo que se configura rejectUnauthorized: false.
 */
const isRemote =
  config.databaseUrl.includes('supabase') ||
  config.databaseUrl.includes('rds.amazonaws');

const db = knex({
  client: 'pg',
  connection: {
    connectionString: config.databaseUrl,
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  },
  pool: {
    min: config.isProduction ? 5 : 2,
    max: config.isProduction ? 20 : 10,
    acquireTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  },
});

module.exports = db;
