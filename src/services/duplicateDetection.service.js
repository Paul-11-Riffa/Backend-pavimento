const db = require('../config/database');

/**
 * Servicio de detección de reportes duplicados mediante análisis espacial.
 *
 * Utiliza PostGIS para detectar si una nueva geometría se superpone
 * significativamente con un reporte existente activo.
 *
 * Estrategia:
 *  - Polygons: calcula ratio de intersección de área
 *  - LineStrings: crea un buffer (corredor) y compara superposición
 *  - Solo compara contra reportes activos (excluye solucionado/rechazado)
 */

// Umbral de superposición (80% por defecto)
const OVERLAP_THRESHOLD = parseFloat(process.env.DUPLICATE_OVERLAP_THRESHOLD) || 0.8;

/**
 * Busca un reporte existente que sea "duplicado" de la geometría proporcionada.
 *
 * Se considera duplicado si la superposición es ≥ OVERLAP_THRESHOLD.
 *
 * @param {Object} geometry — geometría GeoJSON (LineString o Polygon)
 * @returns {Promise<string|null>} ID del reporte duplicado, o null
 */
async function findDuplicate(geometry) {
  const geojsonStr = JSON.stringify(geometry);

  let result;

  if (geometry.type === 'Polygon') {
    // Para polígonos: ratio = área de intersección / área del nuevo polígono
    result = await db('reports')
      .select('id')
      .whereIn('status', ['pendiente', 'en_revision', 'en_reparacion'])
      .whereRaw('ST_Intersects(geom, ST_GeomFromGeoJSON(?))', [geojsonStr])
      .whereRaw(
        `ST_Area(ST_Intersection(geom, ST_GeomFromGeoJSON(?))::geography)
         / NULLIF(ST_Area(ST_GeomFromGeoJSON(?)::geography), 0) >= ?`,
        [geojsonStr, geojsonStr, OVERLAP_THRESHOLD]
      )
      .orderBy('confirmations', 'desc')
      .first();
  } else if (geometry.type === 'LineString') {
    // Para líneas: crear buffer de ~10m y comparar longitud de intersección
    // 0.0001 grados ≈ ~11 metros en el ecuador
    result = await db('reports')
      .select('id')
      .whereIn('status', ['pendiente', 'en_revision', 'en_reparacion'])
      .whereRaw('ST_Intersects(ST_Buffer(geom::geography, 10)::geometry, ST_GeomFromGeoJSON(?))', [geojsonStr])
      .whereRaw(
        `ST_Length(
           ST_Intersection(
             ST_Buffer(geom::geography, 10)::geometry,
             ST_GeomFromGeoJSON(?)
           )::geography
         ) / NULLIF(ST_Length(ST_GeomFromGeoJSON(?)::geography), 0) >= ?`,
        [geojsonStr, geojsonStr, OVERLAP_THRESHOLD]
      )
      .orderBy('confirmations', 'desc')
      .first();
  }

  return result ? result.id : null;
}

module.exports = { findDuplicate, OVERLAP_THRESHOLD };
