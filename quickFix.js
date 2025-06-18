// quickFix.js - Arreglo rápido para problemas específicos
require('dotenv').config();
const { sequelize, User } = require('./src/models');
const bcrypt = require('bcrypt');

async function quickFix() {
  try {
    console.log('🔧 ARREGLO RÁPIDO DEL BACKEND');
    console.log('============================\n');

    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos\n');

    // 1. Verificar usuario premium
    console.log('1️⃣ Verificando usuario premium...');
    let premiumUser = await User.findOne({ 
      where: { email: 'premium@predictmaster.pe' } 
    });

    if (!premiumUser) {
      // Buscar un teléfono disponible
      let phoneNumber = '51999000003';
      let counter = 3;
      
      while (await User.findOne({ where: { phone: phoneNumber } })) {
        counter++;
        phoneNumber = `5199900000${counter}`;
        if (counter > 50) break; // Evitar loop infinito
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      premiumUser = await User.create({
        name: 'Usuario Premium PredictMaster',
        phone: phoneNumber,
        email: 'premium@predictmaster.pe',
        password: await bcrypt.hash('premium123', 10),
        isAdmin: false,
        isPremium: true,
        premiumExpiresAt: expiresAt,
        isVerified: true,
        freeViewsLeft: 999,
        preferences: {
          notifications: true,
          favoriteTeams: ['Real Madrid', 'Barcelona'],
          favoriteSports: ['football']
        }
      });

      console.log(`✅ Usuario premium creado con teléfono: ${phoneNumber}`);
    } else {
      // Asegurar que esté bien configurado
      if (!premiumUser.isPremium) {
        premiumUser.isPremium = true;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        premiumUser.premiumExpiresAt = expiresAt;
        await premiumUser.save();
        console.log('✅ Usuario premium actualizado');
      } else {
        console.log('✅ Usuario premium ya existe y está bien configurado');
      }
    }

    // 2. Verificar usuario admin
    console.log('\n2️⃣ Verificando usuario admin...');
    const adminUser = await User.findOne({ 
      where: { email: 'admin@predictmaster.pe' } 
    });

    if (adminUser && adminUser.isAdmin) {
      console.log('✅ Usuario admin encontrado y configurado');
    } else {
      console.log('❌ Usuario admin no encontrado o mal configurado');
    }

    // 3. Verificar usuario demo
    console.log('\n3️⃣ Verificando usuario demo...');
    const demoUser = await User.findOne({ 
      where: { email: 'demo@predictmaster.pe' } 
    });

    if (demoUser) {
      console.log('✅ Usuario demo encontrado');
    } else {
      console.log('❌ Usuario demo no encontrado');
    }

    // 4. Estadísticas finales
    console.log('\n4️⃣ Estadísticas del sistema:');
    const userCount = await User.count();
    const adminCount = await User.count({ where: { isAdmin: true } });
    const premiumCount = await User.count({ where: { isPremium: true } });

    console.log(`👥 Total usuarios: ${userCount}`);
    console.log(`🔧 Usuarios admin: ${adminCount}`);
    console.log(`💎 Usuarios premium: ${premiumCount}`);

    console.log('\n✅ ARREGLO COMPLETADO');
    console.log('====================');
    console.log('\n🔑 CREDENCIALES VERIFICADAS:');
    console.log('🔧 Admin: admin@predictmaster.pe / admin123');
    console.log('👤 Demo: demo@predictmaster.pe / demo123');
    console.log('💎 Premium: premium@predictmaster.pe / premium123');
    
    console.log('\n🚀 PRÓXIMO PASO:');
    console.log('Ejecuta: node simpleTest.js');

  } catch (error) {
    console.error('❌ Error en quickFix:', error.message);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  quickFix();
}

module.exports = quickFix;