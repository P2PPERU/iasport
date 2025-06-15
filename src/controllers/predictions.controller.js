const { Prediction } = require('../models');
const { Op } = require('sequelize');

// Obtener predicciones del día
exports.getTodayPredictions = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const predictions = await Prediction.findAll({
      where: {
        matchTime: {
          [Op.between]: [today, tomorrow]
        },
        status: 'ACTIVE'
      },
      order: [['matchTime', 'ASC'], ['confidence', 'DESC']]
    });

    // Verificar si el usuario puede ver predicciones premium
    const canViewPremium = req.user && (req.user.isPremium || req.user.isAdmin);
    
    console.log('Usuario autenticado:', req.user?.email);
    console.log('Es admin:', req.user?.isAdmin);
    console.log('Es premium:', req.user?.isPremium);
    console.log('Puede ver premium:', canViewPremium);

    const publicPredictions = predictions.map(pred => {
      const data = pred.toJSON();
      
      // Si es premium y el usuario NO puede verlas
      if (data.isPremium && !canViewPremium) {
        return {
          ...data,
          prediction: '🔒 Premium',
          odds: null,
          confidence: null
        };
      }
      
      return data;
    });

    res.json({
      success: true,
      data: publicPredictions,
      count: predictions.length,
      user: req.user ? { email: req.user.email, isAdmin: req.user.isAdmin } : null
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