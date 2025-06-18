// src/services/payment.service.js
const { Payment, Tournament, TournamentEntry, User } = require('../models');
const { v4: uuidv4 } = require('uuid');

class PaymentService {

  // =====================================================
  // CREAR ORDEN DE PAGO PARA TORNEO
  // =====================================================
  static async createTournamentPayment(userId, tournamentId, method = 'PENDING') {
    try {
      const tournament = await Tournament.findByPk(tournamentId);
      if (!tournament) {
        throw new Error('Torneo no encontrado');
      }

      if (tournament.buyIn <= 0) {
        throw new Error('Este torneo es gratuito, no requiere pago');
      }

      // Verificar si ya existe una orden pendiente
      const existingPayment = await Payment.findOne({
        where: {
          userId,
          status: 'PENDING',
          'metadata.tournamentId': tournamentId
        }
      });

      if (existingPayment) {
        return {
          payment: existingPayment,
          isExisting: true
        };
      }

      // Crear nueva orden de pago
      const payment = await Payment.create({
        userId,
        amount: tournament.buyIn,
        currency: tournament.currency,
        method,
        status: 'PENDING',
        reference: `TOURNAMENT_${tournament.id}_${Date.now()}`,
        externalId: uuidv4(),
        metadata: {
          tournamentId,
          tournamentName: tournament.name,
          type: 'tournament_entry',
          createdAt: new Date()
        }
      });

      return {
        payment,
        isExisting: false
      };

    } catch (error) {
      console.error('Error creando pago de torneo:', error);
      throw error;
    }
  }

  // =====================================================
  // CONFIRMAR PAGO Y CREAR ENTRADA DE TORNEO
  // =====================================================
  static async confirmTournamentPayment(paymentId, externalTransactionId = null) {
    try {
      const payment = await Payment.findByPk(paymentId, {
        include: [{
          model: User,
          attributes: ['id', 'name', 'email']
        }]
      });

      if (!payment) {
        throw new Error('Pago no encontrado');
      }

      if (payment.status === 'COMPLETED') {
        throw new Error('El pago ya está confirmado');
      }

      const tournamentId = payment.metadata.tournamentId;
      const tournament = await Tournament.findByPk(tournamentId);

      if (!tournament) {
        throw new Error('Torneo no encontrado');
      }

      // Verificar que el torneo aún acepta inscripciones
      if (tournament.status !== 'REGISTRATION') {
        throw new Error('El torneo ya no acepta inscripciones');
      }

      if (new Date() > new Date(tournament.registrationDeadline)) {
        throw new Error('La fecha límite de inscripción ha pasado');
      }

      // Verificar que no esté lleno
      const currentPlayers = await TournamentEntry.count({
        where: { tournamentId }
      });

      if (currentPlayers >= tournament.maxPlayers) {
        throw new Error('El torneo está lleno');
      }

      // Verificar que el usuario no esté ya inscrito
      const existingEntry = await TournamentEntry.findOne({
        where: { userId: payment.userId, tournamentId }
      });

      if (existingEntry) {
        throw new Error('El usuario ya está inscrito en este torneo');
      }

      // Confirmar el pago
      payment.status = 'COMPLETED';
      payment.metadata = {
        ...payment.metadata,
        confirmedAt: new Date(),
        externalTransactionId,
        confirmationMethod: 'manual'
      };
      await payment.save();

      // Crear entrada del torneo
      const entry = await TournamentEntry.create({
        userId: payment.userId,
        tournamentId,
        buyInPaid: payment.amount,
        paymentId: payment.id
      });

      // Actualizar contador de jugadores y prize pool
      const prizePoolIncrease = payment.amount * 0.9; // 90% al prize pool, 10% comisión
      await tournament.increment('currentPlayers');
      await tournament.increment('prizePool', { by: prizePoolIncrease });

      return {
        payment,
        entry,
        tournament
      };

    } catch (error) {
      console.error('Error confirmando pago:', error);
      throw error;
    }
  }

  // =====================================================
  // CANCELAR PAGO PENDIENTE
  // =====================================================
  static async cancelPayment(paymentId, reason = 'Cancelado por usuario') {
    try {
      const payment = await Payment.findByPk(paymentId);
      
      if (!payment) {
        throw new Error('Pago no encontrado');
      }

      if (payment.status !== 'PENDING') {
        throw new Error('Solo se pueden cancelar pagos pendientes');
      }

      payment.status = 'CANCELLED';
      payment.metadata = {
        ...payment.metadata,
        cancelledAt: new Date(),
        cancelReason: reason
      };
      await payment.save();

      return payment;

    } catch (error) {
      console.error('Error cancelando pago:', error);
      throw error;
    }
  }

