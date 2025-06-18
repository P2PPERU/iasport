// src/controllers/wallet.controller.js - CORREGIDO COMPLETAMENTE
const { 
  Wallet, 
  WalletTransaction, 
  DepositRequest, 
  WithdrawalRequest,
  User 
} = require('../models');
const { Op } = require('sequelize');
const WalletService = require('../services/wallet.service');

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
    
    // Obtener o crear wallet
    const user = await User.findByPk(userId);
    let wallet = await user.getWallet();
    
    if (!wallet) {
      wallet = await WalletService.createWallet(userId);
    }
    
    // Obtener transacciones recientes
    const recentTransactions = await WalletTransaction.findAll({
      where: { walletId: wallet.id },
      order: [['createdAt', 'DESC']],
      limit: 10
    });
    
    // Estadísticas básicas
    const stats = {
      totalTransactions: await WalletTransaction.count({ where: { walletId: wallet.id } }),
      totalDeposits: wallet.totalDeposits || 0,
      totalWithdrawals: wallet.totalWithdrawals || 0,
      totalWinnings: wallet.totalWinnings || 0
    };
    
    res.json({
      success: true,
      data: {
        wallet,
        recentTransactions,
        stats,
        activeTournaments: []
      }
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
    let wallet = await user.getWallet();
    
    if (!wallet) {
      wallet = await WalletService.createWallet(userId);
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
exports.createDepositRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, method, transactionNumber, proofImageUrl } = req.body;
    
    const depositRequest = await WalletService.createDepositRequest(
      userId,
      amount,
      method,
      transactionNumber,
      proofImageUrl
    );
    
    res.status(201).json({
      success: true,
      message: 'Solicitud de depósito creada exitosamente',
      data: {
        depositRequest
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
exports.createWithdrawalRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, method, accountNumber, accountName } = req.body;
    
    const result = await WalletService.createWithdrawalRequest(
      userId,
      amount,
      method,
      accountNumber,
      accountName
    );
    
    res.status(201).json({
      success: true,
      message: 'Solicitud de retiro creada exitosamente',
      data: result
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
exports.getUserDepositRequests = async (req, res) => {
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
exports.getUserWithdrawalRequests = async (req, res) => {
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
          processingTime: '1-24 horas'
        },
        PLIN: {
          name: 'Plin',
          minAmount: 10,
          maxAmount: 5000,
          processingTime: '1-24 horas'
        },
        BANK_TRANSFER: {
          name: 'Transferencia Bancaria',
          minAmount: 50,
          maxAmount: 10000,
          processingTime: '1-24 horas'
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
    
    // Obtener wallet del usuario
    const user = await User.findByPk(userId);
    let wallet = await user.getWallet();
    
    if (!wallet) {
      wallet = await WalletService.createWallet(userId);
    }
    
    const stats = {
      wallet: {
        balance: wallet.balance,
        totalDeposits: wallet.totalDeposits,
        totalWithdrawals: wallet.totalWithdrawals,
        totalWinnings: wallet.totalWinnings,
        totalSpent: wallet.totalSpent
      },
      periodStats: {
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalTournamentSpent: 0,
        totalPrizesWon: 0,
        transactionCount: 0,
        netFlow: 0
      }
    };
    
    res.json({
      success: true,
      data: stats
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
// ADMIN: DASHBOARD DE WALLET
// =====================================================
exports.getAdminDashboard = async (req, res) => {
  try {
    const stats = {
      totalWallets: await Wallet.count(),
      activeWallets: await Wallet.count({ where: { status: 'ACTIVE' } }),
      totalBalance: await Wallet.sum('balance') || 0,
      pendingDeposits: await DepositRequest.count({ where: { status: 'PENDING' } }),
      pendingWithdrawals: await WithdrawalRequest.count({ where: { status: 'PENDING' } }),
      processingWithdrawals: await WithdrawalRequest.count({ where: { status: 'PROCESSING' } }),
      todayTransactions: 0
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error obteniendo dashboard admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener dashboard administrativo'
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
// ADMIN: RECHAZAR RETIRO
// =====================================================
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const result = await WalletService.cancelWithdrawal(id, reason);
    
    res.json({
      success: true,
      message: 'Retiro rechazado y fondos devueltos',
      data: result
    });
  } catch (error) {
    console.error('Error rechazando retiro:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al rechazar retiro'
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
exports.getAllDepositRequests = async (req, res) => {
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
exports.getAllWithdrawalRequests = async (req, res) => {
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