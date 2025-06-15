const router = require('express').Router();
const notificationsController = require('../controllers/notifications.controller');
const requireAuth = require('../middleware/requireAuth.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');

// Ruta pública - obtener clave VAPID
router.get('/vapid-public-key', notificationsController.getVapidPublicKey);

// Rutas que requieren autenticación
router.use(requireAuth);

// Suscripción/Desuscripción
router.post('/subscribe', notificationsController.subscribe);
router.post('/unsubscribe', notificationsController.unsubscribe);

// Notificaciones del usuario
router.post('/test', notificationsController.sendTest);
router.get('/history', notificationsController.getHistory);
router.put('/history/:id/clicked', notificationsController.markAsClicked);

// Rutas administrativas
router.use(requireAdmin);

// Envío masivo
router.post('/broadcast', notificationsController.sendBroadcast);
router.post('/hot-prediction/:predictionId', notificationsController.sendHotPrediction);
router.post('/prediction-result/:predictionId', notificationsController.sendPredictionResult);

module.exports = router;