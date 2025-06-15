const router = require('express').Router();
const authController = require('../controllers/auth.controller');

// Rutas públicas
router.post('/login', authController.login);
router.post('/register', authController.register);

module.exports = router;