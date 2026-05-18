const express = require('express');
const cors = require('cors');
const config = require('./config');
const db = require('./config/database');
const reportsRoutes = require('./routes/reports.routes');
const requestLogger = require('./middlewares/requestLogger');
const { AppError } = require('./utils/errors');

const app = express();

// ─── Middlewares globales ────────────────────────────────────────────────────

// Logging de peticiones HTTP
app.use(requestLogger);

// Habilitar CORS para permitir peticiones del frontend
app.use(cors({ origin: config.corsOrigin }));

// Parsear JSON con un límite de 1 MB (suficiente para geometrías grandes)
app.use(express.json({ limit: '1mb' }));

// ─── Ruta de salud (con verificación de base de datos) ──────────────────────

app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let postgisVersion = null;

  try {
    const result = await db.raw('SELECT PostGIS_Version() as version');
    dbStatus = 'connected';
    postgisVersion = result.rows[0].version;
  } catch {
    dbStatus = 'error';
  }

  const healthy = dbStatus === 'connected';

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'pavimento-backend',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      postgis: postgisVersion,
    },
  });
});

// ─── Rutas de la API ────────────────────────────────────────────────────────

app.use('/api/reports', reportsRoutes);

// ─── Manejo de rutas no encontradas ─────────────────────────────────────────

app.use((req, res, next) => {
  next(new AppError(`Ruta ${req.method} ${req.originalUrl} no encontrada.`, 404));
});

// ─── Middleware global de manejo de errores ──────────────────────────────────

app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  // Log del error en consola (solo en desarrollo)
  if (statusCode === 500) {
    console.error('❌ Error interno:', err);
  }

  res.status(statusCode).json({
    error: {
      status: statusCode,
      message,
    },
  });
});

module.exports = app;
