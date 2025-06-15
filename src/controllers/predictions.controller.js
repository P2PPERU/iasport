// src/controllers/predictions.controller.js
const { Prediction, UnlockedPrediction, User } = require('../models');
const { Op } = require('sequelize');

// Obtener predicciones del día
exports.getTodayPredictions = async (req, res) => {
  try {
    const now = new Date();
    
    // Buscar predicciones desde ahora hasta 24 horas en el futuro
    const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const predictions = await Prediction.findAll({
      where: {
        matchTime: {
          [Op.between]: [now, endTime] // Desde ahora hasta 24 horas después
        },
        status: 'ACTIVE'
      },
      order: [['matchTime', 'ASC'], ['confidence', 'DESC']]
    });

    // Si hay usuario autenticado, obtener sus predicciones desbloqueadas
    let unlockedPredictionIds = [];
    let freeViewsLeft = 0;
    
    if (req.user) {
      const unlocked = await UnlockedPrediction.findAll({
        where: { userId: req.user.id },
        attributes: ['predictionId']
      });
      unlockedPredictionIds = unlocked.map(u => u.predictionId);
      
      // Obtener vistas gratis del usuario
      const user = await User.findByPk(req.user.id);
      freeViewsLeft = user.freeViewsLeft || 0;
    }

    const canViewPremium = req.user && (req.user.isPremium || req.user.isAdmin);

    const formattedPredictions = predictions.map(pred => {
      const data = pred.toJSON();
      
      // Si es premium y el usuario NO puede verlas (no es premium/admin y no la desbloqueó)
      if (data.isPremium && !canViewPremium && !unlockedPredictionIds.includes(data.id)) {
        return {
          ...data,
          prediction: '🔒 Premium',
          odds: null,
          confidence: null,
          locked: true
        };
      }
      
      return {
        ...data,
        locked: false,
        unlocked: unlockedPredictionIds.includes(data.id)
      };
    });

    res.json({
      success: true,
      data: formattedPredictions,
      count: predictions.length,
      freeViewsLeft: freeViewsLeft,
      isPremium: req.user?.isPremium || false
    });
  } catch (error) {
    console.error('Error obteniendo predicciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener predicciones'
    });
  }
};

// Obtener una predicción por ID
exports.getPrediction = async (req, res) => {
  try {
    const { id } = req.params;
    
    const prediction = await Prediction.findByPk(id);
    
    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Predicción no encontrada'
      });
    }

    // Incrementar vistas
    prediction.views += 1;
    await prediction.save();

    const canViewPremium = req.user && (req.user.isPremium || req.user.isAdmin);
    const data = prediction.toJSON();

    // Si es premium y el usuario NO puede verla
    if (data.isPremium && !canViewPremium) {
      data.prediction = '🔒 Premium';
      data.odds = null;
      data.confidence = null;
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener predicción'
    });
  }
};

// Desbloquear predicción con video
exports.unlockPrediction = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Debes iniciar sesión para desbloquear predicciones'
      });
    }

    const userId = req.user.id;

    // Verificar si ya está desbloqueada
    const existingUnlock = await UnlockedPrediction.findOne({
      where: { userId, predictionId: id }
    });

    if (existingUnlock) {
      return res.status(400).json({
        success: false,
        message: 'Predicción ya desbloqueada'
      });
    }

    // Verificar límite diario
    const user = await User.findByPk(userId);
    
    // Resetear si es un nuevo día
    const today = new Date().toDateString();
    const lastReset = user.lastFreeViewReset ? new Date(user.lastFreeViewReset).toDateString() : null;
    
    if (lastReset !== today) {
      user.freeViewsLeft = 2;
      user.lastFreeViewReset = new Date();
      await user.save();
    }

    if (user.freeViewsLeft <= 0) {
      return res.status(403).json({
        success: false,
        message: 'Límite diario alcanzado',
        freeViewsLeft: 0
      });
    }

    // Obtener la predicción completa
    const prediction = await Prediction.findByPk(id);
    
    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Predicción no encontrada'
      });
    }

    // Crear desbloqueo
    await UnlockedPrediction.create({
      userId,
      predictionId: id,
      method: 'VIDEO'
    });

    // Decrementar vistas gratis
    user.freeViewsLeft -= 1;
    await user.save();

    res.json({
      success: true,
      message: 'Predicción desbloqueada',
      freeViewsLeft: user.freeViewsLeft,
      prediction: prediction.toJSON()
    });
  } catch (error) {
    console.error('Error desbloqueando predicción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desbloquear predicción'
    });
  }
};