// createRegularUser.js - Crear usuario regular para pruebas
require('dotenv').config();
const { sequelize, User, UserStats, League } = require('./src/models');
const bcrypt = require('bcrypt');

async function createRegularUser() {
  try {
    console.log('👤 CREANDO USUARIO REGULAR PARA PRUEBAS');
    console.log('======================================\n');

    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos\n');

    // Crear varios usuarios de ejemplo
    const users = [
      {
        name: 'Demo User',
        phone: '51999000002',
        email: 'demo@predictmaster.pe', 
        password: 'demo123',
        isAdmin: false,
        isPremium: false,
        isVerified: true,
        freeViewsLeft: 2,
        description: 'Usuario demo básico'
      },
      {
        name: 'Premium User',
        phone: '51999000003',
        email: 'premium@predictmaster.pe',
        password: 'premium123', 
        isAdmin: false,
        isPremium: true,
        isVerified: true,
        freeViewsLeft: 2,
        description: 'Usuario premium de ejemplo',
        premiumExpiry: 30 // días
      },
      {
        name: 'Carlos Predictor',
        phone: '51987654321',
        email: 'carlos@test.pe',
        password: 'carlos123',
        isAdmin: false,
        isPremium: false,
        isVerified: true,
        freeViewsLeft: 2,
        description: 'Usuario regular #1'
      },
      {
        name: 'Maria Futbol',
        phone: '51987654322', 
        email: 'maria@test.pe',
        password: 'maria123',
        isAdmin: false,
        isPremium: true,
        isVerified: true,
        freeViewsLeft: 2,
        description: 'Usuario premium #2',
        premiumExpiry: 15 // días
      }
    ];

    console.log('👥 Creando usuarios de ejemplo...\n');

    for (const userData of users) {
      try {
        // Verificar si ya existe
        const existingUser = await User.findOne({ 
          where: { email: userData.email } 
        });

        if (existingUser) {
          console.log(`⚠️ Usuario ya existe: ${userData.email}`);
          console.log(`   🔑 Password: ${userData.password}`);
          
          // Actualizar datos si es necesario
          existingUser.isVerified = userData.isVerified;
          existingUser.isPremium = userData.isPremium;
          existingUser.freeViewsLeft = userData.freeViewsLeft;
          
          if (userData.premiumExpiry && userData.isPremium) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + userData.premiumExpiry);
            existingUser.premiumExpiresAt = expiryDate;
          }
          
          await existingUser.save();
          console.log(`   ✅ Datos actualizados\n`);
          continue;
        }

        // Crear nuevo usuario
        const newUserData = {
          name: userData.name,
          phone: userData.phone,
          email: userData.email,
          password: await bcrypt.hash(userData.password, 10),
          isAdmin: userData.isAdmin,
          isPremium: userData.isPremium,
          isVerified: userData.isVerified,
          freeViewsLeft: userData.freeViewsLeft,
          lastFreeViewReset: new Date(),
          preferences: {
            notifications: true,
            favoriteTeams: ['Alianza Lima', 'Universitario', 'Sporting Cristal'],
            favoriteSports: ['football']
          }
        };

        // Agregar fecha de expiración premium si aplica
        if (userData.premiumExpiry && userData.isPremium) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + userData.premiumExpiry);
          newUserData.premiumExpiresAt = expiryDate;
        }

        const newUser = await User.create(newUserData);

        console.log(`✅ Usuario creado: ${userData.description}`);
        console.log(`   📧 Email: ${newUser.email}`);
        console.log(`   🔑 Password: ${userData.password}`);
        console.log(`   💎 Premium: ${newUser.isPremium ? 'SÍ' : 'NO'}`);
        if (newUser.isPremium && newUser.premiumExpiresAt) {
          console.log(`   ⏰ Premium expira: ${newUser.premiumExpiresAt.toLocaleDateString()}`);
        }

        // Crear estadísticas iniciales
        try {
          const bronzeLeague = await League.findOne({ where: { name: 'Bronze' } });
          if (bronzeLeague) {
            await UserStats.create({
              userId: newUser.id,
              leagueId: bronzeLeague.id,
              totalTournaments: 0,
              totalPredictions: 0
            });
            console.log(`   📊 Estadísticas iniciales creadas`);
          }
        } catch (statsError) {
          console.log(`   ⚠️ Error con estadísticas: ${statsError.message}`);
        }
        
        console.log(''); // Línea en blanco

      } catch (userError) {
        console.log(`❌ Error creando ${userData.email}: ${userError.message}\n`);
      }
    }

    // Resumen final
    const totalUsers = await User.count();
    const premiumUsers = await User.count({ where: { isPremium: true } });
    const adminUsers = await User.count({ where: { isAdmin: true } });

    console.log('📊 RESUMEN DE USUARIOS:');
    console.log(`   👥 Total usuarios: ${totalUsers}`);
    console.log(`   💎 Usuarios premium: ${premiumUsers}`);
    console.log(`   🔧 Usuarios admin: ${adminUsers}`);

    console.log('\n🔑 CREDENCIALES PARA PRUEBAS:');
    console.log('   👤 Usuario Demo:');
    console.log('      📧 demo@predictmaster.pe / demo123');
    console.log('   💎 Usuario Premium:');
    console.log('      📧 premium@predictmaster.pe / premium123');
    console.log('   👤 Usuario Regular #1:');
    console.log('      📧 carlos@test.pe / carlos123');
    console.log('   💎 Usuario Premium #2:');
    console.log('      📧 maria@test.pe / maria123');

    console.log('\n🌐 ENDPOINTS PARA USUARIOS:');
    console.log('   • POST /api/auth/login - Iniciar sesión');
    console.log('   • POST /api/auth/register - Registrarse');
    console.log('   • GET  /api/users/profile - Ver perfil');
    console.log('   • GET  /api/predictions - Ver predicciones');
    console.log('   • POST /api/predictions/:id/unlock - Desbloquear predicción');
    console.log('   • GET  /api/tournaments - Ver torneos');
    console.log('   • POST /api/tournaments/:id/join - Inscribirse a torneo');

    console.log('\n🚀 Para probar login de usuario regular:');
    console.log('   curl -X POST http://localhost:3001/api/auth/login \\');
    console.log('        -H "Content-Type: application/json" \\');
    console.log('        -d \'{"phoneOrEmail":"demo@predictmaster.pe","password":"demo123"}\'');

  } catch (error) {
    console.error('❌ Error creando usuarios:', error.message);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  createRegularUser();
}

module.exports = createRegularUser;