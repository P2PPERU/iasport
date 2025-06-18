// src/models/Tournament.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Tournament = sequelize.define('Tournament', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  type: {
    type: DataTypes.ENUM('HYPER_TURBO', 'DAILY_CLASSIC', 'WEEKLY_MASTERS', 'FREEROLL', 'SPECIAL'),
    allowNull: false
  },
  buyIn: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'buy_in'
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'PEN'
  },
  maxPlayers: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'max_players'
  },
  currentPlayers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'current_players'
  },
  prizePool: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    field: 'prize_pool'
  },
  status: {
    type: DataTypes.ENUM('UPCOMING', 'REGISTRATION', 'ACTIVE', 'FINISHED', 'CANCELLED'),
    defaultValue: 'UPCOMING'
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'start_time'
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'end_time'
  },
  registrationDeadline: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'registration_deadline'
  },
  predictionsCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 4,
    field: 'predictions_count'
  },
  payoutStructure: {
    type: DataTypes.JSONB,
    defaultValue: {
      "1": 50, // 1er lugar: 50% del prize pool
      "2": 30, // 2do lugar: 30%
      "3": 20  // 3er lugar: 20%
    },
    field: 'payout_structure'
  },
  rules: {
    type: DataTypes.JSONB,
    defaultValue: {
      scoring: 'CONFIDENCE_BASED',
      bonusMultipliers: {
        streak: 1.1,
        perfectPick: 1.5,
        roi: 1.15
      }
    }
  },
  isHot: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_hot'
  },
  isFeatured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_featured'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'tournaments',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Tournament;