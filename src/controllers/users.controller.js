const { User, Payment } = require('../models');

// Obtener perfil del usuario autenticado
exports.getProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }

    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil'
    });
  }
};

// Actualizar preferencias
exports.updatePreferences = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }

    const { notifications, favoriteTeams, favoriteSports } = req.body;

    const user = await User.findByPk(req.user.id);
    
    user.preferences = {
      ...user.preferences,
      ...(notifications !== undefined && { notifications }),
      ...(favoriteTeams && { favoriteTeams }),
      ...(favoriteSports && { favoriteSports })
    };

    await user.save();

    res.json({
      success: true,
      message: 'Preferencias actualizadas',
      data: user.preferences
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar preferencias'
    });
  }
};