// src/routes/payments.routes.js
const router = require('express').Router();
const paymentsController = require('../controllers/payments.controller');
const requireAuth = require('../middleware/requireAuth.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');

// =====================================================
// RUTAS QUE REQUIEREN AUTENTICACIÓN
// =====================================================
router.use(requireAuth);

// Crear orden de pago para torneo
router.post('/tournament/:tournamentId', paymentsController.createTournamentPayment);

// Obtener estado de un pago
router.get('/:paymentId/status', paymentsController.getPaymentStatus);

// Confirmar pago manualmente (para desarrollo)
router.post('/:paymentId/confirm', paymentsController.confirmPayment);

// Cancelar pago pendiente
router.post('/:paymentId/cancel', paymentsController.cancelPayment);

// Obtener historial de pagos del usuario
router.get('/user/history', paymentsController.getUserPayments);

// =====================================================
// SIMULACIÓN DE PAGOS (DESARROLLO)
// =====================================================

// Simular pago exitoso/fallido (solo desarrollo)
router.post('/:paymentId/simulate', paymentsController.simulatePayment);

// =====================================================
// RUTAS ADMINISTRATIVAS
// =====================================================
router.use(requireAdmin);

// Obtener estadísticas de pagos
router.get('/admin/stats', paymentsController.getPaymentStats);

// Listar todos los pagos con filtros
router.get('/admin/list', paymentsController.getAllPayments);

// Procesar reembolso
router.post('/:paymentId/refund', paymentsController.processRefund);

// Limpiar pagos antiguos pendientes
router.post('/admin/cleanup', paymentsController.cleanupOldPayments);

// =====================================================
// WEBHOOKS (NO REQUIEREN AUTENTICACIÓN)
// =====================================================
router.use('/webhook', (req, res, next) => {
  // Remover autenticación para webhooks
  delete req.user;
  next();
});

// Webhook de Yape (cuando esté implementado)
router.post('/webhook/yape', paymentsController.yapeWebhook);

// Webhook de Plin (cuando esté implementado)
router.post('/webhook/plin', paymentsController.plinWebhook);

// Webhook genérico
router.post('/webhook/:provider', paymentsController.genericWebhook);

module.exports = router;