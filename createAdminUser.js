// createAdminUser.js - Crear usuario administrador
require('dotenv').config();
const { sequelize, User, UserStats, League } = require('./src/models');
const bcrypt = require('bcrypt');

async function createAdminUser() {
  try {
    console.log('👨‍💼 CREANDO USUARIO ADMINISTRADOR');
    console.log('================================\n');

    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos\n');

    // Verificar si ya existe
    const existingAdmin = await User.findOne({ 
      where: { email: 'admin@predictmaster.pe' } 
    });

    if (existingAdmin) {
      console.log('⚠️ Ya existe un usuario admin con email: admin@predictmaster.pe');
      console.log('📧 Email: admin@predictmaster.pe');
      console.log('🔑 Password: admin123\n');
      
      // Actualizar datos si es necesario
      existingAdmin.isAdmin = true;
      existingAdmin.isPremium = true;
      existingAdmin.isVerified = true;
      existingAdmin.freeViewsLeft = 999;
      await existingAdmin.save();
      
      console.log('✅ Permisos de admin actualizados');
    } else {
      // Crear nuevo usuario admin
      const adminUser = await User.create({
        name: 'Administrador PredictMaster',
        phone: '51999000001',
        email: 'admin@predictmaster.pe',
        password: await bcrypt.hash('admin123', 10),
        isAdmin: true,
        isPremium: true,
        isVerified: true,
        freeViewsLeft: 999,
        lastFreeViewReset: new Date(),
        preferences: {
          notifications: true,
          favoriteTeams: ['Alianza Lima', 'Universitario'],
          favoriteSports: ['football', 'basketball']
        }
      });

      console.log('✅ Usuario administrador creado exitosamente!');
      console.log(`📧 Email: ${adminUser.email}`);
      console.log('🔑 Password: admin123');
      console.log(`🆔 ID: ${adminUser.id}`);

      // Crear estadísticas iniciales
      try {
        const bronzeLeague = await League.findOne({ where: { name: 'Bronze' } });
        if (bronzeLeague) {
          await UserStats.create({
            userId: adminUser.id,
            leagueId: bronzeLeague.id,
            totalTournaments: 0,
            totalPredictions: 0
          });
          console.log('📊 Estadísticas iniciales creadas');
        }
      } catch (statsError) {
        console.log('⚠️ Error creando estadísticas:', statsError.message);
      }
    }

    // Verificar permisos
    const admin = await User.findOne({ 
      where: { email: 'admin@predictmaster.pe' },
      include: [{
        model: UserStats,
        as: 'stats',
        include: [{ model: League }]
      }]
    });

    console.log('\n🔍 VERIFICACIÓN DE PERMISOS:');
    console.log(`   👤 Nombre: ${admin.name}`);
    console.log(`   📧 Email: ${admin.email}`);
    console.log(`   🔧 Es Admin: ${admin.isAdmin ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   💎 Es Premium: ${admin.isPremium ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   ✅ Verificado: ${admin.isVerified ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   👁️ Vistas gratis: ${admin.freeViewsLeft}`);
    console.log(`   🏅 Liga: ${admin.stats?.League?.name || 'No asignada'}`);

    console.log('\n🌐 ENDPOINTS DE ADMIN DISPONIBLES:');
    console.log('   • GET  /api/admin/stats - Dashboard stats');
    console.log('   • GET  /api/admin/predictions - Gestionar predicciones');
    console.log('   • POST /api/admin/predictions - Crear predicción');
    console.log('   • PUT  /api/admin/predictions/:id - Actualizar predicción');
    console.log('   • GET  /api/admin/users - Gestionar usuarios');
    console.log('   • GET  /api/admin/tournaments - Gestionar torneos');
    console.log('   • POST /api/admin/tournaments - Crear torneo');
    console.log('   • GET  /api/admin/payments - Ver pagos');

    console.log('\n🔑 CREDENCIALES PARA LOGIN:');
    console.log('   📧 Email: admin@predictmaster.pe');
    console.log('   🔑 Password: admin123');

    console.log('\n🚀 Para probar el login:');
    console.log('   curl -X POST http://localhost:3001/api/auth/login \\');
    console.log('        -H "Content-Type: application/json" \\');
    console.log('        -d \'{"phoneOrEmail":"admin@predictmaster.pe","password":"admin123"}\'');

  } catch (error) {
    console.error('❌ Error creando usuario admin:', error.message);
    
    if (error.message.includes('duplicate key')) {
      console.log('\n💡 Parece que ya existe un usuario con ese email o teléfono');
      console.log('   Intenta con diferentes credenciales o verifica los usuarios existentes');
    }
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  createAdminUser();
}

module.exports = createAdminUser;