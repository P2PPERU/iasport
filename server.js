// server.js - ACTUALIZADO CON PREDICTMASTER
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { sequelize } = require('./src/models');

const app = express();

// Configuración de CORS
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite
      'http://localhost:5174',
      'https://app.iasport.pe', // Producción
      'https://predictmaster.pe' // Nuevo dominio para torneos
    ];
    
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

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: 'Demasiadas peticiones desde esta IP, intenta de nuevo más tarde.'
});

// Rate limiting específico para torneos (más permisivo)
const tournamentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Más requests para funcionalidad de torneos
  message: 'Límite de requests para torneos excedido'
});

// Aplicar rate limiting
app.use('/api/auth', limiter);
app.use('/api/tournaments', tournamentLimiter);

// Logging middleware para desarrollo
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Middleware de autenticación opcional para todas las rutas
const authMiddleware = require('./src/middleware/auth.middleware');
app.use(authMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: sequelize.options.database,
    features: {
      predictions: true,
      authentication: true,
      pushNotifications: true,
      tournaments: true, // NUEVA FUNCIONALIDAD
      payments: false
    }
  });
});

// Ruta principal con información actualizada
app.get('/', (req, res) => {
  res.json({ 
    message: 'IA SPORT & PREDICTMASTER API v2.0',
    status: 'active',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        verify: 'POST /api/auth/verify',
        forgotPassword: 'POST /api/auth/forgot-password',
        resetPassword: 'POST /api/auth/reset-password'
      },
      predictions: {
        list: 'GET /api/predictions',
        single: 'GET /api/predictions/:id',
        byDate: 'GET /api/predictions/date/:date',
        unlock: 'POST /api/predictions/:id/unlock'
      },
      // NUEVOS ENDPOINTS DE TORNEOS
      tournaments: {
        list: 'GET /api/tournaments',
        single: 'GET /api/tournaments/:id',
        join: 'POST /api/tournaments/:id/join',
        confirmEntry: 'POST /api/tournaments/confirm-entry',
        submitPrediction: 'POST /api/tournaments/:tournamentId/predictions',
        globalRanking: 'GET /api/tournaments/ranking/global',
        userStats: 'GET /api/tournaments/user/stats',
        userHistory: 'GET /api/tournaments/user/history'
      },
      users: {
        profile: 'GET /api/users/profile',
        updatePreferences: 'PUT /api/users/preferences',
        paymentHistory: 'GET /api/users/payments'
      },
      notifications: {
        vapidKey: 'GET /api/notifications/vapid-public-key',
        subscribe: 'POST /api/notifications/subscribe',
        unsubscribe: 'POST /api/notifications/unsubscribe',
        test: 'POST /api/notifications/test',
        history: 'GET /api/notifications/history'
      },
      admin: {
        stats: 'GET /api/admin/stats',
        // Predicciones
        predictions: {
          create: 'POST /api/admin/predictions',
          update: 'PUT /api/admin/predictions/:id',
          updateResult: 'PUT /api/admin/predictions/:id/result',
          delete: 'DELETE /api/admin/predictions/:id'
        },
        // Torneos (NUEVO)
        tournaments: {
          stats: 'GET /api/admin/tournaments/stats',
          list: 'GET /api/admin/tournaments',
          create: 'POST /api/admin/tournaments',
          update: 'PUT /api/admin/tournaments/:id',
          updateStatus: 'PUT /api/admin/tournaments/:id/status',
          delete: 'DELETE /api/admin/tournaments/:id',
          participants: 'GET /api/admin/tournaments/:id/participants',
          removeParticipant: 'DELETE /api/admin/tournaments/:tournamentId/participants/:userId',
          recalculate: 'POST /api/admin/tournaments/:id/recalculate'
        },
        users: {
          list: 'GET /api/admin/users',
          update: 'PUT /api/admin/users/:id',
          togglePremium: 'PUT /api/admin/users/:id/premium'
        },
        notifications: {
          sendCustom: 'POST /api/admin/notifications/custom',
          sendHotPrediction: 'POST /api/admin/notifications/hot-prediction/:id',
          sendResult: 'POST /api/admin/notifications/prediction-result/:id'
        }
      },
      payments: {
        createYape: 'POST /api/payments/yape',
        createPlin: 'POST /api/payments/plin',
        status: 'GET /api/payments/:id/status',
        webhook: 'POST /api/payments/webhook/:provider'
      }
    }
  });
});

