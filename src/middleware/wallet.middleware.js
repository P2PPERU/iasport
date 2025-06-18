// src/middleware/wallet.middleware.js
const { body, validationResult } = require('express-validator');
const { DepositRequest, WithdrawalRequest, WalletTransaction } = require('../models');
const { validateAmount, checkDailyLimits } = require('../utils/walletHelpers');

// =====================================================
// VALIDAR ERRORES DE EXPRESS-VALIDATOR
// =====================================================
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos inválidos',
      errors: errors.array()
    });
  }
  next();
};

// =====================================================
// VALIDAR CREACIÓN DE DEPÓSITO
// =====================================================
exports.validateCreateDeposit = [
  body('amount')
    .isFloat({ min: 10, max: 5000 })
    .withMessage('El monto debe estar entre S/ 10 y S/ 5000'),
  
  body('method')
    .isIn(['YAPE', 'PLIN', 'BANK_TRANSFER'])
    .withMessage('Método de pago inválido'),
  
  body('transactionNumber')
    .isLength({ min: 5, max: 50 })
    .withMessage('Número de transacción debe tener entre 5 y 50 caracteres'),
  
  body('proofImageUrl')
    .optional()
    .isURL()
    .withMessage('URL de comprobante inválida'),
  
  handleValidationErrors
];

// =====================================================
// VALIDAR CREACIÓN DE RETIRO
// =====================================================
exports.validateCreateWithdrawal = [
  body('amount')
    .isFloat({ min: 20, max: 500 })
    .withMessage('El monto debe estar entre S/ 20 y S/ 500'),
  
  body('method')
    .isIn(['YAPE', 'PLIN', 'BANK_TRANSFER'])
    .withMessage('Método de pago inválido'),
  
  body('accountNumber')
    .isLength({ min: 5, max: 50 })
    .withMessage('Número de cuenta inválido'),
  
  body('accountName')
    .isLength({ min: 3, max: 100 })
    .withMessage('Nombre de cuenta debe tener entre 3 y 100 caracteres'),
  
  handleValidationErrors
];

// =====================================================
// VALIDAR APROBACIÓN DE DEPÓSITO
// =====================================================
exports.validateApproveDeposit = [
  body('adminNotes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notas del admin no pueden exceder 500 caracteres'),
  
  handleValidationErrors
];

// =====================================================
// VALIDAR PROCESAMIENTO DE RETIRO
// =====================================================
exports.validateProcessWithdrawal = [
  body('adminNotes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notas del admin no pueden exceder 500 caracteres'),
  
  body('externalTransactionId')
    .optional()
    .isLength({ min: 5, max: 100 })
    .withMessage('ID de transacción externa inválido'),
  
  handleValidationErrors
];

// =====================================================
// VALIDAR AJUSTE MANUAL
// =====================================================
exports.validateManualAdjustment = [
  body('userId')
    .isUUID()
    .withMessage('ID de usuario inválido'),
  
  body('amount')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('Monto debe estar entre S/ 0.01 y S/ 10,000'),
  
  body('type')
    .isIn(['CREDIT', 'DEBIT'])
    .withMessage('Tipo debe ser CREDIT o DEBIT'),
  
  body('reason')
    .isLength({ min: 10, max: 255 })
    .withMessage('Razón debe tener entre 10 y 255 caracteres'),
  
  handleValidationErrors
];

