// src/routes/predictionResults.routes.js
const router = require('express').Router();
const predictionResultsController = require('../controllers/predictionResults.controller');
const requireAuth = require('../middleware/requireAuth.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');

// Todas las rutas requieren autenticación y permisos de admin
router.use(requireAuth);
router.use(requireAdmin);

// =====================================================
// GESTIÓN DE RESULTADOS DE PREDICCIONES
// =====================================================

// Obtener predicciones pendientes de resultado
router.get('/pending', predictionResultsController.getPendingPredictions);

// Actualizar resultado de una predicción específica
router.put('/:predictionId/result', predictionResultsController.updatePredictionResult);

// Actualización masiva de resultados
router.put('/batch/results', predictionResultsController.updateMultiplePredictionResults);

// Revertir resultado (emergencia)
router.put('/:predictionId/revert', predictionResultsController.revertPredictionResult);

// =====================================================
// ESTADÍSTICAS Y REPORTES
// =====================================================

// Obtener estadísticas de resultados
router.get('/stats', predictionResultsController.getResultsStats);

// Historial de actualizaciones
router.get('/history', predictionResultsController.getUpdateHistory);

module.exports = router;