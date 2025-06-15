const jwt = require('jsonwebtoken');
const { User } = require('../models');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    console.log('Auth header:', authHeader ? 'Presente' : 'No presente');
    
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      console.log('No hay token, usuario no autenticado');
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu-super-secret-jwt-key');
    console.log('Token decodificado, userId:', decoded.id);
    
    const user = await User.findByPk(decoded.id);

    if (user) {
      req.user = user.toJSON(); // Convertir a JSON para evitar problemas de Sequelize
      console.log('Usuario encontrado:', user.email, 'Admin:', user.isAdmin);
    } else {
      console.log('Usuario no encontrado en BD');
    }

    next();
  } catch (error) {
    console.log('Error en token:', error.message);
    next();
  }
};