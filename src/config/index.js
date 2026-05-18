const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno desde .env en la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/pavimento_db',
  isProduction: process.env.NODE_ENV === 'production',
};

module.exports = config;
