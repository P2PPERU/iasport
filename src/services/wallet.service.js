// src/services/wallet.service.js
const { 
  Wallet, 
  WalletTransaction, 
  DepositRequest, 
  WithdrawalRequest,
  User,
  Tournament,
  TournamentEntry,
  sequelize 
} = require('../models');
const { Op } = require('sequelize');
const {
  InsufficientBalanceError,
  WalletFrozenError,
  DuplicateTransactionError,
  InvalidAmountError,
  DailyLimitExceededError,
  WalletNotFoundError,
  TransactionNotReversibleError,
  OperationNotAllowedError
} = require('../utils/walletErrors');
const {
  formatMoney,
  generateReference,
  calculateFee,
  checkDailyLimits,
  generateTransactionDescription,
  validateAmount
} = require('../utils/walletHelpers');

class WalletService {
  
  // =====================================================
  // CREAR WALLET PARA USUARIO
  // =====================================================
  static async createWallet(userId, transaction = null) {
    try {
      const existingWallet = await Wallet.findOne({ 
        where: { userId },
        transaction 
      });
      
      if (existingWallet) {
        return existingWallet;
      }
      
      const wallet = await Wallet.create({
        userId,
        balance: 0.00,
        status: 'ACTIVE',
        currency: 'PEN'
      }, { transaction });
      
      console.log(`✅ Wallet creada para usuario ${userId}`);
      return wallet;
      
    } catch (error) {
      console.error('Error creando wallet:', error);
      throw error;
    }
  }
  
  // =====================================================
  // OPERACIÓN DE DÉBITO (RESTAR DINERO)
  // =====================================================
  static async debitWallet(walletId, amount, category, description, reference, dbTransaction) {
    try {
      // 1. Buscar wallet con LOCK
      const wallet = await Wallet.findByPk(walletId, {
        lock: dbTransaction.LOCK.UPDATE,
        transaction: dbTransaction
      });
      
      if (!wallet) {
        throw new WalletNotFoundError(walletId);
      }
      
      // 2. Validar estado de wallet
      if (wallet.status !== 'ACTIVE') {
        throw new WalletFrozenError(`Wallet ${wallet.status}`);
      }
      
      // 3. Validar saldo suficiente
      const formattedAmount = formatMoney(amount);
      if (wallet.balance < formattedAmount) {
        throw new InsufficientBalanceError(wallet.balance, formattedAmount);
      }
      
      // 4. Calcular nuevo balance
      const balanceBefore = wallet.balance;
      const balanceAfter = formatMoney(balanceBefore - formattedAmount);
      
      // 5. Crear transacción
      const transaction = await WalletTransaction.create({
        walletId: wallet.id,
        type: 'DEBIT',
        category,
        amount: formattedAmount,
        balanceBefore,
        balanceAfter,
        status: 'COMPLETED',
        description: description || generateTransactionDescription(category),
        reference,
        externalReference: generateReference(`DEB_${category}`)
      }, { transaction: dbTransaction });
      
      // 6. Actualizar wallet
      await wallet.update({
        balance: balanceAfter,
        totalSpent: formatMoney(wallet.totalSpent + formattedAmount),
        lastTransactionAt: new Date()
      }, { transaction: dbTransaction });
      
      console.log(`✅ Débito exitoso: Wallet ${walletId}, Monto: S/ ${formattedAmount}`);
      
      return transaction;
      
    } catch (error) {
      console.error('Error en debitWallet:', error);
      throw error;
    }
  }
  
