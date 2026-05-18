# 🛣️ Guía de Integración Frontend — API Pavimento

> **Base URL:** `http://localhost:3000/api`
> **Formato:** Todas las respuestas y envíos usan **GeoJSON (RFC 7946)**
> **CORS:** Habilitado para cualquier origen (`*`)

---

## 📋 Tabla de Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| `GET` | `/health` | Estado del servicio y base de datos | No |
| `GET` | `/reports` | Obtener reportes (con filtros opcionales) | No |
| `GET` | `/reports/:id` | Obtener un reporte individual | No |
| `POST` | `/reports` | Crear nuevo reporte (o confirmar duplicado) | No |
| `PATCH` | `/reports/:id` | Actualizar estado o nivel de daño | No |
| `POST` | `/reports/:id/confirm` | Confirmar un reporte existente (+1) | No |
| `DELETE` | `/reports/:id` | Eliminar un reporte | No |

---

## 🗺️ Conceptos Clave

### Formato GeoJSON

El backend trabaja exclusivamente con el estándar **GeoJSON**. Esto significa que las respuestas son directamente compatibles con librerías de mapas como **Leaflet**, **Mapbox GL**, y **OpenLayers**.

- **Feature**: Un reporte individual (geometría + propiedades)
- **FeatureCollection**: Una colección de reportes (lo que devuelve `GET /reports`)

### Tipos de Geometría Soportados

| Tipo | Uso | Ejemplo |
|------|-----|---------|
| `LineString` | Tramos de calle | Una calle con baches de inicio a fin |
| `Polygon` | Áreas / zonas | Una cuadra completa dañada |

> ⚠️ **No se aceptan** `Point`, `MultiPolygon`, ni otros tipos.

### Coordenadas

Las coordenadas siguen el orden **[longitud, latitud]** (estándar GeoJSON, diferente a Google Maps que usa lat, lng).

```
[-66.1571, 18.4655]
   ↑ lon      ↑ lat
```

---

## 📖 Detalle de Endpoints

---

### `GET /api/health`

Verifica el estado del servidor y la conexión a la base de datos.

**Respuesta `200`:**
```json
{
  "status": "ok",
  "service": "pavimento-backend",
  "timestamp": "2026-05-18T19:57:53.567Z",
  "database": {
    "status": "connected",
    "postgis": "3.3 USE_GEOS=1 USE_PROJ=1 USE_STATS=1"
  }
}
```

**Respuesta `503` (base de datos caída):**
```json
{
  "status": "degraded",
  "database": { "status": "error", "postgis": null }
}
```

---

### `GET /api/reports`

Devuelve una **FeatureCollection** GeoJSON con los reportes. Soporta filtros opcionales por query params.

#### Query Parameters (todos opcionales)

| Param | Tipo | Ejemplo | Descripción |
|-------|------|---------|-------------|
| `bbox` | `string` | `-66.16,18.45,-66.14,18.47` | Bounding box: `minLon,minLat,maxLon,maxLat` |
| `status` | `string` | `pendiente` | Filtrar por estado |
| `damageLevel` | `string` | `severo` | Filtrar por nivel de daño |

> 💡 **Los filtros se pueden combinar:** `?bbox=-66.16,18.45,-66.14,18.47&status=pendiente&damageLevel=severo`

#### Ejemplo de Uso en el Frontend (con mapa)

```javascript
// Cuando el usuario mueve/hace zoom en el mapa
async function loadReports(map) {
  const bounds = map.getBounds();
  const bbox = [
    bounds.getWest(),   // minLon
    bounds.getSouth(),  // minLat
    bounds.getEast(),   // maxLon
    bounds.getNorth()   // maxLat
  ].join(',');

  const res = await fetch(`http://localhost:3000/api/reports?bbox=${bbox}`);
  const geojson = await res.json();

  // geojson es un FeatureCollection — se puede usar directamente
  // Leaflet:
  L.geoJSON(geojson).addTo(map);

  // Mapbox GL:
  map.getSource('reports').setData(geojson);
}
```

**Respuesta `200`:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "716bed4e-d121-40a9-a4dd-42b123a8d4c9",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-66.1571, 18.4655],
          [-66.1565, 18.4660],
          [-66.1560, 18.4650],
          [-66.1571, 18.4655]
        ]]
      },
      "properties": {
        "streetName": "Calle Principal",
        "description": "Baches grandes",
        "damageLevel": "severo",
        "status": "pendiente",
        "confirmations": 1,
        "createdAt": "2026-05-18T19:57:53.594Z",
        "updatedAt": "2026-05-18T19:57:53.594Z"
      }
    }
  ]
}
```

---

### `GET /api/reports/:id`

