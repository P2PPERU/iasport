// src/routes/tournaments.routes.js - ACTUALIZADO CON WALLET INTEGRATION
const router = require('express').Router();
const tournamentsController = require('../controllers/tournaments.controller');
const requireAuth = require('../middleware/requireAuth.middleware');
const tournamentMiddleware = require('../middleware/tournament.middleware');

// =====================================================
// RUTAS PÚBLICAS (sin autenticación requerida)
// =====================================================

// Obtener torneos activos/disponibles
router.get('/', tournamentsController.getActiveTournaments);

// Obtener detalles de un torneo específico
router.get('/:id', 
  tournamentMiddleware.validateTournamentExists,
  tournamentsController.getTournament
);

// Obtener ranking global
router.get('/ranking/global', tournamentsController.getGlobalRanking);

// =====================================================
// RUTAS QUE REQUIEREN AUTENTICACIÓN
// =====================================================
router.use(requireAuth);

// Inscribirse a un torneo (con validaciones completas)
router.post('/:id/join', 
  tournamentMiddleware.validateJoinTournament,
  tournamentsController.joinTournament
);

// Salir de un torneo (antes de que empiece)
router.post('/:id/leave', 
  tournamentMiddleware.validateTournamentExists,
  tournamentsController.leaveTournament
);

// Enviar predicción en un torneo (con validaciones completas)
router.post('/:tournamentId/predictions', 
  tournamentMiddleware.validatePredictionSubmission,
  tournamentsController.submitPrediction
);

// Obtener estadísticas del usuario
router.get('/user/stats', tournamentsController.getUserStats);

// Obtener historial de torneos del usuario
router.get('/user/history', tournamentsController.getUserTournaments);

module.exports = router;