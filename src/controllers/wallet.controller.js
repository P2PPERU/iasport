// src/controllers/wallet.controller.js
const { 
  Wallet, 
  WalletTransaction, 
  DepositRequest, 
  WithdrawalRequest,
  User 
} = require('../models');
const { Op } = require('sequelize');
const WalletService = require('../services/wallet.service');
const {
  validateAmount,
  validatePeruvianPhone,
  getProcessingTime,
  getReceptionAccount
} = require('../utils/walletHelpers');

// =====================================================
// OBTENER BALANCE DEL USUARIO
// =====================================================
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const balance = await WalletService.getAvailableBalance(userId);
    
    res.json({
      success: true,
      data: {
        balance,
        currency: 'PEN'
      }
    });
  } catch (error) {
    console.error('Error obteniendo balance:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener balance'
    });
  }
};

// =====================================================
// OBTENER DASHBOARD DE WALLET
// =====================================================
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const dashboard = await WalletService.getWalletDashboard(userId);
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Error obteniendo dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener dashboard de wallet'
    });
  }
};

// =====================================================
// OBTENER HISTORIAL DE TRANSACCIONES
// =====================================================
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, type, category } = req.query;
    
    // Obtener wallet del usuario
    const user = await User.findByPk(userId);
    const wallet = await user.getWallet();
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet no encontrada'
      });
    }
    
    const where = { walletId: wallet.id };
    if (type) where.type = type;
    if (category) where.category = category;
    
    const transactions = await WalletTransaction.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: transactions.rows,
      total: transactions.count,
      hasMore: (parseInt(offset) + parseInt(limit)) < transactions.count
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial de transacciones'
    });
  }
};

// =====================================================
// CREAR SOLICITUD DE DEPÓSITO
// =====================================================
exports.createDeposit = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, method, transactionNumber, proofImageUrl } = req.body;
    
    // Validar monto
    const validation = validateAmount(amount, 'DEPOSIT');
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: `Monto debe estar entre S/ ${validation.min} y S/ ${validation.max}`
      });
    }
    
    const depositRequest = await WalletService.createDepositRequest(
      userId,
      amount,
      method,
      transactionNumber,
      proofImageUrl
    );
    
    const receptionAccount = getReceptionAccount(method);
    const processingTime = getProcessingTime('DEPOSIT', method);
    
    res.status(201).json({
      success: true,
      message: 'Solicitud de depósito creada exitosamente',
      data: {
        depositRequest,
        receptionAccount,
        processingTime,
        instructions: {
          step1: `Transfiere S/ ${amount} a la cuenta mostrada`,
          step2: 'Usa el número de operación proporcionado',
          step3: 'Sube el comprobante si es necesario',
          step4: 'Espera la aprobación del administrador'
        }
      }
    });
  } catch (error) {
    console.error('Error creando depósito:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear solicitud de depósito'
    });
  }
};

// =====================================================
// CREAR SOLICITUD DE RETIRO
// =====================================================
exports.createWithdrawal = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, method, accountNumber, accountName } = req.body;
    
    // Validar monto
    const validation = validateAmount(amount, 'WITHDRAWAL');
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: `Monto debe estar entre S/ ${validation.min} y S/ ${validation.max}`
      });
    }
    
    // Validar número de cuenta para Yape/Plin
    if ((method === 'YAPE' || method === 'PLIN') && !validatePeruvianPhone(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Número de teléfono inválido para Yape/Plin'
      });
    }
    
    const result = await WalletService.createWithdrawalRequest(
      userId,
      amount,
      method,
      accountNumber,
      accountName
    );
    
    const processingTime = getProcessingTime('WITHDRAWAL', method);
    
    res.status(201).json({
      success: true,
      message: 'Solicitud de retiro creada exitosamente',
      data: {
        withdrawalRequest: result.withdrawalRequest,
        newBalance: result.newBalance,
        processingTime,
        note: 'Los fondos han sido reservados y serán procesados por nuestro equipo'
      }
    });
  } catch (error) {
    console.error('Error creando retiro:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear solicitud de retiro'
    });
  }
};

// =====================================================
// OBTENER SOLICITUDES DE DEPÓSITO DEL USUARIO
// =====================================================
exports.getUserDeposits = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10, offset = 0, status } = req.query;
    
    const where = { userId };
    if (status) where.status = status;
    
    const deposits = await DepositRequest.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: deposits.rows,
      total: deposits.count,
      hasMore: (parseInt(offset) + parseInt(limit)) < deposits.count
    });
  } catch (error) {
    console.error('Error obteniendo depósitos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener solicitudes de depósito'
    });
  }
};

