require('dotenv').config();
const { Sequelize } = require('sequelize');

async function testDB() {
  try {
    console.log('Probando conexión a PostgreSQL...');
    
    const sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false
      }
    );

    await sequelize.authenticate();
    console.log('✅ PostgreSQL conectado');
    console.log('📊 Database:', process.env.DB_NAME);
    
    const [result] = await sequelize.query('SELECT version()');
    console.log('📈 PostgreSQL:', result[0].version.split(' ')[1]);
    
    await sequelize.close();
    console.log('🎯 Test completado exitosamente');
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('');
      console.log('🔧 SOLUCIÓN:');
      console.log('1. Abre "Servicios" en Windows (Win+R, escribe services.msc)');
      console.log('2. Busca "postgresql" en la lista');
      console.log('3. Click derecho -> Iniciar');
      console.log('4. O ejecuta como admin: net start postgresql-x64-14');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('');
      console.log('🔧 La base de datos no existe:');
      console.log('1. Abre pgAdmin o ejecuta:');
      console.log('   psql -U postgres -p 5433');
      console.log('   CREATE DATABASE ia_sport_db;');
    }
  }
}

testDB();