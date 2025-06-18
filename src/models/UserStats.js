// src/models/UserStats.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserStats = sequelize.define('UserStats', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  leagueId: {
    type: DataTypes.UUID,
    field: 'league_id',
    references: {
      model: 'leagues',
      key: 'id'
    }
  },
  // Estadísticas generales
  totalTournaments: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_tournaments'
  },
  activeTournaments: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'active_tournaments'
  },
  wonTournaments: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'won_tournaments'
  },
  top3Finishes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'top3_finishes'
  },
  totalEarnings: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    field: 'total_earnings'
  },
  totalSpent: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    field: 'total_spent'
  },
  netProfit: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    field: 'net_profit'
  },
  roi: {
    type: DataTypes.DECIMAL(8, 4),
    defaultValue: 0.0000
  },
  
  // Estadísticas de predicciones
  totalPredictions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_predictions'
  },
  correctPredictions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'correct_predictions'
  },
  successRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0.00,
    field: 'success_rate'
  },
  averageOdds: {
    type: DataTypes.DECIMAL(8, 4),
    defaultValue: 0.0000,
    field: 'average_odds'
  },
  averageConfidence: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0.00,
    field: 'average_confidence'
  },
  
  // Rankings y posiciones
  globalRank: {
    type: DataTypes.INTEGER,
    field: 'global_rank'
  },
  monthlyRank: {
    type: DataTypes.INTEGER,
    field: 'monthly_rank'
  },
  weeklyRank: {
    type: DataTypes.INTEGER,
    field: 'weekly_rank'
  },
  
  // Rachas y logros
  currentStreak: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'current_streak'
  },
  bestStreak: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'best_streak'
  },
  worstStreak: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'worst_streak'
  },
  
  // Estadísticas por periodo
  monthlyStats: {
    type: DataTypes.JSONB,
    defaultValue: {
      tournaments: 0,
      predictions: 0,
      correct: 0,
      earnings: 0,
      spent: 0
    },
    field: 'monthly_stats'
  },
  weeklyStats: {
    type: DataTypes.JSONB,
    defaultValue: {
      tournaments: 0,
      predictions: 0,
      correct: 0,
      earnings: 0,
      spent: 0
    },
    field: 'weekly_stats'
  },
  
  // Estadísticas por tipo de torneo
  tournamentTypeStats: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'tournament_type_stats'
  },
  
  // Preferencias y deportes favoritos
  sportStats: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'sport_stats'
  },
  
  // Última actualización
  lastCalculated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'last_calculated'
  }
}, {
  tableName: 'user_stats',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['global_rank']
    },
    {
      fields: ['monthly_rank']
    },
    {
      fields: ['success_rate']
    },
    {
      fields: ['roi']
    }
  ]
});

// Método para recalcular estadísticas de un usuario
UserStats.recalculate = async function(userId) {
  const { TournamentEntry, TournamentPrediction, Tournament } = require('./index');
  
  // Obtener todas las entradas del usuario
  const entries = await TournamentEntry.findAll({
    where: { userId },
    include: [{
      model: Tournament,
      attributes: ['type', 'status']
    }]
  });

  // Obtener todas las predicciones del usuario
  const predictions = await TournamentPrediction.findAll({
    where: { userId }
  });

  // Calcular estadísticas
  const stats = {
    totalTournaments: entries.length,
    activeTournaments: entries.filter(e => e.Tournament.status === 'ACTIVE').length,
    wonTournaments: entries.filter(e => e.finalRank === 1).length,
    top3Finishes: entries.filter(e => e.finalRank && e.finalRank <= 3).length,
    totalEarnings: entries.reduce((sum, e) => sum + parseFloat(e.prizeWon || 0), 0),
    totalSpent: entries.reduce((sum, e) => sum + parseFloat(e.buyInPaid || 0), 0),
    totalPredictions: predictions.length,
    correctPredictions: predictions.filter(p => p.isCorrect).length
  };

  stats.netProfit = stats.totalEarnings - stats.totalSpent;
  stats.roi = stats.totalSpent > 0 ? ((stats.netProfit / stats.totalSpent) * 100) : 0;
  stats.successRate = stats.totalPredictions > 0 ? ((stats.correctPredictions / stats.totalPredictions) * 100) : 0;
  stats.averageOdds = predictions.length > 0 ? 
    predictions.reduce((sum, p) => sum + parseFloat(p.selectedOdds), 0) / predictions.length : 0;

  // Actualizar o crear registro
  const [userStats] = await UserStats.upsert({
    userId,
    ...stats,
    lastCalculated: new Date()
  });

  return userStats;
};

module.exports = UserStats;