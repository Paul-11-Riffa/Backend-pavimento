# 🛣️ Pavimento Backend API

API REST geoespacial para el proyecto SIG Pavimento. Recibe y gestiona reportes de calles dañadas utilizando geometrías GeoJSON, con base de datos PostgreSQL + PostGIS en Supabase.

## Requisitos

- **Node.js** v18 o superior
- **Supabase** (o cualquier PostgreSQL con PostGIS)

## Instalación

```bash
npm install
```

## Configuración

Crear un archivo `.env` en la raíz del proyecto:

```env
PORT=3000
CORS_ORIGIN=*
DATABASE_URL=postgresql://usuario:contraseña@host:5432/basedatos
```

## Ejecución

```bash
# Correr migraciones (crear tablas)
npx knex migrate:latest

# Modo desarrollo (con hot-reload)
npm run dev

# Modo producción
npm start
```

El servidor arranca en `http://localhost:3000` por defecto.

## Endpoints

| Método   | Ruta                          | Descripción                                              |
|----------|-------------------------------|----------------------------------------------------------|
| `GET`    | `/api/health`                 | Estado del servicio y conexión a la base de datos        |
| `GET`    | `/api/reports`                | Obtener reportes (FeatureCollection) con filtros         |
| `GET`    | `/api/reports/:id`            | Obtener un reporte por ID (Feature)                      |
| `POST`   | `/api/reports`                | Crear reporte o confirmar duplicado                      |
| `PATCH`  | `/api/reports/:id`            | Actualizar estado, nivel de daño o descripción           |
| `POST`   | `/api/reports/:id/confirm`    | Confirmar manualmente un reporte existente               |
| `DELETE` | `/api/reports/:id`            | Eliminar un reporte por ID                               |

### Filtros en GET /api/reports

| Parámetro     | Ejemplo                           | Descripción                        |
|---------------|-----------------------------------|------------------------------------|
| `bbox`        | `?bbox=-66.16,18.45,-66.14,18.47` | Filtrar por área visible del mapa  |
| `status`      | `?status=pendiente`               | Filtrar por estado del reporte     |
| `damageLevel` | `?damageLevel=severo`             | Filtrar por nivel de daño          |

Los filtros se pueden combinar: `?bbox=...&status=pendiente&damageLevel=severo`

### Niveles de Daño

| Valor      | Descripción                                   |
|------------|-----------------------------------------------|
| `leve`     | Grietas superficiales, baches pequeños        |
| `moderado` | Baches medianos, pavimento deteriorado        |
| `severo`   | Daño estructural, intransitable               |
| `critico`  | Peligro para vehículos y peatones             |

### Estados del Reporte

```
pendiente → en_revision → en_reparacion → solucionado
pendiente → rechazado
en_revision → rechazado
```

### Detección de Duplicados

Cuando se crea un reporte, el sistema verifica automáticamente si existe un reporte activo con ≥80% de superposición geométrica:
- **Si encuentra duplicado**: incrementa `confirmations` del existente y responde con `_meta.merged: true`
- **Si no**: crea un nuevo reporte con `confirmations: 1`

## Ejemplo de uso

### Crear un reporte

```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
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
      "description": "Pavimento dañado",
      "damageLevel": "severo"
    }
  }'
```

### Actualizar estado

```bash
curl -X PATCH http://localhost:3000/api/reports/:id \
  -H "Content-Type: application/json" \
  -d '{"status": "en_revision"}'
```

### Obtener reportes en un área

```bash
curl "http://localhost:3000/api/reports?bbox=-66.16,18.45,-66.14,18.47&status=pendiente"
```

## Docker (Producción)

```bash
# Construir imagen
docker build -t pavimento-backend .

# Correr contenedor
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e NODE_ENV=production \
  pavimento-backend
```

## Estructura del proyecto

```
src/
├── app.js                           # Inicialización de Express
├── server.js                        # Punto de entrada con verificación de DB
├── config/
│   ├── index.js                     # Variables de configuración
│   └── database.js                  # Pool de conexiones PostgreSQL
├── constants/
│   └── reportEnums.js               # Estados, niveles de daño, máquina de estados
├── controllers/
│   └── reports.controller.js        # Manejo de request/response
├── middlewares/
│   ├── validateGeoJSON.js           # Validación GeoJSON + matemática
│   ├── validateBBox.js              # Validación de bounding box
│   ├── validateStatusUpdate.js      # Validación de actualizaciones
│   └── requestLogger.js             # Logging de peticiones HTTP
├── routes/
│   └── reports.routes.js            # Definición de rutas
├── services/
│   ├── reports.service.js           # Lógica de negocio + PostGIS
│   └── duplicateDetection.service.js # Detección espacial de duplicados
└── utils/
    ├── errors.js                    # Clases de error personalizadas
    └── geometryValidator.js         # Validación geométrica con Turf.js
```

## Tecnologías

- **Node.js** + **Express.js** — Servidor HTTP
- **PostgreSQL** + **PostGIS** — Base de datos geoespacial
- **Knex.js** — Query builder y migraciones
- **Turf.js** — Validación geométrica
- **Supabase** — Hosting de PostgreSQL
- **GeoJSON (RFC 7946)** — Formato estándar de intercambio