Devuelve un **Feature** GeoJSON individual.

**Respuesta `200`:** Un objeto Feature (igual al ejemplo dentro del array `features` de arriba).

**Respuesta `404`:**
```json
{
  "error": {
    "status": 404,
    "message": "Reporte con id \"abc123\" no encontrado."
  }
}
```

---

### `POST /api/reports`

Crea un nuevo reporte. Si la geometría se superpone ≥80% con un reporte activo existente, **no crea un duplicado** — en su lugar incrementa el contador de confirmaciones del reporte existente.

#### Body (JSON)

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [-66.1571, 18.4655],
      [-66.1565, 18.4660],
      [-66.1560, 18.4650],
      [-66.1571, 18.4655]
    ]]
  },
  "properties": {
    "streetName": "Calle Principal",
    "description": "Pavimento dañado en toda la cuadra",
    "damageLevel": "severo"
  }
}
```

#### Campos de `properties`

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `streetName` | `string` | Recomendado | Nombre de la calle |
| `description` | `string` | Opcional | Descripción del daño |
| `damageLevel` | `string` | Opcional (default: `moderado`) | Nivel de daño (ver valores abajo) |

#### Ejemplo de Uso en el Frontend

```javascript
// Después de que el usuario dibuja una geometría en el mapa
async function submitReport(drawnGeometry) {
  const feature = {
    type: "Feature",
    geometry: drawnGeometry,  // { type: "Polygon", coordinates: [...] }
    properties: {
      streetName: document.getElementById('streetName').value,
      description: document.getElementById('description').value,
      damageLevel: document.getElementById('damageLevel').value
    }
  };

  const res = await fetch('http://localhost:3000/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feature)
  });

  const data = await res.json();

  if (res.status === 201) {
    console.log('Reporte creado:', data.id);
  } else if (res.status === 200 && data._meta?.merged) {
    console.log('Reporte fusionado con existente. Confirmaciones:', data.properties.confirmations);
  }
}
```

**Respuesta `201` (reporte nuevo):**
```json
{
  "type": "Feature",
  "id": "a1b2c3d4-...",
  "geometry": { "..." },
  "properties": {
    "streetName": "Calle Principal",
    "description": "Pavimento dañado en toda la cuadra",
    "damageLevel": "severo",
    "status": "pendiente",
    "confirmations": 1,
    "createdAt": "2026-05-18T19:57:53.594Z",
    "updatedAt": "2026-05-18T19:57:53.594Z"
  }
}
```

**Respuesta `200` (duplicado fusionado):**
```json
{
  "type": "Feature",
  "id": "id-del-reporte-existente",
  "geometry": { "..." },
  "properties": {
    "confirmations": 2,
    "..."
  },
  "_meta": {
    "merged": true,
    "message": "Se encontró un reporte existente en la misma zona. Se incrementó el contador de confirmaciones."
  }
}
```

**Respuesta `400` (validación fallida):**
```json
{
  "error": {
    "status": 400,
    "message": "Tipo de geometría \"Point\" no soportado. Tipos permitidos: LineString, Polygon."
  }
}
```

---

### `PATCH /api/reports/:id`

Actualiza parcialmente un reporte. Se pueden enviar uno o más campos.

#### Body (JSON) — todos opcionales, pero al menos uno requerido

```json
{
  "status": "en_revision",
  "damageLevel": "critico",
  "description": "Actualización de la descripción"
}
```

> ⚠️ **Las transiciones de estado siguen reglas estrictas.** Ver sección "Máquina de Estados" más abajo.

**Respuesta `200`:** Feature actualizado.

**Respuesta `400` (transición inválida):**
```json
{
  "error": {
    "status": 400,
    "message": "No se puede cambiar de \"pendiente\" a \"solucionado\". Transiciones permitidas desde \"pendiente\": en_revision, rechazado."
  }
}
```

---

### `POST /api/reports/:id/confirm`

Incrementa el contador de confirmaciones de un reporte existente. No requiere body.

```javascript
await fetch(`http://localhost:3000/api/reports/${reportId}/confirm`, {
  method: 'POST'
});
```

**Respuesta `200`:** Feature con `confirmations` incrementado.

---

### `DELETE /api/reports/:id`

Elimina un reporte permanentemente.

**Respuesta `204`:** Sin contenido (éxito).
**Respuesta `404`:** Reporte no encontrado.

---

## 🏷️ Valores de Enumeraciones

### Niveles de Daño (`damageLevel`)

| Valor | Etiqueta Sugerida para UI | Descripción |
|-------|---------------------------|-------------|
| `leve` | 🟢 Leve | Grietas superficiales, baches pequeños |
| `moderado` | 🟡 Moderado | Baches medianos, pavimento deteriorado |
| `severo` | 🟠 Severo | Daño estructural, intransitable |
| `critico` | 🔴 Crítico | Peligro para vehículos y peatones |

### Estados del Reporte (`status`)

| Valor | Etiqueta Sugerida para UI |
|-------|---------------------------|
| `pendiente` | ⏳ Pendiente |
| `en_revision` | 🔍 En Revisión |
| `en_reparacion` | 🔧 En Reparación |
| `solucionado` | ✅ Solucionado |
| `rechazado` | ❌ Rechazado |

### Máquina de Estados (Transiciones Válidas)

```
pendiente ──→ en_revision ──→ en_reparacion ──→ solucionado
    │              │
    └──→ rechazado ←┘
