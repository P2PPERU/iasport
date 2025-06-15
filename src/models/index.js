const sequelize = require('../config/database');
const User = require('./User');
const Prediction = require('./Prediction');
const Payment = require('./Payment');
const UnlockedPrediction = require('./UnlockedPrediction');

// Asociaciones
User.hasMany(Payment, { foreignKey: 'user_id' });
Payment.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(UnlockedPrediction, { foreignKey: 'user_id' });
UnlockedPrediction.belongsTo(User, { foreignKey: 'user_id' });

Prediction.hasMany(UnlockedPrediction, { foreignKey: 'prediction_id' });
UnlockedPrediction.belongsTo(Prediction, { foreignKey: 'prediction_id' });

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
  syncDatabase
};