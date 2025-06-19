// src/models/index.js - ACTUALIZADO CON WALLET Y ALIAS

const sequelize = require('../config/database');

// Modelos existentes
const User = require('./User');
const Prediction = require('./Prediction');
const Payment = require('./Payment');
const UnlockedPrediction = require('./UnlockedPrediction');
const PushSubscription = require('./PushSubscription');
const NotificationHistory = require('./NotificationHistory');

// Modelos de PredictMaster
const Tournament = require('./Tournament');
const TournamentEntry = require('./TournamentEntry');
const TournamentPrediction = require('./TournamentPrediction');
const League = require('./League');
const UserStats = require('./UserStats');

// NUEVOS MODELOS DE WALLET
const Wallet = require('./Wallet');
const WalletTransaction = require('./WalletTransaction');
const DepositRequest = require('./DepositRequest');
const WithdrawalRequest = require('./WithdrawalRequest');

// =====================================================
// ASOCIACIONES EXISTENTES
// =====================================================
User.hasMany(Payment, { foreignKey: 'user_id' });
Payment.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(UnlockedPrediction, { foreignKey: 'user_id' });
UnlockedPrediction.belongsTo(User, { foreignKey: 'user_id' });

Prediction.hasMany(UnlockedPrediction, { foreignKey: 'prediction_id' });
UnlockedPrediction.belongsTo(Prediction, { foreignKey: 'prediction_id' });

User.hasMany(PushSubscription, { foreignKey: 'user_id' });
PushSubscription.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(NotificationHistory, { foreignKey: 'user_id' });
NotificationHistory.belongsTo(User, { foreignKey: 'user_id' });

// =====================================================
// ASOCIACIONES DE TORNEOS
// =====================================================
User.hasMany(TournamentEntry, { foreignKey: 'user_id', as: 'tournamentEntries' });
TournamentEntry.belongsTo(User, { foreignKey: 'user_id' });

Tournament.hasMany(TournamentEntry, { foreignKey: 'tournament_id', as: 'entries' });
TournamentEntry.belongsTo(Tournament, { foreignKey: 'tournament_id' });

TournamentEntry.belongsTo(Payment, { foreignKey: 'payment_id' });
Payment.hasOne(TournamentEntry, { foreignKey: 'payment_id' });

TournamentEntry.hasMany(TournamentPrediction, { foreignKey: 'entry_id', as: 'predictions' });
TournamentPrediction.belongsTo(TournamentEntry, { foreignKey: 'entry_id' });

Tournament.hasMany(TournamentPrediction, { foreignKey: 'tournament_id', as: 'predictions' });
TournamentPrediction.belongsTo(Tournament, { foreignKey: 'tournament_id' });

User.hasMany(TournamentPrediction, { foreignKey: 'user_id', as: 'tournamentPredictions' });
TournamentPrediction.belongsTo(User, { foreignKey: 'user_id' });

Prediction.hasMany(TournamentPrediction, { foreignKey: 'base_prediction_id', as: 'tournamentUses' });
TournamentPrediction.belongsTo(Prediction, { foreignKey: 'base_prediction_id', as: 'basePrediction' });

League.hasMany(UserStats, { foreignKey: 'league_id' });
UserStats.belongsTo(League, { foreignKey: 'league_id' });

User.hasOne(UserStats, { foreignKey: 'user_id', as: 'stats' });
UserStats.belongsTo(User, { foreignKey: 'user_id' });

// =====================================================
// NUEVAS ASOCIACIONES DE WALLET
// =====================================================

// User ↔ Wallet (1:1)
User.hasOne(Wallet, { foreignKey: 'user_id', as: 'wallet' });
Wallet.belongsTo(User, { foreignKey: 'user_id' });

// Wallet ↔ WalletTransaction (1:N)
Wallet.hasMany(WalletTransaction, { foreignKey: 'wallet_id', as: 'transactions' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'wallet_id' });

// User ↔ DepositRequest (1:N)
User.hasMany(DepositRequest, { foreignKey: 'user_id', as: 'depositRequests' });
DepositRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' }); // Alias agregado

// Wallet ↔ DepositRequest (1:N)
Wallet.hasMany(DepositRequest, { foreignKey: 'wallet_id', as: 'depositRequests' });
DepositRequest.belongsTo(Wallet, { foreignKey: 'wallet_id' });

// DepositRequest ↔ WalletTransaction (1:1 opcional)
DepositRequest.belongsTo(WalletTransaction, { foreignKey: 'wallet_transaction_id', as: 'transaction' });
WalletTransaction.hasOne(DepositRequest, { foreignKey: 'wallet_transaction_id' });