// =====================================================
// OBTENER SOLICITUDES DE RETIRO DEL USUARIO
// =====================================================
exports.getUserWithdrawals = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10, offset = 0, status } = req.query;
    
    const where = { userId };
    if (status) where.status = status;
    
    const withdrawals = await WithdrawalRequest.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: withdrawals.rows,
      total: withdrawals.count,
      hasMore: (parseInt(offset) + parseInt(limit)) < withdrawals.count
    });
  } catch (error) {
    console.error('Error obteniendo retiros:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener solicitudes de retiro'
    });
  }
};

// =====================================================
// CANCELAR SOLICITUD DE RETIRO
// =====================================================
exports.cancelWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason = 'Cancelado por el usuario' } = req.body;
    
    // Verificar que el retiro pertenece al usuario
    const withdrawal = await WithdrawalRequest.findOne({
      where: { id, userId }
    });
    
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud de retiro no encontrada'
      });
    }
    
    const result = await WalletService.cancelWithdrawal(id, reason);
    
    res.json({
      success: true,
      message: 'Solicitud de retiro cancelada exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error cancelando retiro:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al cancelar solicitud de retiro'
    });
  }
};

// =====================================================
// OBTENER INFORMACIÓN DE MÉTODOS DE PAGO
// =====================================================
exports.getPaymentMethods = async (req, res) => {
  try {
    const methods = {
      deposit: {
        YAPE: {
          name: 'Yape',
          minAmount: 10,
          maxAmount: 5000,
          processingTime: '1-24 horas',
          account: getReceptionAccount('YAPE')
        },
        PLIN: {
          name: 'Plin',
          minAmount: 10,
          maxAmount: 5000,
          processingTime: '1-24 horas',
          account: getReceptionAccount('PLIN')
        },
        BANK_TRANSFER: {
          name: 'Transferencia Bancaria',
          minAmount: 50,
          maxAmount: 10000,
          processingTime: '1-24 horas',
          account: getReceptionAccount('BANK_TRANSFER')
        }
      },
      withdrawal: {
        YAPE: {
          name: 'Yape',
          minAmount: 20,
          maxAmount: 500,
          processingTime: '24-48 horas',
          fee: 1.00
        },
        PLIN: {
          name: 'Plin',
          minAmount: 20,
          maxAmount: 500,
          processingTime: '24-48 horas',
          fee: 1.00
        },
        BANK_TRANSFER: {
          name: 'Transferencia Bancaria',
          minAmount: 50,
          maxAmount: 1000,
          processingTime: '48-72 horas',
          fee: 5.00
        }
      }
    };
    
    res.json({
      success: true,
      data: methods
    });
  } catch (error) {
    console.error('Error obteniendo métodos de pago:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener métodos de pago'
    });
  }
};

// =====================================================
// OBTENER ESTADÍSTICAS DE WALLET
// =====================================================
exports.getWalletStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month' } = req.query;
    
    // Obtener wallet del usuario
    const user = await User.findByPk(userId);
    const wallet = await user.getWallet();
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet no encontrada'
      });
    }
    
    // Calcular fecha de inicio según período
    let startDate = new Date();
    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }
    
    // Obtener transacciones del período
    const transactions = await WalletTransaction.findAll({
      where: {
        walletId: wallet.id,
        createdAt: { [Op.gte]: startDate },
        status: 'COMPLETED'
      }
    });
    
    // Calcular estadísticas
    const stats = {
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalTournamentSpent: 0,
      totalPrizesWon: 0,
      transactionCount: transactions.length,
      netFlow: 0
    };
    
    transactions.forEach(txn => {
      const amount = parseFloat(txn.amount);
      
      if (txn.type === 'CREDIT') {
        if (txn.category === 'DEPOSIT') {
          stats.totalDeposits += amount;
        } else if (txn.category === 'TOURNAMENT_PRIZE') {
          stats.totalPrizesWon += amount;
        }
      } else if (txn.type === 'DEBIT') {
        if (txn.category === 'WITHDRAWAL') {
          stats.totalWithdrawals += amount;
        } else if (txn.category === 'TOURNAMENT_ENTRY') {
          stats.totalTournamentSpent += amount;
        }
      }
    });
    
    stats.netFlow = (stats.totalDeposits + stats.totalPrizesWon) - 
                   (stats.totalWithdrawals + stats.totalTournamentSpent);
    
    res.json({
      success: true,
      data: {
        period,
        wallet: {
          balance: wallet.balance,
          totalDeposits: wallet.totalDeposits,
          totalWithdrawals: wallet.totalWithdrawals,
          totalWinnings: wallet.totalWinnings,
          totalSpent: wallet.totalSpent
        },
        periodStats: stats
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de wallet'
    });
  }
};