  // =====================================================
  // OPERACIÓN DE CRÉDITO (SUMAR DINERO)
  // =====================================================
  static async creditWallet(walletId, amount, category, description, reference, dbTransaction) {
    try {
      // 1. Buscar wallet con LOCK
      const wallet = await Wallet.findByPk(walletId, {
        lock: dbTransaction.LOCK.UPDATE,
        transaction: dbTransaction
      });
      
      if (!wallet) {
        throw new WalletNotFoundError(walletId);
      }
      
      // 2. Validar estado (puede recibir dinero aunque esté frozen)
      if (wallet.status === 'CLOSED') {
        throw new OperationNotAllowedError('credit', 'Wallet cerrada');
      }
      
      // 3. Calcular nuevo balance
      const formattedAmount = formatMoney(amount);
      const balanceBefore = wallet.balance;
      const balanceAfter = formatMoney(balanceBefore + formattedAmount);
      
      // 4. Crear transacción
      const transaction = await WalletTransaction.create({
        walletId: wallet.id,
        type: 'CREDIT',
        category,
        amount: formattedAmount,
        balanceBefore,
        balanceAfter,
        status: 'COMPLETED',
        description: description || generateTransactionDescription(category),
        reference,
        externalReference: generateReference(`CRE_${category}`)
      }, { transaction: dbTransaction });
      
      // 5. Actualizar wallet y totales según categoría
      const updateData = {
        balance: balanceAfter,
        lastTransactionAt: new Date()
      };
      
      if (category === 'DEPOSIT') {
        updateData.totalDeposits = formatMoney(wallet.totalDeposits + formattedAmount);
      } else if (['TOURNAMENT_PRIZE', 'BONUS'].includes(category)) {
        updateData.totalWinnings = formatMoney(wallet.totalWinnings + formattedAmount);
      }
      
      await wallet.update(updateData, { transaction: dbTransaction });
      
      console.log(`✅ Crédito exitoso: Wallet ${walletId}, Monto: S/ ${formattedAmount}`);
      
      return transaction;
      
    } catch (error) {
      console.error('Error en creditWallet:', error);
      throw error;
    }
  }
  
  // =====================================================
  // PAGAR INSCRIPCIÓN A TORNEO
  // =====================================================
  static async payTournamentEntry(userId, tournamentId, amount) {
    const t = await sequelize.transaction();
    
    try {
      // Obtener wallet del usuario
      const user = await User.findByPk(userId, { transaction: t });
      const wallet = await user.getOrCreateWallet(t);
      
      // Verificar saldo
      if (!wallet.canDebit(amount)) {
        throw new InsufficientBalanceError(wallet.balance, amount);
      }
      
      // Obtener info del torneo
      const tournament = await Tournament.findByPk(tournamentId, { transaction: t });
      
      // Realizar débito
      const transaction = await this.debitWallet(
        wallet.id,
        amount,
        'TOURNAMENT_ENTRY',
        `Inscripción - ${tournament.name}`,
        `TOURNAMENT_${tournamentId}`,
        t
      );
      
      await t.commit();
      
      return {
        success: true,
        transaction,
        newBalance: wallet.balance - amount
      };
      
    } catch (error) {
      await t.rollback();
      console.error('Error en payTournamentEntry:', error);
      throw error;
    }
  }
  
  // =====================================================
  // PAGAR PREMIO DE TORNEO
  // =====================================================
  static async payTournamentPrize(userId, tournamentId, amount, position) {
    const t = await sequelize.transaction();
    
    try {
      // Obtener wallet del usuario
      const user = await User.findByPk(userId, { transaction: t });
      const wallet = await user.getOrCreateWallet(t);
      
      // Obtener info del torneo
      const tournament = await Tournament.findByPk(tournamentId, { transaction: t });
      
      // Realizar crédito
      const transaction = await this.creditWallet(
        wallet.id,
        amount,
        'TOURNAMENT_PRIZE',
        `Premio posición #${position} - ${tournament.name}`,
        `PRIZE_${tournamentId}_${userId}`,
        t
      );
      
      await t.commit();
      
      console.log(`🏆 Premio pagado: Usuario ${userId}, Torneo ${tournamentId}, Monto: S/ ${amount}`);
      
      return {
        success: true,
        transaction,
        newBalance: wallet.balance + amount
      };
      
    } catch (error) {
      await t.rollback();
      console.error('Error en payTournamentPrize:', error);
      throw error;
    }
  }
  
  // =====================================================
  // REEMBOLSAR TORNEO
  // =====================================================
  static async refundTournamentEntry(userId, tournamentId, amount, reason) {
    const t = await sequelize.transaction();
    
    try {
      const user = await User.findByPk(userId, { transaction: t });
      const wallet = await user.getOrCreateWallet(t);
      const tournament = await Tournament.findByPk(tournamentId, { transaction: t });
      
      const transaction = await this.creditWallet(
        wallet.id,
        amount,
        'TOURNAMENT_REFUND',
        `Reembolso - ${tournament.name} (${reason})`,
        `REFUND_${tournamentId}_${userId}`,
        t
      );
      
      await t.commit();
      
      return {
        success: true,
        transaction,
        newBalance: wallet.balance + amount
      };
      
    } catch (error) {
      await t.rollback();
      console.error('Error en refundTournamentEntry:', error);
      throw error;
    }
  }
  
