const router = require('express').Router();
const authController = require('../controllers/auth.controller');

// Solo login y registro
router.post('/login', authController.login);
router.post('/register', authController.register);

module.exports = router;