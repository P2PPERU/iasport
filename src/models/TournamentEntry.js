// src/models/TournamentEntry.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TournamentEntry = sequelize.define('TournamentEntry', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  tournamentId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'tournament_id',
    references: {
      model: 'tournaments',
      key: 'id'
    }
  },
  entryTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'entry_time'
  },
  buyInPaid: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'buy_in_paid'
  },
  paymentId: {
    type: DataTypes.UUID,
    field: 'payment_id',
    references: {
      model: 'payments',
      key: 'id'
    }
  },
  currentRank: {
    type: DataTypes.INTEGER,
    field: 'current_rank'
  },
  finalRank: {
    type: DataTypes.INTEGER,
    field: 'final_rank'
  },
  totalScore: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    field: 'total_score'
  },
  predictionsSubmitted: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'predictions_submitted'
  },
  correctPredictions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'correct_predictions'
  },
  roi: {
    type: DataTypes.DECIMAL(8, 4),
    defaultValue: 0.0000
  },
  streakCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'streak_count'
  },
  bonusPoints: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    field: 'bonus_points'
  },
  prizeWon: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    field: 'prize_won'
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'ELIMINATED', 'FINISHED'),
    defaultValue: 'ACTIVE'
  },
  eliminatedAt: {
    type: DataTypes.DATE,
    field: 'eliminated_at'
  },
  statistics: {
    type: DataTypes.JSONB,
    defaultValue: {
      predictionsByType: {},
      accuracyRate: 0,
      averageOdds: 0,
      bestStreak: 0,
      worstStreak: 0
    }
  }
}, {
  tableName: 'tournament_entries',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'tournament_id']
    },
    {
      fields: ['tournament_id', 'total_score']
    },
    {
      fields: ['tournament_id', 'current_rank']
    }
  ]
});

module.exports = TournamentEntry;