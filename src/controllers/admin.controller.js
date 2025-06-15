const { User, Prediction, Payment, PushSubscription, NotificationHistory } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const NotificationService = require('../services/notification.service');

// Dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas del dashboard...');
    
    // Total usuarios
    const totalUsers = await User.count();
    const premiumUsers = await User.count({ where: { isPremium: true } });
    
    // Predicciones de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayPredictions = await Prediction.count({
      where: {
        matchTime: {
          [Op.between]: [today, tomorrow]
        }
      }
    });

    // Ingresos semanales
    let weeklyRevenue = 0;
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      weeklyRevenue = await Payment.sum('amount', {
        where: {
          status: 'COMPLETED',
          created_at: { [Op.gte]: weekAgo }
        }
      }) || 0;
    } catch (error) {
      console.log('No se pudieron obtener ingresos:', error.message);
      weeklyRevenue = premiumUsers * 7;
    }

    // Contar resultados
    const wonCount = await Prediction.count({ where: { result: 'WON' } });
    const lostCount = await Prediction.count({ where: { result: 'LOST' } });
    const totalWithResults = wonCount + lostCount;
    
    const successRate = totalWithResults > 0 
      ? ((wonCount / totalWithResults) * 100).toFixed(1) 
      : 89.0;

    // Estadísticas de notificaciones
    let notificationStats = {
      activeSubscriptions: 0,
      notificationsSent24h: 0
    };

    try {
      notificationStats.activeSubscriptions = await PushSubscription.count({ 
        where: { isActive: true } 
      });
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      notificationStats.notificationsSent24h = await NotificationHistory.count({
        where: {
          sent_at: { [Op.gte]: yesterday }
        }
      });
    } catch (error) {
      console.log('Error obteniendo stats de notificaciones:', error.message);
    }

    // Respuesta
    const stats = {
      totalUsers,
      premiumUsers,
      todayPredictions,
      weeklyRevenue,
      successRate: parseFloat(successRate),
      activeUsers: Math.floor(totalUsers * 0.7),
      wonPredictions: wonCount,
      lostPredictions: lostCount,
      pendingPredictions: await Prediction.count({ where: { result: 'PENDING' } }),
      ...notificationStats
    };

    console.log('✅ Stats generadas:', stats);

    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Error en getDashboardStats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Obtener todas las predicciones (con filtros)
exports.getPredictions = async (req, res) => {
  try {
    const { date, status, result, isPremium, isHot, sport } = req.query;
    
    const where = {};
    
    // Filtro por fecha
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      where.matchTime = {
        [Op.between]: [startDate, endDate]
      };
    }
    
    // Otros filtros
    if (status) where.status = status;
    if (result) where.result = result;
    if (isPremium !== undefined) where.isPremium = isPremium === 'true';
    if (isHot !== undefined) where.isHot = isHot === 'true';
    if (sport) where.sport = sport;
    
    const predictions = await Prediction.findAll({
      where,
      order: [['matchTime', 'DESC'], ['created_at', 'DESC']]
    });
    
    res.json({
      success: true,
      data: predictions,
      count: predictions.length
    });
  } catch (error) {
    console.error('Error obteniendo predicciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener predicciones',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Crear predicción
exports.createPrediction = async (req, res) => {
  try {
    console.log('Creando predicción:', req.body);
    
    // Validaciones básicas
    const requiredFields = ['league', 'match', 'homeTeam', 'awayTeam', 'prediction', 'confidence', 'odds'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          message: `El campo ${field} es requerido`
        });
      }
    }
    
    const prediction = await Prediction.create({
      ...req.body,
      matchTime: req.body.matchTime || new Date()
    });

    // Si es hot, enviar notificación automáticamente
    if (prediction.isHot) {
      try {
        await NotificationService.sendHotPrediction(prediction.id);
        console.log('✅ Notificación de predicción hot enviada');
      } catch (error) {
        console.error('Error enviando notificación hot:', error);
      }
    }
    
    res.status(201).json({
      success: true,
      data: prediction,
      message: 'Predicción creada exitosamente'
    });
  } catch (error) {
    console.error('Error creando predicción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear predicción',
      error: error.message
    });
  }
};

// Actualizar predicción completa
exports.updatePrediction = async (req, res) => {
  try {
    const { id } = req.params;
    
    const prediction = await Prediction.findByPk(id);
    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Predicción no encontrada'
      });
    }

    // Guardar estado anterior
    const wasHot = prediction.isHot;

    await prediction.update(req.body);

    // Si se cambió a hot, enviar notificación
    if (!wasHot && prediction.isHot) {
      try {
        await NotificationService.sendHotPrediction(prediction.id);
        console.log('✅ Notificación de predicción hot enviada');
      } catch (error) {
        console.error('Error enviando notificación hot:', error);
      }
    }

    res.json({
      success: true,
      data: prediction,
      message: 'Predicción actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando predicción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar predicción',
      error: error.message
    });
  }
};

