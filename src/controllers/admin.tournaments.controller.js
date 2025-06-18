// src/controllers/admin.tournaments.controller.js
const { Tournament, TournamentEntry, TournamentPrediction, User, UserStats } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// =====================================================
// OBTENER ESTADÍSTICAS DE TORNEOS
// =====================================================
exports.getTournamentStats = async (req, res) => {
  try {
    const stats = {
      // Contadores básicos
      totalTournaments: await Tournament.count(),
      activeTournaments: await Tournament.count({ where: { status: 'ACTIVE' } }),
      upcomingTournaments: await Tournament.count({ where: { status: ['UPCOMING', 'REGISTRATION'] } }),
      finishedTournaments: await Tournament.count({ where: { status: 'FINISHED' } }),
      
      // Participación
      totalEntries: await TournamentEntry.count(),
      activeEntries: await TournamentEntry.count({ where: { status: 'ACTIVE' } }),
      
      // Ingresos (últimos 30 días)
      monthlyRevenue: 0,
      totalPrizesPaid: 0
    };

    // Ingresos del último mes
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const revenueResult = await TournamentEntry.sum('buyInPaid', {
      where: {
        createdAt: { [Op.gte]: thirtyDaysAgo }
      }
    });
    stats.monthlyRevenue = revenueResult || 0;

    // Total de premios pagados
    const prizesResult = await TournamentEntry.sum('prizeWon');
    stats.totalPrizesPaid = prizesResult || 0;

    // Estadísticas por tipo de torneo
    const typeStats = await Tournament.findAll({
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('prize_pool')), 'totalPrizePool'],
        [sequelize.fn('AVG', sequelize.col('current_players')), 'avgPlayers']
      ],
      group: ['type'],
      raw: true
    });

    stats.byType = typeStats;

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas de torneos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
};

// =====================================================
// CREAR NUEVO TORNEO
// =====================================================
exports.createTournament = async (req, res) => {
  try {
    const tournamentData = req.body;

    // Validaciones básicas
    const requiredFields = ['name', 'type', 'maxPlayers', 'startTime', 'endTime', 'registrationDeadline'];
    for (const field of requiredFields) {
      if (!tournamentData[field]) {
        return res.status(400).json({
          success: false,
          message: `El campo ${field} es requerido`
        });
      }
    }

    // Validar fechas
    const now = new Date();
    const startTime = new Date(tournamentData.startTime);
    const endTime = new Date(tournamentData.endTime);
    const registrationDeadline = new Date(tournamentData.registrationDeadline);

    if (startTime <= now) {
      return res.status(400).json({
        success: false,
        message: 'La fecha de inicio debe ser futura'
      });
    }

    if (endTime <= startTime) {
      return res.status(400).json({
        success: false,
        message: 'La fecha de fin debe ser posterior al inicio'
      });
    }

    if (registrationDeadline >= startTime) {
      return res.status(400).json({
        success: false,
        message: 'La fecha límite de registro debe ser anterior al inicio'
      });
    }

    // Establecer status inicial
    tournamentData.status = registrationDeadline > now ? 'UPCOMING' : 'REGISTRATION';

    const tournament = await Tournament.create(tournamentData);

    res.status(201).json({
      success: true,
      message: 'Torneo creado exitosamente',
      data: tournament
    });

  } catch (error) {
    console.error('Error creando torneo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear torneo',
      error: error.message
    });
  }
};

