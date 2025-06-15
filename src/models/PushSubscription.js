const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PushSubscription = sequelize.define('PushSubscription', {
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
  endpoint: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  p256dh: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  auth: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  deviceType: {
    type: DataTypes.STRING(50),
    defaultValue: 'web',
    field: 'device_type'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  lastUsed: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'last_used'
  }
}, {
  tableName: 'push_subscriptions',
  underscored: true,
  timestamps: true
});

module.exports = PushSubscription;