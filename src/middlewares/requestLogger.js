/**
 * Middleware de logging de peticiones HTTP.
 *
 * Registra método, ruta, status y tiempo de respuesta en formato JSON
 * para fácil integración con servicios de logging en la nube (CloudWatch, etc.).
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  // Capturar cuando la respuesta termine
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    };

    // Colorear según status en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      const color =
        res.statusCode >= 500 ? '\x1b[31m' : // rojo
        res.statusCode >= 400 ? '\x1b[33m' : // amarillo
        res.statusCode >= 300 ? '\x1b[36m' : // cyan
        '\x1b[32m';                           // verde
      const reset = '\x1b[0m';
      console.log(
        `  ${color}${req.method.padEnd(7)}${reset} ${req.originalUrl} → ${color}${res.statusCode}${reset} (${duration}ms)`
      );
    } else {
      // JSON para producción (CloudWatch, etc.)
      console.log(JSON.stringify(log));
    }
  });

  next();
}

module.exports = requestLogger;
