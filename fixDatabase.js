// fix-db.js - Solucionar problema de ENUM en PostgreSQL
require('dotenv').config();
const { Sequelize } = require('sequelize');

async function fixDatabase() {
  try {
    console.log('🔧 Solucionando problema de base de datos...');
    
    const sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: true // Mostrar SQL para debug
      }
    );

    console.log('📡 Conectando a PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Conectado exitosamente');

    // OPCIÓN 1: Limpiar y recrear tablas problemáticas
    console.log('\n🗑️ Eliminando tablas problemáticas...');
    
    const tablesToDrop = [
      'tournament_predictions',
      'tournament_entries', 
      'tournaments',
      'user_stats',
      'leagues'
    ];

    for (const table of tablesToDrop) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
        console.log(`   ✅ ${table} eliminada`);
      } catch (error) {
        console.log(`   ⚠️ ${table} no existía o error: ${error.message}`);
      }
    }

    // Eliminar tipos ENUM si existen
    console.log('\n🧹 Limpiando tipos ENUM...');
    const enumTypes = [
      'enum_tournaments_type',
      'enum_tournaments_status',
      'enum_tournament_entries_status',
      'enum_tournament_predictions_result'
    ];

    for (const enumType of enumTypes) {
      try {
        await sequelize.query(`DROP TYPE IF EXISTS ${enumType} CASCADE;`);
        console.log(`   ✅ ${enumType} eliminado`);
      } catch (error) {
        console.log(`   ⚠️ ${enumType} no existía`);
      }
    }

    console.log('\n✅ Limpieza completada');
    console.log('🚀 Ahora ejecuta: node createTournamentTables.js');
    
    await sequelize.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n🔧 PostgreSQL no está corriendo');
      console.log('   Solución: Inicia PostgreSQL en Servicios de Windows');
    }
  }
}

fixDatabase();