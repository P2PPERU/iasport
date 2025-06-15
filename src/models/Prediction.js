const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Prediction = sequelize.define('Prediction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  league: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  match: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  homeTeam: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'home_team'
  },
  awayTeam: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'away_team'
  },
  prediction: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  predictionType: {
    type: DataTypes.STRING(20),
    defaultValue: 'CUSTOM',
    field: 'prediction_type'
  },
  confidence: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 50,
      max: 100
    }
  },
  odds: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 1.01
    }
  },
  matchTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'match_time'
  },
  isHot: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_hot'
  },
  isPremium: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_premium'
  },
  result: {
    type: DataTypes.STRING(20),
    defaultValue: 'PENDING'
  },
  aiAnalysis: {
    type: DataTypes.JSONB,
    field: 'ai_analysis'
  },
  sport: {
    type: DataTypes.STRING(50),
    defaultValue: 'football'
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'ACTIVE'
  }
}, {
  tableName: 'predictions',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Prediction;