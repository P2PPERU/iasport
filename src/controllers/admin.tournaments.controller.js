// src/controllers/admin.tournaments.controller.js - CORREGIDO
const { Tournament, TournamentEntry, TournamentPrediction, User, UserStats } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// =====================================================
// OBTENER ESTADÍSTICAS DE TORNEOS - CORREGIDO
// =====================================================
exports.getTournamentStats = async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas de torneos...');
    
    // Inicializar stats con valores por defecto
    const stats = {
      // Contadores básicos
      totalTournaments: 0,
      activeTournaments: 0,
      upcomingTournaments: 0,
      finishedTournaments: 0,
      
      // Participación
      totalEntries: 0,
      activeEntries: 0,
      
      // Ingresos (últimos 30 días)
      monthlyRevenue: 0,
      totalPrizesPaid: 0,
      
      // Estadísticas por tipo
      byType: []
    };

    // Contadores básicos de torneos - MEJORADO
    try {
      stats.totalTournaments = await Tournament.count();
      stats.activeTournaments = await Tournament.count({ where: { status: 'ACTIVE' } });
      stats.upcomingTournaments = await Tournament.count({ 
        where: { status: { [Op.in]: ['UPCOMING', 'REGISTRATION'] } }
      });
      stats.finishedTournaments = await Tournament.count({ where: { status: 'FINISHED' } });
      console.log('✅ Contadores de torneos obtenidos');
    } catch (error) {
      console.log('⚠️ Error en contadores de torneos:', error.message);
      // Los valores por defecto ya están asignados
    }

    // Contadores de participación - MEJORADO
    try {
      stats.totalEntries = await TournamentEntry.count();
      stats.activeEntries = await TournamentEntry.count({ where: { status: 'ACTIVE' } });
      console.log('✅ Contadores de participación obtenidos');
    } catch (error) {
      console.log('⚠️ Error en contadores de participación:', error.message);
      // Usar valores por defecto (0)
    }

    // Ingresos del último mes - MEJORADO
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const revenueResult = await TournamentEntry.sum('buyInPaid', {
        where: {
          createdAt: { [Op.gte]: thirtyDaysAgo }
        }
      });
      stats.monthlyRevenue = revenueResult || 0;
      console.log('✅ Revenue mensual obtenido:', stats.monthlyRevenue);
    } catch (error) {
      console.log('⚠️ Error calculando revenue mensual:', error.message);
      stats.monthlyRevenue = 0;
    }

    // Total de premios pagados - MEJORADO
    try {
      const prizesResult = await TournamentEntry.sum('prizeWon');
      stats.totalPrizesPaid = prizesResult || 0;
      console.log('✅ Premios pagados obtenidos:', stats.totalPrizesPaid);
    } catch (error) {
      console.log('⚠️ Error calculando premios pagados:', error.message);
      stats.totalPrizesPaid = 0;
    }

    // Estadísticas por tipo de torneo - MEJORADO
    try {
      const typeStats = await Tournament.findAll({
        attributes: [
          'type',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('prize_pool')), 0), 'totalPrizePool'],
          [sequelize.fn('COALESCE', sequelize.fn('AVG', sequelize.col('current_players')), 0), 'avgPlayers']
        ],
        group: ['type'],
        raw: true
      });

      stats.byType = typeStats.map(stat => ({
        type: stat.type,
        count: parseInt(stat.count) || 0,
        totalPrizePool: parseFloat(stat.totalPrizePool) || 0,
        avgPlayers: parseFloat(stat.avgPlayers) || 0
      }));
      
      console.log('✅ Estadísticas por tipo obtenidas:', stats.byType.length, 'tipos');
    } catch (error) {
      console.log('⚠️ Error en estadísticas por tipo:', error.message);
      stats.byType = [];
    }

    // Agregar información adicional útil
    try {
      // Calcular tasa de ocupación promedio
      if (stats.totalTournaments > 0) {
        const avgOccupancy = await Tournament.findOne({
          attributes: [
            [sequelize.fn('AVG', 
              sequelize.literal('CASE WHEN max_players > 0 THEN (current_players::float / max_players::float) * 100 ELSE 0 END')
            ), 'avgOccupancy']
          ],
          raw: true
        });
        
        stats.avgOccupancy = parseFloat(avgOccupancy?.avgOccupancy) || 0;
      } else {
        stats.avgOccupancy = 0;
      }
    } catch (error) {
      console.log('⚠️ Error calculando ocupación promedio:', error.message);
      stats.avgOccupancy = 0;
    }

    // Log final
    console.log('✅ Estadísticas completas obtenidas:', {
      torneos: stats.totalTournaments,
      participaciones: stats.totalEntries,
      revenue: stats.monthlyRevenue,
      tipos: stats.byType.length
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error general en getTournamentStats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
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
    tournamentData.status = registrationDeadline > now ? 'REGISTRATION' : 'UPCOMING';

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

    // Usar findAll + count (NO findAndCountAll, porque da errores con group)
    const tournaments = await Tournament.findAll({
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
      offset: parseInt(offset),
      subQuery: false // CLAVE para evitar errores de subquery con group
    });

    // Total filtrados
    const totalFiltered = await Tournament.count({ where });

    res.json({
      success: true,
      data: tournaments,
      total: totalFiltered,
      hasMore: (parseInt(offset) + parseInt(limit)) < totalFiltered
    });

  } catch (error) {
    console.error('Error obteniendo torneos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener torneos',
      error: error.message
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