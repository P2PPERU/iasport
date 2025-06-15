const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Generar JWT
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      isAdmin: user.isAdmin 
    },
    process.env.JWT_SECRET || 'tu-super-secret-jwt-key',
    { expiresIn: '7d' }
  );
};

// Login
exports.login = async (req, res) => {
  try {
    const { phoneOrEmail, password } = req.body;

    // Buscar usuario por email o teléfono
    const user = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
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

    // Validar contraseña
    const isValidPassword = await user.validatePassword(password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Contraseña incorrecta'
      });
    }

    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        message: 'Por favor verifica tu cuenta primero'
      });
    }

    // Actualizar último login
    user.lastLogin = new Date();
    await user.save();

    // Generar token
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

// Registro
exports.register = async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;

    // Verificar si ya existe
    const existingUser = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { email },
          { phone }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con este email o teléfono'
      });
    }

    // Crear usuario
    const user = await User.create({
      name,
      phone,
      email,
      password: await bcrypt.hash(password, 10),
      isVerified: true // Por ahora, para pruebas
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