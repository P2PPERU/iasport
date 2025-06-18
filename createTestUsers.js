// createTestUsers.js - CORREGIDO
const bcrypt = require('bcrypt');
const { User, sequelize } = require('./src/models');

const createTestUsers = async () => {
  try {
    console.log('🔧 CREANDO USUARIOS DE PRUEBA...\n');

    // Verificar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos establecida');

    // Crear usuario admin si no existe
    const [admin, adminCreated] = await User.findOrCreate({
      where: { email: 'admin@iasport.pe' },
      defaults: {
        name: 'Administrador',
        phone: '51987654321',
        email: 'admin@iasport.pe',
        password: await bcrypt.hash('admin123', 10),
        isAdmin: true,
        isPremium: true,
        isVerified: true,
        freeViewsLeft: 999,
        lastFreeViewReset: new Date()
      }
    });

    if (adminCreated) {
      console.log('✅ Usuario administrador creado');
    } else {
      console.log('ℹ️  Usuario administrador ya existe');
    }

    // Crear usuario premium para tests
    const [premiumUser, premiumCreated] = await User.findOrCreate({
      where: { email: 'premium@test.com' },
      defaults: {
        name: 'Usuario Premium Test',
        phone: '51912345678',
        email: 'premium@test.com',
        password: await bcrypt.hash('test123', 10),
        isAdmin: false,
        isPremium: true,
        isVerified: true,
        freeViewsLeft: 2,
        lastFreeViewReset: new Date(),
        premiumExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días
      }
    });

    if (premiumCreated) {
      console.log('✅ Usuario premium test creado');
    } else {
      console.log('ℹ️  Usuario premium test ya existe');
    }

    // Crear usuario regular para tests
    const [regularUser, regularCreated] = await User.findOrCreate({
      where: { email: 'regular@test.com' },
      defaults: {
        name: 'Usuario Regular Test',
        phone: '51923456789',
        email: 'regular@test.com',
        password: await bcrypt.hash('test123', 10),
        isAdmin: false,
        isPremium: false,
        isVerified: true,
        freeViewsLeft: 2,
        lastFreeViewReset: new Date()
      }
    });

    if (regularCreated) {
      console.log('✅ Usuario regular test creado');
    } else {
      console.log('ℹ️  Usuario regular test ya existe');
    }

    // Crear wallets para los usuarios
    const WalletService = require('./src/services/wallet.service');
    
    console.log('\n💰 CREANDO WALLETS...');
    
    // Wallet para admin
    try {
      await WalletService.createWallet(admin.id);
      console.log('✅ Wallet admin creada');
    } catch (error) {
      console.log('ℹ️  Wallet admin ya existe');
    }

    // Wallet para usuario premium con balance inicial
    try {
      const wallet = await WalletService.createWallet(premiumUser.id);
      
      // Agregar balance inicial de S/ 200 para tests
      const t = await sequelize.transaction();
      try {
        await WalletService.creditWallet(
          wallet.id,
          200.00,
          'ADMIN_ADJUSTMENT',
          'Balance inicial para tests',
          'INITIAL_BALANCE',
          t
        );
        await t.commit();
        console.log('✅ Wallet premium user creada con S/ 200');
      } catch (error) {
        await t.rollback();
        console.log('✅ Wallet premium user creada');
      }
    } catch (error) {
      console.log('ℹ️  Wallet premium user ya existe');
    }

    // Wallet para usuario regular
    try {
      await WalletService.createWallet(regularUser.id);
      console.log('✅ Wallet regular user creada');
    } catch (error) {
      console.log('ℹ️  Wallet regular user ya existe');
    }

    console.log('\n🎉 USUARIOS DE PRUEBA LISTOS:');
    console.log('👑 Admin: admin@iasport.pe / admin123');
    console.log('💎 Premium: premium@test.com / test123 (Balance: S/ 200)');
    console.log('👤 Regular: regular@test.com / test123');

    console.log('\n✅ Setup completado exitosamente!');

  } catch (error) {
    console.error('❌ Error creando usuarios:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  createTestUsers();
}

module.exports = createTestUsers;