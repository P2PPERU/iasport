// fixTournamentEntryTable.js - Solucionar problema de wallet_transaction_id
require('dotenv').config();
const { sequelize } = require('./src/models');

async function fixTournamentEntryTable() {
  try {
    console.log('🔧 SOLUCIONANDO PROBLEMA DE TOURNAMENT_ENTRIES');
    console.log('===========================================\n');

    console.log('📡 Conectando a PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Conectado exitosamente\n');

    // PASO 1: Verificar si la tabla wallet_transactions existe
    console.log('🔍 PASO 1: Verificando si existe wallet_transactions...');
    
    const [walletTablesResult] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'wallet_transactions'
    `);
    
    const walletTableExists = walletTablesResult.length > 0;
    
    if (!walletTableExists) {
      console.log('❌ La tabla wallet_transactions no existe');
      console.log('   Primero debes crear las tablas del sistema de wallet');
      console.log('   Ejecuta: node createWalletTables.js');
      return;
    }
    
    console.log('✅ La tabla wallet_transactions existe');

    // PASO 2: Verificar si la columna wallet_transaction_id ya existe
    console.log('\n🔍 PASO 2: Verificando columna wallet_transaction_id...');
    
    const [columnResult] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tournament_entries' 
      AND column_name = 'wallet_transaction_id'
    `);
    
    if (columnResult.length > 0) {
      console.log('✅ La columna wallet_transaction_id ya existe');
    } else {
      console.log('❌ La columna wallet_transaction_id no existe, agregándola...');
      
      await sequelize.query(`
        ALTER TABLE tournament_entries 
        ADD COLUMN wallet_transaction_id UUID REFERENCES wallet_transactions(id)
      `);
      
      console.log('✅ Columna wallet_transaction_id agregada');
    }

    // PASO 3: Verificar si el índice existe
    console.log('\n🔍 PASO 3: Verificando índice...');
    
    const [indexResult] = await sequelize.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'tournament_entries' 
      AND indexname = 'idx_tournament_entries_wallet_transaction_id'
    `);
    
    if (indexResult.length > 0) {
      console.log('✅ El índice idx_tournament_entries_wallet_transaction_id ya existe');
    } else {
      console.log('❌ El índice no existe, creándolo...');
      
      await sequelize.query(`
        CREATE INDEX idx_tournament_entries_wallet_transaction_id 
        ON tournament_entries(wallet_transaction_id)
      `);
      
      console.log('✅ Índice idx_tournament_entries_wallet_transaction_id creado');
    }

    // PASO 4: Actualizar el enum de status para incluir REFUNDED
    console.log('\n🔍 PASO 4: Actualizando enum de status...');
    
    try {
      await sequelize.query(`
        ALTER TYPE enum_tournament_entries_status ADD VALUE IF NOT EXISTS 'REFUNDED'
      `);
      console.log('✅ Valor REFUNDED agregado al enum');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ El valor REFUNDED ya existe en el enum');
      } else {
        throw error;
      }
    }

    console.log('\n🎉 TABLA TOURNAMENT_ENTRIES ACTUALIZADA EXITOSAMENTE!');
    console.log('=================================================');
    console.log('✅ Columna wallet_transaction_id agregada');
    console.log('✅ Índice creado');
    console.log('✅ Enum actualizado con REFUNDED');
    console.log('\n🚀 Ahora puedes iniciar el servidor: npm run dev');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    
    if (error.message.includes('permission denied')) {
      console.log('\n🔧 Error de permisos en PostgreSQL');
      console.log('   Verifica que estás usando el usuario correcto en .env');
    } else if (error.message.includes('does not exist')) {
      console.log('\n🔧 Error: Alguna tabla o tipo no existe');
      console.log('   Asegúrate de que la base de datos esté correctamente configurada');
    } else {
      console.log('\n🔧 Error de PostgreSQL:');
      console.log(`   ${error.message}`);
    }
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  fixTournamentEntryTable();
}

module.exports = fixTournamentEntryTable;