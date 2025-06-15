const NotificationService = require('../services/notification.service');
const { vapidPublicKey } = require('../config/webpush');

// Obtener clave pública VAPID
exports.getVapidPublicKey = (req, res) => {
  res.json({
    success: true,
    publicKey: vapidPublicKey
  });
};

// Suscribir dispositivo a notificaciones
exports.subscribe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida'
      });
    }

    const { subscription, deviceType = 'web' } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Suscripción inválida'
      });
    }

    const result = await NotificationService.subscribe(
      req.user.id,
      subscription,
      deviceType
    );

    res.json({
      success: true,
      message: 'Dispositivo suscrito exitosamente',
      data: {
        id: result.id,
        endpoint: result.endpoint
      }
    });
  } catch (error) {
    console.error('Error en subscribe:', error);
    res.status(500).json({
      success: false,
      message: 'Error al suscribir dispositivo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Desuscribir dispositivo
exports.unsubscribe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida'
      });
    }

    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Endpoint requerido'
      });
    }

    await NotificationService.unsubscribe(req.user.id, endpoint);

    res.json({
      success: true,
      message: 'Dispositivo desuscrito exitosamente'
    });
  } catch (error) {
    console.error('Error en unsubscribe:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desuscribir dispositivo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Enviar notificación de prueba
exports.sendTest = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida'
      });
    }

    const result = await NotificationService.sendToUser(
      req.user.id,
      NotificationService.NOTIFICATION_TYPES.CUSTOM,
      {
        title: '🎉 Notificaciones Activadas!',
        body: 'Recibirás alertas de predicciones hot y resultados',
        data: { test: true }
      }
    );

    res.json({
      success: true,
      message: 'Notificación de prueba enviada',
      data: result
    });
  } catch (error) {
    console.error('Error enviando test:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar notificación',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Obtener historial de notificaciones
exports.getHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida'
      });
    }

    const { limit = 50 } = req.query;
    const history = await NotificationService.getHistory(req.user.id, parseInt(limit));

    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Marcar notificación como clickeada
exports.markAsClicked = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await NotificationService.markAsClicked(id);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Notificación marcada como clickeada'
    });
  } catch (error) {
    console.error('Error marcando notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar notificación',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ADMIN: Enviar notificación masiva
exports.sendBroadcast = async (req, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado'
      });
    }

    const { userIds, type, data } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lista de usuarios requerida'
      });
    }

    const result = await NotificationService.sendToUsers(userIds, type, data);

    res.json({
      success: true,
      message: 'Notificaciones enviadas',
      data: result
    });
  } catch (error) {
    console.error('Error en broadcast:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar notificaciones',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ADMIN: Enviar notificación de predicción hot
exports.sendHotPrediction = async (req, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado'
      });
    }

    const { predictionId } = req.params;
    
    const result = await NotificationService.sendHotPrediction(predictionId);

    res.json({
      success: true,
      message: 'Notificación de predicción hot enviada',
      data: result
    });
  } catch (error) {
    console.error('Error enviando hot prediction:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar notificación',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ADMIN: Enviar resultado de predicción
exports.sendPredictionResult = async (req, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado'
      });
    }

    const { predictionId } = req.params;
    
    const result = await NotificationService.sendPredictionResult(predictionId);

    res.json({
      success: true,
      message: 'Notificación de resultado enviada',
      data: result
    });
  } catch (error) {
    console.error('Error enviando resultado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar notificación',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};