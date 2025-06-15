// fixDatabase.js - Arreglar columnas faltantes
require('dotenv').config();
const { sequelize } = require('./src/models');

async function fixDatabase() {
  try {
    console.log('🔧 Arreglando base de datos...\n');

    // 1. Verificar qué columnas existen
    console.log('📊 Verificando columnas existentes en users...');
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log('Columnas actuales:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // 2. Agregar columnas faltantes
    console.log('\n➕ Agregando columnas faltantes...');
    
    try {
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS free_views_left INTEGER DEFAULT 2;
      `);
      console.log('✅ Columna free_views_left agregada');
    } catch (error) {
      console.log('⚠️ Error agregando free_views_left:', error.message);
    }

    try {
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS last_free_view_reset DATE DEFAULT CURRENT_DATE;
      `);
      console.log('✅ Columna last_free_view_reset agregada');
    } catch (error) {
      console.log('⚠️ Error agregando last_free_view_reset:', error.message);
    }

    // 3. Actualizar valores para usuarios existentes
    console.log('\n🔄 Actualizando usuarios existentes...');
    await sequelize.query(`
      UPDATE users 
      SET free_views_left = 2, 
          last_free_view_reset = CURRENT_DATE 
      WHERE free_views_left IS NULL;
    `);

    // 4. Verificar columnas después de los cambios
    console.log('\n📊 Columnas después de los cambios:');
    const [newColumns] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('free_views_left', 'last_free_view_reset')
      ORDER BY ordinal_position;
    `);
    
    newColumns.forEach(col => {
      console.log(`  ✅ ${col.column_name} (${col.data_type})`);
    });

    // 5. Mostrar usuarios actualizados
    console.log('\n👥 Usuarios en el sistema:');
    const [users] = await sequelize.query(`
      SELECT name, email, is_admin as "isAdmin", is_premium as "isPremium", 
             free_views_left as "freeViewsLeft", last_free_view_reset as "lastReset"
      FROM users 
      ORDER BY created_at;
    `);
    console.table(users);

    console.log('\n✅ Base de datos arreglada!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar
fixDatabase();