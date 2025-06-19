// createTestUsers.js - CREAR USUARIOS DE PRUEBA PARA TESTING
const { User, Wallet, sequelize } = require('./src/models');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');

const testUsers = [
  {
    name: 'Administrador Principal',
    phone: '51987654321',
    email: 'admin@iasport.pe',
    password: 'admin123',
    isAdmin: true,
    isPremium: true,
    isVerified: true,
    premiumExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
    preferences: {
      notifications: true,
      favoriteTeams: ['Real Madrid', 'Barcelona'],
      favoriteSports: ['football', 'basketball']
    }
  },
  {
    name: 'Usuario Premium Test',
    phone: '51987654322',
    email: 'premium@test.com',
    password: 'test123',
    isAdmin: false,
    isPremium: true,
    isVerified: true,
    premiumExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
    freeViewsLeft: 2,
    preferences: {
      notifications: true,
      favoriteTeams: ['Manchester City'],
      favoriteSports: ['football']
    }
  },
  {
    name: 'Usuario Regular Test',
    phone: '51987654323',
    email: 'regular@test.com',
    password: 'test123',
    isAdmin: false,
    isPremium: false,
    isVerified: true,
    freeViewsLeft: 2,
    preferences: {
      notifications: false,
      favoriteTeams: [],
      favoriteSports: ['football']
    }
  },
  {
    name: 'Usuario No Verificado',
    phone: '51987654324',
    email: 'unverified@test.com',
    password: 'test123',
    isAdmin: false,
    isPremium: false,
    isVerified: false,
    verificationCode: '123456',
    verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    freeViewsLeft: 2
  },
  {
    name: 'Usuario Premium Expirado',
    phone: '51987654325',
    email: 'expired@test.com',
    password: 'test123',
    isAdmin: false,
    isPremium: true,
    isVerified: true,
    premiumExpiresAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Expirado hace 7 días
    freeViewsLeft: 0
  }
];

