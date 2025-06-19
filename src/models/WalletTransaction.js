// src/models/WalletTransaction.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WalletTransaction = sequelize.define('WalletTransaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  walletId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'wallet_id',
    references: {
      model: 'wallets',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('DEBIT', 'CREDIT'),
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM(
      'DEPOSIT',
      'WITHDRAWAL', 
      'TOURNAMENT_ENTRY',
      'TOURNAMENT_PRIZE',
      'TOURNAMENT_REFUND',
      'BONUS',
      'FEE',
      'ADMIN_ADJUSTMENT'
    ),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0.01
    },
    get() {
      const value = this.getDataValue('amount');
      return value ? parseFloat(value) : 0;
    }
  },
  balanceBefore: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'balance_before',
    get() {
      const value = this.getDataValue('balanceBefore');
      return value ? parseFloat(value) : 0;
    }
  },
  balanceAfter: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'balance_after',
    get() {
      const value = this.getDataValue('balanceAfter');
      return value ? parseFloat(value) : 0;
    }
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REVERSED'),
    allowNull: false,
    defaultValue: 'PENDING'
  },
  description: {
    type: DataTypes.STRING(255)
  },
  reference: {
    type: DataTypes.STRING(100)
  },
  externalReference: {
    type: DataTypes.STRING(100),
    unique: true,
    field: 'external_reference'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  createdBy: {
    type: DataTypes.UUID,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'wallet_transactions',
  underscored: true, // Esto es clave para snake_case
  timestamps: true,  // Usa automáticamente created_at y updated_at
  indexes: [
    { fields: ['wallet_id'] },
    { fields: ['status'] },
    { fields: ['category'] },
    { fields: ['reference'] },
    { unique: true, fields: ['external_reference'] },
    { fields: ['created_at'] }
  ]
});

// Métodos de instancia
WalletTransaction.prototype.isCompleted = function() {
  return this.status === 'COMPLETED';
};

WalletTransaction.prototype.canReverse = function() {
  return this.status === 'COMPLETED' && 
         ['DEPOSIT', 'TOURNAMENT_PRIZE', 'BONUS', 'ADMIN_ADJUSTMENT'].includes(this.category);
};

module.exports = WalletTransaction;
