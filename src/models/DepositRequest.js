// src/models/DepositRequest.js 
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DepositRequest = sequelize.define('DepositRequest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
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
  walletId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'wallet_id',
    references: {
      model: 'wallets',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 10.00 // Mínimo S/ 10
    },
    get() {
      const value = this.getDataValue('amount');
      return value ? parseFloat(value) : 0;
    }
  },
  method: {
    type: DataTypes.ENUM('YAPE', 'PLIN', 'BANK_TRANSFER'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'),
    allowNull: false,
    defaultValue: 'PENDING'
  },
  transactionNumber: {
    type: DataTypes.STRING(50),
    field: 'transaction_number'
  },
  proofImageUrl: {
    type: DataTypes.STRING(500),
    field: 'proof_image_url'
  },
  walletTransactionId: {
    type: DataTypes.UUID,
    field: 'wallet_transaction_id',
    references: {
      model: 'wallet_transactions',
      key: 'id'
    }
  },
  adminNotes: {
    type: DataTypes.TEXT,
    field: 'admin_notes'
  },
  processedBy: {
    type: DataTypes.UUID,
    field: 'processed_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  processedAt: {
    type: DataTypes.DATE,
    field: 'processed_at'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
    defaultValue: () => {
      const date = new Date();
      date.setHours(date.getHours() + 24);
      return date;
    }
  }
}, {
  tableName: 'deposit_requests',
  underscored: true,
  timestamps: true, // ya activa created_at y updated_at en snake_case
  indexes: [
    { fields: ['user_id'] },
    { fields: ['wallet_id'] },
    { fields: ['status'] },
    { fields: ['created_at'] }
  ]
});

// Métodos de instancia
DepositRequest.prototype.isExpired = function() {
  return new Date() > this.expiresAt;
};

DepositRequest.prototype.canApprove = function() {
  return this.status === 'PENDING' && !this.isExpired();
};

// Hook para verificar expiración antes de aprobar
DepositRequest.beforeUpdate(async (depositRequest, options) => {
  if (
    depositRequest.changed('status') &&
    depositRequest.status === 'APPROVED' &&
    depositRequest.isExpired()
  ) {
    throw new Error('No se puede aprobar un depósito expirado');
  }
});

module.exports = DepositRequest;
