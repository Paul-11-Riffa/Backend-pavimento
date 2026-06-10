const { ValidationError } = require('../utils/errors');

/**
 * Middleware: Valida que el body sea un Feature GeoJSON con geometría Polygon.
 * Específico para zonas restringidas.
 */
function validateZoneGeoJSON(req, res, next) {
  const body = req.body;

  // Debe ser un Feature
  if (!body || body.type !== 'Feature') {
    return next(new ValidationError('El body debe ser un Feature GeoJSON con type: "Feature".'));
  }

  // Debe tener geometría
  if (!body.geometry) {
    return next(new ValidationError('El Feature debe contener una geometría.'));
  }

  const { geometry } = body;

  // Solo polígonos para zonas restringidas
  if (geometry.type !== 'Polygon') {
    return next(
      new ValidationError(
        `Se esperaba geometría tipo "Polygon", pero se recibió "${geometry.type}". Las zonas restringidas deben ser polígonos cerrados.`
      )
    );
  }

  // Validar que tenga coordenadas
  if (!geometry.coordinates || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    return next(new ValidationError('El Polygon debe contener un array de coordenadas.'));
  }

  const ring = geometry.coordinates[0];

  // Mínimo 4 puntos (3 vértices + cierre)
  if (!Array.isArray(ring) || ring.length < 4) {
    return next(
      new ValidationError('El Polygon debe tener al menos 3 vértices (4 puntos incluyendo el cierre).')
    );
  }

  // Verificar que el anillo esté cerrado
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return next(new ValidationError('El anillo del polígono debe estar cerrado (primer punto = último punto).'));
  }

  // Validar que las coordenadas estén aproximadamente en la región de Santa Cruz, Bolivia
  // Bbox amplio: lat [-18.5, -17.0], lng [-64.0, -62.5]
  for (const [lng, lat] of ring) {
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return next(new ValidationError('Todas las coordenadas deben ser números [lng, lat].'));
    }
    if (lat < -19 || lat > -16 || lng < -65 || lng > -62) {
      return next(
        new ValidationError(
          `Coordenada [${lng}, ${lat}] está fuera del área de Santa Cruz de la Sierra. Verifique que las coordenadas sean correctas.`
        )
      );
    }
  }

  // Debe tener properties con nombre
  if (!body.properties) {
    body.properties = {};
  }

  next();
}

module.exports = validateZoneGeoJSON;
