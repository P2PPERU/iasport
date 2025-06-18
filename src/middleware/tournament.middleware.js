// src/middleware/tournament.middleware.js
const { Tournament, TournamentEntry, TournamentPrediction } = require('../models');
const { Op } = require('sequelize');

// =====================================================
// VALIDAR EXISTENCIA DE TORNEO
// =====================================================
exports.validateTournamentExists = async (req, res, next) => {
  try {
    const { id, tournamentId } = req.params;
    const tId = id || tournamentId;

    if (!tId) {
      return res.status(400).json({
        success: false,
        message: 'ID de torneo requerido'
      });
    }

    const tournament = await Tournament.findByPk(tId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    req.tournament = tournament;
    next();

  } catch (error) {
    console.error('Error validando torneo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar torneo'
    });
  }
};

// =====================================================
// VALIDAR PARTICIPACIÓN DEL USUARIO
// =====================================================
exports.validateUserParticipation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const tournamentId = req.tournament.id;

    const entry = await TournamentEntry.findOne({
      where: { userId, tournamentId }
    });

    if (!entry) {
      return res.status(403).json({
        success: false,
        message: 'No estás inscrito en este torneo'
      });
    }

    if (entry.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: `Tu participación está ${entry.status.toLowerCase()}`
      });
    }

    req.tournamentEntry = entry;
    next();

  } catch (error) {
    console.error('Error validando participación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar participación'
    });
  }
};

// =====================================================
// VALIDAR ESTADO DE TORNEO PARA PREDICCIONES
// =====================================================
exports.validateTournamentForPredictions = (req, res, next) => {
  const tournament = req.tournament;

  if (tournament.status !== 'ACTIVE') {
    return res.status(400).json({
      success: false,
      message: `El torneo está ${tournament.status}. Solo se aceptan predicciones en torneos activos.`
    });
  }

  const now = new Date();
  
  // Verificar que no haya pasado el tiempo de fin
  if (now > new Date(tournament.endTime)) {
    return res.status(400).json({
      success: false,
      message: 'El tiempo para enviar predicciones ha expirado'
    });
  }

  next();
};

// =====================================================
// VALIDAR LÍMITE DE PREDICCIONES
// =====================================================
exports.validatePredictionLimit = async (req, res, next) => {
  try {
    const { sequenceNumber } = req.body;
    const tournament = req.tournament;
    const userId = req.user.id;

    // Verificar que no exceda el límite del torneo
    if (sequenceNumber > tournament.predictionsCount) {
      return res.status(400).json({
        success: false,
        message: `Este torneo solo permite ${tournament.predictionsCount} predicciones`
      });
    }

    // Verificar que no haya enviado ya esta secuencia
    const existingPrediction = await TournamentPrediction.findOne({
      where: {
        tournamentId: tournament.id,
        userId,
        sequenceNumber
      }
    });

    if (existingPrediction) {
      return res.status(400).json({
        success: false,
        message: `Ya has enviado la predicción #${sequenceNumber}`
      });
    }

    next();

  } catch (error) {
    console.error('Error validando límite:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar límite de predicciones'
    });
  }
};

// =====================================================
// VALIDAR DATOS DE PREDICCIÓN
// =====================================================
exports.validatePredictionData = (req, res, next) => {
  const { predictionData } = req.body;

  if (!predictionData) {
    return res.status(400).json({
      success: false,
      message: 'Datos de predicción requeridos'
    });
  }

  // Campos requeridos
  const requiredFields = [
    'league', 'match', 'homeTeam', 'awayTeam', 
    'prediction', 'type', 'odds', 'confidence', 'matchTime'
  ];

  for (const field of requiredFields) {
    if (!predictionData[field]) {
      return res.status(400).json({
        success: false,
        message: `El campo ${field} es requerido en predictionData`
      });
    }
  }

  // Validar confianza (1-100)
  const confidence = parseInt(predictionData.confidence);
  if (isNaN(confidence) || confidence < 1 || confidence > 100) {
    return res.status(400).json({
      success: false,
      message: 'La confianza debe ser un número entre 1 y 100'
    });
  }

  // Validar cuotas (mínimo 1.01)
  const odds = parseFloat(predictionData.odds);
  if (isNaN(odds) || odds < 1.01) {
    return res.status(400).json({
      success: false,
      message: 'Las cuotas deben ser al menos 1.01'
    });
  }

  // Validar tiempo del partido (debe ser futuro)
  const matchTime = new Date(predictionData.matchTime);
  if (isNaN(matchTime.getTime()) || matchTime <= new Date()) {
    return res.status(400).json({
      success: false,
      message: 'El tiempo del partido debe ser futuro'
    });
  }

  // Validar tipo de predicción
  const validTypes = ['1X2', 'OVER_UNDER', 'HANDICAP', 'BTTS', 'PROPS', 'COMBINED'];
  if (!validTypes.includes(predictionData.type)) {
    return res.status(400).json({
      success: false,
      message: `Tipo de predicción inválido. Debe ser: ${validTypes.join(', ')}`
    });
  }

  next();
};