  // =====================================================
  // VALIDACIONES Y CONSULTAS
  // =====================================================
  
  static async canAffordTournament(userId, amount) {
    try {
      const user = await User.findByPk(userId);
      const wallet = await user.getWallet();
      
      if (!wallet) return false;
      
      return wallet.canDebit(amount);
      
    } catch (error) {
      console.error('Error en canAffordTournament:', error);
      return false;
    }
  }
  
  static async getAvailableBalance(userId) {
    try {
      const user = await User.findByPk(userId);
      const wallet = await user.getWallet();
      
      return wallet ? wallet.getAvailableBalance() : 0;
      
    } catch (error) {
      console.error('Error en getAvailableBalance:', error);
      return 0;
    }
  }
  
  // =====================================================
  // DASHBOARD Y ESTADÍSTICAS
  // =====================================================
  
  static async getWalletDashboard(userId) {
    try {
      const user = await User.findByPk(userId, {
        include: [{
          model: Wallet,
          as: 'wallet'
        }]
      });
      
      if (!user.wallet) {
        throw new WalletNotFoundError(userId);
      }
      
      // Obtener torneos activos
      const activeTournaments = await TournamentEntry.findAll({
        where: { 
          userId,
          status: 'ACTIVE'
        },
        include: [{
          model: Tournament,
          attributes: ['id', 'name', 'endTime', 'prizePool']
        }]
      });
      
      // Obtener transacciones recientes
      const recentTransactions = await WalletTransaction.findAll({
        where: { walletId: user.wallet.id },
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      
      // Calcular estadísticas del mes
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const monthlyStats = await WalletTransaction.findAll({
        where: {
          walletId: user.wallet.id,
          createdAt: { [Op.gte]: startOfMonth },
          status: 'COMPLETED'
        },
        attributes: [
          'type',
          'category',
          [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['type', 'category']
      });
      
      return {
        wallet: user.wallet,
        activeTournaments,
        recentTransactions,
        monthlyStats
      };
      
    } catch (error) {
      console.error('Error en getWalletDashboard:', error);
      throw error;
    }
  }
  
  // =====================================================
  // CREAR SOLICITUD DE DEPÓSITO
  // =====================================================
  
  static async createDepositRequest(userId, amount, method, transactionNumber, proofImageUrl) {
    try {
      // Validar monto
      const validation = validateAmount(amount, 'DEPOSIT');
      if (!validation.isValid) {
        throw new InvalidAmountError(amount, validation.min, validation.max);
      }
      
      // Obtener wallet
      const user = await User.findByPk(userId);
      const wallet = await user.getOrCreateWallet();
      
      // Verificar si hay solicitud pendiente
      const pendingRequest = await DepositRequest.findOne({
        where: {
          userId,
          status: 'PENDING'
        }
      });
      
      if (pendingRequest) {
        throw new OperationNotAllowedError(
          'crear depósito',
          'Ya tienes una solicitud de depósito pendiente'
        );
      }
      
      // Crear solicitud
      const depositRequest = await DepositRequest.create({
        userId,
        walletId: wallet.id,
        amount: formatMoney(amount),
        method,
        transactionNumber,
        proofImageUrl,
        status: 'PENDING'
      });
      
      console.log(`📥 Solicitud de depósito creada: ${depositRequest.id}`);
      
      return depositRequest;
      
    } catch (error) {
      console.error('Error en createDepositRequest:', error);
      throw error;
    }
  }
  
  // =====================================================
  // APROBAR DEPÓSITO
  // =====================================================
  
  static async approveDeposit(depositRequestId, adminId, adminNotes) {
    const t = await sequelize.transaction();
    
    try {
      // Obtener solicitud con lock
      const depositRequest = await DepositRequest.findByPk(depositRequestId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
        include: [{
          model: Wallet,
          as: 'Wallet'
        }]
      });
      
      if (!depositRequest) {
        throw new Error('Solicitud de depósito no encontrada');
      }
      
      if (!depositRequest.canApprove()) {
        throw new OperationNotAllowedError(
          'aprobar depósito',
          `Estado actual: ${depositRequest.status}`
        );
      }
      
      // Crear transacción de crédito
      const walletTransaction = await this.creditWallet(
        depositRequest.walletId,
        depositRequest.amount,
        'DEPOSIT',
        `Depósito aprobado - ${depositRequest.method}`,
        `DEP_${depositRequest.id}`,
        t
      );
      
      // Actualizar solicitud
      await depositRequest.update({
        status: 'APPROVED',
        walletTransactionId: walletTransaction.id,
        processedBy: adminId,
        processedAt: new Date(),
        adminNotes
      }, { transaction: t });
      
      await t.commit();
      
      console.log(`✅ Depósito aprobado: ${depositRequestId}`);
      
      return {
        depositRequest,
        walletTransaction
      };
      
    } catch (error) {
      await t.rollback();
      console.error('Error en approveDeposit:', error);
      throw error;
    }
  }
  
  // =====================================================
  // CREAR SOLICITUD DE RETIRO
  // =====================================================
  
  static async createWithdrawalRequest(userId, amount, method, accountNumber, accountName) {
    const t = await sequelize.transaction();
    
    try {
      // Validar monto
      const validation = validateAmount(amount, 'WITHDRAWAL');
      if (!validation.isValid) {
        throw new InvalidAmountError(amount, validation.min, validation.max);
      }
      
      // Verificar límites diarios
      const limits = await checkDailyLimits(userId, amount, 'WITHDRAWAL', WalletTransaction);
      if (limits.wouldExceed) {
        throw new DailyLimitExceededError(limits.limit, amount);
      }
      
      // Obtener wallet
      const user = await User.findByPk(userId, { transaction: t });
      const wallet = await user.getWallet({ transaction: t });
      
      if (!wallet || !wallet.canDebit(amount)) {
        throw new InsufficientBalanceError(wallet ? wallet.balance : 0, amount);
      }
      
      // Verificar solicitudes pendientes
      const pendingWithdrawal = await WithdrawalRequest.findOne({
        where: {
          userId,
          status: ['PENDING', 'PROCESSING']
        },
        transaction: t
      });
      
      if (pendingWithdrawal) {
        throw new OperationNotAllowedError(
          'crear retiro',
          'Ya tienes una solicitud de retiro en proceso'
        );
      }
      
      // Crear transacción de débito (congelar fondos)
      const walletTransaction = await this.debitWallet(
        wallet.id,
        amount,
        'WITHDRAWAL',
        `Retiro solicitado - ${method}`,
        generateReference('WTH'),
        t
      );
      
      // Marcar transacción como pendiente (fondos congelados)
      await walletTransaction.update({
        status: 'PENDING'
      }, { transaction: t });
      
      // Crear solicitud de retiro
      const withdrawalRequest = await WithdrawalRequest.create({
        userId,
        walletId: wallet.id,
        amount: formatMoney(amount),
        method,
        accountNumber,
        accountName,
        walletTransactionId: walletTransaction.id,
        status: 'PENDING'
      }, { transaction: t });
      
      await t.commit();
      
      console.log(`💸 Solicitud de retiro creada: ${withdrawalRequest.id}`);
      
      return {
        withdrawalRequest,
        walletTransaction,
        newBalance: wallet.balance - amount
      };
      
    } catch (error) {
      await t.rollback();
      console.error('Error en createWithdrawalRequest:', error);
      throw error;
    }
  }
  
  // =====================================================
  // PROCESAR/COMPLETAR RETIRO
  // =====================================================
  
  static async processWithdrawal(withdrawalRequestId, adminId, externalTransactionId, adminNotes) {
    const t = await sequelize.transaction();
    
    try {
      const withdrawalRequest = await WithdrawalRequest.findByPk(withdrawalRequestId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
        include: [{
          model: WalletTransaction,
          as: 'transaction'
        }]
      });
      
      if (!withdrawalRequest) {
        throw new Error('Solicitud de retiro no encontrada');
      }
      
      if (!withdrawalRequest.canProcess()) {
        throw new OperationNotAllowedError(
          'procesar retiro',
          `Estado actual: ${withdrawalRequest.status}`
        );
      }
      
      // Actualizar solicitud a procesando
      await withdrawalRequest.update({
        status: 'PROCESSING',
        processedBy: adminId,
        processedAt: new Date(),
        adminNotes
      }, { transaction: t });
      
      await t.commit();
      
      return withdrawalRequest;
      
    } catch (error) {
      await t.rollback();
      console.error('Error en processWithdrawal:', error);
      throw error;
    }
  }
  
  static async completeWithdrawal(withdrawalRequestId, externalTransactionId) {
    const t = await sequelize.transaction();
    
    try {
      const withdrawalRequest = await WithdrawalRequest.findByPk(withdrawalRequestId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
        include: [{
          model: WalletTransaction,
          as: 'transaction'
        }]
      });
      
      if (!withdrawalRequest) {
        throw new Error('Solicitud de retiro no encontrada');
      }
      
      if (!withdrawalRequest.canComplete()) {
        throw new OperationNotAllowedError(
          'completar retiro',
          `Estado actual: ${withdrawalRequest.status}`
        );
      }
      
      // Actualizar transacción a completada
      await withdrawalRequest.transaction.update({
        status: 'COMPLETED'
      }, { transaction: t });
      
      // Actualizar solicitud
      await withdrawalRequest.update({
        status: 'COMPLETED',
        externalTransactionId,
        completedAt: new Date()
      }, { transaction: t });
      
      await t.commit();
      
      console.log(`✅ Retiro completado: ${withdrawalRequestId}`);
      
      return withdrawalRequest;
      
    } catch (error) {
      await t.rollback();
      console.error('Error en completeWithdrawal:', error);
      throw error;
    }
  }
  
  // =====================================================
  // CANCELAR RETIRO
  // =====================================================
  
  static async cancelWithdrawal(withdrawalRequestId, reason) {
    const t = await sequelize.transaction();
    
    try {
      const withdrawalRequest = await WithdrawalRequest.findByPk(withdrawalRequestId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
        include: [{
          model: WalletTransaction,
          as: 'transaction'
        }, {
          model: Wallet
        }]
      });
      
      if (!withdrawalRequest) {
        throw new Error('Solicitud de retiro no encontrada');
      }
      
      if (!withdrawalRequest.canCancel()) {
        throw new OperationNotAllowedError(
          'cancelar retiro',
          `Estado actual: ${withdrawalRequest.status}`
        );
      }
      
      // Revertir la transacción (devolver fondos)
      const wallet = await Wallet.findByPk(withdrawalRequest.walletId, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });
      
      const amountToReturn = withdrawalRequest.amount;
      
      // Crear transacción de reversión
      await WalletTransaction.create({
        walletId: wallet.id,
        type: 'CREDIT',
        category: 'WITHDRAWAL',
        amount: amountToReturn,
        balanceBefore: wallet.balance,
        balanceAfter: formatMoney(wallet.balance + amountToReturn),
        status: 'COMPLETED',
        description: `Reversión de retiro - ${reason}`,
        reference: `REV_${withdrawalRequest.id}`,
        externalReference: generateReference('REV_WTH')
      }, { transaction: t });
      
      // Actualizar balance de wallet
      await wallet.update({
        balance: formatMoney(wallet.balance + amountToReturn),
        totalWithdrawals: formatMoney(wallet.totalWithdrawals - amountToReturn),
        lastTransactionAt: new Date()
      }, { transaction: t });
      
      // Marcar transacción original como cancelada
      await withdrawalRequest.transaction.update({
        status: 'CANCELLED'
      }, { transaction: t });
      
      // Actualizar solicitud
      await withdrawalRequest.update({
        status: 'CANCELLED',
        adminNotes: reason
      }, { transaction: t });
      
      await t.commit();
      
      console.log(`❌ Retiro cancelado: ${withdrawalRequestId}`);
      
      return withdrawalRequest;
      
    } catch (error) {
      await t.rollback();
      console.error('Error en cancelWithdrawal:', error);
      throw error;
    }
  }
  
  // =====================================================
  // AJUSTE MANUAL (ADMIN)
  // =====================================================
  
  static async manualAdjustment(userId, amount, type, reason, adminId) {
    const t = await sequelize.transaction();
    
    try {
      const user = await User.findByPk(userId, { transaction: t });
      const wallet = await user.getOrCreateWallet(t);
      
      let transaction;
      
      if (type === 'CREDIT') {
        transaction = await this.creditWallet(
          wallet.id,
          Math.abs(amount),
          'ADMIN_ADJUSTMENT',
          `Ajuste administrativo: ${reason}`,
          generateReference('ADJ'),
          t
        );
      } else {
        // Para débito, verificar saldo
        if (!wallet.canDebit(Math.abs(amount))) {
          throw new InsufficientBalanceError(wallet.balance, Math.abs(amount));
        }
        
        transaction = await this.debitWallet(
          wallet.id,
          Math.abs(amount),
          'ADMIN_ADJUSTMENT',
          `Ajuste administrativo: ${reason}`,
          generateReference('ADJ'),
          t
        );
      }
      
      // Registrar quién hizo el ajuste
      await transaction.update({
        createdBy: adminId,
        metadata: {
          ...transaction.metadata,
          reason,
          adjustedAt: new Date()
        }
      }, { transaction: t });
      
      await t.commit();
      
      console.log(`⚙️ Ajuste manual realizado: Usuario ${userId}, ${type} S/ ${Math.abs(amount)}`);
      
      return transaction;
      
    } catch (error) {
      await t.rollback();
      console.error('Error en manualAdjustment:', error);
      throw error;
    }
  }
  
  // =====================================================
  // REVERTIR TRANSACCIÓN
  // =====================================================
  
  static async reverseTransaction(originalTransactionId, reason, adminId) {
    const t = await sequelize.transaction();
    
    try {
      // Buscar transacción original
      const originalTxn = await WalletTransaction.findByPk(originalTransactionId, {
        include: [{
          model: Wallet
        }],
        transaction: t
      });
      
      if (!originalTxn) {
        throw new Error('Transacción no encontrada');
      }
      
      if (!originalTxn.canReverse()) {
        throw new TransactionNotReversibleError(
          originalTransactionId,
          'Solo se pueden revertir transacciones completadas de tipo crédito'
        );
      }
      
      // Verificar que no haya sido revertida ya
      if (originalTxn.status === 'REVERSED') {
        throw new TransactionNotReversibleError(
          originalTransactionId,
          'La transacción ya fue revertida'
        );
      }
      
      const wallet = await Wallet.findByPk(originalTxn.walletId, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });
      
      // Para revertir un crédito, hacemos un débito
      const reversalType = originalTxn.type === 'CREDIT' ? 'DEBIT' : 'CREDIT';
      const amount = originalTxn.amount;
      
      if (reversalType === 'DEBIT' && !wallet.canDebit(amount)) {
        throw new InsufficientBalanceError(wallet.balance, amount);
      }
      
      let reversalTxn;
      
      if (reversalType === 'DEBIT') {
        reversalTxn = await this.debitWallet(
          wallet.id,
          amount,
          originalTxn.category,
          `Reversión: ${originalTxn.description}`,
          `REV_${originalTxn.id}`,
          t
        );
      } else {
        reversalTxn = await this.creditWallet(
          wallet.id,
          amount,
          originalTxn.category,
          `Reversión: ${originalTxn.description}`,
          `REV_${originalTxn.id}`,
          t
        );
      }
      
      // Marcar original como revertida
      await originalTxn.update({
        status: 'REVERSED',
        metadata: {
          ...originalTxn.metadata,
          reversedAt: new Date(),
          reversedBy: adminId,
          reversalReason: reason,
          reversalTransactionId: reversalTxn.id
        }
      }, { transaction: t });
      
      // Actualizar metadata de la reversión
      await reversalTxn.update({
        createdBy: adminId,
        metadata: {
          ...reversalTxn.metadata,
          originalTransactionId,
          reversalReason: reason
        }
      }, { transaction: t });
      
      await t.commit();
      
      console.log(`🔄 Transacción revertida: ${originalTransactionId}`);
      
      return {
        originalTransaction: originalTxn,
        reversalTransaction: reversalTxn
      };
      
    } catch (error) {
      await t.rollback();
      console.error('Error en reverseTransaction:', error);
      throw error;
    }
  }
}

module.exports = WalletService;