// User ↔ WithdrawalRequest (1:N)
User.hasMany(WithdrawalRequest, { foreignKey: 'user_id', as: 'withdrawalRequests' });
WithdrawalRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' }); // Alias agregado

// Wallet ↔ WithdrawalRequest (1:N)
Wallet.hasMany(WithdrawalRequest, { foreignKey: 'wallet_id', as: 'withdrawalRequests' });
WithdrawalRequest.belongsTo(Wallet, { foreignKey: 'wallet_id' });

// WithdrawalRequest ↔ WalletTransaction (1:1)
WithdrawalRequest.belongsTo(WalletTransaction, { foreignKey: 'wallet_transaction_id', as: 'transaction' });
WalletTransaction.hasOne(WithdrawalRequest, { foreignKey: 'wallet_transaction_id' });

// Admin relationships for processing
DepositRequest.belongsTo(User, { foreignKey: 'processed_by', as: 'processor' });
WithdrawalRequest.belongsTo(User, { foreignKey: 'processed_by', as: 'processor' });
WalletTransaction.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// =====================================================
// ACTUALIZAR ASOCIACIÓN DE TOURNAMENT ENTRY
// =====================================================
// Agregar nueva asociación con WalletTransaction
TournamentEntry.belongsTo(WalletTransaction, { foreignKey: 'wallet_transaction_id', as: 'walletTransaction' });
WalletTransaction.hasOne(TournamentEntry, { foreignKey: 'wallet_transaction_id' });

// =====================================================
// MÉTODOS HELPER PARA WALLET
// =====================================================

// Obtener wallet del usuario (crear si no existe)
User.prototype.getOrCreateWallet = async function(transaction = null) {
  let wallet = await this.getWallet({ transaction });

  if (!wallet) {
    wallet = await Wallet.create({
      userId: this.id,
      status: 'ACTIVE',
      currency: 'PEN'
    }, { transaction });
  }

  return wallet;
};

// Verificar si el usuario puede pagar un monto
User.prototype.canAfford = async function(amount) {
  const wallet = await this.getWallet();
  return wallet && wallet.canDebit(amount);
};

// Obtener balance disponible
User.prototype.getAvailableBalance = async function() {
  const wallet = await this.getWallet();
  return wallet ? wallet.getAvailableBalance() : 0;
};

// =====================================================
// SINCRONIZAR BASE DE DATOS
// =====================================================
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: false });
    console.log('✅ Todos los modelos sincronizados con la base de datos');
    // Crear ligas por defecto si no existen
    await createDefaultLeagues();
  } catch (error) {
    console.error('❌ Error sincronizando modelos:', error);
  }
};

// Crear ligas por defecto
const createDefaultLeagues = async () => {
  const defaultLeagues = [
    {
      name: 'Bronze',
      level: 1,
      minTournaments: 0,
      color: '#CD7F32',
      icon: 'fas fa-shield-alt',
      description: 'Liga inicial para nuevos jugadores'
    },
    {
      name: 'Silver',
      level: 2,
      minTournaments: 11,
      color: '#C0C0C0',
      icon: 'fas fa-shield-alt',
      description: 'Para jugadores con experiencia básica'
    },
    {
      name: 'Gold',
      level: 3,
      minTournaments: 31,
      minSuccessRate: 55,
      color: '#FFD700',
      icon: 'fas fa-award',
      description: 'Para predictores competentes'
    },
    {
      name: 'Platinum',
      level: 4,
      minTournaments: 100,
      minROI: 10,
      minSuccessRate: 60,
      color: '#E5E4E2',
      icon: 'fas fa-gem',
      description: 'Elite de predictores'
    },
    {
      name: 'Legend',
      level: 5,
      minTournaments: 200,
      minROI: 25,
      minSuccessRate: 70,
      color: '#9932CC',
      icon: 'fas fa-crown',
      description: 'Los mejores predictores del mundo'
    }
  ];

  for (const league of defaultLeagues) {
    await League.findOrCreate({
      where: { name: league.name },
      defaults: league
    });
  }
  console.log('✅ Ligas por defecto creadas/verificadas');
};

module.exports = {
  sequelize,
  // Modelos existentes
  User,
  Prediction,
  Payment,
  UnlockedPrediction,
  PushSubscription,
  NotificationHistory,
  // Modelos de torneos
  Tournament,
  TournamentEntry,
  TournamentPrediction,
  League,
  UserStats,
  // NUEVOS MODELOS DE WALLET
  Wallet,
  WalletTransaction,
  DepositRequest,
  WithdrawalRequest,
  // Funciones utilitarias
  syncDatabase,
  createDefaultLeagues
};
