require('dotenv').config();
const sequelize = require('./src/config/database');

async function testFinal() {
  try {
    console.log('🔍 Configuración:');
    console.log('- Host:', process.env.DB_HOST);
    console.log('- Puerto:', process.env.DB_PORT);
    console.log('- Base de datos:', process.env.DB_NAME);
    console.log('- Usuario:', process.env.DB_USER);
    
    console.log('\n🔄 Conectando...');
    await sequelize.authenticate();
    console.log('✅ ¡CONEXIÓN EXITOSA!');
    
    // Probar consultas
    const [users] = await sequelize.query('SELECT COUNT(*) as total FROM users');
    console.log(`\n👥 Usuarios: ${users[0].total}`);
    
    const [predictions] = await sequelize.query('SELECT COUNT(*) as total FROM predictions');
    console.log(`🎯 Predicciones: ${predictions[0].total}`);
    
    // Ver las predicciones
    const [predList] = await sequelize.query(`
      SELECT league, match, prediction, confidence, odds 
      FROM predictions 
      ORDER BY match_time 
      LIMIT 3
    `);
    
    console.log('\n📋 Primeras 3 predicciones:');
    console.table(predList);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

testFinal();