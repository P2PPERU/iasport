// src/controllers/payments.controller.js
const { Payment, Tournament, TournamentEntry, User } = require('../models');
const { Op } = require('sequelize');
const PaymentService = require('../services/payment.service');

// =====================================================
// CREAR ORDEN DE PAGO PARA TORNEO
// =====================================================
exports.createTournamentPayment = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { method = 'YAPE' } = req.body;
    const userId = req.user.id;

    // Validar métodos de pago disponibles
    const validMethods = ['YAPE', 'PLIN', 'CARD', 'BANK_TRANSFER'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({
        success: false,
        message: `Método de pago inválido. Métodos disponibles: ${validMethods.join(', ')}`
      });
    }

    const result = await PaymentService.createTournamentPayment(
      userId, 
      tournamentId, 
      method
    );

    const statusCode = result.isExisting ? 200 : 201;
    const message = result.isExisting ? 
      'Orden de pago existente encontrada' : 
      'Orden de pago creada exitosamente';

    res.status(statusCode).json({
      success: true,
      message,
      data: {
        paymentId: result.payment.id,
        amount: result.payment.amount,
        currency: result.payment.currency,
        method: result.payment.method,
        reference: result.payment.reference,
        externalId: result.payment.externalId,
        status: result.payment.status,
        tournamentName: result.payment.metadata.tournamentName,
        isExisting: result.isExisting
      }
    });

  } catch (error) {
    console.error('Error creando pago de torneo:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear orden de pago'
    });
  }
};

// =====================================================
// OBTENER ESTADO DE PAGO
// =====================================================
exports.getPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const result = await PaymentService.getPaymentStatus(paymentId);
    
    // Verificar que el pago pertenece al usuario (seguridad)
    if (result.payment.userId !== userId && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver este pago'
      });
    }

    res.json({
      success: true,
      data: {
        payment: {
          id: result.payment.id,
          amount: result.payment.amount,
          currency: result.payment.currency,
          method: result.payment.method,
          status: result.payment.status,
          reference: result.payment.reference,
          createdAt: result.payment.createdAt,
          metadata: result.payment.metadata
        },
        tournament: result.tournamentInfo
      }
    });

  } catch (error) {
    console.error('Error obteniendo estado de pago:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener estado del pago'
    });
  }
};

// =====================================================
// CONFIRMAR PAGO MANUALMENTE
// =====================================================
exports.confirmPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { externalTransactionId } = req.body;
    const userId = req.user.id;

    // En desarrollo, permitir confirmar pagos propios
    // En producción, esto sería manejado por webhooks
    if (process.env.NODE_ENV === 'production' && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Confirmación manual no disponible en producción'
      });
    }

    const payment = await Payment.findByPk(paymentId);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Pago no encontrado'
      });
    }

    if (payment.userId !== userId && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para confirmar este pago'
      });
    }

    const result = await PaymentService.confirmTournamentPayment(
      paymentId, 
      externalTransactionId
    );

    res.json({
      success: true,
      message: 'Pago confirmado e inscripción completada',
      data: {
        payment: result.payment,
        entry: result.entry,
        tournament: {
          id: result.tournament.id,
          name: result.tournament.name,
          currentPlayers: result.tournament.currentPlayers,
          prizePool: result.tournament.prizePool
        }
      }
    });

  } catch (error) {
    console.error('Error confirmando pago:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al confirmar pago'
    });
  }
};

// =====================================================
// CANCELAR PAGO PENDIENTE
// =====================================================
exports.cancelPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason = 'Cancelado por el usuario' } = req.body;
    const userId = req.user.id;

    const payment = await Payment.findByPk(paymentId);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Pago no encontrado'
      });
    }

    if (payment.userId !== userId && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para cancelar este pago'
      });
    }

    const cancelledPayment = await PaymentService.cancelPayment(paymentId, reason);

    res.json({
      success: true,
      message: 'Pago cancelado exitosamente',
      data: cancelledPayment
    });

  } catch (error) {
    console.error('Error cancelando pago:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al cancelar pago'
    });
  }
};

