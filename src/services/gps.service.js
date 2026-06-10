const db = require('../config/database');
const turf = require('@turf/turf');
const { AppError } = require('../utils/errors');
/**
 * GPS Service — Records positions and detects zone breaches via PostGIS.
 */

let wsBroadcast = null;

function setWsBroadcast(fn) {
  wsBroadcast = fn;
}

/**
 * Record a GPS position for an inmate and check zone containment.
 */
async function recordPosition(inmateId, lat, lng, accuracy = null) {
  const inmate = await db('inmates')
    .select(['inmates.*', 'restricted_zones.name as zone_name'])
    .leftJoin('restricted_zones', 'inmates.zone_id', 'restricted_zones.id')
    .where('inmates.id', inmateId)
    .first();

  if (!inmate) {
    const { NotFoundError } = require('../utils/errors');
    throw new NotFoundError(`Reo con id "${inmateId}" no encontrado.`);
  }

  // --- Detección de Spoofing (Salto Espacial) ---
  const lastPosition = await db('gps_positions')
    .select(['recorded_at', db.raw('ST_Y(point) as lat'), db.raw('ST_X(point) as lng')])
    .where('inmate_id', inmateId)
    .orderBy('recorded_at', 'desc')
    .first();

  if (lastPosition) {
    const timeDiffSeconds = (new Date() - new Date(lastPosition.recorded_at)) / 1000;
    if (timeDiffSeconds > 0) {
      const distanceMovedMeters = turf.distance(
        turf.point([lastPosition.lng, lastPosition.lat]),
        turf.point([lng, lat]),
        { units: 'meters' }
      );
      
      const speedMetersPerSecond = distanceMovedMeters / timeDiffSeconds;
      
      // Si la velocidad supera los 41.6 m/s (aprox 150 km/h), consideramos que es spoofing
      if (speedMetersPerSecond > 41.6) {
        throw new AppError(`Posición rechazada por sospecha de spoofing (Velocidad detectada: ${(speedMetersPerSecond * 3.6).toFixed(2)} km/h)`, 400);
      }
    }
  }
  // ----------------------------------------------

  let isInside = true;
  let distanceMeters = 0;

  if (inmate.zone_id) {
    const result = await db.raw(
      `SELECT
        ST_Contains(rz.geom, ST_SetSRID(ST_MakePoint(?, ?), 4326)) as is_inside,
        ST_Distance(rz.geom::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography) as distance_m
      FROM restricted_zones rz WHERE rz.id = ?`,
      [lng, lat, lng, lat, inmate.zone_id]
    );
    if (result.rows.length > 0) {
      isInside = result.rows[0].is_inside;
      distanceMeters = parseFloat(result.rows[0].distance_m) || 0;
    }
  }

  const [position] = await db('gps_positions')
    .insert({
      inmate_id: inmateId,
      point: db.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)', [lng, lat]),
      accuracy,
      is_inside_zone: isInside,
    })
    .returning(['id', 'inmate_id', 'accuracy', 'is_inside_zone', 'recorded_at']);

  const positionData = {
    id: position.id, inmateId: position.inmate_id,
    lat, lng, accuracy: position.accuracy,
    isInsideZone: position.is_inside_zone,
    recordedAt: position.recorded_at, inmateName: inmate.name,
    distanceMeters // <-- Agregado al payload del WS
  };

  if (wsBroadcast) wsBroadcast('position:update', positionData);

  let alert = null;
  if (!isInside && inmate.zone_id) {
    const recentAlert = await db('alerts')
      .where('inmate_id', inmateId)
      .where('status', 'activa')
      .where('created_at', '>', db.raw("NOW() - INTERVAL '30 seconds'"))
      .first();

    if (!recentAlert) {
      const [alertRow] = await db('alerts')
        .insert({
          inmate_id: inmateId,
          zone_id: inmate.zone_id,
          position: db.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)', [lng, lat]),
          distance_meters: distanceMeters,
          status: 'activa',
        })
        .returning('*');

      alert = {
        id: alertRow.id, inmateId: alertRow.inmate_id,
        inmateName: inmate.name, zoneId: alertRow.zone_id,
        zoneName: inmate.zone_name, lat, lng,
        distanceMeters: alertRow.distance_meters,
        status: alertRow.status, createdAt: alertRow.created_at,
      };

      if (wsBroadcast) wsBroadcast('alert:new', alert);

      await db('inmates').where('id', inmateId)
        .update({ status: 'fugado', updated_at: db.fn.now() });
    }
  } else if (isInside && inmate.status === 'fugado') {
    await db('inmates').where('id', inmateId)
      .update({ status: 'activo', updated_at: db.fn.now() });
    
    const [resolvedAlert] = await db('alerts')
      .where('inmate_id', inmateId)
      .where('status', 'activa')
      .update({ status: 'resuelta', resolved_at: db.fn.now() })
      .returning('*');

    if (resolvedAlert) {
      const resolvedAlertData = {
        id: resolvedAlert.id,
        inmateId: resolvedAlert.inmate_id,
        inmateName: inmate.name,
        zoneId: resolvedAlert.zone_id,
        zoneName: inmate.zone_name,
        lat,
        lng,
        distanceMeters: parseFloat(resolvedAlert.distance_meters) || 0,
        status: resolvedAlert.status,
        createdAt: resolvedAlert.created_at,
        resolvedAt: resolvedAlert.resolved_at,
      };
      if (wsBroadcast) wsBroadcast('alert:resolved', resolvedAlertData);
    }
  }

  return { inside: isInside, distanceMeters, alert, position: positionData };
}

/**
 * Get latest position for all active inmates.
 */
async function getLatestPositions() {
  const result = await db.raw(`
    SELECT DISTINCT ON (i.id)
      i.id as inmate_id, i.name as inmate_name, i.identification,
      i.zone_id, i.status as inmate_status, rz.name as zone_name,
      ST_Y(gp.point) as lat, ST_X(gp.point) as lng,
      gp.accuracy, gp.is_inside_zone, gp.recorded_at
    FROM inmates i
    INNER JOIN gps_positions gp ON gp.inmate_id = i.id
    LEFT JOIN restricted_zones rz ON i.zone_id = rz.id
    WHERE i.status IN ('activo', 'fugado')
    ORDER BY i.id, gp.recorded_at DESC
  `);

  return result.rows.map((r) => ({
    inmateId: r.inmate_id, inmateName: r.inmate_name,
    identification: r.identification, zoneId: r.zone_id,
    zoneName: r.zone_name, inmateStatus: r.inmate_status,
    lat: parseFloat(r.lat), lng: parseFloat(r.lng),
    accuracy: r.accuracy, isInsideZone: r.is_inside_zone,
    recordedAt: r.recorded_at,
  }));
}

/**
 * Get position history for an inmate.
 */
async function getHistory(inmateId, limit = 100) {
  const rows = await db('gps_positions')
    .select(['id', 'inmate_id', db.raw('ST_Y(point) as lat'), db.raw('ST_X(point) as lng'),
      'accuracy', 'is_inside_zone', 'recorded_at'])
    .where('inmate_id', inmateId)
    .orderBy('recorded_at', 'desc').limit(limit);

  return rows.map((r) => ({
    id: r.id, inmateId: r.inmate_id,
    lat: parseFloat(r.lat), lng: parseFloat(r.lng),
    accuracy: r.accuracy, isInsideZone: r.is_inside_zone,
    recordedAt: r.recorded_at,
  }));
}

module.exports = { recordPosition, getLatestPositions, getHistory, setWsBroadcast };