// =====================================================
// VALIDAR INSCRIPCIÓN A TORNEO
// =====================================================
exports.validateTournamentRegistration = async (req, res, next) => {
  try {
    const tournament = req.tournament;
    const userId = req.user.id;
    const now = new Date();

    // Verificar estado del torneo
    if (tournament.status !== 'REGISTRATION') {
      return res.status(400).json({
        success: false,
        message: 'El torneo no está disponible para inscripciones'
      });
    }

    // Verificar fecha límite
    if (now > new Date(tournament.registrationDeadline)) {
      return res.status(400).json({
        success: false,
        message: 'La fecha límite de inscripción ha pasado'
      });
    }

    // Verificar si ya está inscrito
    const existingEntry = await TournamentEntry.findOne({
      where: { userId, tournamentId: tournament.id }
    });

    if (existingEntry) {
      return res.status(400).json({
        success: false,
        message: 'Ya estás inscrito en este torneo'
      });
    }

    // Verificar límite de jugadores
    const currentPlayers = await TournamentEntry.count({
      where: { tournamentId: tournament.id }
    });

    if (currentPlayers >= tournament.maxPlayers) {
      return res.status(400).json({
        success: false,
        message: 'El torneo está lleno'
      });
    }

    next();

  } catch (error) {
    console.error('Error validando inscripción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar inscripción'
    });
  }
};

// =====================================================
// VALIDAR PERMISOS DE MODIFICACIÓN (ADMIN)
// =====================================================
exports.validateTournamentModification = (req, res, next) => {
  const tournament = req.tournament;
  const updates = req.body;

  // Si el torneo está activo o terminado, solo permitir ciertos campos
  if (['ACTIVE', 'FINISHED'].includes(tournament.status)) {
    const allowedFields = ['status', 'isHot', 'isFeatured', 'endTime'];
    const updateKeys = Object.keys(updates);
    const invalidFields = updateKeys.filter(key => !allowedFields.includes(key));
    
    if (invalidFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `No se pueden modificar estos campos en torneos ${tournament.status}: ${invalidFields.join(', ')}`
      });
    }
  }

  // Validar transiciones de estado si se está cambiando el status
  if (updates.status && updates.status !== tournament.status) {
    const validTransitions = {
      'UPCOMING': ['REGISTRATION', 'CANCELLED'],
      'REGISTRATION': ['ACTIVE', 'CANCELLED'],
      'ACTIVE': ['FINISHED', 'CANCELLED'],
      'FINISHED': [], // No se puede cambiar
      'CANCELLED': [] // No se puede cambiar
    };

    const allowedNext = validTransitions[tournament.status] || [];
    if (!allowedNext.includes(updates.status)) {
      return res.status(400).json({
        success: false,
        message: `No se puede cambiar de ${tournament.status} a ${updates.status}`
      });
    }
  }

  next();
};

// =====================================================
// VALIDAR ELIMINACIÓN DE TORNEO
// =====================================================
exports.validateTournamentDeletion = async (req, res, next) => {
  try {
    const tournament = req.tournament;

    // Solo permitir eliminar torneos que no han empezado
    if (!['UPCOMING', 'REGISTRATION'].includes(tournament.status)) {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden eliminar torneos que no han comenzado'
      });
    }

    // Verificar si hay inscripciones
    const entryCount = await TournamentEntry.count({
      where: { tournamentId: tournament.id }
    });

    if (entryCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar un torneo con inscripciones'
      });
    }

    next();

  } catch (error) {
    console.error('Error validando eliminación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar eliminación'
    });
  }
};

// =====================================================
// MIDDLEWARE COMBINADO PARA PREDICCIONES
// =====================================================
exports.validatePredictionSubmission = [
  exports.validateTournamentExists,
  exports.validateUserParticipation,
  exports.validateTournamentForPredictions,
  exports.validatePredictionLimit,
  exports.validatePredictionData
];

// =====================================================
// MIDDLEWARE COMBINADO PARA INSCRIPCIONES
// =====================================================
exports.validateJoinTournament = [
  exports.validateTournamentExists,
  exports.validateTournamentRegistration
];

// =====================================================
// MIDDLEWARE COMBINADO PARA ADMIN
// =====================================================
exports.validateAdminTournamentUpdate = [
  exports.validateTournamentExists,
  exports.validateTournamentModification
];

exports.validateAdminTournamentDelete = [
  exports.validateTournamentExists,
  exports.validateTournamentDeletion
];