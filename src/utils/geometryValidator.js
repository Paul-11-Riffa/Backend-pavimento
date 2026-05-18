const turf = require('@turf/turf');

/**
 * Utilidades de validación geométrica avanzada.
 *
 * Valida matemáticamente que las geometrías GeoJSON sean correctas
 * según RFC 7946 antes de insertarlas en PostGIS.
 */

/**
 * Verifica que todas las coordenadas estén dentro de rangos válidos.
 * Longitud: [-180, 180], Latitud: [-90, 90]
 *
 * @param {number[][]} coords — arreglo plano de posiciones [lon, lat]
 * @returns {{ valid: boolean, message?: string }}
 */
function validateCoordinateRanges(coords) {
  for (let i = 0; i < coords.length; i++) {
    const [lon, lat] = coords[i];

    if (typeof lon !== 'number' || typeof lat !== 'number') {
      return {
        valid: false,
        message: `La posición ${i} contiene valores no numéricos. Cada posición debe ser [longitud, latitud].`,
      };
    }

    if (lon < -180 || lon > 180) {
      return {
        valid: false,
        message: `Longitud ${lon} fuera de rango en posición ${i}. Rango válido: [-180, 180].`,
      };
    }

    if (lat < -90 || lat > 90) {
      return {
        valid: false,
        message: `Latitud ${lat} fuera de rango en posición ${i}. Rango válido: [-90, 90].`,
      };
    }
  }

  return { valid: true };
}

/**
 * Extrae todas las posiciones de una geometría (LineString o Polygon)
 * como un arreglo plano de [lon, lat].
 *
 * @param {Object} geometry — geometría GeoJSON
 * @returns {number[][]} posiciones
 */
function extractPositions(geometry) {
  if (geometry.type === 'LineString') {
    return geometry.coordinates;
  }
  // Polygon: aplanar todos los anillos
  return geometry.coordinates.flat();
}

/**
 * Verifica que un polígono esté cerrado (primer punto === último punto en cada anillo).
 *
 * @param {number[][][]} rings — anillos del polígono
 * @returns {{ valid: boolean, message?: string }}
 */
function validatePolygonClosed(rings) {
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    const first = ring[0];
    const last = ring[ring.length - 1];

    if (first[0] !== last[0] || first[1] !== last[1]) {
      return {
        valid: false,
        message: `El anillo ${i} del polígono no está cerrado. El primer punto [${first}] y el último [${last}] deben ser idénticos.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Detecta auto-intersecciones en un polígono usando turf.kinks().
 *
 * @param {Object} geometry — geometría Polygon GeoJSON
 * @returns {{ valid: boolean, message?: string }}
 */
function validateNoSelfIntersection(geometry) {
  try {
    const feature = turf.feature(geometry);
    const kinks = turf.kinks(feature);

    if (kinks.features.length > 0) {
      return {
        valid: false,
        message: `El polígono tiene ${kinks.features.length} auto-intersección(es). Las líneas del polígono no deben cruzarse entre sí.`,
      };
    }
  } catch {
    // Si turf no puede procesar la geometría, no bloquear
    // PostGIS hará su propia validación al insertar
  }

  return { valid: true };
}

/**
 * Verifica que un polígono tenga un área mínima razonable
 * para evitar geometrías degeneradas (área ≈ 0).
 *
 * Umbral: 1 m² (en metros cuadrados).
 *
 * @param {Object} geometry — geometría Polygon GeoJSON
 * @returns {{ valid: boolean, message?: string }}
 */
function validateMinimumArea(geometry) {
  try {
    const area = turf.area(turf.feature(geometry));

    if (area < 1) {
      return {
        valid: false,
        message: `El polígono tiene un área de ${area.toFixed(4)} m², que es demasiado pequeña. Debe tener al menos 1 m².`,
      };
    }
  } catch {
    // Fallo silencioso — PostGIS validará
  }

  return { valid: true };
}

/**
 * Verifica que un LineString tenga una longitud mínima razonable.
 *
 * Umbral: 1 metro.
 *
 * @param {Object} geometry — geometría LineString GeoJSON
 * @returns {{ valid: boolean, message?: string }}
 */
function validateMinimumLength(geometry) {
  try {
    const length = turf.length(turf.feature(geometry), { units: 'meters' });

    if (length < 1) {
      return {
        valid: false,
        message: `El LineString tiene una longitud de ${length.toFixed(4)} metros, que es demasiado corta. Debe tener al menos 1 metro.`,
      };
    }
  } catch {
    // Fallo silencioso — PostGIS validará
  }

  return { valid: true };
}

/**
 * Reordena los anillos de un polígono según RFC 7946:
 * - Anillo exterior: sentido antihorario (CCW)
 * - Anillos interiores: sentido horario (CW)
 *
 * Muta la geometría recibida.
 *
 * @param {Object} geometry — geometría Polygon GeoJSON
 */
function enforceWindingOrder(geometry) {
  try {
    const feature = turf.feature(geometry);
    const rewound = turf.rewind(feature, { mutate: false });
    geometry.coordinates = rewound.geometry.coordinates;
  } catch {
    // Si falla rewind, dejamos la geometría como está
  }
}

module.exports = {
  validateCoordinateRanges,
  extractPositions,
  validatePolygonClosed,
  validateNoSelfIntersection,
  validateMinimumArea,
  validateMinimumLength,
  enforceWindingOrder,
};
