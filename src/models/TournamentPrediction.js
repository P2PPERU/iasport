// src/models/TournamentPrediction.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TournamentPrediction = sequelize.define('TournamentPrediction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
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
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  entryId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'entry_id',
    references: {
      model: 'tournament_entries',
      key: 'id'
    }
  },
  basePredictionId: {
    type: DataTypes.UUID,
    field: 'base_prediction_id',
    references: {
      model: 'predictions',
      key: 'id'
    }
  },
  // Copia de datos de la predicción para snapshot
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
  userPrediction: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'user_prediction'
  },
  predictionType: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'prediction_type'
  },
  selectedOdds: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'selected_odds'
  },
  confidence: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 100
    }
  },
  matchTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'match_time'
  },
  submittedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'submitted_at'
  },
  result: {
    type: DataTypes.ENUM('WON', 'LOST', 'VOID', 'PENDING'),
    defaultValue: 'PENDING'
  },
  points: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  bonusMultiplier: {
    type: DataTypes.DECIMAL(4, 2),
    defaultValue: 1.00,
    field: 'bonus_multiplier'
  },
  finalPoints: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    field: 'final_points'
  },
  isCorrect: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_correct'
  },
  roiContribution: {
    type: DataTypes.DECIMAL(8, 4),
    defaultValue: 0.0000,
    field: 'roi_contribution'
  },
  sequenceNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'sequence_number'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'tournament_predictions',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['tournament_id', 'user_id', 'sequence_number']
    },
    {
      fields: ['tournament_id', 'result']
    },
    {
      fields: ['entry_id']
    }
  ]
});

module.exports = TournamentPrediction;