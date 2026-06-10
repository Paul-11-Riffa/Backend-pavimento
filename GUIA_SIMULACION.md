# 🚨 Guía Completa: Simulación de Geofencing - Áreas Restringidas

## 📋 Índice
1. [Prerrequisitos](#prerrequisitos)
2. [Configuración Inicial](#configuración-inicial)
3. [Cómo hacer la Simulación](#cómo-hacer-la-simulación)
4. [Pasos Detallados](#pasos-detallados)
5. [Verificar Resultados](#verificar-resultados)
6. [Troubleshooting](#troubleshooting)

---

## 📦 Prerrequisitos

Asegúrate de tener:
- ✅ Backend ejecutándose: `npm start`
- ✅ PostgreSQL + PostGIS funcionando
- ✅ Postman instalado
- ✅ Un navegador moderno (Chrome, Firefox, Edge)

**Verificar conexión:**
```bash
curl http://localhost:3000/api/health
```
Deberías ver: `"status": "ok"`

---

## ⚙️ Configuración Inicial

### 1. Importar Colección en Postman

1. Abre **Postman**
2. Click en **"Import"** (arriba a la izquierda)
3. Selecciona la pestaña **"File"**
4. Elige el archivo: `postman_simulation.json`
5. Click **"Import"**

**Resultado:** Deberías ver una colección llamada "Simulación Geofencing - Áreas Restringidas" con 10 requests.

### 2. Configurar Variables de Entorno

En Postman:
1. Click en **"Environments"** (izquierda)
2. Busca **"Simulación Geofencing"** o crea una nueva
3. Asegúrate que `baseUrl` = `http://localhost:3000`
4. Selecciona este environment en el dropdown superior derecho

### 3. Abrir Monitor de Alertas

1. Abre el archivo `alert_monitor.html` en tu navegador
   - O arrastra y suelta al navegador
   - O haz click derecho → "Abrir con..." → Navegador

**Resultado:** Deberías ver:
- ✅ Estado de conexión: "✅ Conectado"
- 📊 3 contadores: Alertas Activas, Reconocidas, Resueltas
- 📋 Un área de logs en tiempo real

---

## 🎬 Cómo hacer la Simulación

### **El flujo es muy simple:**

```
1. Crear Zona Restringida (polígono)
   ↓
2. Crear Reo (asignado a esa zona)
   ↓
3. Enviar Posición DENTRO de la zona ✅
   ↓
4. Enviar Posición FUERA de la zona ⚠️ ← ALERTA SE GENERA AQUÍ
   ↓
5. Ver alertas
   ↓
6. Regresar Reo a la zona ✅ ← ALERTA SE RESUELVE AQUÍ
```

---

## 📝 Pasos Detallados

### **PASO 1️⃣ : Crear una Zona Restringida**

En Postman:
1. Abre la carpeta "Simulación Geofencing"
2. Haz click en el request: **"1️⃣ CREAR ZONA RESTRINGIDA"**
3. Verifica que el body sea un GeoJSON válido con un polígono
4. Click **"Send"** (azul arriba a la derecha)

**Respuesta esperada (201 Created):**
```json
{
  "type": "Feature",
  "id": "abc-123-xyz",  ← ¡GUARDA ESTE ID!
  "geometry": { ... },
  "properties": {
    "name": "Penitenciaria Central",
    "inmateCount": 0,
    ...
  }
}
```

**Lo que pasa automáticamente:**
- Postman guarda el `id` en la variable `{{zoneId}}`
- ✅ La variable se usa automáticamente en los siguientes requests

---

### **PASO 2️⃣ : Crear un Reo**

En Postman:
1. Click en el request: **"2️⃣ CREAR REO (asignado a zona)"**
2. El body usa automáticamente `"zoneId": "{{zoneId}}"` (la zona que acabamos de crear)
3. Click **"Send"**

**Respuesta esperada (201 Created):**
```json
{
  "id": "inmate-456-def",  ← ¡GUARDA ESTE ID!
  "name": "Juan Pérez García",
  "identification": "12345678-A",
  "zoneId": "abc-123-xyz",
  "status": "activo",
  "deviceId": "device-gps-001",
  ...
}
```

**Lo que pasa automáticamente:**
- ✅ El reo se crea con estado: `"activo"`
- ✅ El reo está asignado a la zona que creamos
- ✅ Postman guarda el `id` en la variable `{{inmateId}}`

---

### **PASO 3️⃣ : Enviar Posición DENTRO de la Zona**

En Postman:
1. Click en el request: **"3️⃣ ENVIAR POSICIÓN DENTRO DE LA ZONA"**
2. El body es:
```json
{
  "inmateId": "{{inmateId}}",
  "lat": -34.905,
  "lng": -56.145,
  "accuracy": 5
}
```
3. Click **"Send"**

**Respuesta esperada (200 OK):**
```json
{
  "inside": true,          ← ✅ DENTRO DE LA ZONA
  "distanceMeters": 0,
  "alert": null,           ← NO HAY ALERTA
  "position": { ... }
}
```

**Verificar en el Monitor de Alertas:**
- 📍 Deberías ver un log: "📍 Nueva Posición: Juan Pérez García"
- ❌ No deberías ver alertas rojas

---

### **PASO 4️⃣ : Enviar Posición FUERA de la Zona ⚠️**

**¡ESTO ES LO MÁS IMPORTANTE!**

En Postman:
1. Click en el request: **"4️⃣ ENVIAR POSICIÓN FUERA DE LA ZONA (ALERTA ⚠️)"**
2. El body es:
```json
{
  "inmateId": "{{inmateId}}",
  "lat": -34.88,
  "lng": -56.12,
  "accuracy": 5
}
```
3. Click **"Send"**

**Respuesta esperada (200 OK):**
```json
{
  "inside": false,         ← ❌ FUERA DE LA ZONA
  "distanceMeters": 3541.5,
  "alert": {
    "id": "alert-789-ghi",
    "inmateId": "inmate-456-def",
    "inmateName": "Juan Pérez García",
    "zoneId": "abc-123-xyz",
    "zoneName": "Penitenciaria Central",
    "lat": -34.88,
    "lng": -56.12,
    "distanceMeters": 3541.5,
    "status": "activa",      ← ⚠️ ALERTA ACTIVA
    "createdAt": "2026-05-22T10:30:15.123Z"
  },
  "position": { ... }
}
```

**Verificar en el Monitor de Alertas:**
- 🚨 **Deberías ver una alerta ROJA** con:
  - Nombre: Juan Pérez García
  - Zona: Penitenciaria Central
  - Distancia: 3541 metros
  - Estado: **activa**
- 📊 El contador "Alertas Activas" debe cambiar de 0 a 1
- 📋 En el log deberías ver: "🚨 NUEVA ALERTA"

**¿Qué pasó en el backend automáticamente?**
1. ✅ Se registró la posición GPS
2. ✅ PostGIS verificó que está FUERA de la zona
3. ✅ Se creó una ALERTA automáticamente
4. ✅ El reo cambió de estado a `"fugado"`
5. ✅ Se envió por WebSocket: `alert:new`

---

### **PASO 5️⃣ : Ver todas las Alertas**

En Postman:
1. Click en el request: **"5️⃣ VER TODAS LAS ALERTAS ACTIVAS"**
2. Click **"Send"**

**Respuesta esperada (200 OK):**
```json
[
  {
    "id": "alert-789-ghi",
    "inmateId": "inmate-456-def",
    "inmateName": "Juan Pérez García",
    "zoneId": "abc-123-xyz",
    "zoneName": "Penitenciaria Central",
    "lat": -34.88,
    "lng": -56.12,
    "distanceMeters": 3541.5,
    "status": "activa",
    "createdAt": "2026-05-22T10:30:15.123Z",
    "resolvedAt": null
  }
]
```

---

### **PASO 6️⃣ : Regresar Reo a la Zona (RESUELVE ALERTA)**

En Postman:
1. Click en el request: **"6️⃣ REGRESAR REO A LA ZONA (RESUELVE ALERTA)"**
2. El body es igual al PASO 3 (posición DENTRO):
```json
{
  "inmateId": "{{inmateId}}",
  "lat": -34.905,
  "lng": -56.145,
  "accuracy": 5
}
```
3. Click **"Send"**

**Respuesta esperada (200 OK):**
```json
{
  "inside": true,          ← ✅ VOLVIÓ A ESTAR DENTRO
  "distanceMeters": 0,
  "alert": null,
  "position": { ... }
}
```

**Verificar en el Monitor de Alertas:**
- 🟢 La alerta deberá cambiar de estado: **activa** → **resuelta**
- El contador "Alertas Activas" debe volver a 0
- El contador "Resueltas" debe aumentar a 1
- El reo cambia de estado: `"fugado"` → `"activo"`

---

## ✅ Verificar Resultados

### **En el Monitor de Alertas:**
- ✅ Deberías ver 3 estadísticas actualizándose en tiempo real
- ✅ Las alertas deberían aparecer/desaparecer automáticamente
- ✅ El color de la alerta debe cambiar según su estado
- ✅ Los logs deberían mostrarse en orden cronológico

### **En Postman:**
- ✅ Cada request debe retornar status **200** o **201**
- ✅ Los IDs se guardan automáticamente en las variables
- ✅ Puedes expandir cada respuesta para ver todos los detalles

### **En la BD (opcional):**
Abre una terminal y conéctate a PostgreSQL:
```bash
psql -U postgres -d sig_pavimento
```

Luego:
```sql
-- Ver zonas
SELECT id, name, status FROM restricted_zones;

-- Ver reos
SELECT id, name, status, zone_id FROM inmates;

-- Ver posiciones GPS del reo
SELECT inmate_id, lat, lng, is_inside_zone, recorded_at 
FROM gps_positions 
WHERE inmate_id = 'inmate-456-def'
ORDER BY recorded_at DESC;

-- Ver alertas
SELECT id, inmate_id, status, distance_meters, created_at 
FROM alerts 
ORDER BY created_at DESC;
```

---

## 🔄 Repetir la Simulación

Si quieres hacer la simulación de nuevo:

### **Opción A: Limpiar todo y empezar de cero**
1. En Postman: **"❌ LIMPIAR: Eliminar reo"** → Send
2. En Postman: **"❌ LIMPIAR: Eliminar zona"** → Send
3. Vuelve al PASO 1️⃣

### **Opción B: Crear nuevo reo (reutilizar zona)**
1. Salta el PASO 1️⃣ (la zona ya existe)
2. En PASO 2️⃣, modifica el body para cambiar:
   - `"identification": "87654321-B"` (diferente ID)
   - `"name": "María García López"` (diferente nombre)
3. Continúa con PASO 3️⃣

---

## 🐛 Troubleshooting

### **Problema: El Monitor de Alertas dice "❌ Desconectado"**

**Soluciones:**
1. Asegúrate que el backend está corriendo: `npm start`
2. Verifica que el servidor está en puerto 3000
3. En la consola del navegador (F12), busca errores
4. Click en "Reconectar" en el Monitor
5. Si persiste, reinicia el backend

### **Problema: En Postman aparece error "zoneId not found"**

**Soluciones:**
1. Asegúrate de ejecutar el PASO 1️⃣ primero
2. Verifica que Postman tenga el environment correcto seleccionado
3. En la consola de Postman (abajo), deberías ver logs de los requests anteriores

### **Problema: No aparece la alerta después del PASO 4️⃣**

**Soluciones:**
1. Verifica que el Monitor de Alertas esté conectado (status ✅)
2. Mira los logs: deberías ver "🚨 NUEVA ALERTA"
3. Revisa la respuesta de Postman: `"alert"` debe tener datos, no ser `null`
4. En la BD, ejecuta: `SELECT * FROM alerts ORDER BY created_at DESC LIMIT 1;`

### **Problema: Las coordenadas no están DENTRO del polígono**

El polígono de prueba es:
```
Esquina 1: lat: -34.90, lng: -56.15
Esquina 2: lat: -34.90, lng: -56.14
Esquina 3: lat: -34.91, lng: -56.14
Esquina 4: lat: -34.91, lng: -56.15
```

**Coordenadas que ESTÁN dentro (PASO 3):**
- `lat: -34.905, lng: -56.145` ✅

**Coordenadas que ESTÁN fuera (PASO 4):**
- `lat: -34.88, lng: -56.12` ❌ (mucho más al norte)

---

## 📊 Próximos Pasos

Una vez que la simulación funcione correctamente, podrás:

1. **Crear múltiples reos**: Repite desde el PASO 2️⃣ con diferentes datos
2. **Crear múltiples zonas**: Repite desde el PASO 1️⃣ con polígonos diferentes
3. **Pruebas de estrés**: Envía muchas posiciones rapidamente
4. **Enviar alertas a policías**: Implementar notificaciones (Email, SMS, Push)

---

## 📞 Dudas o Problemas

Si algo no funciona:
1. Comprueba los logs en la consola del backend: `npm start`
2. Abre la consola del navegador (F12) en el Monitor de Alertas
3. Revisa los detalles en la respuesta de Postman

¡Mucho éxito con tu simulación! 🚀