  // =====================================================
  // PROCESAR REEMBOLSO
  // =====================================================
  static async processRefund(paymentId, reason, refundAmount = null) {
    try {
      const payment = await Payment.findByPk(paymentId);
      
      if (!payment) {
        throw new Error('Pago no encontrado');
      }

      if (payment.status !== 'COMPLETED') {
        throw new Error('Solo se pueden reembolsar pagos completados');
      }

      const amount = refundAmount || payment.amount;

      // Buscar la entrada del torneo asociada
      const entry = await TournamentEntry.findOne({
        where: { paymentId: payment.id }
      });

      if (entry) {
        // Actualizar la entrada
        entry.status = 'REFUNDED';
        entry.metadata = {
          ...entry.metadata,
          refundedAt: new Date(),
          refundReason: reason,
          refundAmount: amount
        };
        await entry.save();

        // Actualizar contadores del torneo
        const tournament = await Tournament.findByPk(entry.tournamentId);
        if (tournament) {
          await tournament.decrement('currentPlayers');
          await tournament.decrement('prizePool', { by: amount * 0.9 });
        }
      }

      // Crear registro del reembolso
      const refund = await Payment.create({
        userId: payment.userId,
        amount: -amount, // Monto negativo para reembolso
        currency: payment.currency,
        method: payment.method,
        status: 'COMPLETED',
        reference: `REFUND_${payment.reference}`,
        externalId: `REF_${payment.externalId}`,
        metadata: {
          originalPaymentId: payment.id,
          type: 'refund',
          reason,
          processedAt: new Date()
        }
      });

      return {
        refund,
        originalPayment: payment,
        entry
      };

    } catch (error) {
      console.error('Error procesando reembolso:', error);
      throw error;
    }
  }

  // =====================================================
  // OBTENER ESTADO DE PAGO
  // =====================================================
  static async getPaymentStatus(paymentId) {
    try {
      const payment = await Payment.findByPk(paymentId, {
        include: [{
          model: User,
          attributes: ['id', 'name', 'email']
        }]
      });

      if (!payment) {
        throw new Error('Pago no encontrado');
      }

      // Si es un pago de torneo, incluir información del torneo
      let tournamentInfo = null;
      if (payment.metadata.tournamentId) {
        const tournament = await Tournament.findByPk(payment.metadata.tournamentId, {
          attributes: ['id', 'name', 'status', 'startTime']
        });
        tournamentInfo = tournament;
      }

      return {
        payment,
        tournamentInfo
      };

    } catch (error) {
      console.error('Error obteniendo estado de pago:', error);
      throw error;
    }
  }

  // =====================================================
  // SIMULAR PAGO (PARA DESARROLLO/TESTING)
  // =====================================================
  static async simulatePayment(paymentId, success = true) {
    try {
      if (!['development', 'testing'].includes(process.env.NODE_ENV)) {
        throw new Error('Simulación de pagos solo disponible en desarrollo');
      }

      const payment = await Payment.findByPk(paymentId);
      if (!payment) {
        throw new Error('Pago no encontrado');
      }

      if (payment.status !== 'PENDING') {
        throw new Error('Solo se pueden simular pagos pendientes');
      }

      if (success) {
        // Simular pago exitoso
        const result = await this.confirmTournamentPayment(
          paymentId, 
          `SIM_${Date.now()}`
        );
        return result;
      } else {
        // Simular pago fallido
        payment.status = 'FAILED';
        payment.metadata = {
          ...payment.metadata,
          failedAt: new Date(),
          failureReason: 'Simulación de fallo',
          simulatedFailure: true
        };
        await payment.save();
        return { payment };
      }

    } catch (error) {
      console.error('Error simulando pago:', error);
      throw error;
    }
  }

  // =====================================================
  // OBTENER ESTADÍSTICAS DE PAGOS
  // =====================================================
  static async getPaymentStats(period = 'month') {
    try {
      let dateFilter = {};
      const now = new Date();
      
      if (period === 'day') {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        dateFilter = { [require('sequelize').Op.gte]: startOfDay };
      } else if (period === 'week') {
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        dateFilter = { [require('sequelize').Op.gte]: weekAgo };
      } else if (period === 'month') {
        const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
        dateFilter = { [require('sequelize').Op.gte]: monthAgo };
      }

      const where = {};
      if (Object.keys(dateFilter).length > 0) {
        where.createdAt = dateFilter;
      }

      // Estadísticas básicas
      const stats = await Payment.findAll({
        where,
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
          [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total']
        ],
        group: ['status'],
        raw: true
      });

      // Pagos por método
      const methodStats = await Payment.findAll({
        where: {
          ...where,
          status: 'COMPLETED'
        },
        attributes: [
          'method',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
          [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total']
        ],
        group: ['method'],
        raw: true
      });

      return {
        period,
        byStatus: stats,
        byMethod: methodStats,
        summary: {
          totalAmount: stats.reduce((sum, s) => sum + parseFloat(s.total || 0), 0),
          totalTransactions: stats.reduce((sum, s) => sum + parseInt(s.count || 0), 0),
          completedAmount: stats.find(s => s.status === 'COMPLETED')?.total || 0,
          pendingAmount: stats.find(s => s.status === 'PENDING')?.total || 0
        }
      };

    } catch (error) {
      console.error('Error obteniendo estadísticas de pagos:', error);
      throw error;
    }
  }

  // =====================================================
  // LIMPIAR PAGOS ANTIGUOS PENDIENTES
  // =====================================================
  static async cleanupOldPendingPayments(daysOld = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const oldPayments = await Payment.findAll({
        where: {
          status: 'PENDING',
          createdAt: { [require('sequelize').Op.lte]: cutoffDate }
        }
      });

      let cleaned = 0;
      for (const payment of oldPayments) {
        await this.cancelPayment(payment.id, 'Expirado por inactividad');
        cleaned++;
      }

      return {
        cleaned,
        cutoffDate
      };

    } catch (error) {
      console.error('Error limpiando pagos antiguos:', error);
      throw error;
    }
  }
}

module.exports = PaymentService;