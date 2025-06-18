// src/routes/wallet.routes.js
const router = require('express').Router();
const walletController = require('../controllers/wallet.controller');
const requireAuth = require('../middleware/requireAuth.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');
const walletMiddleware = require('../middleware/wallet.middleware');

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
router.post('/deposits', 
  walletMiddleware.validateCreateDeposit,
  walletMiddleware.checkPendingRequests('deposit'),
  walletController.createDeposit
);
router.get('/deposits', walletController.getUserDeposits);

// Retiros
router.post('/withdrawals', 
  walletMiddleware.validateCreateWithdrawal,
  walletMiddleware.checkSufficientBalance,
  walletMiddleware.checkDailyWithdrawalLimit,
  walletMiddleware.checkPendingRequests('withdrawal'),
  walletController.createWithdrawal
);
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
router.put('/admin/deposits/:id/approve', 
  walletMiddleware.validateApproveDeposit,
  walletController.approveDeposit
);
router.put('/admin/deposits/:id/reject', walletController.rejectDeposit);

// Gestión de retiros
router.get('/admin/withdrawals', walletController.getAllWithdrawals);
router.put('/admin/withdrawals/:id/process', 
  walletMiddleware.validateProcessWithdrawal,
  walletController.processWithdrawal
);
router.put('/admin/withdrawals/:id/complete', walletController.completeWithdrawal);

// Ajustes manuales
router.post('/admin/adjustment', 
  walletMiddleware.validateManualAdjustment,
  walletController.manualAdjustment
);

module.exports = router;