```

Solo se permiten estas transiciones. Intentar una transición no válida retorna `400`.

---

## 🎨 Estructura del Feature (Propiedades)

Cada reporte tiene esta estructura en `properties`:

| Propiedad | Tipo | Descripción | Disponible en |
|-----------|------|-------------|---------------|
| `streetName` | `string` | Nombre de la calle | POST, GET |
| `description` | `string` | Descripción del daño | POST, PATCH, GET |
| `damageLevel` | `string` | Nivel de daño | POST, PATCH, GET |
| `status` | `string` | Estado del ciclo de vida | PATCH, GET |
| `confirmations` | `number` | Cantidad de ciudadanos que reportaron | GET |
| `createdAt` | `ISO 8601` | Fecha de creación | GET |
| `updatedAt` | `ISO 8601` | Última actualización | GET |

---

## ⚠️ Manejo de Errores

Todos los errores siguen el mismo formato:

```json
{
  "error": {
    "status": 400,
    "message": "Descripción legible del error"
  }
}
```

| Código | Significado |
|--------|-------------|
| `400` | Datos inválidos (geometría, estado, etc.) |
| `404` | Reporte no encontrado |
| `500` | Error interno del servidor |

### Errores Comunes de Validación

| Causa | Mensaje |
|-------|---------|
| Geometría tipo Point | `Tipo de geometría "Point" no soportado` |
| Coordenada fuera de rango | `Longitud -200 fuera de rango` |
| Polígono no cerrado | `El anillo 0 del polígono no está cerrado` |
| Línea demasiado corta | `El LineString tiene una longitud de 0.0000 metros` |
| Transición de estado inválida | `No se puede cambiar de "X" a "Y"` |
| bbox mal formado | `El parámetro "bbox" debe tener 4 valores numéricos` |

---

## 🔗 Flujo Completo de Integración

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                                                             │
│  1. Usuario abre el mapa                                    │
│     └─→ GET /reports?bbox=...  ──→ Cargar GeoJSON al mapa  │
│                                                             │
│  2. Usuario mueve/zoom el mapa                              │
│     └─→ GET /reports?bbox=...  ──→ Actualizar capa GeoJSON │
│                                                             │
│  3. Usuario dibuja geometría                                │
│     └─→ POST /reports          ──→ Enviar Feature GeoJSON   │
│         │                                                   │
│         ├─ 201: "Reporte creado" (mostrar en mapa)          │
│         └─ 200 + merged: "Ya reportado, +1 confirmación"   │
│                                                             │
│  4. Usuario toca un reporte en el mapa                      │
│     └─→ GET /reports/:id       ──→ Mostrar detalle/popup   │
│                                                             │
│  5. Ciudadano confirma un reporte existente                 │
│     └─→ POST /reports/:id/confirm ──→ Actualizar contador  │
│                                                             │
│  6. Admin cambia estado                                     │
│     └─→ PATCH /reports/:id     ──→ Actualizar estado       │
│                                                             │
│  7. Admin elimina reporte                                   │
│     └─→ DELETE /reports/:id    ──→ Quitar del mapa         │
└─────────────────────────────────────────────────────────────┘
```

---

## 💡 Recomendaciones para el Frontend

1. **Usar `bbox` siempre** al cargar reportes. Evita descargar toda la base de datos.
2. **Escuchar `moveend`/`zoomend`** del mapa para recargar con el nuevo bbox.
3. **Diferenciar `201` vs `200`** en el POST para mostrar mensaje apropiado al usuario.
4. **Colorear por `damageLevel`**: 🟢 leve → 🟡 moderado → 🟠 severo → 🔴 crítico.
5. **Mostrar `confirmations`** como badge o indicador de urgencia en el mapa.
6. **El `id` está en `feature.id`**, no dentro de `feature.properties`.
7. **Las coordenadas son `[lon, lat]`**, no `[lat, lon]`.
