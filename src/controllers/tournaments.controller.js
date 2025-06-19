// src/controllers/tournaments.controller.js - ACTUALIZADO CON WALLET INTEGRATION
const { Tournament, TournamentEntry, TournamentPrediction, User, League, UserStats, Wallet, WalletTransaction } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const WalletService = require('../services/wallet.service');

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

    // Si hay usuario autenticado, verificar si ya está inscrito y su saldo
    let userEntries = [];
    let userBalance = 0;
    
    if (req.user) {
      userEntries = await TournamentEntry.findAll({
        where: { userId: req.user.id },
        attributes: ['tournamentId']
      });
      
      // Obtener saldo del usuario
      userBalance = await WalletService.getAvailableBalance(req.user.id);
    }

    const userTournamentIds = userEntries.map(entry => entry.tournamentId);

    const formattedTournaments = tournaments.map(tournament => {
      const data = tournament.toJSON();
      data.isUserEntered = userTournamentIds.includes(data.id);
      data.canRegister = data.status === 'REGISTRATION' && 
                        data.currentPlayers < data.maxPlayers &&
                        !data.isUserEntered &&
                        new Date() < new Date(data.registrationDeadline);
      
      // Verificar si el usuario puede pagar
      data.canAfford = data.buyIn === 0 || userBalance >= data.buyIn;
      data.userBalance = userBalance;
      
      return data;
    });

    res.json({
      success: true,
      data: formattedTournaments,
      count: formattedTournaments.length,
      userBalance
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

    // Verificar si el usuario está inscrito y su saldo
    let userEntry = null;
    let userBalance = 0;
    
    if (req.user) {
      userEntry = await TournamentEntry.findOne({
        where: { userId: req.user.id, tournamentId: id },
        include: [{
          model: TournamentPrediction,
          as: 'predictions',
          order: [['sequence_number', 'ASC']]
        }]
      });
      
      userBalance = await WalletService.getAvailableBalance(req.user.id);
    }

    const data = tournament.toJSON();
    data.userEntry = userEntry;
    data.userBalance = userBalance;
    data.canAfford = data.buyIn === 0 || userBalance >= data.buyIn;
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
// INSCRIBIRSE A UN TORNEO - INTEGRADO CON WALLET
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
        data: {
          entry,
          tournament: {
            id: tournament.id,
            name: tournament.name,
            currentPlayers: tournament.currentPlayers + 1
          }
        }
      });
    }

    // Para torneos pagados, usar WalletService
    const paymentResult = await WalletService.payTournamentEntry(
      userId, 
      id, 
      tournament.buyIn
    );

    if (!paymentResult.success) {
      return res.status(400).json({
        success: false,
        message: paymentResult.error || 'No tienes saldo suficiente',
        data: {
          required: tournament.buyIn,
          available: paymentResult.available || 0
        }
      });
    }

    // Crear entrada del torneo
    const entry = await TournamentEntry.create({
      userId,
      tournamentId: id,
      buyInPaid: tournament.buyIn,
      walletTransactionId: paymentResult.transaction.id
    });

    // Actualizar contador de jugadores y prize pool
    const prizePoolIncrease = tournament.buyIn * 0.9; // 90% al prize pool, 10% comisión
    await tournament.increment('currentPlayers');
    await tournament.increment('prizePool', { by: prizePoolIncrease });

    res.json({
      success: true,
      message: 'Inscripción exitosa',
      data: {
        entry,
        transaction: paymentResult.transaction,
        newBalance: paymentResult.newBalance,
        tournament: {
          id: tournament.id,
          name: tournament.name,
          currentPlayers: tournament.currentPlayers + 1,
          prizePool: tournament.prizePool + prizePoolIncrease
        }
      }
    });

  } catch (error) {
    console.error('Error al inscribirse:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar inscripción',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
    
    // Implementar lógica de ranking según el período
    let ranking = [];
    
    if (period === 'all') {
      // Ranking global basado en UserStats
      ranking = await UserStats.findAll({
        include: [
          { model: User, attributes: ['id', 'name'] },
          { model: League }
        ],
        order: [
          ['roi', 'DESC'],
          ['success_rate', 'DESC']
        ],
        limit: parseInt(limit)
      });
    } else if (period === 'monthly') {
      // Ranking mensual
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      ranking = await UserStats.findAll({
        include: [
          { model: User, attributes: ['id', 'name'] },
          { model: League }
        ],
        order: [
          [sequelize.literal('"monthly_stats"->\'earnings\''), 'DESC'],
          [sequelize.literal('"monthly_stats"->\'correct\''), 'DESC']
        ],
        limit: parseInt(limit)
      });
    } else if (period === 'weekly') {
      // Ranking semanal
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      ranking = await UserStats.findAll({
        include: [
          { model: User, attributes: ['id', 'name'] },
          { model: League }
        ],
        order: [
          [sequelize.literal('"weekly_stats"->\'earnings\''), 'DESC'],
          [sequelize.literal('"weekly_stats"->\'correct\''), 'DESC']
        ],
        limit: parseInt(limit)
      });
    }

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

    // Obtener balance de wallet
    const walletBalance = await WalletService.getAvailableBalance(userId);

    res.json({
      success: true,
      data: {
        ...userStats.toJSON(),
        activeTournaments,
        walletBalance
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
      }, {
        model: WalletTransaction,
        as: 'walletTransaction',
        attributes: ['id', 'amount', 'status', 'createdAt'],
        required: false
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

// =====================================================
// SALIR DE UN TORNEO (ANTES DE QUE EMPIECE)
// =====================================================
exports.leaveTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const tournament = await Tournament.findByPk(id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    // Solo permitir salir si el torneo no ha empezado
    if (!['UPCOMING', 'REGISTRATION'].includes(tournament.status)) {
      return res.status(400).json({
        success: false,
        message: 'No puedes salir de un torneo que ya comenzó'
      });
    }

    const entry = await TournamentEntry.findOne({
      where: { userId, tournamentId: id }
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'No estás inscrito en este torneo'
      });
    }

    // Si pagó buy-in, hacer reembolso
    let refundResult = { success: false, newBalance: 0 };
    
    if (entry.buyInPaid > 0) {
      refundResult = await WalletService.refundTournamentEntry(
        userId,
        id,
        entry.buyInPaid,
        'Usuario salió del torneo antes del inicio'
      );

      if (!refundResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Error procesando reembolso',
          error: refundResult.error
        });
      }
    }

    // Eliminar entrada
    await entry.destroy();

    // Actualizar contadores del torneo
    await tournament.decrement('currentPlayers');
    if (entry.buyInPaid > 0) {
      await tournament.decrement('prizePool', { by: entry.buyInPaid * 0.9 });
    }

    res.json({
      success: true,
      message: entry.buyInPaid > 0 ? 
        'Has salido del torneo y se procesó tu reembolso' : 
        'Has salido del torneo exitosamente',
      data: {
        refunded: entry.buyInPaid,
        newBalance: refundResult.newBalance
      }
    });

  } catch (error) {
    console.error('Error saliendo del torneo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al salir del torneo',
      error: error.message
    });
  }
};