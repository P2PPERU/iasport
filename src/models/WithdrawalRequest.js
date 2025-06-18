// src/models/WithdrawalRequest.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WithdrawalRequest = sequelize.define('WithdrawalRequest', {
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
      min: 20.00 // Mínimo S/ 20
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
    type: DataTypes.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'PENDING'
  },
  accountNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'account_number'
  },
  accountName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'account_name'
  },
  walletTransactionId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'wallet_transaction_id',
    references: {
      model: 'wallet_transactions',
      key: 'id'
    }
  },
  externalTransactionId: {
    type: DataTypes.STRING(100),
    field: 'external_transaction_id'
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
  completedAt: {
    type: DataTypes.DATE,
    field: 'completed_at'
  }
}, {
  tableName: 'withdrawal_requests',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['wallet_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['created_at']
    }
  ]
});

// Métodos de instancia
WithdrawalRequest.prototype.canProcess = function() {
  return this.status === 'PENDING';
};

WithdrawalRequest.prototype.canComplete = function() {
  return this.status === 'PROCESSING';
};

WithdrawalRequest.prototype.canCancel = function() {
  return this.status === 'PENDING';
};

module.exports = WithdrawalRequest;