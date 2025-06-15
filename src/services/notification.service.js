const { webpush } = require('../config/webpush');
const { PushSubscription, NotificationHistory, User, Prediction } = require('../models');
const { Op } = require('sequelize');

class NotificationService {
  // Tipos de notificaciones
  static NOTIFICATION_TYPES = {
    HOT_PREDICTION: 'hot_prediction',
    PREDICTION_RESULT: 'prediction_result',
    PREMIUM_EXPIRING: 'premium_expiring',
    DAILY_REMINDER: 'daily_reminder',
    CUSTOM: 'custom'
  };

  // Templates de notificaciones
  static getNotificationTemplate(type, data) {
    const templates = {
      hot_prediction: {
        title: '🔥 Predicción Caliente!',
        body: `${data.match} - ${data.prediction} (${data.confidence}% confianza)`,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        vibrate: [200, 100, 200],
        data: {
          type: 'hot_prediction',
          predictionId: data.predictionId,
          url: `/predictions/${data.predictionId}`
        }
      },
      prediction_result: {
        title: data.won ? '✅ Predicción Ganada!' : '❌ Predicción Perdida',
        body: `${data.match}: ${data.result}`,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: {
          type: 'prediction_result',
          predictionId: data.predictionId,
          url: `/predictions/${data.predictionId}/result`
        }
      },
      premium_expiring: {
        title: '⏰ Tu Premium está por expirar',
        body: `Tu suscripción premium expira en ${data.daysLeft} días. ¡Renueva ahora!`,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        actions: [
          {
            action: 'renew',
            title: 'Renovar'
          },
          {
            action: 'later',
            title: 'Más tarde'
          }
        ],
        data: {
          type: 'premium_expiring',
          url: '/premium'
        }
      },
      daily_reminder: {
        title: '📊 Nuevas Predicciones Disponibles',
        body: 'Revisa las predicciones de hoy con alta confianza',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: {
          type: 'daily_reminder',
          url: '/predictions'
        }
      },
      custom: {
        title: data.title,
        body: data.body,
        icon: data.icon || '/icon-192x192.png',
        badge: data.badge || '/badge-72x72.png',
        data: data.data || {}
      }
    };

    return templates[type] || templates.custom;
  }

  // Suscribir dispositivo
  static async subscribe(userId, subscription, deviceType = 'web') {
    try {
      // Verificar si ya existe
      const existing = await PushSubscription.findOne({
        where: {
          userId,
          endpoint: subscription.endpoint
        }
      });

      if (existing) {
        // Actualizar si existe
        existing.p256dh = subscription.keys.p256dh;
        existing.auth = subscription.keys.auth;
        existing.isActive = true;
        existing.lastUsed = new Date();
        await existing.save();
        return existing;
      }

      // Crear nueva suscripción
      const newSubscription = await PushSubscription.create({
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        deviceType,
        isActive: true
      });

      return newSubscription;
    } catch (error) {
      console.error('Error al suscribir:', error);
      throw error;
    }
  }

  // Desuscribir dispositivo
  static async unsubscribe(userId, endpoint) {
    try {
      const subscription = await PushSubscription.findOne({
        where: { userId, endpoint }
      });

      if (subscription) {
        subscription.isActive = false;
        await subscription.save();
      }

      return true;
    } catch (error) {
      console.error('Error al desuscribir:', error);
      throw error;
    }
  }

