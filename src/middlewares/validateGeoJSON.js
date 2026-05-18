const { ValidationError } = require('../utils/errors');
const gv = require('../utils/geometryValidator');

// Tipos de geometría permitidos para reportes de calles
const ALLOWED_GEOMETRY_TYPES = ['LineString', 'Polygon'];

/**
 * Middleware que valida que el body de la petición sea un Feature GeoJSON válido
 * con una geometría de tipo LineString o Polygon.
 *
 * Validaciones estructurales:
 *  1. El body debe tener type === "Feature"
 *  2. Debe incluir un objeto "geometry"
 *  3. geometry.type debe ser "LineString" o "Polygon"
 *  4. geometry.coordinates debe ser un arreglo no vacío
 *  5. "properties" debe ser un objeto (puede estar vacío)
 *
 * Validaciones matemáticas (Fase 2):
 *  6. Coordenadas dentro de rangos válidos (lon: [-180,180], lat: [-90,90])
 *  7. Polígonos cerrados (primer punto === último punto)
 *  8. Sin auto-intersecciones en polígonos
 *  9. Área mínima para polígonos (≥ 1 m²)
 * 10. Longitud mínima para líneas (≥ 1 metro)
 * 11. Winding order RFC 7946 (se corrige automáticamente)
 */
function validateGeoJSON(req, res, next) {
  const { body } = req;

  // ─── Validaciones Estructurales ────────────────────────────────────────

  // 1. Verificar que sea un Feature
  if (!body || body.type !== 'Feature') {
    return next(
      new ValidationError(
        'El body debe ser un objeto GeoJSON de tipo "Feature". Ejemplo: { "type": "Feature", "geometry": {...}, "properties": {...} }'
      )
    );
  }

  // 2. Verificar que tenga geometría
  const { geometry } = body;
  if (!geometry || typeof geometry !== 'object') {
    return next(
      new ValidationError('El Feature debe incluir un objeto "geometry" válido.')
    );
  }

  // 3. Verificar tipo de geometría permitido
  if (!ALLOWED_GEOMETRY_TYPES.includes(geometry.type)) {
    return next(
      new ValidationError(
        `Tipo de geometría "${geometry.type}" no soportado. Tipos permitidos: ${ALLOWED_GEOMETRY_TYPES.join(', ')}.`
      )
    );
  }

  // 4. Verificar coordenadas
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    return next(
      new ValidationError(
        'La geometría debe incluir un arreglo "coordinates" no vacío.'
      )
    );
  }

  // 5. Verificar estructura básica según tipo
  if (geometry.type === 'LineString') {
    if (!Array.isArray(geometry.coordinates[0]) || geometry.coordinates.length < 2) {
      return next(
        new ValidationError(
          'Un LineString debe tener al menos 2 posiciones. Formato: [[lon, lat], [lon, lat], ...]'
        )
      );
    }
  }

  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 4) {
      return next(
        new ValidationError(
          'Un Polygon debe tener al menos un anillo con 4 o más posiciones (el primero y último punto deben coincidir).'
        )
      );
    }
  }

  // 6. Asegurar que properties exista como objeto
  if (body.properties === undefined || body.properties === null) {
    body.properties = {};
  } else if (typeof body.properties !== 'object' || Array.isArray(body.properties)) {
    return next(
      new ValidationError('"properties" debe ser un objeto (no un arreglo ni un valor primitivo).')
    );
  }

  // ─── Validaciones Matemáticas ──────────────────────────────────────────

  // 7. Validar rangos de coordenadas
  const positions = gv.extractPositions(geometry);
  const rangeCheck = gv.validateCoordinateRanges(positions);
  if (!rangeCheck.valid) {
    return next(new ValidationError(rangeCheck.message));
  }

  // Validaciones específicas por tipo de geometría
  if (geometry.type === 'Polygon') {
    // 8. Polígono cerrado
    const closedCheck = gv.validatePolygonClosed(geometry.coordinates);
    if (!closedCheck.valid) {
      return next(new ValidationError(closedCheck.message));
    }

    // 9. Sin auto-intersecciones
    const kinkCheck = gv.validateNoSelfIntersection(geometry);
    if (!kinkCheck.valid) {
      return next(new ValidationError(kinkCheck.message));
    }

    // 10. Área mínima
    const areaCheck = gv.validateMinimumArea(geometry);
    if (!areaCheck.valid) {
      return next(new ValidationError(areaCheck.message));
    }

    // 11. Corregir winding order automáticamente (no rechaza, corrige)
    gv.enforceWindingOrder(geometry);
  }

  if (geometry.type === 'LineString') {
    // 12. Longitud mínima
    const lengthCheck = gv.validateMinimumLength(geometry);
    if (!lengthCheck.valid) {
      return next(new ValidationError(lengthCheck.message));
    }
  }

  next();
}

module.exports = validateGeoJSON;
