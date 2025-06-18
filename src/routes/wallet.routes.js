// src/routes/wallet.routes.js
const router = require('express').Router();
const walletController = require('../controllers/wallet.controller');
const requireAuth = require('../middleware/requireAuth.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');

// =====================================================
// RUTAS QUE REQUIEREN AUTENTICACIÓN
// =====================================================
router.use(requireAuth);

// Balance y dashboard
router.get('/balance', walletController.getBalance);
router.get('/dashboard', walletController.getDashboard);

// Historial de transacciones
router.get('/transactions', walletController.getTransactionHistory);

// Depósitos
router.post('/deposits', walletController.createDeposit);
router.get('/deposits', walletController.getUserDeposits);

// Retiros
router.post('/withdrawals', walletController.createWithdrawal);
router.get('/withdrawals', walletController.getUserWithdrawals);
router.put('/withdrawals/:id/cancel', walletController.cancelWithdrawal);

// Información general
router.get('/payment-methods', walletController.getPaymentMethods);
router.get('/stats', walletController.getWalletStats);

// =====================================================
// RUTAS ADMINISTRATIVAS
// =====================================================
router.use(requireAdmin);

// Gestión de depósitos
router.get('/admin/deposits', walletController.getAllDeposits);
router.put('/admin/deposits/:id/approve', walletController.approveDeposit);
router.put('/admin/deposits/:id/reject', walletController.rejectDeposit);

// Gestión de retiros
router.get('/admin/withdrawals', walletController.getAllWithdrawals);
router.put('/admin/withdrawals/:id/process', walletController.processWithdrawal);
router.put('/admin/withdrawals/:id/complete', walletController.completeWithdrawal);

// Ajustes manuales
router.post('/admin/adjustment', walletController.manualAdjustment);

module.exports = router;