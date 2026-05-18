const { ValidationError } = require('../utils/errors');

/**
 * Middleware que parsea y valida el query parameter `bbox` (bounding box).
 *
 * Formato esperado: ?bbox=minLon,minLat,maxLon,maxLat
 * Ejemplo: ?bbox=-66.16,18.45,-66.14,18.47
 *
 * Si bbox no está presente, pasa sin modificar.
 * Si está presente pero es inválido, retorna 400.
 * Si es válido, adjunta el bbox parseado a req.query.parsedBBox.
 */
function validateBBox(req, res, next) {
  const { bbox } = req.query;

  // Si no se envió bbox, continuar normalmente
  if (!bbox) {
    return next();
  }

  // Parsear: "minLon,minLat,maxLon,maxLat"
  const parts = bbox.split(',').map(Number);

  if (parts.length !== 4 || parts.some(isNaN)) {
    return next(
      new ValidationError(
        'El parámetro "bbox" debe tener 4 valores numéricos separados por coma: minLon,minLat,maxLon,maxLat. Ejemplo: ?bbox=-66.16,18.45,-66.14,18.47'
      )
    );
  }

  const [minLon, minLat, maxLon, maxLat] = parts;

  // Validar rangos
  if (minLon < -180 || minLon > 180 || maxLon < -180 || maxLon > 180) {
    return next(
      new ValidationError('Longitudes del bbox fuera de rango. Rango válido: [-180, 180].')
    );
  }

  if (minLat < -90 || minLat > 90 || maxLat < -90 || maxLat > 90) {
    return next(
      new ValidationError('Latitudes del bbox fuera de rango. Rango válido: [-90, 90].')
    );
  }

  // Validar que min < max
  if (minLon >= maxLon) {
    return next(
      new ValidationError(`minLon (${minLon}) debe ser menor que maxLon (${maxLon}).`)
    );
  }

  if (minLat >= maxLat) {
    return next(
      new ValidationError(`minLat (${minLat}) debe ser menor que maxLat (${maxLat}).`)
    );
  }

  // Adjuntar bbox parseado al request
  req.query.parsedBBox = { minLon, minLat, maxLon, maxLat };

  next();
}

module.exports = validateBBox;
