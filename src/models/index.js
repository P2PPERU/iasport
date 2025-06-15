const sequelize = require('../config/database');
const User = require('./User');
const Prediction = require('./Prediction');
const Payment = require('./Payment');

// Asociaciones
User.hasMany(Payment, { foreignKey: 'user_id' });
Payment.belongsTo(User, { foreignKey: 'user_id' });

// Sincronizar modelos con BD (no crea tablas, solo valida)
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: false }); // false para no modificar tablas existentes
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
  syncDatabase
};