const { Router } = require('express');
const controller = require('../controllers/alerts.controller');

const router = Router();

// GET    /api/alerts             → Todas las alertas
router.get('/', controller.getAllAlerts);

// GET    /api/alerts/stats       → Estadísticas
router.get('/stats', controller.getAlertStats);

// PATCH  /api/alerts/:id/ack     → Reconocer alerta
router.patch('/:id/ack', controller.acknowledgeAlert);

// PATCH  /api/alerts/:id/resolve → Resolver alerta
router.patch('/:id/resolve', controller.resolveAlert);

module.exports = router;