// Rutas de la API
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/predictions', require('./src/routes/predictions.routes'));
app.use('/api/tournaments', require('./src/routes/tournaments.routes')); // NUEVA RUTA
app.use('/api/users', require('./src/routes/users.routes'));
app.use('/api/admin', require('./src/routes/admin.routes'));
app.use('/api/notifications', require('./src/routes/notifications.routes'));
// app.use('/api/payments', require('./src/routes/payments.routes')); // Descomentar cuando esté listo

// Manejo de rutas no encontradas
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
    path: req.path,
    suggestion: req.path.startsWith('/api/tournaments') ? 
      'Verifica la documentación de torneos en GET /' : 
      'Verifica los endpoints disponibles en GET /'
  });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
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
  
  // Error de unicidad de Sequelize
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      message: 'El valor ya existe',
      field: err.errors[0].path
    });
  }
  
  // Error de clave foránea
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      success: false,
      message: 'Referencia inválida',
      details: 'El registro referenciado no existe'
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
  
  // Error por defecto
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      error: err 
    })
  });
});

// Puerto y arranque del servidor
const PORT = process.env.PORT || 3001; // Cambiado a 3001 por defecto

// Variables para los jobs
let notificationJobs = null;
let tournamentJobs = null; // NUEVO: Jobs de torneos

// Función para arrancar el servidor
const startServer = async () => {
  try {
    // Probar conexión a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a PostgreSQL establecida');
    
    // Sincronizar modelos (sin alterar tablas existentes)
    await sequelize.sync({ alter: false });
    console.log('✅ Modelos sincronizados');
    
    // Iniciar jobs de notificaciones
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_NOTIFICATION_JOBS === 'true') {
      try {
        const NotificationJobs = require('./src/jobs/notificationJobs');
        NotificationJobs.init();
        notificationJobs = NotificationJobs;
        console.log('✅ Jobs de notificaciones iniciados');
      } catch (error) {
        console.error('⚠️ Error iniciando jobs de notificaciones:', error.message);
      }
    }
    
    // NUEVO: Iniciar jobs de torneos
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_TOURNAMENT_JOBS === 'true') {
      try {
        const TournamentJobs = require('./src/jobs/tournamentJobs');
        TournamentJobs.init();
        tournamentJobs = TournamentJobs;
        console.log('✅ Jobs de torneos iniciados');
      } catch (error) {
        console.error('⚠️ Error iniciando jobs de torneos:', error.message);
      }
    } else {
      console.log('ℹ️ Jobs de torneos deshabilitados');
    }
    
    // Arrancar servidor
    app.listen(PORT, () => {
      console.log(`🚀 IA SPORT & PREDICTMASTER API corriendo en http://localhost:${PORT}`);
      console.log(`📚 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 JWT Secret configurado: ${process.env.JWT_SECRET ? 'Sí' : 'No (usando default)'}`);
      console.log(`🔔 Push Notifications: ${process.env.VAPID_PUBLIC_KEY ? 'Configuradas' : 'No configuradas'}`);
      console.log('\n📍 Endpoints principales:');
      console.log(`   - API Info: GET http://localhost:${PORT}/`);
      console.log(`   - Health: GET http://localhost:${PORT}/health`);
      console.log(`   - Predicciones: GET http://localhost:${PORT}/api/predictions`);
      console.log(`   - Torneos: GET http://localhost:${PORT}/api/tournaments`); // NUEVO
      console.log(`   - Login: POST http://localhost:${PORT}/api/auth/login`);
      console.log(`   - Admin Stats: GET http://localhost:${PORT}/api/admin/stats`);
      console.log(`   - Admin Torneos: GET http://localhost:${PORT}/api/admin/tournaments/stats`); // NUEVO
      console.log('\n🎯 PREDICTMASTER - Plataforma de Torneos de Pronósticos');
      console.log('🏆 Nuevas funcionalidades:');
      console.log('   • Sistema completo de torneos');
      console.log('   • Rankings en tiempo real');
      console.log('   • Ligas de usuarios');
      console.log('   • Sistema de scoring avanzado');
      console.log('   • Gestión automática de torneos');
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
    // Detener jobs si están activos
    if (notificationJobs) {
      notificationJobs.stop();
      console.log('✅ Jobs de notificaciones detenidos');
    }
    
    if (tournamentJobs) {
      tournamentJobs.stop();
      console.log('✅ Jobs de torneos detenidos');
    }
    
    await sequelize.close();
    console.log('✅ Conexión a base de datos cerrada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al cerrar:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n👋 Cerrando servidor (SIGTERM)...');
  try {
    if (notificationJobs) notificationJobs.stop();
    if (tournamentJobs) tournamentJobs.stop();
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Error no manejado:', err);
  // En producción, podrías querer cerrar el servidor
  // process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Excepción no capturada:', err);
  process.exit(1);
});

// Iniciar el servidor
startServer();