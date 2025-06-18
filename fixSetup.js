require('dotenv').config();
const { sequelize, User, Prediction } = require('./src/models');
const bcrypt = require('bcrypt');

async function fixSetupSimple() {
  try {
    console.log('🚀 Setup simplificado...\n');

    // 1. Verificar/crear usuario demo
    console.log('👤 Configurando usuario demo...');
    let demoUser = await User.findOne({ where: { email: 'demo@iasport.pe' } });
    
    if (!demoUser) {
      // Crear sin campos que pueden no existir
      demoUser = await User.create({
        name: 'Usuario Demo',
        phone: '51999111222',
        email: 'demo@iasport.pe',
        password: await bcrypt.hash('demo123', 10),
        isVerified: true,
        isPremium: false
      });
      console.log('✅ Usuario demo creado');
      
      // Actualizar campos adicionales si existen
      try {
        await sequelize.query(`
          UPDATE users 
          SET free_views_left = 2, 
              last_free_view_reset = CURRENT_DATE 
          WHERE id = :userId
        `, {
          replacements: { userId: demoUser.id }
        });
        console.log('✅ Vistas gratis configuradas');
      } catch (e) {
        console.log('⚠️ No se pudieron configurar vistas gratis');
      }
    } else {
      console.log('✅ Usuario demo ya existe');
    }

    // 2. Verificar admin
    const adminUser = await User.findOne({ where: { email: 'admin@iasport.pe' } });
    console.log(adminUser ? '✅ Admin existe' : '❌ Admin no encontrado');

    // 3. Recrear predicciones
    console.log('\n🎯 Configurando predicciones...');
    await Prediction.destroy({ where: {} });
    
    const now = new Date();
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
        matchTime: new Date(now.getTime() + 6 * 60 * 60 * 1000),
        isHot: true,
        isPremium: true,
        sport: 'football',
        status: 'ACTIVE'
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
        matchTime: new Date(now.getTime() + 3 * 60 * 60 * 1000),
        isHot: true,
        isPremium: true,
        sport: 'football',
        status: 'ACTIVE'
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
        matchTime: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        isHot: false,
        isPremium: false,
        sport: 'football',
        status: 'ACTIVE'
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
        matchTime: new Date(now.getTime() + 5 * 60 * 60 * 1000),
        isHot: false,
        isPremium: false,
        sport: 'football',
        status: 'ACTIVE'
      }
    ];

    for (const pred of predictions) {
      await Prediction.create(pred);
    }
    
    const predCount = await Prediction.count();
    console.log(`✅ ${predCount} predicciones creadas`);

    // 4. Mostrar resumen
    console.log('\n📋 RESUMEN:');
    console.log('===========');
    
    // Contar usuarios sin usar campos que pueden no existir
    const userCount = await User.count();
    console.log(`👥 Usuarios: ${userCount}`);
    console.log(`🎯 Predicciones: ${predCount}`);
    
    console.log('\n🔑 Credenciales:');
    console.log('   Demo: demo@iasport.pe / demo123');
    console.log('   Admin:   / admin123');
    
    console.log('\n✅ Setup completado!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  fixSetupSimple();
}

module.exports = fixSetupSimple;