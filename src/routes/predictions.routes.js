const router = require('express').Router();
const predictionsController = require('../controllers/predictions.controller');

// Rutas públicas
router.get('/', predictionsController.getTodayPredictions);
router.get('/:id', predictionsController.getPrediction);

module.exports = router;