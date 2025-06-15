const router = require('express').Router();
const usersController = require('../controllers/users.controller');
const requireAuth = require('../middleware/requireAuth.middleware');

// Todas las rutas requieren autenticación
router.use(requireAuth);

router.get('/profile', usersController.getProfile);
router.put('/preferences', usersController.updatePreferences);

module.exports = router;