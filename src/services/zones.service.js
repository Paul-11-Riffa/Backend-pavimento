const db = require('../config/database');

/**
 * Servicio de Zonas Restringidas — CRUD con PostGIS.
 *
 * Las zonas se almacenan como polígonos PostGIS y se sirven como GeoJSON Features.
 */

/**
 * Convierte una fila de la tabla restricted_zones en un Feature GeoJSON.
 */
function rowToFeature(row) {
  return {
    type: 'Feature',
    id: row.id,
    geometry: JSON.parse(row.geojson),
    properties: {
      name: row.name,
      description: row.description,
      status: row.status,
      inmateCount: parseInt(row.inmate_count, 10) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

/**
 * Columnas base para SELECT con geometría como GeoJSON.
 */
const BASE_COLUMNS = [
  'restricted_zones.id',
  'restricted_zones.name',
  'restricted_zones.description',
  'restricted_zones.status',
  'restricted_zones.created_at',
  'restricted_zones.updated_at',
  db.raw('ST_AsGeoJSON(restricted_zones.geom)::text as geojson'),
];

/**
 * Obtiene todas las zonas restringidas como FeatureCollection.
 */
async function getAll(filters = {}) {
  let query = db('restricted_zones')
    .select([
      ...BASE_COLUMNS,
      db.raw('COALESCE(ic.cnt, 0) as inmate_count'),
    ])
    .leftJoin(
      db.raw(`(SELECT zone_id, COUNT(*) as cnt FROM inmates WHERE status = 'activo' GROUP BY zone_id) as ic`),
      'restricted_zones.id',
      'ic.zone_id'
    );

  if (filters.status) {
    query = query.where('restricted_zones.status', filters.status);
  }

  const rows = await query.orderBy('restricted_zones.created_at', 'desc');

  return {
    type: 'FeatureCollection',
    features: rows.map(rowToFeature),
  };
}

/**
 * Obtiene una zona individual por ID.
 */
async function getById(id) {
  const row = await db('restricted_zones')
    .select([
      ...BASE_COLUMNS,
      db.raw(`(SELECT COUNT(*) FROM inmates WHERE zone_id = restricted_zones.id AND status = 'activo')::int as inmate_count`),
    ])
    .where('restricted_zones.id', id)
    .first();

  return row ? rowToFeature(row) : null;
}

/**
 * Crea una nueva zona restringida a partir de un Feature GeoJSON.
 */
async function create(feature) {
  const { geometry, properties = {} } = feature;

  const [row] = await db('restricted_zones')
    .insert({
      name: properties.name || 'Zona sin nombre',
      description: properties.description || '',
      status: 'activa',
      geom: db.raw('ST_GeomFromGeoJSON(?)', [JSON.stringify(geometry)]),
    })
    .returning([
      'id',
      'name',
      'description',
      'status',
      'created_at',
      'updated_at',
      db.raw('ST_AsGeoJSON(geom)::text as geojson'),
    ]);

  return rowToFeature({ ...row, inmate_count: 0 });
}

/**
 * Actualiza parcialmente una zona (nombre, descripción, status).
 */
async function update(id, changes) {
  const updateData = { updated_at: db.fn.now() };

  if (changes.name) updateData.name = changes.name;
  if (changes.description !== undefined) updateData.description = changes.description;
  if (changes.status) updateData.status = changes.status;

  const [row] = await db('restricted_zones')
    .where('id', id)
    .update(updateData)
    .returning([
      'id',
      'name',
      'description',
      'status',
      'created_at',
      'updated_at',
      db.raw('ST_AsGeoJSON(geom)::text as geojson'),
    ]);

  if (!row) return null;

  // Obtener conteo de reos
  const countResult = await db('inmates')
    .where('zone_id', id)
    .where('status', 'activo')
    .count('* as cnt')
    .first();

  return rowToFeature({ ...row, inmate_count: countResult?.cnt || 0 });
}

/**
 * Elimina una zona. Solo permite si no tiene reos activos asignados.
 */
async function remove(id) {
  // Verificar que no tenga reos activos
  const inmateCount = await db('inmates')
    .where('zone_id', id)
    .where('status', 'activo')
    .count('* as cnt')
    .first();

  if (parseInt(inmateCount?.cnt, 10) > 0) {
    const { ValidationError } = require('../utils/errors');
    throw new ValidationError(
      `No se puede eliminar la zona porque tiene ${inmateCount.cnt} reo(s) activo(s) asignado(s). Reasigne o desactive los reos primero.`
    );
  }

  const count = await db('restricted_zones').where('id', id).del();
  return count > 0;
}

module.exports = { getAll, getById, create, update, remove };
