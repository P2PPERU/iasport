// src/utils/walletHelpers.js - CORREGIDO
const crypto = require('crypto');
const { Op } = require('sequelize');

/**
 * Formatear monto a 2 decimales
 */
const formatMoney = (amount) => {
  return Number(parseFloat(amount).toFixed(2));
};

/**
 * Generar referencia única
 */
const generateReference = (prefix = 'TXN') => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${random}`.toUpperCase();
};

/**
 * Validar número de teléfono peruano (Yape/Plin)
 */
const validatePeruvianPhone = (phone) => {
  // Formato: 51 + 9 dígitos empezando con 9
  const regex = /^51[9]\d{8}$/;
  return regex.test(phone);
};

/**
 * Calcular comisión
 */
const calculateFee = (amount, type = 'TOURNAMENT_ENTRY') => {
  const fees = {
    TOURNAMENT_ENTRY: 0.10, // 10%
    WITHDRAWAL: 1.00, // S/ 1.00 fijo
    DEPOSIT: 0, // Sin comisión
  };
  
  if (type === 'WITHDRAWAL') {
    return fees[type] || 0;
  }
  
  return formatMoney(amount * (fees[type] || 0));
};

/**
 * Verificar límites diarios
 */
const checkDailyLimits = async (userId, amount, type, WalletTransaction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Obtener wallet del usuario
    const { User, Wallet } = require('../models');
    const user = await User.findByPk(userId);
    const wallet = await user.getWallet();
    
    if (!wallet) {
      return {
        used: 0,
        limit: 1000,
        available: 1000,
        wouldExceed: false
      };
    }
    
    const dailyTotal = await WalletTransaction.sum('amount', {
      where: {
        walletId: wallet.id,
        type: 'DEBIT',
        category: type,
        status: 'COMPLETED',
        createdAt: {
          [Op.between]: [today, tomorrow]
        }
      }
    }) || 0;
    
    const limits = {
      WITHDRAWAL: parseFloat(process.env.WALLET_MAX_WITHDRAWAL_DAILY || 1000),
      TOURNAMENT_ENTRY: parseFloat(process.env.WALLET_MAX_TOURNAMENT_DAILY || 500)
    };
    
    const limit = limits[type] || Infinity;
    
    return {
      used: parseFloat(dailyTotal),
      limit: limit,
      available: limit - parseFloat(dailyTotal),
      wouldExceed: (parseFloat(dailyTotal) + amount) > limit
    };
  } catch (error) {
    console.error('Error en checkDailyLimits:', error);
    return {
      used: 0,
      limit: 1000,
      available: 1000,
      wouldExceed: false
    };
  }
};

/**
 * Generar descripción para transacción
 */
const generateTransactionDescription = (category, metadata = {}) => {
  const descriptions = {
    DEPOSIT: `Depósito via ${metadata.method || 'N/A'}`,
    WITHDRAWAL: `Retiro via ${metadata.method || 'N/A'}`,
    TOURNAMENT_ENTRY: `Inscripción - ${metadata.tournamentName || 'Torneo'}`,
    TOURNAMENT_PRIZE: `Premio ${metadata.position || ''} - ${metadata.tournamentName || 'Torneo'}`,
    TOURNAMENT_REFUND: `Reembolso - ${metadata.tournamentName || 'Torneo'}`,
    BONUS: `Bonus: ${metadata.reason || 'Promoción'}`,
    FEE: `Comisión: ${metadata.reason || 'Transacción'}`,
    ADMIN_ADJUSTMENT: `Ajuste administrativo: ${metadata.reason || 'N/A'}`
  };
  
  return descriptions[category] || 'Transacción';
};

/**
 * Validar monto según tipo de operación
 */
const validateAmount = (amount, type) => {
  const rules = {
    DEPOSIT: {
      min: parseFloat(process.env.WALLET_MIN_DEPOSIT || 10),
      max: parseFloat(process.env.WALLET_MAX_DEPOSIT || 5000)
    },
    WITHDRAWAL: {
      min: parseFloat(process.env.WALLET_MIN_WITHDRAWAL || 20),
      max: parseFloat(process.env.WALLET_MAX_WITHDRAWAL_SINGLE || 500)
    },
    TOURNAMENT_ENTRY: {
      min: 0,
      max: parseFloat(process.env.WALLET_MAX_TOURNAMENT_ENTRY || 100)
    }
  };
  
  const rule = rules[type] || { min: 0, max: Infinity };
  
  return {
    isValid: amount >= rule.min && amount <= rule.max,
    min: rule.min,
    max: rule.max
  };
};

/**
 * Calcular tiempo de procesamiento estimado
 */
const getProcessingTime = (type, method) => {
  if (type === 'DEPOSIT') {
    return '1-24 horas (requiere verificación)';
  }
  
  if (type === 'WITHDRAWAL') {
    const times = {
      YAPE: '24-48 horas',
      PLIN: '24-48 horas',
      BANK_TRANSFER: '48-72 horas'
    };
    return times[method] || '48-72 horas';
  }
  
  return 'Inmediato';
};

/**
 * Obtener información de cuenta de recepción
 */
const getReceptionAccount = (method) => {
  const accounts = {
    YAPE: {
      number: process.env.YAPE_ACCOUNT_NUMBER || '999888777',
      name: process.env.YAPE_ACCOUNT_NAME || 'PredictMaster SAC',
      type: 'Yape'
    },
    PLIN: {
      number: process.env.PLIN_ACCOUNT_NUMBER || '999888777',
      name: process.env.PLIN_ACCOUNT_NAME || 'PredictMaster SAC',
      type: 'Plin'
    },
    BANK_TRANSFER: {
      number: process.env.BANK_ACCOUNT_NUMBER || '123-456789-0-12',
      name: process.env.BANK_ACCOUNT_NAME || 'PredictMaster SAC',
      bank: process.env.BANK_NAME || 'BCP',
      type: 'Cuenta Corriente'
    }
  };
  
  return accounts[method] || null;
};

module.exports = {
  formatMoney,
  generateReference,
  validatePeruvianPhone,
  calculateFee,
  checkDailyLimits,
  generateTransactionDescription,
  validateAmount,
  getProcessingTime,
  getReceptionAccount
};