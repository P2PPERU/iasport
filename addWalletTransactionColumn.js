// addWalletTransactionColumn.js - Agregar columna wallet_transaction_id a tournament_entries
require('dotenv').config();
const { sequelize } = require('./src/models');

async function addWalletTransactionColumn() {
  try {
    console.log('🔧 AGREGANDO COLUMNA WALLET_TRANSACTION_ID A TOURNAMENT_ENTRIES');
    console.log('===========================================================\n');

    console.log('📡 Conectando a PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Conectado exitosamente\n');

    // Verificar si la columna ya existe
    console.log('🔍 Verificando si la columna ya existe...');
    const [checkResult] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tournament_entries' 
      AND column_name = 'wallet_transaction_id'
    `);

    if (checkResult.length > 0) {
      console.log('✅ La columna wallet_transaction_id ya existe\n');
    } else {
      console.log('❌ La columna no existe, agregándola...\n');

      // Agregar la columna
      await sequelize.query(`
        ALTER TABLE tournament_entries 
        ADD COLUMN wallet_transaction_id UUID REFERENCES wallet_transactions(id)
      `);
      console.log('✅ Columna wallet_transaction_id agregada exitosamente\n');

      // Crear índice para la nueva columna
      await sequelize.query(`
        CREATE INDEX idx_tournament_entries_wallet_transaction_id 
        ON tournament_entries(wallet_transaction_id)
      `);
      console.log('✅ Índice creado para wallet_transaction_id\n');
    }

    console.log('🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE!');
    console.log('==================================');
    console.log('✅ La tabla tournament_entries ahora tiene la columna wallet_transaction_id');
    console.log('✅ Puedes iniciar el servidor normalmente');
    console.log('\n🚀 Ejecuta: npm run dev');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.message.includes('relation "wallet_transactions" does not exist')) {
      console.log('\n🔧 La tabla wallet_transactions no existe');
      console.log('   Primero debes crear las tablas del sistema de wallet');
      console.log('   Ejecuta: node createWalletTables.js');
    }
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  addWalletTransactionColumn();
}

module.exports = addWalletTransactionColumn;