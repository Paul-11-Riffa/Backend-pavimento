/**
 * Street Validator — Verifica que un polígono no contenga calles usando Overpass API (OpenStreetMap).
 *
 * Consulta la API de Overpass para buscar vías/calles (highway=*) dentro del
 * bounding box del polígono proporcionado. Si encuentra calles, retorna la lista.
 */

// node-fetch v2 para CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

/**
 * Extrae el bounding box de un polígono GeoJSON.
 * @param {Object} polygon — GeoJSON Polygon geometry
 * @returns {{ south: number, west: number, north: number, east: number }}
 */
function getBoundingBox(polygon) {
  const coords = polygon.coordinates[0]; // outer ring
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const [lng, lat] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return { south: minLat, west: minLng, north: maxLat, east: maxLng };
}

/**
 * Valida que un polígono no contenga calles/vías.
 *
 * @param {Object} polygon — GeoJSON Polygon geometry
 * @returns {Promise<{ valid: boolean, streets: Array<{ name: string, type: string }> }>}
 */
async function validateNoStreets(polygon) {
  const bbox = getBoundingBox(polygon);

  // Query Overpass: buscar todas las vías con atributo "highway" dentro del bbox
  const query = `
    [out:json][timeout:10];
    way["highway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    out tags;
  `;

  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      console.error(`Overpass API error: ${response.status} ${response.statusText}`);
      // Si Overpass falla, permitimos la creación con advertencia
      return {
        valid: true,
        warning: 'No se pudo verificar calles (Overpass API no disponible). El área fue aceptada.',
        streets: [],
      };
    }

    const data = await response.json();
    const streets = (data.elements || [])
      .filter((el) => el.tags?.highway)
      .map((el) => ({
        name: el.tags.name || 'Calle sin nombre',
        type: el.tags.highway,
        osmId: el.id,
      }));

    if (streets.length > 0) {
      return {
        valid: false,
        message: `El área seleccionada contiene ${streets.length} calle(s)/vía(s). Solo se pueden marcar edificios o recintos cerrados como áreas restringidas.`,
        streets: streets.slice(0, 20), // Limitar a 20 para la respuesta
      };
    }

    return { valid: true, streets: [] };
  } catch (error) {
    console.error('Error validando calles con Overpass:', error.message);
    // Si hay error de red, permitir con advertencia
    return {
      valid: true,
      warning: 'No se pudo verificar calles (error de red). El área fue aceptada.',
      streets: [],
    };
  }
}

module.exports = { validateNoStreets };
