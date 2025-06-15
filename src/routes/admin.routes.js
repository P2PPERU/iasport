const router = require('express').Router();
const adminController = require('../controllers/admin.controller');
const requireAuth = require('../middleware/requireAuth.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');

// Todas las rutas requieren autenticación y ser admin
router.use(requireAuth);
router.use(requireAdmin);

// Dashboard
router.get('/stats', adminController.getDashboardStats);
router.get('/stats/detailed', adminController.getDetailedStats);

// Predicciones
router.get('/predictions', adminController.getPredictions);
router.post('/predictions', adminController.createPrediction);
router.put('/predictions/:id', adminController.updatePrediction);
router.put('/predictions/:id/result', adminController.updateResult);
router.delete('/predictions/:id', adminController.deletePrediction);

// Usuarios
router.get('/users', adminController.getUsers);
router.put('/users/:id', adminController.updateUser);
router.put('/users/:id/premium', adminController.togglePremium);

// Pagos
router.get('/payments', adminController.getPayments);

module.exports = router;