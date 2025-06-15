const cron = require('node-cron');
const NotificationService = require('../services/notification.service');
const { Prediction, User } = require('../models');
const { Op } = require('sequelize');

class NotificationJobs {
  static jobs = [];

  // Inicializar todos los jobs
  static init() {
    console.log('🔔 Iniciando jobs de notificaciones...');

    // Job 1: Notificar predicciones hot (cada hora)
    this.scheduleHotPredictions();

    // Job 2: Notificar resultados (cada 30 minutos)
    this.scheduleResultNotifications();

    // Job 3: Notificar premium por expirar (diario a las 10 AM)
    this.schedulePremiumExpiring();

    // Job 4: Recordatorio diario (diario a las 9 AM)
    this.scheduleDailyReminder();

    console.log(`✅ ${this.jobs.length} jobs de notificaciones activos`);
  }

  // Detener todos los jobs
  static stop() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    console.log('🛑 Jobs de notificaciones detenidos');
  }

  // Job: Notificar predicciones hot nuevas
  static scheduleHotPredictions() {
    const job = cron.schedule('0 * * * *', async () => {
      console.log('🔥 Verificando predicciones hot nuevas...');
      
      try {
        // Buscar predicciones hot creadas en la última hora
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);

        const hotPredictions = await Prediction.findAll({
          where: {
            isHot: true,
            created_at: { [Op.gte]: oneHourAgo },
            status: 'ACTIVE',
            matchTime: { [Op.gte]: new Date() } // Solo futuras
          }
        });

        console.log(`   Encontradas: ${hotPredictions.length} predicciones hot nuevas`);

        for (const prediction of hotPredictions) {
          try {
            const result = await NotificationService.sendHotPrediction(prediction.id);
            console.log(`   ✅ Notificación enviada para: ${prediction.match}`);
            console.log(`      Enviadas: ${result.sent}, Fallidas: ${result.failed}`);
          } catch (error) {
            console.error(`   ❌ Error enviando notificación:`, error.message);
          }
        }
      } catch (error) {
        console.error('❌ Error en job de predicciones hot:', error);
      }
    });

    job.start();
    this.jobs.push(job);
  }

  // Job: Notificar resultados de predicciones
  static scheduleResultNotifications() {
    const job = cron.schedule('*/30 * * * *', async () => {
      console.log('📊 Verificando resultados nuevos...');
      
      try {
        // Buscar predicciones con resultados actualizados recientemente
        const thirtyMinutesAgo = new Date();
        thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

        const predictionsWithResults = await Prediction.findAll({
          where: {
            result: { [Op.in]: ['WON', 'LOST'] },
            updated_at: { [Op.gte]: thirtyMinutesAgo },
            // Evitar notificar dos veces
            '$notificationHistory.id$': null
          },
          include: [{
            model: NotificationHistory,
            where: {
              type: 'prediction_result'
            },
            required: false
          }]
        });

        console.log(`   Encontrados: ${predictionsWithResults.length} resultados nuevos`);

        for (const prediction of predictionsWithResults) {
          try {
            const result = await NotificationService.sendPredictionResult(prediction.id);
            console.log(`   ✅ Resultado notificado: ${prediction.match} - ${prediction.result}`);
            console.log(`      Enviadas: ${result.sent}, Fallidas: ${result.failed}`);
          } catch (error) {
            console.error(`   ❌ Error enviando resultado:`, error.message);
          }
        }
      } catch (error) {
        console.error('❌ Error en job de resultados:', error);
      }
    });

    job.start();
    this.jobs.push(job);
  }

  // Job: Notificar premium por expirar
  static schedulePremiumExpiring() {
    const job = cron.schedule('0 10 * * *', async () => {
      console.log('⏰ Verificando suscripciones premium por expirar...');
      
      try {
        const result = await NotificationService.notifyExpiringPremium();
        console.log(`   ✅ Notificaciones enviadas: ${result.sent}`);
        console.log(`   ❌ Notificaciones fallidas: ${result.failed}`);
      } catch (error) {
        console.error('❌ Error en job de premium expiring:', error);
      }
    });

    job.start();
    this.jobs.push(job);
  }

  // Job: Recordatorio diario
  static scheduleDailyReminder() {
    const job = cron.schedule('0 9 * * *', async () => {
      console.log('📅 Enviando recordatorios diarios...');
      
      try {
        // Buscar usuarios activos con notificaciones habilitadas
        const users = await User.findAll({
          where: {
            isVerified: true,
            'preferences.notifications': true,
            lastLogin: {
              [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Activos en últimos 30 días
            }
          },
          include: [{
            model: PushSubscription,
            where: { isActive: true },
            required: true
          }]
        });

        const userIds = users.map(u => u.id);
        console.log(`   Usuarios elegibles: ${userIds.length}`);

        // Verificar si hay predicciones interesantes hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayPredictions = await Prediction.count({
          where: {
            matchTime: { [Op.between]: [today, tomorrow] },
            confidence: { [Op.gte]: 80 },
            status: 'ACTIVE'
          }
        });

        if (todayPredictions > 0) {
          const result = await NotificationService.sendToUsers(
            userIds,
            NotificationService.NOTIFICATION_TYPES.DAILY_REMINDER,
            {
              predictionsCount: todayPredictions
            }
          );

          console.log(`   ✅ Recordatorios enviados: ${result.sent}`);
          console.log(`   ❌ Recordatorios fallidos: ${result.failed}`);
        } else {
          console.log('   ℹ️ No hay predicciones destacadas hoy, saltando recordatorio');
        }
      } catch (error) {
        console.error('❌ Error en job de recordatorio diario:', error);
      }
    });

    job.start();
    this.jobs.push(job);
  }

  // Job manual: Limpiar suscripciones inactivas
  static async cleanupInactiveSubscriptions() {
    console.log('🧹 Limpiando suscripciones inactivas...');
    
    try {
      // Eliminar suscripciones inactivas por más de 90 días
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const deleted = await PushSubscription.destroy({
        where: {
          isActive: false,
          updated_at: { [Op.lte]: ninetyDaysAgo }
        }
      });

      console.log(`   ✅ ${deleted} suscripciones inactivas eliminadas`);

      // Limpiar historial antiguo (más de 6 meses)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const historyDeleted = await NotificationHistory.destroy({
        where: {
          sent_at: { [Op.lte]: sixMonthsAgo }
        }
      });

      console.log(`   ✅ ${historyDeleted} registros de historial antiguos eliminados`);
    } catch (error) {
      console.error('❌ Error en limpieza:', error);
    }
  }

  // Estadísticas de notificaciones
  static async getStats() {
    try {
      const stats = {
        activeSubscriptions: await PushSubscription.count({ where: { isActive: true } }),
        totalNotificationsSent: await NotificationHistory.count(),
        notificationsLast24h: await NotificationHistory.count({
          where: {
            sent_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        deliveredRate: 0,
        clickRate: 0
      };

      // Calcular tasas
      const delivered = await NotificationHistory.count({ where: { delivered: true } });
      const clicked = await NotificationHistory.count({ where: { clicked: true } });
      
      if (stats.totalNotificationsSent > 0) {
        stats.deliveredRate = ((delivered / stats.totalNotificationsSent) * 100).toFixed(2);
        stats.clickRate = ((clicked / stats.totalNotificationsSent) * 100).toFixed(2);
      }

      return stats;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }
}

// Exportar clase y método para iniciar
module.exports = NotificationJobs;

// Si se ejecuta directamente, mostrar estadísticas
if (require.main === module) {
  console.log('📊 Estadísticas de Notificaciones:\n');
  NotificationJobs.getStats()
    .then(stats => {
      console.table(stats);
      process.exit(0);
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}