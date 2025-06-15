const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NotificationHistory = sequelize.define('NotificationHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    field: 'user_id'
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  sentAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'sent_at'
  },
  delivered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  clicked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  errorMessage: {
    type: DataTypes.TEXT,
    field: 'error_message'
  }
}, {
  tableName: 'notification_history',
  underscored: true,
  timestamps: true,
  updatedAt: false
});

module.exports = NotificationHistory;