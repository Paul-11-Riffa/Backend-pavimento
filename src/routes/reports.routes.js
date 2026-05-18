const { Router } = require('express');
const controller = require('../controllers/reports.controller');
const validateGeoJSON = require('../middlewares/validateGeoJSON');
const validateBBox = require('../middlewares/validateBBox');
const validateStatusUpdate = require('../middlewares/validateStatusUpdate');

const router = Router();

// GET  /api/reports      → Obtener reportes (con filtros opcionales: bbox, status, damageLevel)
router.get('/', validateBBox, controller.getAllReports);

// GET  /api/reports/:id  → Obtener un reporte por ID (Feature)
router.get('/:id', controller.getReportById);

// POST /api/reports      → Crear un nuevo reporte (o confirmar duplicado)
router.post('/', validateGeoJSON, controller.createReport);

// PATCH /api/reports/:id → Actualizar estado, nivel de daño o descripción
router.patch('/:id', validateStatusUpdate, controller.updateReport);

// POST /api/reports/:id/confirm → Confirmar manualmente un reporte existente
router.post('/:id/confirm', controller.confirmReport);

// DELETE /api/reports/:id → Eliminar un reporte por ID
router.delete('/:id', controller.deleteReport);

module.exports = router;
