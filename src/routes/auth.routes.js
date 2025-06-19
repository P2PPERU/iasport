const router = require('express').Router();
const authController = require('../controllers/auth.controller');

// ✅ WRAPPER SIMPLE PARA MANEJAR ERRORES ASYNC
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ✅ RUTAS SIMPLES - LAS VALIDACIONES ESTÁN EN EL CONTROLLER
router.post('/login', asyncHandler(authController.login));
router.post('/register', asyncHandler(authController.register));

module.exports = router;