// src/routes/admin.routes.js - ACTUALIZADO CON TORNEOS
const router = require('express').Router();
const adminController = require('../controllers/admin.controller');
const adminTournamentsController = require('../controllers/admin.tournaments.controller');
const requireAuth = require('../middleware/requireAuth.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');

// Todas las rutas requieren autenticación y ser admin
router.use(requireAuth);
router.use(requireAdmin);

// =====================================================
// DASHBOARD Y ESTADÍSTICAS GENERALES
// =====================================================
router.get('/stats', adminController.getDashboardStats);
router.get('/stats/detailed', adminController.getDetailedStats);

// =====================================================
// GESTIÓN DE PREDICCIONES
// =====================================================
router.get('/predictions', adminController.getPredictions);
router.post('/predictions', adminController.createPrediction);
router.put('/predictions/:id', adminController.updatePrediction);
router.put('/predictions/:id/result', adminController.updateResult);
router.delete('/predictions/:id', adminController.deletePrediction);

// =====================================================
// GESTIÓN DE USUARIOS
// =====================================================
router.get('/users', adminController.getUsers);
router.put('/users/:id', adminController.updateUser);
router.put('/users/:id/premium', adminController.togglePremium);

// =====================================================
// GESTIÓN DE PAGOS
// =====================================================
router.get('/payments', adminController.getPayments);

// =====================================================
// NOTIFICACIONES
// =====================================================
router.get('/notifications/stats', adminController.getNotificationStats);
router.post('/notifications/custom', adminController.sendCustomNotification);

// =====================================================
// GESTIÓN DE TORNEOS (NUEVAS RUTAS)
// =====================================================

// Estadísticas de torneos
router.get('/tournaments/stats', adminTournamentsController.getTournamentStats);

// CRUD de torneos
router.get('/tournaments', adminTournamentsController.getAllTournaments);
router.post('/tournaments', adminTournamentsController.createTournament);
router.put('/tournaments/:id', adminTournamentsController.updateTournament);
router.delete('/tournaments/:id', adminTournamentsController.deleteTournament);

// Gestión de status de torneos
router.put('/tournaments/:id/status', adminTournamentsController.updateTournamentStatus);

// Gestión de participantes
router.get('/tournaments/:id/participants', adminTournamentsController.getTournamentParticipants);
router.delete('/tournaments/:tournamentId/participants/:userId', adminTournamentsController.removeParticipant);

// Herramientas de administración
router.post('/tournaments/:id/recalculate', adminTournamentsController.recalculateScores);

module.exports = router;