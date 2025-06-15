// src/routes/predictions.routes.js (CORREGIDO)
const router = require('express').Router();
const predictionsController = require('../controllers/predictions.controller');
const requireAuth = require('../middleware/requireAuth.middleware');

// Rutas públicas
router.get('/', predictionsController.getTodayPredictions);
router.get('/:id', predictionsController.getPrediction);

// Rutas que requieren autenticación
router.post('/:id/unlock', requireAuth, predictionsController.unlockPrediction);

module.exports = router;