// src/controllers/predictionResults.controller.js
const { TournamentPrediction, Tournament, TournamentEntry, User } = require('../models');
const { Op } = require('sequelize');
const ScoringService = require('../services/scoring.service');
const NotificationService = require('../services/notification.service');

// =====================================================
// ACTUALIZAR RESULTADO DE PREDICCIÓN (ADMIN)
// =====================================================
exports.updatePredictionResult = async (req, res) => {
  try {
    const { predictionId } = req.params;
    const { result, actualOdds, notes } = req.body;

    // Validar resultado
    const validResults = ['WON', 'LOST', 'VOID'];
    if (!validResults.includes(result)) {
      return res.status(400).json({
        success: false,
        message: 'Resultado inválido. Debe ser: WON, LOST o VOID'
      });
    }

    // Buscar la predicción
    const prediction = await TournamentPrediction.findByPk(predictionId, {
      include: [{
        model: Tournament
      }, {
        model: User,
        attributes: ['id', 'name', 'email']
      }]
    });

    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Predicción no encontrada'
      });
    }

    // Verificar que el torneo permita actualizaciones
    if (prediction.Tournament.status === 'FINISHED') {
      return res.status(400).json({
        success: false,
        message: 'No se pueden actualizar predicciones de torneos finalizados'
      });
    }

    // Actualizar la predicción usando el servicio de scoring
    const updatedPrediction = await ScoringService.updatePredictionResult(
      predictionId, 
      result, 
      actualOdds
    );

    // Agregar notas si se proporcionaron
    if (notes) {
      updatedPrediction.metadata = {
        ...updatedPrediction.metadata,
        adminNotes: notes,
        updatedBy: req.user.id,
        updatedAt: new Date()
      };
      await updatedPrediction.save();
    }

    // Actualizar rankings del torneo
    await ScoringService.updateTournamentRankings(prediction.tournamentId);

    // Notificar al usuario sobre el resultado (opcional)
    if (result !== 'PENDING') {
      try {
        await NotificationService.sendToUser(
          prediction.userId,
          'prediction_result_updated',
          {
            title: result === 'WON' ? '✅ Predicción Ganada!' : 
                   result === 'LOST' ? '❌ Predicción Perdida' : '⚪ Predicción Anulada',
            body: `${prediction.match}: ${prediction.userPrediction}`,
            points: updatedPrediction.finalPoints,
            tournamentName: prediction.Tournament.name
          }
        );
      } catch (notificationError) {
        console.error('Error enviando notificación:', notificationError);
      }
    }

    res.json({
      success: true,
      message: `Predicción actualizada a ${result}`,
      data: updatedPrediction
    });

  } catch (error) {
    console.error('Error actualizando resultado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar resultado de predicción',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =====================================================
// ACTUALIZAR MÚLTIPLES RESULTADOS (BATCH)
// =====================================================
exports.updateMultiplePredictionResults = async (req, res) => {
  try {
    const { predictions } = req.body;

    if (!Array.isArray(predictions) || predictions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de predicciones'
      });
    }

    const results = {
      updated: 0,
      failed: 0,
      errors: []
    };

    // Procesar cada predicción
    for (const predictionUpdate of predictions) {
      try {
        const { id, result, actualOdds } = predictionUpdate;
        
        if (!id || !result) {
          results.failed++;
          results.errors.push({ id, error: 'ID y resultado son requeridos' });
          continue;
        }

        await ScoringService.updatePredictionResult(id, result, actualOdds);
        results.updated++;

      } catch (error) {
        results.failed++;
        results.errors.push({ 
          id: predictionUpdate.id, 
          error: error.message 
        });
      }
    }

    // Obtener torneos únicos para actualizar rankings
    const tournamentIds = await TournamentPrediction.findAll({
      where: {
        id: { [Op.in]: predictions.map(p => p.id) }
      },
      attributes: ['tournamentId'],
      group: ['tournamentId']
    });

    // Actualizar rankings de todos los torneos afectados
    for (const tournament of tournamentIds) {
      try {
        await ScoringService.updateTournamentRankings(tournament.tournamentId);
      } catch (error) {
        console.error('Error actualizando ranking:', error);
      }
    }

    res.json({
      success: true,
      message: `Actualización masiva completada: ${results.updated} exitosas, ${results.failed} fallidas`,
      data: results
    });

  } catch (error) {
    console.error('Error en actualización masiva:', error);
    res.status(500).json({
      success: false,
      message: 'Error en actualización masiva de predicciones'
    });
  }
};