// =====================================================
// ADMIN: APROBAR DEPÓSITO
// =====================================================
exports.approveDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id;
    
    const result = await WalletService.approveDeposit(id, adminId, adminNotes);
    
    res.json({
      success: true,
      message: 'Depósito aprobado exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error aprobando depósito:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al aprobar depósito'
    });
  }
};

// =====================================================
// ADMIN: RECHAZAR DEPÓSITO
// =====================================================
exports.rejectDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;
    
    const depositRequest = await DepositRequest.findByPk(id);
    if (!depositRequest) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud de depósito no encontrada'
      });
    }
    
    await depositRequest.update({
      status: 'REJECTED',
      adminNotes: reason,
      processedBy: adminId,
      processedAt: new Date()
    });
    
    res.json({
      success: true,
      message: 'Depósito rechazado',
      data: depositRequest
    });
  } catch (error) {
    console.error('Error rechazando depósito:', error);
    res.status(500).json({
      success: false,
      message: 'Error al rechazar depósito'
    });
  }
};

// =====================================================
// ADMIN: PROCESAR RETIRO
// =====================================================
exports.processWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { externalTransactionId, adminNotes } = req.body;
    const adminId = req.user.id;
    
    const result = await WalletService.processWithdrawal(id, adminId, externalTransactionId, adminNotes);
    
    res.json({
      success: true,
      message: 'Retiro marcado como procesando',
      data: result
    });
  } catch (error) {
    console.error('Error procesando retiro:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al procesar retiro'
    });
  }
};

// =====================================================
// ADMIN: COMPLETAR RETIRO
// =====================================================
exports.completeWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { externalTransactionId } = req.body;
    
    const result = await WalletService.completeWithdrawal(id, externalTransactionId);
    
    res.json({
      success: true,
      message: 'Retiro completado exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error completando retiro:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al completar retiro'
    });
  }
};

// =====================================================
// ADMIN: AJUSTE MANUAL
// =====================================================
exports.manualAdjustment = async (req, res) => {
  try {
    const { userId, amount, type, reason } = req.body;
    const adminId = req.user.id;
    
    if (!['CREDIT', 'DEBIT'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo debe ser CREDIT o DEBIT'
      });
    }
    
    const result = await WalletService.manualAdjustment(
      userId,
      Math.abs(amount),
      type,
      reason,
      adminId
    );
    
    res.json({
      success: true,
      message: 'Ajuste manual realizado exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error en ajuste manual:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al realizar ajuste manual'
    });
  }
};

// =====================================================
// ADMIN: OBTENER TODAS LAS SOLICITUDES DE DEPÓSITO
// =====================================================
exports.getAllDeposits = async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    const where = {};
    if (status) where.status = status;
    
    const deposits = await DepositRequest.findAndCountAll({
      where,
      include: [{
        model: User,
        attributes: ['id', 'name', 'email']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: deposits.rows,
      total: deposits.count,
      hasMore: (parseInt(offset) + parseInt(limit)) < deposits.count
    });
  } catch (error) {
    console.error('Error obteniendo depósitos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener solicitudes de depósito'
    });
  }
};

// =====================================================
// ADMIN: OBTENER TODAS LAS SOLICITUDES DE RETIRO
// =====================================================
exports.getAllWithdrawals = async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    const where = {};
    if (status) where.status = status;
    
    const withdrawals = await WithdrawalRequest.findAndCountAll({
      where,
      include: [{
        model: User,
        attributes: ['id', 'name', 'email']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: withdrawals.rows,
      total: withdrawals.count,
      hasMore: (parseInt(offset) + parseInt(limit)) < withdrawals.count
    });
  } catch (error) {
    console.error('Error obteniendo retiros:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener solicitudes de retiro'
    });
  }
};