const createTestUsers = async () => {
  console.log('🔧 Creando usuarios de prueba...\n');
  
  try {
    // Verificar conexión a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida');
    
    const createdUsers = [];
    
    for (const userData of testUsers) {
      try {
        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({
          where: {
            [Op.or]: [
              { email: userData.email },
              { phone: userData.phone }
            ]
          }
        });
        
        if (existingUser) {
          console.log(`⚠️  Usuario ${userData.email} ya existe, actualizando...`);
          
          // Actualizar usuario existente
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          await existingUser.update({
            ...userData,
            password: hashedPassword
          });
          
          createdUsers.push(existingUser);
          console.log(`✅ Usuario ${userData.email} actualizado`);
        } else {
          // Crear nuevo usuario
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          const newUser = await User.create({
            ...userData,
            password: hashedPassword
          });
          
          createdUsers.push(newUser);
          console.log(`✅ Usuario ${userData.email} creado`);
        }
        
        // Crear wallet si no existe
        const user = createdUsers[createdUsers.length - 1];
        let wallet = await Wallet.findOne({ where: { userId: user.id } });
        
        if (!wallet) {
          wallet = await Wallet.create({
            userId: user.id,
            balance: userData.isAdmin ? 1000.00 : userData.isPremium ? 500.00 : 100.00, // Balance inicial
            status: 'ACTIVE',
            currency: 'PEN'
          });
          console.log(`   💰 Wallet creada con balance inicial: S/ ${wallet.balance}`);
        } else {
          // Actualizar balance si es necesario
          const initialBalance = userData.isAdmin ? 1000.00 : userData.isPremium ? 500.00 : 100.00;
          if (wallet.balance === 0) {
            await wallet.update({ balance: initialBalance });
            console.log(`   💰 Balance actualizado: S/ ${initialBalance}`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Error creando usuario ${userData.email}:`, error.message);
      }
    }
    
    console.log(`\n✅ Proceso completado. ${createdUsers.length} usuarios procesados.\n`);
    
    // Mostrar resumen
    console.log('📋 RESUMEN DE USUARIOS CREADOS:');
    console.log('═'.repeat(80));
    
    for (const user of createdUsers) {
      const wallet = await Wallet.findOne({ where: { userId: user.id } });
      console.log(`📧 ${user.email.padEnd(25)} | ${user.isAdmin ? '👑 Admin' : user.isPremium ? '💎 Premium' : '👤 Regular'} | 💰 S/ ${wallet?.balance || 0}`);
    }
    
    console.log('\n🔑 CREDENCIALES PARA TESTING:');
    console.log('═'.repeat(80));
    testUsers.forEach(user => {
      console.log(`${user.email.padEnd(25)} | ${user.password}`);
    });
    
    console.log('\n💡 CÓMO USAR:');
    console.log('   1. Ejecuta: node comprehensive-test-suite.js');
    console.log('   2. O usa las credenciales en tu frontend/Postman');
    console.log('   3. Para tests de stress: node stress-performance-tests.js');
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
    process.exit(1);
  }
};

// =====================================================
// FUNCIÓN PARA LIMPIAR DATOS DE PRUEBA
// =====================================================

const cleanupTestData = async () => {
  console.log('🧹 Limpiando datos de prueba...\n');
  
  try {
    const testEmails = testUsers.map(u => u.email);
    
    // Buscar usuarios de prueba
    const usersToDelete = await User.findAll({
      where: {
        email: { [Op.in]: testEmails }
      }
    });
    
    console.log(`Encontrados ${usersToDelete.length} usuarios de prueba para eliminar`);
    
    for (const user of usersToDelete) {
      // Eliminar wallet asociada
      await Wallet.destroy({ where: { userId: user.id } });
      
      // Eliminar usuario
      await user.destroy();
      
      console.log(`✅ Usuario ${user.email} eliminado`);
    }
    
    console.log('\n✅ Limpieza completada');
    
  } catch (error) {
    console.error('❌ Error en limpieza:', error.message);
  }
};

// =====================================================
// FUNCIÓN PARA CREAR DATOS DE PRUEBA ADICIONALES
// =====================================================

const createTestData = async () => {
  console.log('📊 Creando datos de prueba adicionales...\n');
  
  try {
    const { Prediction, Tournament } = require('./src/models');
    
    // Crear predicciones de prueba
    const samplePredictions = [
      {
        league: 'Premier League',
        match: 'Manchester City vs Arsenal',
        homeTeam: 'Manchester City',
        awayTeam: 'Arsenal',
        prediction: 'Manchester City ganará',
        predictionType: '1X2',
        confidence: 85,
        odds: 1.65,
        matchTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isHot: true,
        isPremium: false,
        sport: 'football',
        status: 'ACTIVE'
      },
      {
        league: 'La Liga',
        match: 'Real Madrid vs Barcelona',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        prediction: 'Más de 2.5 goles',
        predictionType: 'OVER_UNDER',
        confidence: 78,
        odds: 1.85,
        matchTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
        isHot: true,
        isPremium: true,
        sport: 'football',
        status: 'ACTIVE'
      },
      {
        league: 'Serie A',
        match: 'Juventus vs Inter',
        homeTeam: 'Juventus',
        awayTeam: 'Inter',
        prediction: 'Ambos equipos anotarán',
        predictionType: 'BTTS',
        confidence: 72,
        odds: 1.95,
        matchTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
        isHot: false,
        isPremium: false,
        sport: 'football',
        status: 'ACTIVE'
      }
    ];
    
    for (const predData of samplePredictions) {
      const existing = await Prediction.findOne({
        where: { match: predData.match }
      });
      
      if (!existing) {
        await Prediction.create(predData);
        console.log(`✅ Predicción creada: ${predData.match}`);
      } else {
        console.log(`⚠️  Predicción ya existe: ${predData.match}`);
      }
    }
    
    // Crear torneos de prueba
    const sampleTournaments = [
      {
        name: 'Torneo Diario de Fútbol',
        description: 'Torneo diario para predicciones de fútbol',
        type: 'DAILY_CLASSIC',
        buyIn: 10.00,
        maxPlayers: 50,
        currentPlayers: 0,
        prizePool: 450.00,
        status: 'REGISTRATION',
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
        registrationDeadline: new Date(Date.now() + 1 * 60 * 60 * 1000),
        predictionsCount: 3,
        isHot: true,
        isFeatured: true
      },
      {
        name: 'Freeroll Semanal',
        description: 'Torneo gratuito semanal',
        type: 'FREEROLL',
        buyIn: 0.00,
        maxPlayers: 100,
        currentPlayers: 0,
        prizePool: 200.00,
        status: 'UPCOMING',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 30 * 60 * 60 * 1000),
        registrationDeadline: new Date(Date.now() + 23 * 60 * 60 * 1000),
        predictionsCount: 5,
        isHot: false,
        isFeatured: true
      }
    ];
    
    for (const tournamentData of sampleTournaments) {
      const existing = await Tournament.findOne({
        where: { name: tournamentData.name }
      });
      
      if (!existing) {
        await Tournament.create(tournamentData);
        console.log(`✅ Torneo creado: ${tournamentData.name}`);
      } else {
        console.log(`⚠️  Torneo ya existe: ${tournamentData.name}`);
      }
    }
    
    console.log('\n✅ Datos de prueba adicionales creados');
    
  } catch (error) {
    console.error('❌ Error creando datos adicionales:', error.message);
  }
};

// =====================================================
// EJECUTAR SEGÚN ARGUMENTOS
// =====================================================

const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.includes('--cleanup')) {
    await cleanupTestData();
  } else if (args.includes('--data')) {
    await createTestData();
  } else if (args.includes('--all')) {
    await createTestUsers();
    await createTestData();
  } else {
    await createTestUsers();
  }
  
  process.exit(0);
};

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = {
  createTestUsers,
  cleanupTestData,
  createTestData,
  testUsers
};