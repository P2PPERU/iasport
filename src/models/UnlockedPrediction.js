const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UnlockedPrediction = sequelize.define('UnlockedPrediction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id'
  },
  predictionId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'prediction_id'
  },
  unlockedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'unlocked_at'
  },
  method: {
    type: DataTypes.STRING(20),
    defaultValue: 'VIDEO'
  }
}, {
  tableName: 'unlocked_predictions',
  underscored: true,
  timestamps: true
});

module.exports = UnlockedPrediction;