// =====================================================
// OBTENER TODOS LOS TORNEOS (ADMIN)
// =====================================================
exports.getAllTournaments = async (req, res) => {
  try {
    const { status, type, dateFrom, dateTo, limit = 50, offset = 0 } = req.query;
    
    const where = {};
    
    if (status) where.status = status;
    if (type) where.type = type;
    
    if (dateFrom || dateTo) {
      where.startTime = {};
      if (dateFrom) where.startTime[Op.gte] = new Date(dateFrom);
      if (dateTo) where.startTime[Op.lte] = new Date(dateTo);
    }

    const tournaments = await Tournament.findAndCountAll({
      where,
      include: [{
        model: TournamentEntry,
        as: 'entries',
        attributes: [],
        required: false
      }],
      attributes: {
        include: [
          [sequelize.fn('COUNT', sequelize.col('entries.id')), 'actualPlayers']
        ]
      },
      group: ['Tournament.id'],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: tournaments.rows,
      total: tournaments.count.length,
      hasMore: (parseInt(offset) + parseInt(limit)) < tournaments.count.length
    });

  } catch (error) {
    console.error('Error obteniendo torneos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener torneos'
    });
  }
};

// =====================================================
// ACTUALIZAR TORNEO
// =====================================================
exports.updateTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const tournament = await Tournament.findByPk(id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    // No permitir cambios en torneos activos o finalizados
    if (['ACTIVE', 'FINISHED'].includes(tournament.status)) {
      const allowedFields = ['status', 'isHot', 'isFeatured'];
      const updateKeys = Object.keys(updates);
      const invalidFields = updateKeys.filter(key => !allowedFields.includes(key));
      
      if (invalidFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `No se pueden modificar estos campos en torneos activos: ${invalidFields.join(', ')}`
        });
      }
    }

    await tournament.update(updates);

    res.json({
      success: true,
      message: 'Torneo actualizado exitosamente',
      data: tournament
    });

  } catch (error) {
    console.error('Error actualizando torneo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar torneo'
    });
  }
};

// =====================================================
// CAMBIAR STATUS DE TORNEO
// =====================================================
exports.updateTournamentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['UPCOMING', 'REGISTRATION', 'ACTIVE', 'FINISHED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status inválido'
      });
    }

    const tournament = await Tournament.findByPk(id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    // Validar transiciones de estado
    const currentStatus = tournament.status;
    const validTransitions = {
      'UPCOMING': ['REGISTRATION', 'CANCELLED'],
      'REGISTRATION': ['ACTIVE', 'CANCELLED'],
      'ACTIVE': ['FINISHED', 'CANCELLED'],
      'FINISHED': [], // No se puede cambiar
      'CANCELLED': [] // No se puede cambiar
    };

    if (!validTransitions[currentStatus].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `No se puede cambiar de ${currentStatus} a ${status}`
      });
    }

    // Si se finaliza el torneo, calcular resultados finales
    if (status === 'FINISHED' && currentStatus === 'ACTIVE') {
      await finalizeCompetition(tournament);
    }

    tournament.status = status;
    await tournament.save();

    res.json({
      success: true,
      message: `Torneo cambiado a ${status}`,
      data: tournament
    });

  } catch (error) {
    console.error('Error cambiando status:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar status'
    });
  }
};

// =====================================================
// ELIMINAR TORNEO
// =====================================================
exports.deleteTournament = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findByPk(id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    // Solo permitir eliminar torneos que no han empezado
    if (!['UPCOMING', 'REGISTRATION'].includes(tournament.status)) {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden eliminar torneos que no han comenzado'
      });
    }

    // Verificar si hay inscripciones
    const entryCount = await TournamentEntry.count({
      where: { tournamentId: id }
    });

    if (entryCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar un torneo con inscripciones'
      });
    }

    await tournament.destroy();

    res.json({
      success: true,
      message: 'Torneo eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando torneo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar torneo'
    });
  }
};

// =====================================================
// OBTENER PARTICIPANTES DE UN TORNEO
// =====================================================
exports.getTournamentParticipants = async (req, res) => {
  try {
    const { id } = req.params;

    const participants = await TournamentEntry.findAll({
      where: { tournamentId: id },
      include: [{
        model: User,
        attributes: ['id', 'name', 'email']
      }, {
        model: TournamentPrediction,
        as: 'predictions',
        required: false
      }],
      order: [['total_score', 'DESC'], ['roi', 'DESC']]
    });

    res.json({
      success: true,
      data: participants,
      count: participants.length
    });

  } catch (error) {
    console.error('Error obteniendo participantes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener participantes'
    });
  }
};

