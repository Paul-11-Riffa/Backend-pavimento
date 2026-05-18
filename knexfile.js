const config = require('./src/config');

const isRemote =
  config.databaseUrl.includes('supabase') ||
  config.databaseUrl.includes('rds.amazonaws');

module.exports = {
  client: 'pg',
  connection: {
    connectionString: config.databaseUrl,
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  },
  migrations: {
    directory: './migrations',
  },
  pool: {
    min: 2,
    max: 10,
  },
};
