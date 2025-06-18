// src/controllers/tournaments.controller.js
const { Tournament, TournamentEntry, TournamentPrediction, User, League, UserStats, Payment } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// =====================================================
// OBTENER TORNEOS ACTIVOS/DISPONIBLES
// =====================================================
exports.getActiveTournaments = async (req, res) => {
  try {
    const { type, status, featured } = req.query;
    
    const where = {
      status: ['UPCOMING', 'REGISTRATION', 'ACTIVE']
    };
    
    if (type) where.type = type;
    if (status) where.status = status;
    if (featured === 'true') where.isFeatured = true;

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
          [sequelize.fn('COUNT', sequelize.col('entries.id')), 'currentPlayers'],
          [sequelize.literal('(max_players - COUNT(entries.id))'), 'spotsLeft']
        ]
      },
      group: ['Tournament.id'],
      order: [
        ['is_featured', 'DESC'],
        ['is_hot', 'DESC'],
        ['start_time', 'ASC']
      ]
    });

    // Si hay usuario autenticado, verificar si ya está inscrito
    let userEntries = [];
    if (req.user) {
      userEntries = await TournamentEntry.findAll({
        where: { userId: req.user.id },
        attributes: ['tournamentId']
      });
    }

    const userTournamentIds = userEntries.map(entry => entry.tournamentId);

    const formattedTournaments = tournaments.map(tournament => {
      const data = tournament.toJSON();
      data.isUserEntered = userTournamentIds.includes(data.id);
      data.canRegister = data.status === 'REGISTRATION' && 
                        data.currentPlayers < data.maxPlayers &&
                        !data.isUserEntered &&
                        new Date() < new Date(data.registrationDeadline);
      return data;
    });

    res.json({
      success: true,
      data: formattedTournaments,
      count: formattedTournaments.length
    });

  } catch (error) {
    console.error('Error obteniendo torneos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener torneos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =====================================================
// OBTENER DETALLES DE UN TORNEO
// =====================================================
exports.getTournament = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tournament = await Tournament.findByPk(id, {
      include: [{
        model: TournamentEntry,
        as: 'entries',
        include: [{
          model: User,
          attributes: ['id', 'name']
        }],
        order: [['total_score', 'DESC'], ['roi', 'DESC']]
      }]
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    // Verificar si el usuario está inscrito
    let userEntry = null;
    if (req.user) {
      userEntry = await TournamentEntry.findOne({
        where: { userId: req.user.id, tournamentId: id },
        include: [{
          model: TournamentPrediction,
          as: 'predictions',
          order: [['sequence_number', 'ASC']]
        }]
      });
    }

    const data = tournament.toJSON();
    data.userEntry = userEntry;
    data.leaderboard = data.entries.map((entry, index) => ({
      ...entry,
      currentRank: index + 1
    }));

    res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error obteniendo torneo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener torneo'
    });
  }
};

// =====================================================
// INSCRIBIRSE A UN TORNEO
// =====================================================
exports.joinTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar que el torneo existe y está disponible
    const tournament = await Tournament.findByPk(id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    if (tournament.status !== 'REGISTRATION') {
      return res.status(400).json({
        success: false,
        message: 'El torneo no está disponible para inscripciones'
      });
    }

    if (new Date() > new Date(tournament.registrationDeadline)) {
      return res.status(400).json({
        success: false,
        message: 'La fecha límite de inscripción ha pasado'
      });
    }

    // Verificar si ya está inscrito
    const existingEntry = await TournamentEntry.findOne({
      where: { userId, tournamentId: id }
    });

    if (existingEntry) {
      return res.status(400).json({
        success: false,
        message: 'Ya estás inscrito en este torneo'
      });
    }

    // Verificar límite de jugadores
    const currentPlayers = await TournamentEntry.count({
      where: { tournamentId: id }
    });

    if (currentPlayers >= tournament.maxPlayers) {
      return res.status(400).json({
        success: false,
        message: 'El torneo está lleno'
      });
    }

    // Para freerolls, inscripción directa
    if (tournament.buyIn === 0) {
      const entry = await TournamentEntry.create({
        userId,
        tournamentId: id,
        buyInPaid: 0
      });

      // Actualizar contador de jugadores
      await tournament.increment('currentPlayers');

      return res.json({
        success: true,
        message: 'Inscripción exitosa al freeroll',
        data: entry
      });
    }

    // Para torneos pagados, crear orden de pago
    const payment = await Payment.create({
      userId,
      amount: tournament.buyIn,
      currency: tournament.currency,
      method: 'PENDING', // Se definirá en el siguiente paso
      status: 'PENDING',
      reference: `TOURNAMENT_${tournament.id}_${Date.now()}`,
      metadata: {
        tournamentId: id,
        tournamentName: tournament.name,
        type: 'tournament_entry'
      }
    });

    res.json({
      success: true,
      message: 'Orden de pago creada',
      data: {
        paymentId: payment.id,
        amount: tournament.buyIn,
        currency: tournament.currency,
        tournamentName: tournament.name
      }
    });

  } catch (error) {
    console.error('Error al inscribirse:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar inscripción'
    });
  }
};

