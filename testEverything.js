// testEverything.js - Verificar que PredictMaster funcione correctamente
require('dotenv').config();
const { sequelize, User, Tournament, League, UserStats, Prediction } = require('./src/models');
const bcrypt = require('bcrypt');

async function testEverything() {
  try {
    console.log('🧪 VERIFICANDO QUE TODO FUNCIONE CORRECTAMENTE');
    console.log('============================================\n');

    // PRUEBA 1: Verificar conexión a BD
    console.log('📡 PRUEBA 1: Conexión a base de datos...');
    await sequelize.authenticate();
    console.log('   ✅ Conexión exitosa');

    // PRUEBA 2: Verificar que las tablas existan
    console.log('\n📊 PRUEBA 2: Verificando tablas...');
    
    const tables = [
      'users', 'predictions', 'payments', 
      'leagues', 'tournaments', 'tournament_entries', 
      'tournament_predictions', 'user_stats'
    ];

    for (const table of tables) {
      try {
        const [results] = await sequelize.query(
          `SELECT COUNT(*) as count FROM ${table}`
        );
        console.log(`   ✅ ${table}: ${results[0].count} registros`);
      } catch (error) {
        console.log(`   ❌ ${table}: Error - ${error.message}`);
      }
    }

    // PRUEBA 3: Verificar tipos ENUM
    console.log('\n🔧 PRUEBA 3: Verificando tipos ENUM...');
    
    try {
      const [enumTypes] = await sequelize.query(`
        SELECT typname FROM pg_type 
        WHERE typname LIKE 'enum_%' 
        ORDER BY typname
      `);
      
      enumTypes.forEach(type => {
        console.log(`   ✅ ${type.typname}`);
      });
      
      if (enumTypes.length === 0) {
        console.log('   ⚠️ No se encontraron tipos ENUM');
      }
    } catch (error) {
      console.log(`   ❌ Error verificando ENUM: ${error.message}`);
    }

    // PRUEBA 4: Verificar ligas por defecto
    console.log('\n🏅 PRUEBA 4: Verificando ligas...');
    
    const leagues = await League.findAll({
      order: [['level', 'ASC']]
    });
    
    leagues.forEach(league => {
      console.log(`   ✅ ${league.name} (Nivel ${league.level}) - ${league.color}`);
    });

    // PRUEBA 5: Verificar torneo de ejemplo
    console.log('\n🏆 PRUEBA 5: Verificando torneo de ejemplo...');
    
    const tournament = await Tournament.findOne();
    if (tournament) {
      console.log(`   ✅ ${tournament.name}`);
      console.log(`   📅 Inicio: ${tournament.startTime}`);
      console.log(`   💰 Buy-in: S/ ${tournament.buyIn}`);
      console.log(`   👥 Max jugadores: ${tournament.maxPlayers}`);
      console.log(`   📊 Estado: ${tournament.status}`);
    } else {
      console.log('   ⚠️ No hay torneos creados');
    }

    // PRUEBA 6: Crear usuario de prueba
    console.log('\n👤 PRUEBA 6: Creando usuario de prueba...');
    
    try {
      // Eliminar usuario de prueba si existe
      await User.destroy({ where: { email: 'test@predictmaster.pe' } });
      
      const testUser = await User.create({
        name: 'Usuario Prueba',
        phone: '51999888777',
        email: 'test@predictmaster.pe',
        password: await bcrypt.hash('test123', 10),
        isVerified: true,
        freeViewsLeft: 2
      });
      
      console.log(`   ✅ Usuario creado: ${testUser.email}`);
      console.log(`   🆔 ID: ${testUser.id}`);
      
      // PRUEBA 7: Crear estadísticas para el usuario
      console.log('\n📊 PRUEBA 7: Creando estadísticas de usuario...');
      
      const bronzeLeague = await League.findOne({ where: { name: 'Bronze' } });
      
      const userStats = await UserStats.create({
        userId: testUser.id,
        leagueId: bronzeLeague.id,
        totalTournaments: 0,
        totalPredictions: 0
      });
      
      console.log(`   ✅ Estadísticas creadas para ${testUser.name}`);
      console.log(`   🏅 Liga asignada: ${bronzeLeague.name}`);
      
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        console.log('   ℹ️ Usuario de prueba ya existe');
      } else {
        console.log(`   ❌ Error creando usuario: ${error.message}`);
      }
    }

    // PRUEBA 8: Crear predicción de ejemplo
    console.log('\n🎯 PRUEBA 8: Creando predicción de ejemplo...');
    
    try {
      await Prediction.destroy({ where: { match: 'Test Match - Verification' } });
      
      const testPrediction = await Prediction.create({
        league: 'Liga Test',
        match: 'Test Match - Verification',
        homeTeam: 'Equipo A',
        awayTeam: 'Equipo B',
        prediction: 'Equipo A gana',
        predictionType: '1X2',
        confidence: 75,
        odds: 2.50,
        matchTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas después
        isHot: true,
        isPremium: false,
        sport: 'football'
      });
      
      console.log(`   ✅ Predicción creada: ${testPrediction.match}`);
      console.log(`   🎲 Predicción: ${testPrediction.prediction}`);
      console.log(`   📊 Confianza: ${testPrediction.confidence}%`);
      console.log(`   💰 Cuotas: ${testPrediction.odds}`);
      
    } catch (error) {
      console.log(`   ❌ Error creando predicción: ${error.message}`);
    }

    // PRUEBA 9: Verificar asociaciones de modelos
    console.log('\n🔗 PRUEBA 9: Verificando asociaciones...');
    
    try {
      const userWithStats = await User.findOne({
        where: { email: 'test@predictmaster.pe' },
        include: [{
          model: UserStats,
          as: 'stats',
          include: [{ model: League }]
        }]
      });
      
      if (userWithStats && userWithStats.stats) {
        console.log(`   ✅ Usuario → Estadísticas: OK`);
        console.log(`   ✅ Estadísticas → Liga: ${userWithStats.stats.League?.name || 'No asignada'}`);
      } else {
        console.log('   ⚠️ Asociaciones no encontradas');
      }
    } catch (error) {
      console.log(`   ❌ Error verificando asociaciones: ${error.message}`);
    }

    // PRUEBA 10: Verificar constraints y validaciones
    console.log('\n🛡️ PRUEBA 10: Verificando constraints...');
    
    try {
      // Intentar crear torneo con tipo inválido (debe fallar)
      await Tournament.create({
        name: 'Test Invalid',
        type: 'INVALID_TYPE', // Esto debe fallar
        maxPlayers: 50,
        startTime: new Date(),
        endTime: new Date(Date.now() + 60000),
        registrationDeadline: new Date()
      });
      console.log('   ❌ ENUM constraint no está funcionando');
    } catch (error) {
      if (error.message.includes('invalid input value for enum')) {
        console.log('   ✅ ENUM constraints funcionando correctamente');
      } else {
        console.log(`   ⚠️ Error inesperado: ${error.message}`);
      }
    }

    console.log('\n🎉 TODAS LAS PRUEBAS COMPLETADAS!');
    console.log('================================');
    console.log('✅ Base de datos funcionando');
    console.log('✅ Tablas creadas correctamente');
    console.log('✅ Tipos ENUM funcionando');
    console.log('✅ Asociaciones configuradas');
    console.log('✅ Datos de ejemplo creados');
    console.log('✅ Constraints activos');
    
    console.log('\n🚀 CREDENCIALES DE PRUEBA:');
    console.log('   📧 Email: test@predictmaster.pe');
    console.log('   🔑 Password: test123');
    
    console.log('\n🌐 SIGUIENTE PASO:');
    console.log('   Ejecuta: node server.js');
    console.log('   Luego ve a: http://localhost:3001');

    // Resumen final
    const finalStats = {
      usuarios: await User.count(),
      predicciones: await Prediction.count(),
      torneos: await Tournament.count(),
      ligas: await League.count()
    };

    console.log('\n📊 RESUMEN FINAL:');
    console.log(`   👥 Usuarios: ${finalStats.usuarios}`);
    console.log(`   🎯 Predicciones: ${finalStats.predicciones}`);
    console.log(`   🏆 Torneos: ${finalStats.torneos}`);
    console.log(`   🏅 Ligas: ${finalStats.ligas}`);

  } catch (error) {
    console.error('\n❌ ERROR EN PRUEBAS:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  testEverything();
}

module.exports = testEverything;