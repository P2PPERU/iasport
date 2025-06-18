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
  walletController.createDepositRequest
);
router.get('/deposits', walletController.getUserDepositRequests);

// Retiros
router.post('/withdrawals', 
  walletMiddleware.validateCreateWithdrawal,
  walletMiddleware.checkSufficientBalance,
  walletMiddleware.checkDailyWithdrawalLimit,
  walletMiddleware.checkPendingRequests('withdrawal'),
  walletController.createWithdrawalRequest
);
router.get('/withdrawals', walletController.getUserWithdrawalRequests);
router.put('/withdrawals/:id/cancel', walletController.cancelWithdrawal);

// Información general
router.get('/payment-methods', walletController.getPaymentMethods);
router.get('/stats', walletController.getWalletStats);

// =====================================================
// RUTAS ADMINISTRATIVAS
// =====================================================

// Dashboard admin
router.get('/admin/dashboard', requireAdmin, walletController.getAdminDashboard);

// Gestión de depósitos
router.get('/admin/deposits', requireAdmin, walletController.getAllDepositRequests);
router.put('/admin/deposits/:id/approve', 
  requireAdmin,
  walletMiddleware.validateApproveDeposit,
  walletController.approveDeposit
);
router.put('/admin/deposits/:id/reject', requireAdmin, walletController.rejectDeposit);

// Gestión de retiros
router.get('/admin/withdrawals', requireAdmin, walletController.getAllWithdrawalRequests);
router.put('/admin/withdrawals/:id/process', 
  requireAdmin,
  walletMiddleware.validateProcessWithdrawal,
  walletController.processWithdrawal
);
router.put('/admin/withdrawals/:id/complete', requireAdmin, walletController.completeWithdrawal);
router.put('/admin/withdrawals/:id/reject', requireAdmin, walletController.rejectWithdrawal);

// Ajustes manuales
router.post('/admin/adjustment', 
  requireAdmin,
  walletMiddleware.validateManualAdjustment,
  walletController.manualAdjustment
);

module.exports = router;