// =====================================================
// ELIMINAR PARTICIPANTE
// =====================================================
exports.removeParticipant = async (req, res) => {
  try {
    const { tournamentId, userId } = req.params;

    const entry = await TournamentEntry.findOne({
      where: { tournamentId, userId }
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Participante no encontrado en este torneo'
      });
    }

    // Solo permitir eliminar si el torneo no ha empezado
    const tournament = await Tournament.findByPk(tournamentId);
    if (!['UPCOMING', 'REGISTRATION'].includes(tournament.status)) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar participantes de torneos activos'
      });
    }

    await entry.destroy();

    // Actualizar contador de jugadores
    await tournament.decrement('currentPlayers');

    res.json({
      success: true,
      message: 'Participante eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando participante:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar participante'
    });
  }
};

// =====================================================
// FINALIZAR COMPETENCIA Y CALCULAR PREMIOS
// =====================================================
async function finalizeCompetition(tournament) {
  try {
    // Obtener todas las entradas ordenadas por puntuación
    const entries = await TournamentEntry.findAll({
      where: { tournamentId: tournament.id, status: 'ACTIVE' },
      order: [
        ['total_score', 'DESC'],
        ['roi', 'DESC'],
        ['correct_predictions', 'DESC']
      ]
    });

    // Asignar rankings finales
    for (let i = 0; i < entries.length; i++) {
      entries[i].finalRank = i + 1;
      entries[i].status = 'FINISHED';
      await entries[i].save();
    }

    // Calcular y distribuir premios
    const prizePool = parseFloat(tournament.prizePool);
    const payoutStructure = tournament.payoutStructure;

    for (const [position, percentage] of Object.entries(payoutStructure)) {
      const rank = parseInt(position);
      if (rank <= entries.length) {
        const entry = entries[rank - 1];
        const prize = (prizePool * percentage) / 100;
        entry.prizeWon = prize;
        await entry.save();
      }
    }

    // Actualizar estadísticas de usuarios
    for (const entry of entries) {
      await UserStats.recalculate(entry.userId);
    }

    console.log(`✅ Torneo ${tournament.name} finalizado con ${entries.length} participantes`);

  } catch (error) {
    console.error('Error finalizando competencia:', error);
    throw error;
  }
}

// =====================================================
// RECALCULAR PUNTUACIONES DE UN TORNEO
// =====================================================
exports.recalculateScores = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findByPk(id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    // Obtener todas las predicciones del torneo
    const predictions = await TournamentPrediction.findAll({
      where: { tournamentId: id },
      include: [{
        model: TournamentEntry,
        as: 'TournamentEntry'
      }]
    });

    // Recalcular puntuaciones por participante
    const participantScores = {};

    predictions.forEach(prediction => {
      if (!participantScores[prediction.userId]) {
        participantScores[prediction.userId] = {
          totalScore: 0,
          correctPredictions: 0,
          totalPredictions: 0,
          entryId: prediction.entryId
        };
      }

      const participant = participantScores[prediction.userId];
      participant.totalPredictions++;

      if (prediction.result === 'WON') {
        participant.correctPredictions++;
        participant.totalScore += parseFloat(prediction.finalPoints || 0);
      }
    });

    // Actualizar las entradas
    for (const [userId, scores] of Object.entries(participantScores)) {
      await TournamentEntry.update({
        totalScore: scores.totalScore,
        correctPredictions: scores.correctPredictions,
        predictionsSubmitted: scores.totalPredictions
      }, {
        where: { id: scores.entryId }
      });
    }

    res.json({
      success: true,
      message: 'Puntuaciones recalculadas exitosamente',
      data: {
        participantsUpdated: Object.keys(participantScores).length,
        predictionsProcessed: predictions.length
      }
    });

  } catch (error) {
    console.error('Error recalculando puntuaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al recalcular puntuaciones'
    });
  }
};

module.exports = exports;