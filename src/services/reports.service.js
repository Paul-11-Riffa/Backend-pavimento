const db = require('../config/database');

/**
 * Servicio de reportes — acceso a datos via PostgreSQL + PostGIS.
 *
 * Todas las funciones retornan datos en formato GeoJSON (Feature / FeatureCollection).
 * Las geometrías se almacenan como tipos nativos PostGIS y se convierten a GeoJSON
 * en cada consulta usando ST_AsGeoJSON.
 */

/**
 * Convierte una fila de la tabla reports en un Feature GeoJSON.
 * @param {Object} row — fila de la base de datos
 * @returns {Object} Feature GeoJSON
 */
function rowToFeature(row) {
  return {
    type: 'Feature',
    id: row.id,
    geometry: JSON.parse(row.geojson),
    properties: {
      streetName: row.street_name,
      description: row.description,
      damageLevel: row.damage_level,
      status: row.status,
      confirmations: row.confirmations,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

/**
 * Columnas base para SELECT con geometría convertida a GeoJSON.
 */
const BASE_COLUMNS = [
  'id',
  'street_name',
  'description',
  'damage_level',
  'status',
  'confirmations',
  'created_at',
  'updated_at',
  db.raw('ST_AsGeoJSON(geom)::text as geojson'),
];

/**
 * Obtiene reportes como un FeatureCollection GeoJSON, con filtros opcionales.
 *
 * @param {Object} [filters] — filtros opcionales
 * @param {Object} [filters.bbox] — { minLon, minLat, maxLon, maxLat }
 * @param {string} [filters.status] — filtrar por estado
 * @param {string} [filters.damageLevel] — filtrar por nivel de daño
 * @returns {Promise<Object>} FeatureCollection
 */
async function getAll(filters = {}) {
  let query = db('reports').select(BASE_COLUMNS);

  // Filtro espacial por bounding box (Fase 3)
  if (filters.bbox) {
    const { minLon, minLat, maxLon, maxLat } = filters.bbox;
    query = query.whereRaw(
      'ST_Intersects(geom, ST_MakeEnvelope(?, ?, ?, ?, 4326))',
      [minLon, minLat, maxLon, maxLat]
    );
  }

  // Filtro por estado (Fase 4)
  if (filters.status) {
    query = query.where('status', filters.status);
  }

  // Filtro por nivel de daño (Fase 4)
  if (filters.damageLevel) {
    query = query.where('damage_level', filters.damageLevel);
  }

  const rows = await query;

  return {
    type: 'FeatureCollection',
    features: rows.map(rowToFeature),
  };
}

/**
 * Obtiene un reporte individual por su ID.
 * @param {string} id — UUID del reporte
 * @returns {Promise<Object|null>} Feature GeoJSON o null si no existe
 */
async function getById(id) {
  const row = await db('reports').select(BASE_COLUMNS).where('id', id).first();
  return row ? rowToFeature(row) : null;
}

/**
 * Crea un nuevo reporte a partir de un Feature GeoJSON validado.
 *
 * @param {Object} feature — Feature GeoJSON (ya validado por el middleware)
 * @returns {Promise<Object>} Feature GeoJSON con id, timestamps, y metadatos
 */
async function create(feature) {
  const { geometry, properties = {} } = feature;

  const [row] = await db('reports')
    .insert({
      street_name: properties.streetName || '',
      description: properties.description || '',
      damage_level: properties.damageLevel || 'moderado',
      status: 'pendiente',
      confirmations: 1,
      geom: db.raw('ST_GeomFromGeoJSON(?)', [JSON.stringify(geometry)]),
    })
    .returning([...BASE_COLUMNS.slice(0, -1), db.raw('ST_AsGeoJSON(geom)::text as geojson')]);

  return rowToFeature(row);
}

/**
 * Actualiza parcialmente un reporte (estado, nivel de daño, etc.).
 *
 * @param {string} id — UUID del reporte
 * @param {Object} changes — campos a actualizar { status?, damageLevel?, description? }
 * @returns {Promise<Object|null>} Feature actualizado o null si no existe
 */
async function update(id, changes) {
  const updateData = { updated_at: db.fn.now() };

  if (changes.status) updateData.status = changes.status;
  if (changes.damageLevel) updateData.damage_level = changes.damageLevel;
  if (changes.description !== undefined) updateData.description = changes.description;

  const [row] = await db('reports')
    .where('id', id)
    .update(updateData)
    .returning([...BASE_COLUMNS.slice(0, -1), db.raw('ST_AsGeoJSON(geom)::text as geojson')]);

  return row ? rowToFeature(row) : null;
}

/**
 * Incrementa el contador de confirmaciones de un reporte.
 *
 * @param {string} id — UUID del reporte
 * @returns {Promise<Object|null>} Feature actualizado o null si no existe
 */
async function incrementConfirmations(id) {
  const [row] = await db('reports')
    .where('id', id)
    .update({
      confirmations: db.raw('confirmations + 1'),
      updated_at: db.fn.now(),
    })
    .returning([...BASE_COLUMNS.slice(0, -1), db.raw('ST_AsGeoJSON(geom)::text as geojson')]);

  return row ? rowToFeature(row) : null;
}

/**
 * Elimina un reporte por su ID.
 * @param {string} id — UUID del reporte
 * @returns {Promise<boolean>} true si se eliminó, false si no existía
 */
async function remove(id) {
  const count = await db('reports').where('id', id).del();
  return count > 0;
}

module.exports = { getAll, getById, create, update, incrementConfirmations, remove };