// =====================================================
// VERIFICAR SOLICITUDES PENDIENTES
// =====================================================
exports.checkPendingRequests = (type) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      
      let pendingRequest;
      
      if (type === 'deposit') {
        pendingRequest = await DepositRequest.findOne({
          where: {
            userId,
            status: 'PENDING'
          }
        });
        
        if (pendingRequest) {
          return res.status(400).json({
            success: false,
            message: 'Ya tienes una solicitud de depósito pendiente',
            pendingRequest: {
              id: pendingRequest.id,
              amount: pendingRequest.amount,
              createdAt: pendingRequest.createdAt
            }
          });
        }
      }
      
      if (type === 'withdrawal') {
        pendingRequest = await WithdrawalRequest.findOne({
          where: {
            userId,
            status: ['PENDING', 'PROCESSING']
          }
        });
        
        if (pendingRequest) {
          return res.status(400).json({
            success: false,
            message: 'Ya tienes una solicitud de retiro en proceso',
            pendingRequest: {
              id: pendingRequest.id,
              amount: pendingRequest.amount,
              status: pendingRequest.status,
              createdAt: pendingRequest.createdAt
            }
          });
        }
      }
      
      next();
      
    } catch (error) {
      console.error('Error verificando solicitudes pendientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error al verificar solicitudes pendientes'
      });
    }
  };
};

// =====================================================
// VERIFICAR LÍMITE DIARIO DE RETIROS
// =====================================================
exports.checkDailyWithdrawalLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;
    
    const limits = await checkDailyLimits(userId, amount, 'WITHDRAWAL', WalletTransaction);
    
    if (limits.wouldExceed) {
      return res.status(400).json({
        success: false,
        message: 'Límite diario de retiros excedido',
        data: {
          dailyLimit: limits.limit,
          used: limits.used,
          available: limits.available,
          requested: amount
        }
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Error verificando límite diario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar límite diario'
    });
  }
};

// =====================================================
// VERIFICAR SALDO SUFICIENTE
// =====================================================
exports.checkSufficientBalance = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;
    
    const WalletService = require('../services/wallet.service');
    const availableBalance = await WalletService.getAvailableBalance(userId);
    
    if (availableBalance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Saldo insuficiente',
        data: {
          available: availableBalance,
          required: amount,
          shortfall: amount - availableBalance
        }
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Error verificando saldo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar saldo'
    });
  }
};

// =====================================================
// VALIDAR MONTO SEGÚN TIPO DE OPERACIÓN
// =====================================================
exports.validateAmountForOperation = (operationType) => {
  return (req, res, next) => {
    const { amount } = req.body;
    
    const validation = validateAmount(amount, operationType);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: `Monto inválido para ${operationType}`,
        data: {
          amount,
          minAllowed: validation.min,
          maxAllowed: validation.max
        }
      });
    }
    
    next();
  };
};

// =====================================================
// VERIFICAR PERMISOS DE WALLET
// =====================================================
exports.checkWalletPermissions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { User } = require('../models');
    
    const user = await User.findByPk(userId);
    const wallet = await user.getWallet();
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet no encontrada'
      });
    }
    
    if (wallet.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: `Wallet ${wallet.status}. Contacta al soporte.`,
        walletStatus: wallet.status
      });
    }
    
    req.wallet = wallet;
    next();
    
  } catch (error) {
    console.error('Error verificando permisos de wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar permisos de wallet'
    });
  }
};

// =====================================================
// RATE LIMITING PARA OPERACIONES DE WALLET
// =====================================================
exports.walletRateLimit = (maxRequests = 10, windowMinutes = 15) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const userId = req.user.id;
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;
    
    if (!requests.has(userId)) {
      requests.set(userId, []);
    }
    
    const userRequests = requests.get(userId);
    
    // Limpiar requests antiguos
    const validRequests = userRequests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Demasiadas solicitudes. Intenta más tarde.',
        retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
      });
    }
    
    validRequests.push(now);
    requests.set(userId, validRequests);
    
    next();
  };
};

// =====================================================
// MIDDLEWARE COMBINADOS
// =====================================================
exports.validateDepositCreation = [
  exports.validateCreateDeposit,
  exports.checkPendingRequests('deposit'),
  exports.walletRateLimit(5, 60) // 5 depósitos por hora
];

exports.validateWithdrawalCreation = [
  exports.validateCreateWithdrawal,
  exports.checkSufficientBalance,
  exports.checkDailyWithdrawalLimit,
  exports.checkPendingRequests('withdrawal'),
  exports.walletRateLimit(3, 60) // 3 retiros por hora
];