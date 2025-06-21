// src/services/wallet.service.js - CORREGIDO PARA POSTGRESQL
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

// Funciones helper
const formatMoney = (amount) => {
  return Number(parseFloat(amount).toFixed(2));
};

const generateReference = (prefix = 'TXN') => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}_${timestamp}_${random}`.toUpperCase();
};

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
        throw new Error(`Wallet ${walletId} no encontrada`);
      }
      
      // 2. Validar estado de wallet
      if (wallet.status !== 'ACTIVE') {
        throw new Error(`Wallet ${wallet.status}`);
      }
      
      // 3. Validar saldo suficiente
      const formattedAmount = formatMoney(amount);
      if (wallet.balance < formattedAmount) {
        throw new Error(`Saldo insuficiente. Disponible: S/ ${wallet.balance}, Requerido: S/ ${formattedAmount}`);
      }
      
      // 4. Calcular nuevo balance
      const balanceBefore = parseFloat(wallet.balance);
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
        description: description || `Débito - ${category}`,
        reference,
        externalReference: generateReference(`DEB_${category}`)
      }, { transaction: dbTransaction });
      
      // 6. Actualizar wallet
      await wallet.update({
        balance: balanceAfter,
        totalSpent: formatMoney(parseFloat(wallet.totalSpent) + formattedAmount),
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
        throw new Error(`Wallet ${walletId} no encontrada`);
      }
      
      // 2. Validar estado (puede recibir dinero aunque esté frozen)
      if (wallet.status === 'CLOSED') {
        throw new Error('Wallet cerrada');
      }
      
      // 3. Calcular nuevo balance
      const formattedAmount = formatMoney(amount);
      const balanceBefore = parseFloat(wallet.balance);
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
        description: description || `Crédito - ${category}`,
        reference,
        externalReference: generateReference(`CRE_${category}`)
      }, { transaction: dbTransaction });
      
      // 5. Actualizar wallet y totales según categoría
      const updateData = {
        balance: balanceAfter,
        lastTransactionAt: new Date()
      };
      
      if (category === 'DEPOSIT') {
        updateData.totalDeposits = formatMoney(parseFloat(wallet.totalDeposits) + formattedAmount);
      } else if (['TOURNAMENT_PRIZE', 'BONUS'].includes(category)) {
        updateData.totalWinnings = formatMoney(parseFloat(wallet.totalWinnings) + formattedAmount);
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
      let wallet = await Wallet.findOne({ where: { userId }, transaction: t });
      
      if (!wallet) {
        wallet = await this.createWallet(userId, t);
      }
      
      // Verificar saldo
      if (parseFloat(wallet.balance) < amount) {
        await t.rollback();
        return {
          success: false,
          error: `Saldo insuficiente. Disponible: S/ ${wallet.balance}, Requerido: S/ ${amount}`,
          available: parseFloat(wallet.balance)
        };
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
        newBalance: parseFloat(wallet.balance) - amount
      };
      
    } catch (error) {
      await t.rollback();
      console.error('Error en payTournamentEntry:', error);
      return {
        success: false,
        error: error.message,
        available: await this.getAvailableBalance(userId)
      };
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
      let wallet = await Wallet.findOne({ where: { userId }, transaction: t });
      
      if (!wallet) {
        wallet = await this.createWallet(userId, t);
      }
      
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
        newBalance: parseFloat(wallet.balance) + amount
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
      // Obtener wallet del usuario
      const user = await User.findByPk(userId, { transaction: t });
      let wallet = await Wallet.findOne({ where: { userId }, transaction: t });
      
      if (!wallet) {
        wallet = await this.createWallet(userId, t);
      }
      
      // Obtener info del torneo
      const tournament = await Tournament.findByPk(tournamentId, { transaction: t });
      
      // Realizar crédito
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
        newBalance: parseFloat(wallet.balance) + amount
      };
      
    } catch (error) {
      await t.rollback();
      console.error('Error en refundTournamentEntry:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // =====================================================
  // VALIDACIONES Y CONSULTAS
  // =====================================================
  
  static async canAffordTournament(userId, amount) {
    try {
      const user = await User.findByPk(userId);
      const wallet = await Wallet.findOne({ where: { userId } });
      
      if (!wallet) return false;
      
      return parseFloat(wallet.balance) >= amount;
      
    } catch (error) {
      console.error('Error en canAffordTournament:', error);
      return false;
    }
  }
  
  static async getAvailableBalance(userId) {
    try {
      const wallet = await Wallet.findOne({ where: { userId } });
      
      return wallet ? parseFloat(wallet.balance) : 0;
      
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
      const user = await User.findByPk(userId);
      let wallet = await Wallet.findOne({ where: { userId } });
      
      if (!wallet) {
        wallet = await this.createWallet(userId);
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
        where: { walletId: wallet.id },
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      
      // Calcular estadísticas del mes
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const monthlyStats = await WalletTransaction.findAll({
        where: {
          walletId: wallet.id,
          createdAt: { [Op.gte]: startOfMonth },
          status: 'COMPLETED'
        },
        attributes: [
          'type',
          'category',
          [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['type', 'category'],
        raw: true
      });
      
      return {
        wallet,
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
      if (amount < 10 || amount > 5000) {
        throw new Error('El monto debe estar entre S/ 10 y S/ 5000');
      }
      
      // Obtener wallet
      const user = await User.findByPk(userId);
      let wallet = await Wallet.findOne({ where: { userId } });
      
      if (!wallet) {
        wallet = await this.createWallet(userId);
      }
      
      // Verificar si hay solicitud pendiente
      const pendingRequest = await DepositRequest.findOne({
        where: {
          userId,
          status: 'PENDING'
        }
      });
      
      if (pendingRequest) {
        throw new Error('Ya tienes una solicitud de depósito pendiente');
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
        transaction: t
      });
      
      if (!depositRequest) {
        throw new Error('Solicitud de depósito no encontrada');
      }
      
      if (depositRequest.status !== 'PENDING') {
        throw new Error(`No se puede aprobar un depósito en estado ${depositRequest.status}`);
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
      if (amount < 20 || amount > 500) {
        throw new Error('El monto debe estar entre S/ 20 y S/ 500');
      }
      
      // Obtener wallet
      const user = await User.findByPk(userId, { transaction: t });
      let wallet = await Wallet.findOne({ 
        where: { userId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      
      if (!wallet) {
        wallet = await this.createWallet(userId, t);
      }
      
      // Verificar saldo
      if (parseFloat(wallet.balance) < amount) {
        throw new Error(`Saldo insuficiente. Disponible: S/ ${wallet.balance}, Requerido: S/ ${amount}`);
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
        throw new Error('Ya tienes una solicitud de retiro en proceso');
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
        newBalance: parseFloat(wallet.balance) - amount
      };
      
    } catch (error) {
      await t.rollback();
      console.error('Error en createWithdrawalRequest:', error);
      throw error;
    }
  }
  
  // =====================================================
  // PROCESAR RETIRO - CORREGIDO PARA POSTGRESQL
  // =====================================================
  static async processWithdrawal(withdrawalRequestId, adminId, externalTransactionId, adminNotes) {
    const t = await sequelize.transaction();
    
    try {
      // 1. ✅ Lock solo la tabla principal (SIN include)
      const withdrawalRequest = await WithdrawalRequest.findByPk(withdrawalRequestId, {
        lock: t.LOCK.UPDATE,
        transaction: t
        // ❌ NO include aquí para evitar error SQL
      });
      
      if (!withdrawalRequest) {
        throw new Error('Solicitud de retiro no encontrada');
      }
      
      if (withdrawalRequest.status !== 'PENDING') {
        throw new Error(`No se puede procesar un retiro en estado ${withdrawalRequest.status}`);
      }
      
      // 2. ✅ Consulta separada para la transacción relacionada
      const walletTransaction = await WalletTransaction.findByPk(
        withdrawalRequest.walletTransactionId, 
        { transaction: t }
      );
      
      if (!walletTransaction) {
        throw new Error('Transacción de wallet no encontrada');
      }
      
      // 3. ✅ Actualizar solicitud a procesando
      await withdrawalRequest.update({
        status: 'PROCESSING',
        processedBy: adminId,
        processedAt: new Date(),
        adminNotes
      }, { transaction: t });
      
      await t.commit();
      
      console.log(`🔄 Retiro marcado como procesando: ${withdrawalRequestId}`);
      
      return withdrawalRequest;
      
    } catch (error) {
      await t.rollback();
      console.error('Error en processWithdrawal:', error);
      throw error;
    }
  }
  
  // =====================================================
  // COMPLETAR RETIRO - CORREGIDO PARA POSTGRESQL
  // =====================================================
  static async completeWithdrawal(withdrawalRequestId, externalTransactionId) {
    const t = await sequelize.transaction();
    
    try {
      // 1. ✅ Lock solo la tabla principal
      const withdrawalRequest = await WithdrawalRequest.findByPk(withdrawalRequestId, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });
      
      if (!withdrawalRequest) {
        throw new Error('Solicitud de retiro no encontrada');
      }
      
      if (withdrawalRequest.status !== 'PROCESSING') {
        throw new Error(`No se puede completar un retiro en estado ${withdrawalRequest.status}`);
      }
      
      // 2. ✅ Consulta separada para la transacción relacionada
      const walletTransaction = await WalletTransaction.findByPk(
        withdrawalRequest.walletTransactionId,
        { transaction: t }
      );
      
      if (!walletTransaction) {
        throw new Error('Transacción de wallet no encontrada');
      }
      
      // 3. ✅ Actualizar transacción a completada
      await walletTransaction.update({
        status: 'COMPLETED'
      }, { transaction: t });
      
      // 4. ✅ Actualizar solicitud
      await withdrawalRequest.update({
        status: 'COMPLETED',
        externalTransactionId,
        completedAt: new Date()
      }, { transaction: t });
      
      // 5. ✅ Actualizar totales de wallet
      const wallet = await Wallet.findByPk(withdrawalRequest.walletId, { transaction: t });
      if (wallet) {
        await wallet.update({
          totalWithdrawals: formatMoney(parseFloat(wallet.totalWithdrawals) + parseFloat(withdrawalRequest.amount)),
          lastTransactionAt: new Date()
        }, { transaction: t });
      }
      
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
  // CANCELAR RETIRO - CORREGIDO PARA POSTGRESQL
  // =====================================================
  static async cancelWithdrawal(withdrawalRequestId, reason) {
    const t = await sequelize.transaction();
    
    try {
      // 1. ✅ Lock solo la tabla principal (CRÍTICO para evitar doble procesamiento)
      const withdrawalRequest = await WithdrawalRequest.findByPk(withdrawalRequestId, {
        lock: t.LOCK.UPDATE,  // ✅ SEGURIDAD FINANCIERA
        transaction: t
        // ❌ NO include para evitar error SQL
      });
      
      if (!withdrawalRequest) {
        throw new Error('Solicitud de retiro no encontrada');
      }
      
      if (!['PENDING', 'PROCESSING'].includes(withdrawalRequest.status)) {
        throw new Error(`No se puede cancelar un retiro en estado ${withdrawalRequest.status}`);
      }
      
      // 2. ✅ Consulta separada para wallet (CON LOCK para seguridad)
      const wallet = await Wallet.findByPk(withdrawalRequest.walletId, {
        lock: t.LOCK.UPDATE,  // ✅ EVITA RACE CONDITIONS EN BALANCE
        transaction: t
      });
      
      if (!wallet) {
        throw new Error('Wallet no encontrada');
      }
      
      // 3. ✅ Consulta separada para transacción relacionada
      const walletTransaction = await WalletTransaction.findByPk(
        withdrawalRequest.walletTransactionId,
        { transaction: t }
      );
      
      if (!walletTransaction) {
        throw new Error('Transacción de wallet no encontrada');
      }
      
      // 4. ✅ DEVOLVER FONDOS AL USUARIO (CRÍTICO)
      const amountToReturn = parseFloat(withdrawalRequest.amount);
      const newBalance = formatMoney(parseFloat(wallet.balance) + amountToReturn);
      
      // 5. ✅ Crear transacción de reversión
      await WalletTransaction.create({
        walletId: wallet.id,
        type: 'CREDIT',
        category: 'WITHDRAWAL',
        amount: amountToReturn,
        balanceBefore: parseFloat(wallet.balance),
        balanceAfter: newBalance,
        status: 'COMPLETED',
        description: `Reversión de retiro - ${reason}`,
        reference: `REV_${withdrawalRequest.id}`,
        externalReference: generateReference('REV_WTH')
      }, { transaction: t });
      
      // 6. ✅ Actualizar balance de wallet
      await wallet.update({
        balance: newBalance,
        lastTransactionAt: new Date()
      }, { transaction: t });
      
      // 7. ✅ Marcar transacción original como cancelada
      await walletTransaction.update({
        status: 'CANCELLED'
      }, { transaction: t });
      
      // 8. ✅ Actualizar solicitud de retiro
      await withdrawalRequest.update({
        status: 'CANCELLED',
        adminNotes: reason
      }, { transaction: t });
      
      await t.commit();
      
      console.log(`❌ Retiro cancelado y fondos devueltos: ${withdrawalRequestId} - S/ ${amountToReturn}`);
      
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
      let wallet = await Wallet.findOne({ where: { userId }, transaction: t });
      
      if (!wallet) {
        wallet = await this.createWallet(userId, t);
      }
      
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
        if (parseFloat(wallet.balance) < Math.abs(amount)) {
          throw new Error(`Saldo insuficiente. Disponible: S/ ${wallet.balance}, Requerido: S/ ${Math.abs(amount)}`);
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
  // OBTENER BALANCE TOTAL DEL SISTEMA
  // =====================================================
  static async getTotalSystemBalance() {
    try {
      const totalBalance = await Wallet.sum('balance') || 0;
      return totalBalance;
    } catch (error) {
      console.error('Error obteniendo balance total del sistema:', error);
      return 0;
    }
  }
}

module.exports = WalletService;