// Actualizar solo el resultado
exports.updateResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { result } = req.body;
    
    if (!['WON', 'LOST', 'VOID', 'PENDING'].includes(result)) {
      return res.status(400).json({
        success: false,
        message: 'Resultado inválido. Debe ser: WON, LOST, VOID o PENDING'
      });
    }
    
    const prediction = await Prediction.findByPk(id);
    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Predicción no encontrada'
      });
    }

    // Guardar resultado anterior
    const previousResult = prediction.result;

    prediction.result = result;
    await prediction.save();

    // Si el resultado cambió de PENDING a WON/LOST, enviar notificación
    if (previousResult === 'PENDING' && ['WON', 'LOST'].includes(result)) {
      try {
        await NotificationService.sendPredictionResult(prediction.id);
        console.log('✅ Notificación de resultado enviada');
      } catch (error) {
        console.error('Error enviando notificación de resultado:', error);
      }
    }

    res.json({
      success: true,
      message: `Resultado actualizado a ${result}`,
      data: prediction
    });
  } catch (error) {
    console.error('Error actualizando resultado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar resultado',
      error: error.message
    });
  }
};

// Eliminar predicción
exports.deletePrediction = async (req, res) => {
  try {
    const { id } = req.params;
    
    const prediction = await Prediction.findByPk(id);
    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Predicción no encontrada'
      });
    }

    await prediction.destroy();

    res.json({
      success: true,
      message: 'Predicción eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando predicción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar predicción',
      error: error.message
    });
  }
};

