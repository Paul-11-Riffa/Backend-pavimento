const db = require('../config/database');

/**
 * Servicio de Alertas — Gestión de alertas de violación de zona.
 */

let wsBroadcast = null;

function setWsBroadcast(fn) {
  wsBroadcast = fn;
}

function rowToAlert(row) {
  return {
    id: row.id,
    inmateId: row.inmate_id,
    inmateName: row.inmate_name || null,
    inmateIdentification: row.inmate_identification || null,
    zoneId: row.zone_id,
    zoneName: row.zone_name || null,
    lat: row.lat ? parseFloat(row.lat) : null,
    lng: row.lng ? parseFloat(row.lng) : null,
    distanceMeters: row.distance_meters,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

async function getAll(filters = {}) {
  let query = db('alerts')
    .select([
      'alerts.*',
      'inmates.name as inmate_name',
      'inmates.identification as inmate_identification',
      'restricted_zones.name as zone_name',
      db.raw('ST_Y(alerts.position) as lat'),
      db.raw('ST_X(alerts.position) as lng'),
    ])
    .leftJoin('inmates', 'alerts.inmate_id', 'inmates.id')
    .leftJoin('restricted_zones', 'alerts.zone_id', 'restricted_zones.id');

  if (filters.status) {
    query = query.where('alerts.status', filters.status);
  }
  if (filters.inmateId) {
    query = query.where('alerts.inmate_id', filters.inmateId);
  }

  const rows = await query.orderBy('alerts.created_at', 'desc').limit(100);
  return rows.map(rowToAlert);
}

async function acknowledge(id) {
  const [row] = await db('alerts')
    .where('id', id)
    .update({ status: 'reconocida' })
    .returning('*');

  if (!row) return null;

  const enriched = await db('alerts')
    .select([
      'alerts.*',
      'inmates.name as inmate_name',
      'inmates.identification as inmate_identification',
      'restricted_zones.name as zone_name',
      db.raw('ST_Y(alerts.position) as lat'),
      db.raw('ST_X(alerts.position) as lng'),
    ])
    .leftJoin('inmates', 'alerts.inmate_id', 'inmates.id')
    .leftJoin('restricted_zones', 'alerts.zone_id', 'restricted_zones.id')
    .where('alerts.id', id)
    .first();

  const alert = rowToAlert(enriched);
  if (wsBroadcast) wsBroadcast('alert:update', alert);
  return alert;
}

async function resolve(id) {
  const [row] = await db('alerts')
    .where('id', id)
    .update({ status: 'resuelta', resolved_at: db.fn.now() })
    .returning('*');

  if (!row) return null;

  const enriched = await db('alerts')
    .select([
      'alerts.*',
      'inmates.name as inmate_name',
      'inmates.identification as inmate_identification',
      'restricted_zones.name as zone_name',
      db.raw('ST_Y(alerts.position) as lat'),
      db.raw('ST_X(alerts.position) as lng'),
    ])
    .leftJoin('inmates', 'alerts.inmate_id', 'inmates.id')
    .leftJoin('restricted_zones', 'alerts.zone_id', 'restricted_zones.id')
    .where('alerts.id', id)
    .first();

  const alert = rowToAlert(enriched);
  if (wsBroadcast) wsBroadcast('alert:update', alert);
  return alert;
}

async function getStats() {
  const rows = await db('alerts')
    .select('status')
    .count('* as count')
    .groupBy('status');

  const stats = { activa: 0, reconocida: 0, resuelta: 0, total: 0 };
  for (const row of rows) {
    stats[row.status] = parseInt(row.count, 10);
    stats.total += parseInt(row.count, 10);
  }
  return stats;
}

module.exports = { getAll, acknowledge, resolve, getStats, setWsBroadcast };
