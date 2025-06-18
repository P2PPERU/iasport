// src/models/Wallet.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    get() {
      const value = this.getDataValue('balance');
      return value ? parseFloat(value) : 0;
    }
  },
  totalDeposits: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'total_deposits',
    get() {
      const value = this.getDataValue('totalDeposits');
      return value ? parseFloat(value) : 0;
    }
  },
  totalWithdrawals: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'total_withdrawals',
    get() {
      const value = this.getDataValue('totalWithdrawals');
      return value ? parseFloat(value) : 0;
    }
  },
  totalWinnings: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'total_winnings',
    get() {
      const value = this.getDataValue('totalWinnings');
      return value ? parseFloat(value) : 0;
    }
  },
  totalSpent: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'total_spent',
    get() {
      const value = this.getDataValue('totalSpent');
      return value ? parseFloat(value) : 0;
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'PEN'
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'FROZEN', 'CLOSED'),
    allowNull: false,
    defaultValue: 'ACTIVE'
  },
  lastTransactionAt: {
    type: DataTypes.DATE,
    field: 'last_transaction_at'
  }
}, {
  tableName: 'wallets',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id']
    },
    {
      fields: ['status']
    }
  ]
});

// Métodos de instancia
Wallet.prototype.canDebit = function(amount) {
  return this.status === 'ACTIVE' && this.balance >= amount;
};

Wallet.prototype.getAvailableBalance = function() {
  return this.status === 'ACTIVE' ? this.balance : 0;
};

// Métodos estáticos
Wallet.getByUserId = async function(userId, transaction = null) {
  const options = {
    where: { userId }
  };
  if (transaction) {
    options.transaction = transaction;
    options.lock = transaction.LOCK.UPDATE;
  }
  return await this.findOne(options);
};

module.exports = Wallet;