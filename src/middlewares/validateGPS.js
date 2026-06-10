const { AppError } = require('../utils/errors');

/**
 * Middleware para validar que las coordenadas GPS estén dentro de los límites globales reales.
 * Latitud: -90 a 90
 * Longitud: -180 a 180
 */
module.exports = function validateGPS(req, res, next) {
  const { lat, lng } = req.body;

  if (lat === undefined || lng === undefined) {
    return next(new AppError('Las coordenadas lat y lng son requeridas', 400));
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    return next(new AppError('Las coordenadas lat y lng deben ser números válidos', 400));
  }

  if (latitude < -90 || latitude > 90) {
    return next(new AppError('Latitud fuera de rango válido (-90 a 90)', 400));
  }

  if (longitude < -180 || longitude > 180) {
    return next(new AppError('Longitud fuera de rango válido (-180 a 180)', 400));
  }

  next();
};