  // Enviar notificación a un usuario
  static async sendToUser(userId, type, data) {
    try {
      // Obtener suscripciones activas del usuario
      const subscriptions = await PushSubscription.findAll({
        where: {
          userId,
          isActive: true
        }
      });

      if (subscriptions.length === 0) {
        console.log(`Usuario ${userId} no tiene suscripciones activas`);
        return { sent: 0, failed: 0 };
      }

      // Obtener template
      const notification = this.getNotificationTemplate(type, data);

      let sent = 0;
      let failed = 0;

      // Enviar a cada dispositivo
      for (const sub of subscriptions) {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          };

          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(notification)
          );

          sent++;
          
          // Actualizar última vez usada
          sub.lastUsed = new Date();
          await sub.save();

        } catch (error) {
          failed++;
          console.error(`Error enviando a ${sub.endpoint}:`, error);
          
          // Si el error es 410 (Gone), desactivar suscripción
          if (error.statusCode === 410) {
            sub.isActive = false;
            await sub.save();
          }
        }
      }

      // Guardar en historial
      await NotificationHistory.create({
        userId,
        type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        delivered: sent > 0
      });

      return { sent, failed };
    } catch (error) {
      console.error('Error enviando notificación:', error);
      throw error;
    }
  }

  // Enviar a múltiples usuarios
  static async sendToUsers(userIds, type, data) {
    const results = {
      total: userIds.length,
      sent: 0,
      failed: 0
    };

    for (const userId of userIds) {
      try {
        const result = await this.sendToUser(userId, type, data);
        results.sent += result.sent;
        results.failed += result.failed;
      } catch (error) {
        results.failed++;
      }
    }

    return results;
  }

  // Enviar notificación de predicción hot
  static async sendHotPrediction(predictionId) {
    try {
      const prediction = await Prediction.findByPk(predictionId);
      if (!prediction || !prediction.isHot) {
        throw new Error('Predicción no encontrada o no es hot');
      }

      // Obtener usuarios con notificaciones activas
      const users = await User.findAll({
        include: [{
          model: PushSubscription,
          where: { isActive: true },
          required: true
        }],
        where: {
          isPremium: true, // Solo premium para predicciones hot
          'preferences.notifications': true
        }
      });

      const userIds = users.map(u => u.id);
      
      const data = {
        predictionId: prediction.id,
        match: prediction.match,
        prediction: prediction.prediction,
        confidence: prediction.confidence
      };

      return await this.sendToUsers(
        userIds,
        this.NOTIFICATION_TYPES.HOT_PREDICTION,
        data
      );
    } catch (error) {
      console.error('Error enviando predicción hot:', error);
      throw error;
    }
  }

  // Enviar resultados de predicción
  static async sendPredictionResult(predictionId) {
    try {
      const prediction = await Prediction.findByPk(predictionId);
      if (!prediction || prediction.result === 'PENDING') {
        throw new Error('Predicción no encontrada o sin resultado');
      }

      // Buscar usuarios que desbloquearon esta predicción
      const unlockedPredictions = await UnlockedPrediction.findAll({
        where: { predictionId },
        include: [{
          model: User,
          include: [{
            model: PushSubscription,
            where: { isActive: true },
            required: true
          }]
        }]
      });

      const userIds = unlockedPredictions.map(up => up.userId);
      
      const data = {
        predictionId: prediction.id,
        match: prediction.match,
        result: prediction.result,
        won: prediction.result === 'WON'
      };

      return await this.sendToUsers(
        userIds,
        this.NOTIFICATION_TYPES.PREDICTION_RESULT,
        data
      );
    } catch (error) {
      console.error('Error enviando resultado:', error);
      throw error;
    }
  }

  // Notificar premium por expirar
  static async notifyExpiringPremium() {
    try {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const users = await User.findAll({
        where: {
          isPremium: true,
          premiumExpiresAt: {
            [Op.lte]: threeDaysFromNow,
            [Op.gte]: new Date()
          }
        },
        include: [{
          model: PushSubscription,
          where: { isActive: true },
          required: true
        }]
      });

      const results = { sent: 0, failed: 0 };

      for (const user of users) {
        const daysLeft = Math.ceil(
          (user.premiumExpiresAt - new Date()) / (1000 * 60 * 60 * 24)
        );

        const result = await this.sendToUser(
          user.id,
          this.NOTIFICATION_TYPES.PREMIUM_EXPIRING,
          { daysLeft }
        );

        results.sent += result.sent;
        results.failed += result.failed;
      }

      return results;
    } catch (error) {
      console.error('Error notificando premium por expirar:', error);
      throw error;
    }
  }

  // Obtener historial de notificaciones
  static async getHistory(userId, limit = 50) {
    try {
      const history = await NotificationHistory.findAll({
        where: { userId },
        order: [['sent_at', 'DESC']],
        limit
      });

      return history;
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      throw error;
    }
  }

  // Marcar notificación como clickeada
  static async markAsClicked(notificationId) {
    try {
      const notification = await NotificationHistory.findByPk(notificationId);
      if (notification) {
        notification.clicked = true;
        await notification.save();
      }
      return notification;
    } catch (error) {
      console.error('Error marcando como clickeada:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;