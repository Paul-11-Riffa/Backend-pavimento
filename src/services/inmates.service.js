const db = require('../config/database');

/**
 * Servicio de Reos — CRUD con relación a zonas restringidas.
 */

/**
 * Convierte una fila de inmates en un objeto limpio.
 */
function rowToInmate(row) {
  const inmate = {
    id: row.id,
    name: row.name,
    identification: row.identification,
    zoneId: row.zone_id,
    zoneName: row.zone_name || null,
    deviceId: row.device_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  // Si hay posición GPS, incluirla
  if (row.last_lat !== undefined && row.last_lat !== null) {
    inmate.lastPosition = {
      lat: row.last_lat,
      lng: row.last_lng,
      accuracy: row.last_accuracy,
      recordedAt: row.last_recorded_at,
      isInsideZone: row.last_inside,
    };
  } else {
    inmate.lastPosition = null;
  }

  return inmate;
}

/**
 * Obtiene todos los reos con su última posición GPS conocida.
 */
async function getAll(filters = {}) {
  let query = db('inmates')
    .select([
      'inmates.*',
      'restricted_zones.name as zone_name',
      'lp.lat as last_lat',
      'lp.lng as last_lng',
      'lp.accuracy as last_accuracy',
      'lp.recorded_at as last_recorded_at',
      'lp.is_inside_zone as last_inside',
    ])
    .leftJoin('restricted_zones', 'inmates.zone_id', 'restricted_zones.id')
    .leftJoin(
      db.raw(`LATERAL (
        SELECT
          ST_Y(point) as lat,
          ST_X(point) as lng,
          accuracy,
          recorded_at,
          is_inside_zone
        FROM gps_positions
        WHERE gps_positions.inmate_id = inmates.id
        ORDER BY recorded_at DESC
        LIMIT 1
      ) as lp ON true`)
    );

  if (filters.status) {
    query = query.where('inmates.status', filters.status);
  }

  if (filters.zoneId) {
    query = query.where('inmates.zone_id', filters.zoneId);
  }

  const rows = await query.orderBy('inmates.created_at', 'desc');
  return rows.map(rowToInmate);
}

/**
 * Obtiene un reo individual por ID.
 */
async function getById(id) {
  const row = await db('inmates')
    .select([
      'inmates.*',
      'restricted_zones.name as zone_name',
      'lp.lat as last_lat',
      'lp.lng as last_lng',
      'lp.accuracy as last_accuracy',
      'lp.recorded_at as last_recorded_at',
      'lp.is_inside_zone as last_inside',
    ])
    .leftJoin('restricted_zones', 'inmates.zone_id', 'restricted_zones.id')
    .leftJoin(
      db.raw(`LATERAL (
        SELECT
          ST_Y(point) as lat,
          ST_X(point) as lng,
          accuracy,
          recorded_at,
          is_inside_zone
        FROM gps_positions
        WHERE gps_positions.inmate_id = inmates.id
        ORDER BY recorded_at DESC
        LIMIT 1
      ) as lp ON true`)
    )
    .where('inmates.id', id)
    .first();

  return row ? rowToInmate(row) : null;
}

/**
 * Crea un nuevo reo.
 */
async function create(data) {
  const [row] = await db('inmates')
    .insert({
      name: data.name,
      identification: data.identification,
      zone_id: data.zoneId || null,
      device_id: data.deviceId || null,
      status: 'activo',
    })
    .returning('*');

  // Obtener nombre de zona si hay
  let zoneName = null;
  if (row.zone_id) {
    const zone = await db('restricted_zones')
      .select('name')
      .where('id', row.zone_id)
      .first();
    zoneName = zone?.name || null;
  }

  return rowToInmate({ ...row, zone_name: zoneName });
}

/**
 * Actualiza un reo parcialmente.
 */
async function update(id, changes) {
  const updateData = { updated_at: db.fn.now() };

  if (changes.name) updateData.name = changes.name;
  if (changes.identification) updateData.identification = changes.identification;
  if (changes.zoneId !== undefined) updateData.zone_id = changes.zoneId;
  if (changes.deviceId !== undefined) updateData.device_id = changes.deviceId;
  if (changes.status) updateData.status = changes.status;

  const [row] = await db('inmates')
    .where('id', id)
    .update(updateData)
    .returning('*');

  if (!row) return null;

  let zoneName = null;
  if (row.zone_id) {
    const zone = await db('restricted_zones')
      .select('name')
      .where('id', row.zone_id)
      .first();
    zoneName = zone?.name || null;
  }

  return rowToInmate({ ...row, zone_name: zoneName });
}

/**
 * Elimina un reo.
 */
async function remove(id) {
  const count = await db('inmates').where('id', id).del();
  return count > 0;
}

module.exports = { getAll, getById, create, update, remove };
