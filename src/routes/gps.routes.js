const { Router } = require('express');
const controller = require('../controllers/gps.controller');
const { gpsRateLimiter } = require('../middlewares/rateLimiter');
const validateGPS = require('../middlewares/validateGPS');
const verifyToken = require('../middlewares/verifyToken');

const router = Router();

// POST  /api/gps/position          → Enviar posición GPS (Límite y validación anti-spoofing)
router.post('/position', gpsRateLimiter, validateGPS, controller.recordPosition);

// GET   /api/gps/latest            → Última posición de todos los reos (Protegida)
router.get('/latest', verifyToken, controller.getLatestPositions);

// GET   /api/gps/history/:inmateId → Historial de un reo (Protegida)
router.get('/history/:inmateId', verifyToken, controller.getHistory);

module.exports = router;