// =====================================================
// OBTENER PREDICCIONES PENDIENTES
// =====================================================
exports.getPendingPredictions = async (req, res) => {
  try {
    const { tournamentId, sport, league, limit = 50, offset = 0 } = req.query;

    const where = {
      result: 'PENDING',
      matchTime: { [Op.lte]: new Date() } // Solo partidos que ya deberían haber terminado
    };

    if (tournamentId) where.tournamentId = tournamentId;
    if (sport) where['$Tournament.sport$'] = sport;
    if (league) where.league = league;

    const pendingPredictions = await TournamentPrediction.findAndCountAll({
      where,
      include: [{
        model: Tournament,
        attributes: ['id', 'name', 'status', 'type']
      }, {
        model: User,
        attributes: ['id', 'name', 'email']
      }],
      order: [['matchTime', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Agrupar por partido para facilitar actualización masiva
    const groupedByMatch = {};
    pendingPredictions.rows.forEach(prediction => {
      const matchKey = `${prediction.league}_${prediction.match}`;
      if (!groupedByMatch[matchKey]) {
        groupedByMatch[matchKey] = {
          league: prediction.league,
          match: prediction.match,
          homeTeam: prediction.homeTeam,
          awayTeam: prediction.awayTeam,
          matchTime: prediction.matchTime,
          predictions: []
        };
      }
      groupedByMatch[matchKey].predictions.push(prediction);
    });

    res.json({
      success: true,
      data: {
        individual: pendingPredictions.rows,
        grouped: Object.values(groupedByMatch),
        total: pendingPredictions.count,
        hasMore: (parseInt(offset) + parseInt(limit)) < pendingPredictions.count
      }
    });

  } catch (error) {
    console.error('Error obteniendo predicciones pendientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener predicciones pendientes'
    });
  }
};

// =====================================================
// OBTENER ESTADÍSTICAS DE RESULTADOS
// =====================================================
exports.getResultsStats = async (req, res) => {
  try {
    const { tournamentId, period = 'week' } = req.query;

    let dateFilter = {};
    const now = new Date();
    
    if (period === 'day') {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      dateFilter = { [Op.gte]: startOfDay };
    } else if (period === 'week') {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { [Op.gte]: weekAgo };
    } else if (period === 'month') {
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { [Op.gte]: monthAgo };
    }

    const where = {
      result: { [Op.ne]: 'PENDING' }
    };

    if (Object.keys(dateFilter).length > 0) {
      where.updatedAt = dateFilter;
    }

    if (tournamentId) {
      where.tournamentId = tournamentId;
    }

    // Estadísticas básicas
    const stats = await TournamentPrediction.findAll({
      where,
      attributes: [
        'result',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
        [require('sequelize').fn('AVG', require('sequelize').col('final_points')), 'avgPoints'],
        [require('sequelize').fn('SUM', require('sequelize').col('final_points')), 'totalPoints']
      ],
      group: ['result'],
      raw: true
    });

    // Estadísticas por tipo de predicción
    const typeStats = await TournamentPrediction.findAll({
      where,
      attributes: [
        'predictionType',
        'result',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['predictionType', 'result'],
      raw: true
    });

    // Predicciones más rentables
    const topPredictions = await TournamentPrediction.findAll({
      where: {
        ...where,
        result: 'WON'
      },
      include: [{
        model: User,
        attributes: ['name']
      }],
      order: [['final_points', 'DESC']],
      limit: 10
    });

    res.json({
      success: true,
      data: {
        period,
        basicStats: stats,
        typeStats,
        topPredictions,
        summary: {
          totalProcessed: stats.reduce((sum, s) => sum + parseInt(s.count), 0),
          wonCount: stats.find(s => s.result === 'WON')?.count || 0,
          lostCount: stats.find(s => s.result === 'LOST')?.count || 0,
          voidCount: stats.find(s => s.result === 'VOID')?.count || 0
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de resultados'
    });
  }
};

// =====================================================
// OBTENER HISTORIAL DE ACTUALIZACIONES
// =====================================================
exports.getUpdateHistory = async (req, res) => {
  try {
    const { limit = 100, offset = 0, updatedBy } = req.query;

    const where = {
      result: { [Op.ne]: 'PENDING' },
      'metadata.updatedBy': { [Op.ne]: null }
    };

    if (updatedBy) {
      where['metadata.updatedBy'] = updatedBy;
    }

    const history = await TournamentPrediction.findAndCountAll({
      where,
      include: [{
        model: User,
        attributes: ['id', 'name']
      }, {
        model: Tournament,
        attributes: ['name']
      }],
      order: [['updatedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: history.rows,
      total: history.count,
      hasMore: (parseInt(offset) + parseInt(limit)) < history.count
    });

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial de actualizaciones'
    });
  }
};

// =====================================================
// REVERTIR RESULTADO (EMERGENCIA)
// =====================================================
exports.revertPredictionResult = async (req, res) => {
  try {
    const { predictionId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere una razón para revertir el resultado'
      });
    }

    const prediction = await TournamentPrediction.findByPk(predictionId);
    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Predicción no encontrada'
      });
    }

    if (prediction.result === 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'La predicción ya está pendiente'
      });
    }

    // Guardar estado anterior
    const previousState = {
      result: prediction.result,
      points: prediction.points,
      finalPoints: prediction.finalPoints,
      bonusMultiplier: prediction.bonusMultiplier,
      roiContribution: prediction.roiContribution
    };

    // Revertir a estado pendiente
    prediction.result = 'PENDING';
    prediction.points = 0;
    prediction.finalPoints = 0;
    prediction.bonusMultiplier = 1.0;
    prediction.roiContribution = 0;
    prediction.isCorrect = false;
    prediction.metadata = {
      ...prediction.metadata,
      reverted: true,
      revertedBy: req.user.id,
      revertedAt: new Date(),
      revertReason: reason,
      previousState
    };

    await prediction.save();

    // Recalcular totales del torneo
    await ScoringService.updateTournamentEntryTotals(prediction.entryId);
    await ScoringService.updateTournamentRankings(prediction.tournamentId);

    res.json({
      success: true,
      message: 'Resultado revertido exitosamente',
      data: prediction
    });

  } catch (error) {
    console.error('Error revirtiendo resultado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al revertir resultado'
    });
  }
};

module.exports = exports;