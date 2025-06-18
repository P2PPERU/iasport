// setupPredictMaster.js - Setup completo para PredictMaster
require('dotenv').config();
const { sequelize, User, Prediction, Tournament, League, UserStats } = require('./src/models');
const bcrypt = require('bcrypt');

async function setupPredictMaster() {
  try {
    console.log('🚀 CONFIGURANDO PREDICTMASTER - PLATAFORMA DE TORNEOS');
    console.log('=====================================================\n');

    // 1. Crear tablas de torneos
    console.log('📦 1. Creando tablas de torneos...');
    await sequelize.sync({ alter: true }); // O { force: true } si estás empezando
    console.log('✅ Tablas sincronizadas correctamente');

    // 2. Verificar/crear usuarios de prueba
    console.log('\n👥 2. Configurando usuarios de prueba...');
    
    // Admin
    let admin = await User.findOne({ where: { email: 'admin@iasport.pe' } });
    if (!admin) {
      admin = await User.create({
        name: 'Admin PredictMaster',
        phone: '51999000001',
        email: 'admin@iasport.pe',
        password: await bcrypt.hash('admin123', 10),
        isAdmin: true,
        isPremium: true,
        isVerified: true,
        freeViewsLeft: 99,
        lastFreeViewReset: new Date()
      });
      console.log('   ✅ Usuario admin creado');
    }

    // Usuario demo
    let demo = await User.findOne({ where: { email: 'demo@iasport.pe' } });
    if (!demo) {
      demo = await User.create({
        name: 'Demo User',
        phone: '51999000002',
        email: 'demo@iasport.pe',
        password: await bcrypt.hash('demo123', 10),
        isAdmin: false,
        isPremium: false,
        isVerified: true,
        freeViewsLeft: 2,
        lastFreeViewReset: new Date()
      });
      console.log('   ✅ Usuario demo creado');
    }

    // Usuario premium de ejemplo
    let premium = await User.findOne({ where: { email: 'premium@iasport.pe' } });
    if (!premium) {
      const premiumExpiry = new Date();
      premiumExpiry.setDate(premiumExpiry.getDate() + 30);
      
      premium = await User.create({
        name: 'Premium User',
        phone: '51999000003',
        email: 'premium@iasport.pe',
        password: await bcrypt.hash('premium123', 10),
        isAdmin: false,
        isPremium: true,
        premiumExpiresAt: premiumExpiry,
        isVerified: true,
        freeViewsLeft: 2,
        lastFreeViewReset: new Date()
      });
      console.log('   ✅ Usuario premium creado');
    }

    // 3. Crear predicciones base para torneos
    console.log('\n🎯 3. Configurando predicciones para torneos...');
    await Prediction.destroy({ where: {} }); // Limpiar predicciones existentes
    
    const now = new Date();
    const predictions = [
      {
        league: 'Liga 1 Perú',
        match: 'Alianza Lima vs Universitario',
        homeTeam: 'Alianza Lima',
        awayTeam: 'Universitario',
        prediction: 'Más de 2.5 Goles',
        predictionType: 'OVER_UNDER',
        confidence: 85,
        odds: 1.85,
        matchTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        isHot: true,
        isPremium: false,
        sport: 'football',
        result: 'PENDING'
      },
      {
        league: 'Premier League',
        match: 'Manchester City vs Liverpool',
        homeTeam: 'Manchester City',
        awayTeam: 'Liverpool',
        prediction: 'Ambos Equipos Marcan',
        predictionType: 'BTTS',
        confidence: 78,
        odds: 1.65,
        matchTime: new Date(now.getTime() + 3 * 60 * 60 * 1000),
        isHot: false,
        isPremium: false,
        sport: 'football',
        result: 'PENDING'
      },
      {
        league: 'La Liga',
        match: 'Real Madrid vs Barcelona',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        prediction: 'Real Madrid Gana',
        predictionType: '1X2',
        confidence: 72,
        odds: 2.10,
        matchTime: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        isHot: true,
        isPremium: false,
        sport: 'football',
        result: 'PENDING'
      },
      {
        league: 'Champions League',
        match: 'Bayern Munich vs PSG',
        homeTeam: 'Bayern Munich',
        awayTeam: 'PSG',
        prediction: 'Bayern Munich -1 Handicap',
        predictionType: 'HANDICAP',
        confidence: 88,
        odds: 1.95,
        matchTime: new Date(now.getTime() + 5 * 60 * 60 * 1000),
        isHot: true,
        isPremium: true,
        sport: 'football',
        result: 'PENDING'
      },
      {
        league: 'Serie A',
        match: 'Juventus vs Inter Milan',
        homeTeam: 'Juventus',
        awayTeam: 'Inter Milan',
        prediction: 'Under 2.5 Goles',
        predictionType: 'OVER_UNDER',
        confidence: 65,
        odds: 2.35,
        matchTime: new Date(now.getTime() + 6 * 60 * 60 * 1000),
        isHot: false,
        isPremium: false,
        sport: 'football',
        result: 'PENDING'
      },
      {
        league: 'NBA',
        match: 'Lakers vs Warriors',
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        prediction: 'Over 220.5 Puntos',
        predictionType: 'OVER_UNDER',
        confidence: 82,
        odds: 1.90,
        matchTime: new Date(now.getTime() + 7 * 60 * 60 * 1000),
        isHot: false,
        isPremium: true,
        sport: 'basketball',
        result: 'PENDING'
      }
    ];

    for (const pred of predictions) {
      await Prediction.create(pred);
    }
    console.log(`   ✅ ${predictions.length} predicciones creadas`);

    // 4. Crear torneos de ejemplo
    console.log('\n🏆 4. Creando torneos de ejemplo...');
    await Tournament.destroy({ where: {} }); // Limpiar torneos existentes
    
    const tournaments = [
      {
        name: 'Freeroll Bienvenida',
        description: '¡Torneo gratuito para nuevos usuarios! Demuestra tu habilidad predictiva sin riesgo.',
        type: 'FREEROLL',
        buyIn: 0.00,
        maxPlayers: 50,
        startTime: new Date(now.getTime() + 30 * 60 * 1000), // 30 minutos
        endTime: new Date(now.getTime() + 4 * 60 * 60 * 1000), // 4 horas
        registrationDeadline: new Date(now.getTime() + 20 * 60 * 1000), // 20 minutos
        predictionsCount: 3,
        prizePool: 500.00,
        status: 'REGISTRATION',
        isHot: true,
        isFeatured: true,
        payoutStructure: { "1": 60, "2": 25, "3": 15 }
      },
      {
        name: 'Hyper Turbo Fútbol',
        description: 'Torneo rápido de fútbol. 4 predicciones en 2 horas. ¡Acción garantizada!',
        type: 'HYPER_TURBO',
        buyIn: 10.00,
        maxPlayers: 30,
        startTime: new Date(now.getTime() + 1 * 60 * 60 * 1000), // 1 hora
        endTime: new Date(now.getTime() + 3 * 60 * 60 * 1000), // 3 horas
        registrationDeadline: new Date(now.getTime() + 50 * 60 * 1000), // 50 minutos
        predictionsCount: 4,
        status: 'REGISTRATION',
        isHot: true,
        payoutStructure: { "1": 50, "2": 30, "3": 20 }
      },
      {
        name: 'Daily Classic Liga 1',
        description: 'Torneo clásico diario enfocado en la Liga 1 Peruana. Para verdaderos conocedores.',
        type: 'DAILY_CLASSIC',
        buyIn: 25.00,
        maxPlayers: 100,
        startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 horas
        endTime: new Date(now.getTime() + 10 * 60 * 60 * 1000), // 10 horas
        registrationDeadline: new Date(now.getTime() + 1.5 * 60 * 60 * 1000), // 1.5 horas
        predictionsCount: 6,
        status: 'REGISTRATION',
        payoutStructure: { "1": 40, "2": 25, "3": 15, "4": 10, "5": 5, "6": 5 }
      },
      {
        name: 'El Predictor Maestro - Edición Especial',
        description: 'El torneo definitivo. 1 semana de competición. Solo para los mejores predictores.',
        type: 'SPECIAL',
        buyIn: 100.00,
        maxPlayers: 200,
        startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 1 día
        endTime: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000), // 8 días
        registrationDeadline: new Date(now.getTime() + 20 * 60 * 60 * 1000), // 20 horas
        predictionsCount: 15,
        status: 'UPCOMING',
        isHot: true,
        isFeatured: true,
        payoutStructure: { 
          "1": 40, "2": 20, "3": 12, "4": 8, "5": 5, 
          "6": 3, "7": 2, "8": 2, "9": 2, "10": 2,
          "11": 1, "12": 1, "13": 1, "14": 1, "15": 1 
        }
      },
      {
        name: 'Weekly Masters Multideporte',
        description: 'Torneo semanal que incluye fútbol, básquet y más deportes. Diversión completa.',
        type: 'WEEKLY_MASTERS',
        buyIn: 50.00,
        maxPlayers: 75,
        startTime: new Date(now.getTime() + 6 * 60 * 60 * 1000), // 6 horas
        endTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 días
        registrationDeadline: new Date(now.getTime() + 5 * 60 * 60 * 1000), // 5 horas
        predictionsCount: 10,
        status: 'REGISTRATION',
        payoutStructure: { "1": 35, "2": 20, "3": 15, "4": 10, "5": 8, "6": 6, "7": 3, "8": 2, "9": 1 }
      }
    ];

    for (const tournament of tournaments) {
      await Tournament.create(tournament);
    }
    console.log(`   ✅ ${tournaments.length} torneos creados`);

    // 5. Crear estadísticas básicas para usuarios
    console.log('\n📊 5. Inicializando estadísticas de usuarios...');
    
    const users = [admin, demo, premium];
    const bronzeLeague = await League.findOne({ where: { name: 'Bronze' } });
    
    for (const user of users) {
      const existingStats = await UserStats.findOne({ where: { userId: user.id } });
      if (!existingStats) {
        await UserStats.create({
          userId: user.id,
          leagueId: bronzeLeague.id
        });
      }
    }
    console.log('   ✅ Estadísticas iniciales creadas');

    // 6. Mostrar resumen final
    console.log('\n🎉 PREDICTMASTER CONFIGURADO EXITOSAMENTE!');
    console.log('============================================');
    console.log('📊 Resumen:');
    
    const totalUsers = await User.count();
    const totalPredictions = await Prediction.count();
    const totalTournaments = await Tournament.count();
    const totalLeagues = await League.count();
    
    console.log(`   👥 Usuarios: ${totalUsers}`);
    console.log(`   🎯 Predicciones: ${totalPredictions}`);
    console.log(`   🏆 Torneos: ${totalTournaments}`);
    console.log(`   🏅 Ligas: ${totalLeagues}`);
    
    console.log('\n🔑 Credenciales de acceso:');
    console.log('   📧 Admin: admin@iasport.pe / admin123');
    console.log('   📧 Demo: demo@iasport.pe / demo123');
    console.log('   📧 Premium: premium@iasport.pe / premium123');
    
    console.log('\n🌐 Endpoints principales:');
    console.log('   • GET /api/tournaments - Ver torneos disponibles');
    console.log('   • POST /api/tournaments/:id/join - Inscribirse a torneo');
    console.log('   • GET /api/tournaments/ranking/global - Ranking global');
    console.log('   • GET /api/admin/tournaments/stats - Estadísticas admin');
    
    console.log('\n🚀 Para iniciar el servidor:');
    console.log('   node server.js');
    
    console.log('\n🎯 ¡Tu plataforma de torneos de pronósticos está lista!');
    console.log('   Inicia el servidor y comienza a competir 🏆');

  } catch (error) {
    console.error('❌ Error en el setup:', error);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  setupPredictMaster();
}

module.exports = setupPredictMaster;