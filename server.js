// server.js - SOLUCIONADO
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { sequelize } = require('./src/models');

const app = express();

// CORS mejorado
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:5173',
      'http://localhost:5174',
      'https://app.iasport.pe',
      'https://predictmaster.pe'
      
    ];
    
    // Permitir requests sin origin (como Postman, curl, tests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware de seguridad
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors(corsOptions));

// MIDDLEWARE DE BODY PARSING MEJORADO
app.use(express.json({ 
  limit: '10mb',
  strict: true,  // Solo acepta arrays y objects
  type: ['application/json', 'text/plain'] // Tipos aceptados
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Middleware para manejar errores de parsing JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Error de parsing JSON:', err.message);
    return res.status(400).json({
      success: false,
      message: 'JSON inválido',
      error: 'Formato de datos incorrecto'
    });
  }
  next(err);
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas peticiones desde esta IP, intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false
});

const tournamentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Límite de requests para torneos excedido'
});

// Aplicar rate limiting
app.use('/api/auth', limiter);
app.use('/api/tournaments', tournamentLimiter);

// Logging mejorado para desarrollo
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
  });
}

// Middleware de autenticación MEJORADO (opcional para todas las rutas)
const authMiddleware = require('./src/middleware/auth.middleware');
app.use(authMiddleware);

// Health check MEJORADO
app.get('/health', async (req, res) => {
  try {
    // Probar conexión a BD
    await sequelize.authenticate();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        connected: true,
        database: sequelize.options.database
      },
      features: {
        predictions: true,
        authentication: true,
        pushNotifications: true,
        tournaments: true,
        payments: false
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Ruta principal mejorada
app.get('/', (req, res) => {
  res.json({ 
    message: 'IA SPORT & PREDICTMASTER API v2.0',
    status: 'active',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register'
      },
      predictions: {
        list: 'GET /api/predictions',
        single: 'GET /api/predictions/:id',
        unlock: 'POST /api/predictions/:id/unlock'
      },
      tournaments: {
        list: 'GET /api/tournaments',
        single: 'GET /api/tournaments/:id',
        join: 'POST /api/tournaments/:id/join',
        ranking: 'GET /api/tournaments/ranking/global'
      },
      users: {
        profile: 'GET /api/users/profile',
        preferences: 'PUT /api/users/preferences'
      },
      admin: {
        stats: 'GET /api/admin/stats',
        predictions: 'GET /api/admin/predictions',
        tournaments: 'GET /api/admin/tournaments/stats'
      },
      notifications: {
        vapidKey: 'GET /api/notifications/vapid-public-key',
        subscribe: 'POST /api/notifications/subscribe'
      }
    }
  });
});

// Rutas de la API
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/predictions', require('./src/routes/predictions.routes'));
app.use('/api/tournaments', require('./src/routes/tournaments.routes'));
app.use('/api/users', require('./src/routes/users.routes'));
app.use('/api/admin', require('./src/routes/admin.routes'));
app.use('/api/notifications', require('./src/routes/notifications.routes'));

// Manejo de rutas no encontradas
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
    path: req.path,
    method: req.method,
    availableEndpoints: '/'
  });
});

// Manejo MEJORADO de errores globales
app.use((err, req, res, next) => {
  console.error('Error Global:', err);
  
  // Error de validación de Sequelize
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: err.errors.map(e => ({
        field: e.path,
        message: e.message
      }))
    });
  }
  
  // Error de unicidad
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      message: 'El valor ya existe',
      field: err.errors[0].path
    });
  }
  
  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
  
  // Error de JWT expirado
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expirado'
    });
  }
  
  // Error de conexión a BD
  if (err.name === 'SequelizeConnectionError') {
    return res.status(500).json({
      success: false,
      message: 'Error de conexión a base de datos'
    });
  }
  
  // Error por defecto
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack 
    })
  });
});

const PORT = process.env.PORT || 3001;

// Función para arrancar el servidor
const startServer = async () => {
  try {
    // Probar conexión a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a PostgreSQL establecida');
    
    // Sincronizar modelos
    await sequelize.sync({ alter: false });
    console.log('✅ Modelos sincronizados');
    
    // Arrancar servidor
    app.listen(PORT, () => {
      console.log(`🚀 IA SPORT & PREDICTMASTER API corriendo en http://localhost:${PORT}`);
      console.log(`📚 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 JWT Secret configurado: ${process.env.JWT_SECRET ? 'Sí' : 'No'}`);
      console.log(`🔔 Push Notifications: ${process.env.VAPID_PUBLIC_KEY ? 'Configuradas' : 'No configuradas'}`);
      console.log('\n📍 Endpoints principales:');
      console.log(`   - API Info: GET http://localhost:${PORT}/`);
      console.log(`   - Health: GET http://localhost:${PORT}/health`);
      console.log(`   - Predicciones: GET http://localhost:${PORT}/api/predictions`);
      console.log(`   - Torneos: GET http://localhost:${PORT}/api/tournaments`);
      console.log(`   - Login: POST http://localhost:${PORT}/api/auth/login`);
      console.log('\n💡 Usa Ctrl+C para detener el servidor');
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Manejo de señales para cerrar correctamente
process.on('SIGINT', async () => {
  console.log('\n👋 Cerrando servidor...');
  try {
    await sequelize.close();
    console.log('✅ Conexión a base de datos cerrada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al cerrar:', error);
    process.exit(1);
  }
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Promesa rechazada no manejada:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Excepción no capturada:', err);
  process.exit(1);
});

// Iniciar el servidor
startServer();