// src/models/TournamentEntry.js - ACTUALIZADO CON WALLET INTEGRATION
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
    field: 'buy_in_paid',
    get() {
      const value = this.getDataValue('buyInPaid');
      return value ? parseFloat(value) : 0;
    }
  },
  paymentId: {
    type: DataTypes.UUID,
    field: 'payment_id',
    references: {
      model: 'payments',
      key: 'id'
    }
  },
  // NUEVA RELACIÓN CON WALLET TRANSACTION
  walletTransactionId: {
    type: DataTypes.UUID,
    field: 'wallet_transaction_id',
    references: {
      model: 'wallet_transactions',
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
    field: 'total_score',
    get() {
      const value = this.getDataValue('totalScore');
      return value ? parseFloat(value) : 0;
    }
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
    defaultValue: 0.0000,
    get() {
      const value = this.getDataValue('roi');
      return value ? parseFloat(value) : 0;
    }
  },
  streakCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'streak_count'
  },
  bonusPoints: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    field: 'bonus_points',
    get() {
      const value = this.getDataValue('bonusPoints');
      return value ? parseFloat(value) : 0;
    }
  },
  prizeWon: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    field: 'prize_won',
    get() {
      const value = this.getDataValue('prizeWon');
      return value ? parseFloat(value) : 0;
    }
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'ELIMINATED', 'FINISHED', 'REFUNDED'),
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
    },
    {
      fields: ['wallet_transaction_id']
    }
  ]
});

// Métodos de instancia
TournamentEntry.prototype.calculateROI = function() {
  if (this.buyInPaid === 0) return 0;
  const profit = this.prizeWon - this.buyInPaid;
  return (profit / this.buyInPaid) * 100;
};

TournamentEntry.prototype.getAccuracyRate = function() {
  if (this.predictionsSubmitted === 0) return 0;
  return (this.correctPredictions / this.predictionsSubmitted) * 100;
};

TournamentEntry.prototype.isInTheMoney = function() {
  return this.prizeWon > 0;
};

TournamentEntry.prototype.getNetProfit = function() {
  return this.prizeWon - this.buyInPaid;
};

module.exports = TournamentEntry;