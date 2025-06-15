// src/controllers/auth.controller.js (SIMPLIFICADO)
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { Op } = require('sequelize');

// Generar JWT
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      isAdmin: user.isAdmin,
      isPremium: user.isPremium
    },
    process.env.JWT_SECRET || 'tu-super-secret-jwt-key',
    { expiresIn: '7d' }
  );
};

// Login simplificado
exports.login = async (req, res) => {
  try {
    const { phoneOrEmail, password } = req.body;

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: phoneOrEmail },
          { phone: phoneOrEmail }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const isValidPassword = await user.validatePassword(password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Contraseña incorrecta'
      });
    }

    // Actualizar último login y resetear vistas gratis si es nuevo día
    user.lastLogin = new Date();
    
    const today = new Date().toDateString();
    const lastReset = user.lastFreeViewReset ? new Date(user.lastFreeViewReset).toDateString() : null;
    
    if (lastReset !== today) {
      user.freeViewsLeft = 2;
      user.lastFreeViewReset = new Date();
    }
    
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión'
    });
  }
};

// Registro simplificado (sin verificación)
exports.register = async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;

    // Validaciones básicas
    if (!name || name.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'El nombre debe tener al menos 3 caracteres'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Verificar si ya existe
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { phone }]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con este email o teléfono'
      });
    }

    // Crear usuario (ya verificado)
    const user = await User.create({
      name,
      phone,
      email,
      password: await bcrypt.hash(password, 10),
      isVerified: true, // Auto-verificado
      freeViewsLeft: 2,
      lastFreeViewReset: new Date()
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
      error: error.message
    });
  }
};