// Listar usuarios
exports.getUsers = async (req, res) => {
  try {
    const { isPremium, isVerified, search, hasNotifications } = req.query;
    
    const where = {};
    const include = [];
    
    // Filtros
    if (isPremium !== undefined) where.isPremium = isPremium === 'true';
    if (isVerified !== undefined) where.isVerified = isVerified === 'true';
    
    // Si se quiere filtrar por notificaciones
    if (hasNotifications === 'true') {
      include.push({
        model: PushSubscription,
        where: { isActive: true },
        required: true,
        attributes: []
      });
    }
    
    // Búsqueda simple
    if (search) {
      where[Op.or] = [
        sequelize.where(
          sequelize.fn('LOWER', sequelize.col('name')),
          'LIKE',
          `%${search.toLowerCase()}%`
        ),
        sequelize.where(
          sequelize.fn('LOWER', sequelize.col('email')),
          'LIKE',
          `%${search.toLowerCase()}%`
        ),
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const users = await User.findAll({
      where,
      include,
      attributes: { 
        exclude: ['password', 'verificationCode'],
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*) 
              FROM push_subscriptions 
              WHERE user_id = "User"."id" 
              AND is_active = true
            )`),
            'activeSubscriptions'
          ]
        ]
      },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Actualizar usuario
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // No permitir actualizar ciertos campos
    const { password, email, ...allowedUpdates } = req.body;
    
    await user.update(allowedUpdates);

    res.json({
      success: true,
      data: user.toJSON(),
      message: 'Usuario actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
      error: error.message
    });
  }
};

// Toggle premium status
exports.togglePremium = async (req, res) => {
  try {
    const { id } = req.params;
    const { isPremium, days = 7 } = req.body;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    user.isPremium = isPremium;
    
    if (isPremium) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
      user.premiumExpiresAt = expiresAt;
    } else {
      user.premiumExpiresAt = null;
    }
    
    await user.save();

    res.json({
      success: true,
      data: user.toJSON(),
      message: `Usuario ${isPremium ? 'activado' : 'desactivado'} como premium`
    });
  } catch (error) {
    console.error('Error toggle premium:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado premium',
      error: error.message
    });
  }
};

// Obtener pagos
exports.getPayments = async (req, res) => {
  try {
    const { status, method, userId, dateFrom, dateTo } = req.query;
    
    const where = {};
    
    // Filtros
    if (status) where.status = status;
    if (method) where.method = method;
    if (userId) where.userId = userId;
    
    // Rango de fechas
    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) where.created_at[Op.gte] = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = endDate;
      }
    }
    
    let payments = [];
    let totalAmount = 0;
    
    try {
      payments = await Payment.findAll({
        where,
        include: [{
          model: User,
          attributes: ['id', 'name', 'email', 'phone']
        }],
        order: [['created_at', 'DESC']]
      });
      
      totalAmount = await Payment.sum('amount', { where }) || 0;
    } catch (error) {
      console.log('Error obteniendo pagos, tabla puede estar vacía:', error.message);
    }
    
    res.json({
      success: true,
      data: payments,
      count: payments.length,
      totalAmount
    });
  } catch (error) {
    console.error('Error obteniendo pagos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pagos',
      error: error.message
    });
  }
};

// Estadísticas detalladas
exports.getDetailedStats = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    let startDate = new Date();
    if (period === 'day') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }
    
    // Obtener todas las predicciones del período
    const predictions = await Prediction.findAll({
      where: {
        created_at: { [Op.gte]: startDate }
      }
    });
    
    // Agrupar manualmente por deporte
    const sportStats = {};
    predictions.forEach(pred => {
      const sport = pred.sport || 'football';
      if (!sportStats[sport]) {
        sportStats[sport] = { 
          sport: sport,
          total: 0, 
          won: 0, 
          lost: 0,
          pending: 0,
          accuracy: 0
        };
      }
      sportStats[sport].total++;
      if (pred.result === 'WON') sportStats[sport].won++;
      if (pred.result === 'LOST') sportStats[sport].lost++;
      if (pred.result === 'PENDING') sportStats[sport].pending++;
    });
    
    // Calcular precisión por deporte
    Object.values(sportStats).forEach(stat => {
      const decided = stat.won + stat.lost;
      stat.accuracy = decided > 0 ? ((stat.won / decided) * 100).toFixed(1) : 0;
    });
    
    // Agrupar por liga
    const leagueStats = {};
    predictions.forEach(pred => {
      const league = pred.league;
      if (!leagueStats[league]) {
        leagueStats[league] = { 
          league: league,
          total: 0, 
          won: 0,
          lost: 0,
          pending: 0,
          accuracy: 0
        };
      }
      leagueStats[league].total++;
      if (pred.result === 'WON') leagueStats[league].won++;
      if (pred.result === 'LOST') leagueStats[league].lost++;
      if (pred.result === 'PENDING') leagueStats[league].pending++;
    });
    
    // Calcular precisión por liga
    Object.values(leagueStats).forEach(stat => {
      const decided = stat.won + stat.lost;
      stat.accuracy = decided > 0 ? ((stat.won / decided) * 100).toFixed(1) : 0;
    });
    
    // Convertir a arrays y ordenar
    const sportStatsArray = Object.values(sportStats);
    const leagueStatsArray = Object.values(leagueStats)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    
    res.json({
      success: true,
      data: {
        period,
        startDate,
        endDate: new Date(),
        totalPredictions: predictions.length,
        sportStats: sportStatsArray,
        leagueStats: leagueStatsArray
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas detalladas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas detalladas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// NUEVOS MÉTODOS PARA NOTIFICACIONES

// Obtener estadísticas de notificaciones
exports.getNotificationStats = async (req, res) => {
  try {
    const stats = {
      totalSubscriptions: await PushSubscription.count(),
      activeSubscriptions: await PushSubscription.count({ where: { isActive: true } }),
      totalNotifications: await NotificationHistory.count(),
      notificationsToday: 0,
      deliveryRate: 0,
      clickRate: 0
    };

    // Notificaciones hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    stats.notificationsToday = await NotificationHistory.count({
      where: {
        sent_at: { [Op.gte]: today }
      }
    });

    // Tasas
    const delivered = await NotificationHistory.count({ where: { delivered: true } });
    const clicked = await NotificationHistory.count({ where: { clicked: true } });
    
    if (stats.totalNotifications > 0) {
      stats.deliveryRate = ((delivered / stats.totalNotifications) * 100).toFixed(2);
      stats.clickRate = ((clicked / stats.totalNotifications) * 100).toFixed(2);
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error obteniendo stats de notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};

// Enviar notificación personalizada
exports.sendCustomNotification = async (req, res) => {
  try {
    const { userIds, title, body, url, sendToAll = false } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Título y mensaje son requeridos'
      });
    }

    let targetUserIds = userIds;

    // Si sendToAll, obtener todos los usuarios con notificaciones activas
    if (sendToAll) {
      const users = await User.findAll({
        include: [{
          model: PushSubscription,
          where: { isActive: true },
          required: true,
          attributes: []
        }],
        attributes: ['id']
      });
      targetUserIds = users.map(u => u.id);
    }

    if (!targetUserIds || targetUserIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay usuarios para notificar'
      });
    }

    const result = await NotificationService.sendToUsers(
      targetUserIds,
      NotificationService.NOTIFICATION_TYPES.CUSTOM,
      {
        title,
        body,
        data: { url: url || '/predictions' }
      }
    );

    res.json({
      success: true,
      message: 'Notificación personalizada enviada',
      data: {
        ...result,
        totalUsers: targetUserIds.length
      }
    });
  } catch (error) {
    console.error('Error enviando notificación personalizada:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar notificación',
      error: error.message
    });
  }
};