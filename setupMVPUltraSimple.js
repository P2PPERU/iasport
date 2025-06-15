require('dotenv').config();
const { sequelize, User, Prediction } = require('./src/models');
const bcrypt = require('bcrypt');

async function setupMVPUltraSimple() {
  try {
    console.log('🚀 Configurando MVP Ultra Simple...\n');

    // 1. Crear tabla de predicciones desbloqueadas
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS unlocked_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
        unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        method VARCHAR(20) DEFAULT 'VIDEO',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, prediction_id)
      );
    `);

    // 2. Agregar campos para vistas gratis
    await sequelize.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS free_views_left INTEGER DEFAULT 2;
    `);
    await sequelize.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_free_view_reset DATE DEFAULT CURRENT_DATE;
    `);

    // 3. Limpiar y crear predicciones de hoy
    await Prediction.destroy({ where: {} });
    
    const today = new Date();
    const predictions = [
      {
        league: 'Liga 1 Perú',
        match: 'Alianza Lima vs Universitario',
        homeTeam: 'Alianza Lima',
        awayTeam: 'Universitario',
        prediction: 'Más de 2.5 Goles',
        predictionType: 'OVER_UNDER',
        confidence: 92,
        odds: 1.85,
        matchTime: new Date(today.getTime() + 6 * 60 * 60 * 1000), // +6 horas
        isHot: true,
        isPremium: true,
        sport: 'football',
        result: 'PENDING'
      },
      {
        league: 'Premier League',
        match: 'Liverpool vs Chelsea',
        homeTeam: 'Liverpool',
        awayTeam: 'Chelsea',
        prediction: 'Liverpool Gana',
        predictionType: '1X2',
        confidence: 88,
        odds: 1.50,
        matchTime: new Date(today.getTime() + 3 * 60 * 60 * 1000), // +3 horas
        isHot: true,
        isPremium: true,
        sport: 'football',
        result: 'PENDING'
      },
      {
        league: 'La Liga',
        match: 'Real Madrid vs Barcelona',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        prediction: 'Ambos Equipos Marcan',
        predictionType: 'BTTS',
        confidence: 85,
        odds: 1.65,
        matchTime: new Date(today.getTime() + 4 * 60 * 60 * 1000), // +4 horas
        isHot: false,
        isPremium: false, // Esta es gratis
        sport: 'football',
        result: 'PENDING'
      },
      {
        league: 'Serie A',
        match: 'Juventus vs Inter',
        homeTeam: 'Juventus',
        awayTeam: 'Inter',
        prediction: 'Empate',
        predictionType: '1X2',
        confidence: 78,
        odds: 3.20,
        matchTime: new Date(today.getTime() + 5 * 60 * 60 * 1000), // +5 horas
        isHot: false,
        isPremium: false, // Esta también es gratis
        sport: 'football',
        result: 'PENDING'
      }
    ];

    for (const pred of predictions) {
      await Prediction.create(pred);
    }

    console.log('✅ MVP configurado exitosamente!');
    console.log('\n📱 Usuarios de prueba:');
    console.log('   Admin: admin@iasport.pe / admin123');
    console.log('   Demo: demo@iasport.pe / demo123');
    console.log('\n🎯 Predicciones creadas: 4 (2 premium, 2 gratis)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  setupMVPUltraSimple();
}