// =====================================================
// SIMULAR PAGO (DESARROLLO)
// =====================================================
exports.simulatePayment = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Simulación no disponible en producción'
      });
    }

    const { paymentId } = req.params;
    const { success = true } = req.body;
    const userId = req.user.id;

    const payment = await Payment.findByPk(paymentId);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Pago no encontrado'
      });
    }

    if (payment.userId !== userId && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para simular este pago'
      });
    }

    const result = await PaymentService.simulatePayment(paymentId, success);

    res.json({
      success: true,
      message: success ? 'Pago simulado exitosamente' : 'Fallo de pago simulado',
      data: result
    });

  } catch (error) {
    console.error('Error simulando pago:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al simular pago'
    });
  }
};

// =====================================================
// OBTENER HISTORIAL DE PAGOS DEL USUARIO
// =====================================================
exports.getUserPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, status } = req.query;

    const where = { userId };
    if (status) where.status = status;

    const payments = await Payment.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: payments.rows,
      total: payments.count,
      hasMore: (parseInt(offset) + parseInt(limit)) < payments.count
    });

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial de pagos'
    });
  }
};

// =====================================================
// ADMIN: OBTENER ESTADÍSTICAS DE PAGOS
// =====================================================
exports.getPaymentStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    const stats = await PaymentService.getPaymentStats(period);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de pagos'
    });
  }
};

// =====================================================
// ADMIN: LISTAR TODOS LOS PAGOS
// =====================================================
exports.getAllPayments = async (req, res) => {
  try {
    const { 
      status, 
      method, 
      userId, 
      dateFrom, 
      dateTo, 
      limit = 50, 
      offset = 0 
    } = req.query;

    const where = {};
    
    if (status) where.status = status;
    if (method) where.method = method;
    if (userId) where.userId = userId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = endDate;
      }
    }

    const payments = await Payment.findAndCountAll({
      where,
      include: [{
        model: User,
        attributes: ['id', 'name', 'email', 'phone']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const totalAmount = await Payment.sum('amount', { where });

    res.json({
      success: true,
      data: payments.rows,
      total: payments.count,
      totalAmount: totalAmount || 0,
      hasMore: (parseInt(offset) + parseInt(limit)) < payments.count
    });

  } catch (error) {
    console.error('Error listando pagos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar pagos'
    });
  }
};

// =====================================================
// ADMIN: PROCESAR REEMBOLSO
// =====================================================
exports.processRefund = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason, amount } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'La razón del reembolso es requerida'
      });
    }

    const result = await PaymentService.processRefund(paymentId, reason, amount);

    res.json({
      success: true,
      message: 'Reembolso procesado exitosamente',
      data: result
    });

  } catch (error) {
    console.error('Error procesando reembolso:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al procesar reembolso'
    });
  }
};

// =====================================================
// ADMIN: LIMPIAR PAGOS ANTIGUOS
// =====================================================
exports.cleanupOldPayments = async (req, res) => {
  try {
    const { daysOld = 7 } = req.body;

    const result = await PaymentService.cleanupOldPendingPayments(daysOld);

    res.json({
      success: true,
      message: `${result.cleaned} pagos antiguos cancelados`,
      data: result
    });

  } catch (error) {
    console.error('Error limpiando pagos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al limpiar pagos antiguos'
    });
  }
};

// =====================================================
// WEBHOOKS (PLACEHOLDERS PARA FUTURA IMPLEMENTACIÓN)
// =====================================================

exports.yapeWebhook = async (req, res) => {
  try {
    // TODO: Implementar webhook de Yape
    console.log('Yape webhook recibido:', req.body);
    
    res.json({
      success: true,
      message: 'Webhook de Yape recibido (pendiente de implementación)'
    });

  } catch (error) {
    console.error('Error en webhook de Yape:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando webhook de Yape'
    });
  }
};

exports.plinWebhook = async (req, res) => {
  try {
    // TODO: Implementar webhook de Plin
    console.log('Plin webhook recibido:', req.body);
    
    res.json({
      success: true,
      message: 'Webhook de Plin recibido (pendiente de implementación)'
    });

  } catch (error) {
    console.error('Error en webhook de Plin:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando webhook de Plin'
    });
  }
};

exports.genericWebhook = async (req, res) => {
  try {
    const { provider } = req.params;
    
    console.log(`Webhook de ${provider} recibido:`, req.body);
    
    res.json({
      success: true,
      message: `Webhook de ${provider} recibido`,
      provider
    });

  } catch (error) {
    console.error('Error en webhook genérico:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando webhook'
    });
  }
};

module.exports = exports;