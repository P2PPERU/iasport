// src/models/index.js - ACTUALIZADO CON TORNEOS
const sequelize = require('../config/database');

// Modelos existentes
const User = require('./User');
const Prediction = require('./Prediction');
const Payment = require('./Payment');
const UnlockedPrediction = require('./UnlockedPrediction');
const PushSubscription = require('./PushSubscription');
const NotificationHistory = require('./NotificationHistory');

// Nuevos modelos para PredictMaster
const Tournament = require('./Tournament');
const TournamentEntry = require('./TournamentEntry');
const TournamentPrediction = require('./TournamentPrediction');
const League = require('./League');
const UserStats = require('./UserStats');

// =====================================================
// ASOCIACIONES EXISTENTES
// =====================================================
User.hasMany(Payment, { foreignKey: 'user_id' });
Payment.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(UnlockedPrediction, { foreignKey: 'user_id' });
UnlockedPrediction.belongsTo(User, { foreignKey: 'user_id' });

Prediction.hasMany(UnlockedPrediction, { foreignKey: 'prediction_id' });
UnlockedPrediction.belongsTo(Prediction, { foreignKey: 'prediction_id' });

User.hasMany(PushSubscription, { foreignKey: 'user_id' });
PushSubscription.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(NotificationHistory, { foreignKey: 'user_id' });
NotificationHistory.belongsTo(User, { foreignKey: 'user_id' });

// =====================================================
// NUEVAS ASOCIACIONES PARA TORNEOS
// =====================================================

// User ↔ Tournament (many-to-many a través de TournamentEntry)
User.hasMany(TournamentEntry, { foreignKey: 'user_id', as: 'tournamentEntries' });
TournamentEntry.belongsTo(User, { foreignKey: 'user_id' });

Tournament.hasMany(TournamentEntry, { foreignKey: 'tournament_id', as: 'entries' });
TournamentEntry.belongsTo(Tournament, { foreignKey: 'tournament_id' });

// TournamentEntry ↔ Payment
TournamentEntry.belongsTo(Payment, { foreignKey: 'payment_id' });
Payment.hasOne(TournamentEntry, { foreignKey: 'payment_id' });

// TournamentEntry ↔ TournamentPrediction
TournamentEntry.hasMany(TournamentPrediction, { foreignKey: 'entry_id', as: 'predictions' });
TournamentPrediction.belongsTo(TournamentEntry, { foreignKey: 'entry_id' });

// Tournament ↔ TournamentPrediction
Tournament.hasMany(TournamentPrediction, { foreignKey: 'tournament_id', as: 'predictions' });
TournamentPrediction.belongsTo(Tournament, { foreignKey: 'tournament_id' });

// User ↔ TournamentPrediction
User.hasMany(TournamentPrediction, { foreignKey: 'user_id', as: 'tournamentPredictions' });
TournamentPrediction.belongsTo(User, { foreignKey: 'user_id' });

// Prediction ↔ TournamentPrediction (predicción base opcional)
Prediction.hasMany(TournamentPrediction, { foreignKey: 'base_prediction_id', as: 'tournamentUses' });
TournamentPrediction.belongsTo(Prediction, { foreignKey: 'base_prediction_id', as: 'basePrediction' });

// User ↔ League (a través de UserStats)
League.hasMany(UserStats, { foreignKey: 'league_id' });
UserStats.belongsTo(League, { foreignKey: 'league_id' });

User.hasOne(UserStats, { foreignKey: 'user_id', as: 'stats' });
UserStats.belongsTo(User, { foreignKey: 'user_id' });

// =====================================================
// MÉTODOS HELPER PARA CONSULTAS COMPLEJAS
// =====================================================

// Obtener ranking de torneo
Tournament.prototype.getLeaderboard = async function(limit = 50) {
  return await TournamentEntry.findAll({
    where: { tournamentId: this.id },
    include: [{
      model: User,
      attributes: ['id', 'name', 'email']
    }],
    order: [
      ['total_score', 'DESC'],
      ['roi', 'DESC'],
      ['correct_predictions', 'DESC']
    ],
    limit
  });
};

// Obtener estadísticas de usuario en un torneo
User.prototype.getTournamentStats = async function(tournamentId) {
  const entry = await TournamentEntry.findOne({
    where: { userId: this.id, tournamentId },
    include: [{
      model: TournamentPrediction,
      as: 'predictions'
    }]
  });
  
  return entry;
};

// Obtener ranking global
User.getGlobalRanking = async function(period = 'all', limit = 100) {
  const whereClause = {};
  
  if (period === 'monthly') {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    whereClause.created_at = { [sequelize.Sequelize.Op.gte]: startOfMonth };
  } else if (period === 'weekly') {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    whereClause.created_at = { [sequelize.Sequelize.Op.gte]: startOfWeek };
  }

  return await User.findAll({
    include: [{
      model: UserStats,
      as: 'stats',
      include: [{
        model: League
      }]
    }, {
      model: TournamentEntry,
      as: 'tournamentEntries',
      where: whereClause,
      required: false
    }],
    order: [
      [{ model: UserStats, as: 'stats' }, 'roi', 'DESC'],
      [{ model: UserStats, as: 'stats' }, 'success_rate', 'DESC'],
      [{ model: UserStats, as: 'stats' }, 'total_earnings', 'DESC']
    ],
    limit
  });
};

// Sincronizar modelos con BD
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: false });
    console.log('✅ Todos los modelos sincronizados con la base de datos');
    
    // Crear ligas por defecto si no existen
    await createDefaultLeagues();
  } catch (error) {
    console.error('❌ Error sincronizando modelos:', error);
  }
};

// Crear ligas por defecto
const createDefaultLeagues = async () => {
  const defaultLeagues = [
    {
      name: 'Bronze',
      level: 1,
      minTournaments: 0,
      color: '#CD7F32',
      icon: 'fas fa-shield-alt',
      description: 'Liga inicial para nuevos jugadores'
    },
    {
      name: 'Silver',
      level: 2,
      minTournaments: 11,
      color: '#C0C0C0',
      icon: 'fas fa-shield-alt',
      description: 'Para jugadores con experiencia básica'
    },
    {
      name: 'Gold',
      level: 3,
      minTournaments: 31,
      minSuccessRate: 55,
      color: '#FFD700',
      icon: 'fas fa-award',
      description: 'Para predictores competentes'
    },
    {
      name: 'Platinum',
      level: 4,
      minTournaments: 100,
      minROI: 10,
      minSuccessRate: 60,
      color: '#E5E4E2',
      icon: 'fas fa-gem',
      description: 'Elite de predictores'
    },
    {
      name: 'Legend',
      level: 5,
      minTournaments: 200,
      minROI: 25,
      minSuccessRate: 70,
      color: '#9932CC',
      icon: 'fas fa-crown',
      description: 'Los mejores predictores del mundo'
    }
  ];

  for (const league of defaultLeagues) {
    await League.findOrCreate({
      where: { name: league.name },
      defaults: league
    });
  }
  
  console.log('✅ Ligas por defecto creadas/verificadas');
};

module.exports = {
  sequelize,
  // Modelos existentes
  User,
  Prediction,
  Payment,
  UnlockedPrediction,
  PushSubscription,
  NotificationHistory,
  // Nuevos modelos
  Tournament,
  TournamentEntry,
  TournamentPrediction,
  League,
  UserStats,
  // Funciones utilitarias
  syncDatabase,
  createDefaultLeagues
};