// =====================================================
// CONFIRMAR INSCRIPCIÓN (DESPUÉS DEL PAGO)
// =====================================================
exports.confirmEntry = async (req, res) => {
  try {
    const { paymentId } = req.body;
    const userId = req.user.id;

    const payment = await Payment.findOne({
      where: { id: paymentId, userId, status: 'COMPLETED' }
    });

    if (!payment) {
      return res.status(400).json({
        success: false,
        message: 'Pago no encontrado o no completado'
      });
    }

    const tournamentId = payment.metadata.tournamentId;

    // Verificar que no existe ya una entrada
    const existingEntry = await TournamentEntry.findOne({
      where: { userId, tournamentId }
    });

    if (existingEntry) {
      return res.status(400).json({
        success: false,
        message: 'Ya estás inscrito en este torneo'
      });
    }

    // Crear entrada del torneo
    const entry = await TournamentEntry.create({
      userId,
      tournamentId,
      buyInPaid: payment.amount,
      paymentId: payment.id
    });

    // Actualizar prize pool y jugadores
    const tournament = await Tournament.findByPk(tournamentId);
    await tournament.increment('currentPlayers');
    await tournament.increment('prizePool', { by: payment.amount * 0.9 }); // 90% al prize pool, 10% comisión

    res.json({
      success: true,
      message: 'Inscripción confirmada exitosamente',
      data: entry
    });

  } catch (error) {
    console.error('Error confirmando entrada:', error);
    res.status(500).json({
      success: false,
      message: 'Error al confirmar entrada'
    });
  }
};

// =====================================================
// ENVIAR PREDICCIÓN EN UN TORNEO
// =====================================================
exports.submitPrediction = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { predictionData, sequenceNumber } = req.body;
    const userId = req.user.id;

    // Verificar entrada en el torneo
    const entry = await TournamentEntry.findOne({
      where: { userId, tournamentId, status: 'ACTIVE' }
    });

    if (!entry) {
      return res.status(403).json({
        success: false,
        message: 'No estás inscrito en este torneo o fuiste eliminado'
      });
    }

    // Verificar que el torneo está activo
    const tournament = await Tournament.findByPk(tournamentId);
    if (tournament.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'El torneo no está activo'
      });
    }

    // Verificar que no ha enviado ya esta predicción
    const existingPrediction = await TournamentPrediction.findOne({
      where: { tournamentId, userId, sequenceNumber }
    });

    if (existingPrediction) {
      return res.status(400).json({
        success: false,
        message: 'Ya has enviado esta predicción'
      });
    }

    // Crear la predicción del torneo
    const tournamentPrediction = await TournamentPrediction.create({
      tournamentId,
      userId,
      entryId: entry.id,
      basePredictionId: predictionData.basePredictionId,
      league: predictionData.league,
      match: predictionData.match,
      homeTeam: predictionData.homeTeam,
      awayTeam: predictionData.awayTeam,
      userPrediction: predictionData.prediction,
      predictionType: predictionData.type,
      selectedOdds: predictionData.odds,
      confidence: predictionData.confidence,
      matchTime: predictionData.matchTime,
      sequenceNumber
    });

    // Actualizar contador en la entrada
    await entry.increment('predictionsSubmitted');

    res.json({
      success: true,
      message: 'Predicción enviada exitosamente',
      data: tournamentPrediction
    });

  } catch (error) {
    console.error('Error enviando predicción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar predicción'
    });
  }
};

// =====================================================
// OBTENER RANKING GLOBAL
// =====================================================
exports.getGlobalRanking = async (req, res) => {
  try {
    const { period = 'all', limit = 100 } = req.query;
    
    const ranking = await User.getGlobalRanking(period, parseInt(limit));

    res.json({
      success: true,
      data: ranking,
      period,
      count: ranking.length
    });

  } catch (error) {
    console.error('Error obteniendo ranking:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ranking'
    });
  }
};

// =====================================================
// OBTENER ESTADÍSTICAS DE USUARIO
// =====================================================
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;

    let userStats = await UserStats.findOne({
      where: { userId },
      include: [{
        model: League
      }]
    });

    // Si no existen estadísticas, crearlas
    if (!userStats) {
      userStats = await UserStats.recalculate(userId);
      await userStats.reload({
        include: [{
          model: League
        }]
      });
    }

    // Obtener liga actual
    if (!userStats.League) {
      const league = await League.getUserLeague(userId);
      userStats.leagueId = league.id;
      await userStats.save();
      userStats.League = league;
    }

    // Obtener torneos activos
    const activeTournaments = await TournamentEntry.findAll({
      where: { userId },
      include: [{
        model: Tournament,
        where: { status: 'ACTIVE' }
      }]
    });

    res.json({
      success: true,
      data: {
        ...userStats.toJSON(),
        activeTournaments
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
};

// =====================================================
// OBTENER HISTORIAL DE TORNEOS DEL USUARIO
// =====================================================
exports.getUserTournaments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 20, offset = 0 } = req.query;

    const where = { userId };
    if (status) where.status = status;

    const tournaments = await TournamentEntry.findAndCountAll({
      where,
      include: [{
        model: Tournament,
        attributes: ['id', 'name', 'type', 'prizePool', 'status', 'startTime', 'endTime']
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: tournaments.rows,
      total: tournaments.count,
      hasMore: (parseInt(offset) + parseInt(limit)) < tournaments.count
    });

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial'
    });
  }
};