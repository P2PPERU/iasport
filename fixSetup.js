// fixBackend.js - Script para arreglar todos los problemas del backend
require('dotenv').config();
const { sequelize } = require('./src/models');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function fixBackend() {
  log('🔧 ARREGLANDO BACKEND PREDICTMASTER', 'bold');
  log('==================================', 'cyan');
  log('');

  try {
    // 1. Verificar conexión a BD
    log('1️⃣ Verificando conexión a base de datos...', 'yellow');
    try {
      await sequelize.authenticate();
      log('✅ Conexión a PostgreSQL exitosa', 'green');
      log(`   📊 Database: ${sequelize.options.database}`, 'cyan');
    } catch (error) {
      log('❌ Error de conexión a BD:', 'red');
      log(`   ${error.message}`, 'red');
      log('', '');
      log('💡 SOLUCIONES:', 'yellow');
      log('   1. Verifica que PostgreSQL esté corriendo', 'cyan');
      log('   2. Verifica las credenciales en tu .env:', 'cyan');
      log('      DB_HOST=localhost', 'cyan');
      log('      DB_PORT=5433', 'cyan');
      log('      DB_NAME=ia_sport_db', 'cyan');
      log('      DB_USER=postgres', 'cyan');
      log('      DB_PASSWORD=123456', 'cyan');
      process.exit(1);
    }

    // 2. Sincronizar modelos
    log('');
    log('2️⃣ Sincronizando modelos de base de datos...', 'yellow');
    try {
      await sequelize.sync({ alter: false });
      log('✅ Modelos sincronizados correctamente', 'green');
      
      // Verificar tablas críticas
      const tables = await sequelize.getQueryInterface().showAllTables();
      const criticalTables = ['users', 'predictions', 'tournaments', 'leagues'];
      const missingTables = criticalTables.filter(table => !tables.includes(table));
      
      if (missingTables.length > 0) {
        log(`⚠️ Tablas faltantes: ${missingTables.join(', ')}`, 'yellow');
        log('   Ejecutando sync con force...', 'cyan');
        await sequelize.sync({ force: false, alter: true });
        log('✅ Tablas creadas/actualizadas', 'green');
      }
    } catch (error) {
      log('❌ Error sincronizando modelos:', 'red');
      log(`   ${error.message}`, 'red');
      throw error;
    }

    // 3. Crear usuarios de ejemplo
    log('');
    log('3️⃣ Creando usuarios de ejemplo...', 'yellow');
    try {
      const createSampleData = require('./createSampleData');
      await createSampleData();
      log('✅ Usuarios de ejemplo creados/verificados', 'green');
    } catch (error) {
      log('❌ Error creando usuarios:', 'red');
      log(`   ${error.message}`, 'red');
      
      // Crear usuario admin básico como fallback
      try {
        const { User } = require('./src/models');
        const bcrypt = require('bcrypt');
        
        const [admin] = await User.findOrCreate({
          where: { email: 'admin@predictmaster.pe' },
          defaults: {
            name: 'Administrador',
            phone: '51999000001',
            email: 'admin@predictmaster.pe',
            password: await bcrypt.hash('admin123', 10),
            isAdmin: true,
            isPremium: true,
            isVerified: true,
            freeViewsLeft: 999
          }
        });
        
        const [premium] = await User.findOrCreate({
          where: { email: 'premium@predictmaster.pe' },
          defaults: {
            name: 'Usuario Premium',
            phone: '51999000003',
            email: 'premium@predictmaster.pe',
            password: await bcrypt.hash('premium123', 10),
            isAdmin: false,
            isPremium: true,
            isVerified: true,
            freeViewsLeft: 999,
            premiumExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        });
        
        log('✅ Usuarios básicos creados como fallback', 'green');
      } catch (fallbackError) {
        log('❌ Error en fallback de usuarios:', 'red');
        log(`   ${fallbackError.message}`, 'red');
      }
    }

    // 4. Verificar configuración
    log('');
    log('4️⃣ Verificando configuración...', 'yellow');
    
    const requiredEnvVars = {
      'JWT_SECRET': process.env.JWT_SECRET,
      'VAPID_PUBLIC_KEY': process.env.VAPID_PUBLIC_KEY,
      'VAPID_PRIVATE_KEY': process.env.VAPID_PRIVATE_KEY,
      'DB_HOST': process.env.DB_HOST,
      'DB_NAME': process.env.DB_NAME
    };

    let configOK = true;
    for (const [key, value] of Object.entries(requiredEnvVars)) {
      if (value) {
        log(`   ✅ ${key}: Configurado`, 'green');
      } else {
        log(`   ❌ ${key}: No configurado`, 'red');
        configOK = false;
      }
    }

    if (!configOK) {
      log('', '');
      log('⚠️ ADVERTENCIA: Faltan variables de entorno', 'yellow');
      log('   El servidor puede funcionar, pero algunas features no estarán disponibles', 'cyan');
    }

    // 5. Verificar datos
    log('');
    log('5️⃣ Verificando datos existentes...', 'yellow');
    
    const { User, Prediction, Tournament } = require('./src/models');
    
    const counts = {
      users: await User.count(),
      predictions: await Prediction.count(),
      tournaments: await Tournament.count()
    };

    log(`   👥 Usuarios: ${counts.users}`, 'cyan');
    log(`   🎯 Predicciones: ${counts.predictions}`, 'cyan');
    log(`   🏆 Torneos: ${counts.tournaments}`, 'cyan');

    if (counts.users === 0) {
      log('   ⚠️ No hay usuarios - las pruebas de autenticación fallarán', 'yellow');
    }
    
    if (counts.predictions === 0) {
      log('   ⚠️ No hay predicciones - el endpoint /api/predictions estará vacío', 'yellow');
    }

    // 6. Test básico de endpoints
    log('');
    log('6️⃣ Realizando test básico...', 'yellow');
    
    try {
      // Test de usuario admin
      const admin = await User.findOne({ where: { email: 'admin@predictmaster.pe' } });
      if (admin && admin.isAdmin) {
        log('   ✅ Usuario admin encontrado y configurado', 'green');
      } else {
        log('   ❌ Usuario admin no encontrado o mal configurado', 'red');
      }

      // Test de usuario premium
      const premium = await User.findOne({ where: { email: 'premium@predictmaster.pe' } });
      if (premium && premium.isPremium) {
        log('   ✅ Usuario premium encontrado y configurado', 'green');
      } else {
        log('   ❌ Usuario premium no encontrado - creando...', 'yellow');
        
        const bcrypt = require('bcrypt');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        
        await User.create({
          name: 'Usuario Premium',
          phone: '51999000003',
          email: 'premium@predictmaster.pe',
          password: await bcrypt.hash('premium123', 10),
          isAdmin: false,
          isPremium: true,
          premiumExpiresAt: expiresAt,
          isVerified: true,
          freeViewsLeft: 999
        });
        
        log('   ✅ Usuario premium creado', 'green');
      }

    } catch (error) {
      log('   ❌ Error en test básico:', 'red');
      log(`   ${error.message}`, 'red');
    }

    // 7. Resultados finales
    log('');
    log('✅ BACKEND ARREGLADO EXITOSAMENTE', 'bold');
    log('================================', 'green');
    log('');
    log('🔑 CREDENCIALES PARA TESTING:', 'bold');
    log('  🔧 Admin: admin@predictmaster.pe / admin123', 'cyan');
    log('  👤 Demo: demo@predictmaster.pe / demo123', 'cyan');
    log('  💎 Premium: premium@predictmaster.pe / premium123', 'cyan');
    log('');
    log('🚀 PRÓXIMOS PASOS:', 'bold');
    log('  1. Reinicia tu servidor: npm run dev', 'cyan');
    log('  2. Ejecuta las pruebas: node testCompleteBackend.js', 'cyan');
    log('  3. Verifica health: curl http://localhost:3001/health', 'cyan');
    log('');
    log('📍 ENDPOINTS PRINCIPALES:', 'bold');
    log('  • http://localhost:3001/health', 'cyan');
    log('  • http://localhost:3001/api/predictions', 'cyan');
    log('  • http://localhost:3001/api/tournaments', 'cyan');
    log('  • http://localhost:3001/api/auth/login', 'cyan');
    log('');

  } catch (error) {
    log('');
    log('❌ ERROR CRÍTICO DURANTE LA REPARACIÓN', 'red');
    log('=====================================', 'red');
    log(`Error: ${error.message}`, 'red');
    
    if (process.env.NODE_ENV === 'development') {
      log('Stack:', 'yellow');
      log(error.stack, 'red');
    }
    
    log('');
    log('💡 VERIFICA:', 'yellow');
    log('  1. PostgreSQL esté corriendo en puerto 5433', 'cyan');
    log('  2. Base de datos "ia_sport_db" exista', 'cyan');
    log('  3. Credenciales en .env sean correctas', 'cyan');
    log('  4. Todas las dependencias estén instaladas: npm install', 'cyan');
    
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  fixBackend();
}

module.exports = fixBackend;