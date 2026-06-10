const rateLimit = require('express-rate-limit');

/**
 * Middleware para limitar peticiones GPS (evitar DDoS o flood de coordenadas).
 * Límite: 2 peticiones por segundo por IP.
 */
const gpsRateLimiter = rateLimit({
  windowMs: 1000, // 1 segundo
  max: 2, // Límite cada IP a 2 solicitudes por ventana
  message: {
    error: {
      status: 429,
      message: 'Demasiadas peticiones. Por favor, disminuya la frecuencia de actualización del GPS.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { gpsRateLimiter };
