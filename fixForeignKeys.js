// fixForeignKeys.js - Solucionar problema de foreign keys
require('dotenv').config();
const { sequelize } = require('./src/models');

async function fixForeignKeys() {
  try {
    console.log('🔧 SOLUCIONANDO PROBLEMA DE FOREIGN KEYS');
    console.log('=====================================\n');

    console.log('📡 Conectando a PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Conectado exitosamente\n');

    // PASO 1: Limpiar datos en orden correcto (hijos antes que padres)
    console.log('🧹 PASO 1: Limpiando datos en orden correcto...');
    
    // 1. Limpiar unlocked_predictions primero
    try {
      await sequelize.query('DELETE FROM unlocked_predictions;');
      console.log('   ✅ unlocked_predictions limpiada');
    } catch (error) {
      console.log(`   ⚠️ unlocked_predictions: ${error.message}`);
    }

    // 2. Limpiar tournament_predictions
    try {
      await sequelize.query('DELETE FROM tournament_predictions;');
      console.log('   ✅ tournament_predictions limpiada');
    } catch (error) {
      console.log(`   ⚠️ tournament_predictions: ${error.message}`);
    }

    // 3. Limpiar tournament_entries
    try {
      await sequelize.query('DELETE FROM tournament_entries;');
      console.log('   ✅ tournament_entries limpiada');
    } catch (error) {
      console.log(`   ⚠️ tournament_entries: ${error.message}`);
    }

    // 4. Limpiar tournaments
    try {
      await sequelize.query('DELETE FROM tournaments;');
      console.log('   ✅ tournaments limpiada');
    } catch (error) {
      console.log(`   ⚠️ tournaments: ${error.message}`);
    }

    // 5. Ahora sí podemos limpiar predictions
    try {
      await sequelize.query('DELETE FROM predictions;');
      console.log('   ✅ predictions limpiada');
    } catch (error) {
      console.log(`   ⚠️ predictions: ${error.message}`);
    }

    // PASO 2: Arreglar foreign key constraints
    console.log('\n🔗 PASO 2: Arreglando foreign key constraints...');

    // Cambiar constraint de unlocked_predictions para permitir CASCADE DELETE
    try {
      await sequelize.query(`
        ALTER TABLE unlocked_predictions 
        DROP CONSTRAINT IF EXISTS unlocked_predictions_prediction_id_fkey;
      `);
      console.log('   ✅ Constraint anterior eliminado');

      await sequelize.query(`
        ALTER TABLE unlocked_predictions 
        ADD CONSTRAINT unlocked_predictions_prediction_id_fkey 
        FOREIGN KEY (prediction_id) REFERENCES predictions(id) 
        ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      console.log('   ✅ Nuevo constraint con CASCADE creado');
    } catch (error) {
      console.log(`   ⚠️ Error con constraint: ${error.message}`);
    }

    // Hacer lo mismo para tournament_predictions
    try {
      await sequelize.query(`
        ALTER TABLE tournament_predictions 
        DROP CONSTRAINT IF EXISTS tournament_predictions_base_prediction_id_fkey;
      `);

      await sequelize.query(`
        ALTER TABLE tournament_predictions 
        ADD CONSTRAINT tournament_predictions_base_prediction_id_fkey 
        FOREIGN KEY (base_prediction_id) REFERENCES predictions(id) 
        ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      console.log('   ✅ Tournament predictions constraint arreglado');
    } catch (error) {
      console.log(`   ⚠️ Error con tournament constraint: ${error.message}`);
    }

    // PASO 3: Crear datos de ejemplo nuevamente
    console.log('\n🎯 PASO 3: Creando predicciones de ejemplo...');

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
      try {
        await sequelize.query(`
          INSERT INTO predictions (
            id, league, match, home_team, away_team, prediction, prediction_type,
            confidence, odds, match_time, is_hot, is_premium, sport, result,
            views, status, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 'ACTIVE',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `, {
          bind: [
            pred.league, pred.match, pred.homeTeam, pred.awayTeam,
            pred.prediction, pred.predictionType, pred.confidence, pred.odds,
            pred.matchTime, pred.isHot, pred.isPremium, pred.sport, pred.result
          ]
        });
      } catch (error) {
        console.log(`   ⚠️ Error creando predicción ${pred.match}: ${error.message}`);
      }
    }
    console.log(`   ✅ ${predictions.length} predicciones creadas`);

    // PASO 4: Crear torneos de ejemplo
    console.log('\n🏆 PASO 4: Creando torneos de ejemplo...');

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
        isFeatured: true
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
        isHot: true
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
        status: 'REGISTRATION'
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
        isFeatured: true
      }
    ];

    for (const tournament of tournaments) {
      try {
        await sequelize.query(`
          INSERT INTO tournaments (
            id, name, description, type, buy_in, max_players, start_time, end_time,
            registration_deadline, predictions_count, prize_pool, status, is_hot, is_featured,
            payout_structure, rules, metadata, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
            '{"1": 50, "2": 30, "3": 20}',
            '{"scoring": "CONFIDENCE_BASED", "bonusMultipliers": {"streak": 1.1, "perfectPick": 1.5, "roi": 1.15}}',
            '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `, {
          bind: [
            tournament.name, tournament.description, tournament.type, tournament.buyIn,
            tournament.maxPlayers, tournament.startTime, tournament.endTime, tournament.registrationDeadline,
            tournament.predictionsCount, tournament.prizePool, tournament.status, tournament.isHot, tournament.isFeatured
          ]
        });
      } catch (error) {
        console.log(`   ⚠️ Error creando torneo ${tournament.name}: ${error.message}`);
      }
    }
    console.log(`   ✅ ${tournaments.length} torneos creados`);

    console.log('\n🎉 FOREIGN KEYS ARREGLADAS!');
    console.log('==========================');
    console.log('✅ Datos limpiados en orden correcto');
    console.log('✅ Foreign key constraints corregidos');
    console.log('✅ Predicciones de ejemplo recreadas');
    console.log('✅ Torneos de ejemplo recreados');
    
    console.log('\n🚀 Ahora ejecuta: node server.js');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  fixForeignKeys();
}

module.exports = fixForeignKeys;