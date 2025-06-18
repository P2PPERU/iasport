// src/middleware/wallet.middleware.js
const { body, param, query, validationResult } = require('express-validator');
const { validateAmount, validatePeruvianPhone } = require('../utils/walletHelpers');

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: errors.array()
    });
  }
  next();
};

// Validar monto general
const validateAmountMiddleware = (field = 'amount') => {
  return body(field)
    .isFloat({ min: 0.01 })
    .withMessage('El monto debe ser mayor a 0')
    .toFloat()
    .custom((value) => {
      // Verificar que tenga máximo 2 decimales
      const decimals = (value.toString().split('.')[1] || '').length;
      if (decimals > 2) {
        throw new Error('El monto debe tener máximo 2 decimales');
      }
      return true;
    });
};

// Validaciones para crear depósito
const validateCreateDeposit = [
  validateAmountMiddleware('amount')
    .custom((value) => {
      const validation = validateAmount(value, 'DEPOSIT');
      if (!validation.isValid) {
        throw new Error(`Monto debe estar entre S/ ${validation.min} y S/ ${validation.max}`);
      }
      return true;
    }),
  
  body('method')
    .isIn(['YAPE', 'PLIN', 'BANK_TRANSFER'])
    .withMessage('Método de pago inválido'),
  
  body('transactionNumber')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 5, max: 50 })
    .withMessage('Número de transacción inválido'),
  
  body('proofImageUrl')
    .optional()
    .isURL()
    .withMessage('URL de imagen inválida'),
  
  handleValidationErrors
];

// Validaciones para crear retiro
const validateCreateWithdrawal = [
  validateAmountMiddleware('amount')
    .custom((value) => {
      const validation = validateAmount(value, 'WITHDRAWAL');
      if (!validation.isValid) {
        throw new Error(`Monto debe estar entre S/ ${validation.min} y S/ ${validation.max}`);
      }
      return true;
    }),
  
  body('method')
    .isIn(['YAPE', 'PLIN', 'BANK_TRANSFER'])
    .withMessage('Método de pago inválido'),
  
  body('accountNumber')
    .notEmpty()
    .withMessage('Número de cuenta requerido')
    .custom((value, { req }) => {
      if (req.body.method === 'YAPE' || req.body.method === 'PLIN') {
        if (!validatePeruvianPhone(value)) {
          throw new Error('Número de teléfono peruano inválido (debe empezar con 519)');
        }
      }
      return true;
    }),
  
  body('accountName')
    .notEmpty()
    .withMessage('Nombre del titular requerido')
    .isLength({ min: 3, max: 100 })
    .withMessage('Nombre debe tener entre 3 y 100 caracteres'),
  
  handleValidationErrors
];

// Validaciones para aprobar depósito (admin)
const validateApproveDeposit = [
  param('id')
    .isUUID()
    .withMessage('ID de depósito inválido'),
  
  body('adminNotes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notas muy largas (máximo 500 caracteres)'),
  
  handleValidationErrors
];

// Validaciones para procesar retiro (admin)
const validateProcessWithdrawal = [
  param('id')
    .isUUID()
    .withMessage('ID de retiro inválido'),
  
  body('externalTransactionId')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('ID de transacción externa inválido'),
  
  body('adminNotes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notas muy largas (máximo 500 caracteres)'),
  
  handleValidationErrors
];

// Validaciones para ajuste manual (admin)
const validateManualAdjustment = [
  param('userId')
    .isUUID()
    .withMessage('ID de usuario inválido'),
  
  validateAmountMiddleware('amount'),
  
  body('type')
    .isIn(['CREDIT', 'DEBIT'])
    .withMessage('Tipo debe ser CREDIT o DEBIT'),
  
  body('reason')
    .notEmpty()
    .withMessage('Razón es requerida')
    .isLength({ min: 10, max: 200 })
    .withMessage('Razón debe tener entre 10 y 200 caracteres'),
  
  handleValidationErrors
];

// Validar límites diarios
const checkDailyWithdrawalLimit = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;
    
    const { checkDailyLimits } = require('../utils/walletHelpers');
    const { WalletTransaction } = require('../models');
    
    const limits = await checkDailyLimits(userId, amount, 'WITHDRAWAL', WalletTransaction);
    
    if (limits.wouldExceed) {
      return res.status(400).json({
        success: false,
        message: 'Límite diario excedido',
        data: {
          dailyLimit: limits.limit,
          usedToday: limits.used,
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
      message: 'Error al verificar límites'
    });
  }
};

// Verificar si usuario tiene solicitud pendiente
const checkPendingRequests = (type) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const Model = type === 'deposit' 
        ? require('../models').DepositRequest 
        : require('../models').WithdrawalRequest;
      
      const pendingRequest = await Model.findOne({
        where: {
          userId,
          status: type === 'deposit' ? 'PENDING' : ['PENDING', 'PROCESSING']
        }
      });
      
      if (pendingRequest) {
        return res.status(400).json({
          success: false,
          message: `Ya tienes una solicitud de ${type === 'deposit' ? 'depósito' : 'retiro'} en proceso`,
          data: {
            requestId: pendingRequest.id,
            amount: pendingRequest.amount,
            status: pendingRequest.status,
            createdAt: pendingRequest.createdAt
          }
        });
      }
      
      next();
    } catch (error) {
      console.error('Error verificando solicitudes pendientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error al verificar solicitudes'
      });
    }
  };
};

module.exports = {
  validateCreateDeposit,
  validateCreateWithdrawal,
  validateApproveDeposit,
  validateProcessWithdrawal,
  validateManualAdjustment,
  checkDailyWithdrawalLimit,
  checkPendingRequests,
  validateAmountMiddleware,
  handleValidationErrors
};