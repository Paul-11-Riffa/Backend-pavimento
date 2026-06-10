const { Router } = require('express');
const controller = require('../controllers/zones.controller');
const validateZoneGeoJSON = require('../middlewares/validateZoneGeoJSON');

const router = Router();

// GET    /api/zones          → Todas las zonas (FeatureCollection)
router.get('/', controller.getAllZones);

// GET    /api/zones/:id      → Zona individual (Feature)
router.get('/:id', controller.getZoneById);

// POST   /api/zones          → Crear zona (con validación de calles)
router.post('/', validateZoneGeoJSON, controller.createZone);

// PATCH  /api/zones/:id      → Actualizar zona
router.patch('/:id', controller.updateZone);

// DELETE /api/zones/:id      → Eliminar zona
router.delete('/:id', controller.deleteZone);

// POST   /api/zones/validate → Solo validar si un polígono tiene calles
router.post('/validate', controller.validateZone);

module.exports = router;
