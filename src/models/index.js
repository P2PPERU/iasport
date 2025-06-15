const sequelize = require('../config/database');
const User = require('./User');
const Prediction = require('./Prediction');
const Payment = require('./Payment');
const UnlockedPrediction = require('./UnlockedPrediction');
const PushSubscription = require('./PushSubscription');
const NotificationHistory = require('./NotificationHistory');

// Asociaciones existentes
User.hasMany(Payment, { foreignKey: 'user_id' });
Payment.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(UnlockedPrediction, { foreignKey: 'user_id' });
UnlockedPrediction.belongsTo(User, { foreignKey: 'user_id' });

Prediction.hasMany(UnlockedPrediction, { foreignKey: 'prediction_id' });
UnlockedPrediction.belongsTo(Prediction, { foreignKey: 'prediction_id' });

// Nuevas asociaciones para Push Notifications
User.hasMany(PushSubscription, { foreignKey: 'user_id' });
PushSubscription.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(NotificationHistory, { foreignKey: 'user_id' });
NotificationHistory.belongsTo(User, { foreignKey: 'user_id' });

// Sincronizar modelos con BD
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: false });
    console.log('✅ Modelos sincronizados con la base de datos');
  } catch (error) {
    console.error('❌ Error sincronizando modelos:', error);
  }
};

module.exports = {
  sequelize,
  User,
  Prediction,
  Payment,
  UnlockedPrediction,
  PushSubscription,
  NotificationHistory,
  syncDatabase
};