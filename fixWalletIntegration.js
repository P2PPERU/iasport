// fixWalletIntegration.js - Solucionar problemas de integración wallet-torneos
require('dotenv').config();
const { sequelize, User, Wallet, WalletTransaction, DepositRequest, WithdrawalRequest } = require('./src/models');

async function fixWalletIntegration() {
  try {
    console.log('🔧 SOLUCIONANDO PROBLEMAS DE INTEGRACIÓN WALLET-TORNEOS');
    console.log('====================================================\n');

    console.log('📡 Conectando a PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Conectado exitosamente\n');

    // PASO 1: Verificar si las tablas existen
    console.log('🔍 PASO 1: Verificando tablas de wallet...');
    
    const [walletTablesResult] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('wallets', 'wallet_transactions', 'deposit_requests', 'withdrawal_requests')
    `);
    
    const existingTables = walletTablesResult.map(row => row.table_name);
    const requiredTables = ['wallets', 'wallet_transactions', 'deposit_requests', 'withdrawal_requests'];
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      console.log('❌ Faltan tablas:', missingTables.join(', '));
      console.log('   Ejecutando createWalletTables.js...');
      
      const createWalletTables = require('./createWalletTables');
      await createWalletTables();
    } else {
      console.log('✅ Todas las tablas de wallet existen');
    }

    // PASO 2: Verificar columna wallet_transaction_id en tournament_entries
    console.log('\n🔍 PASO 2: Verificando columna wallet_transaction_id...');
    
    const [columnResult] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tournament_entries' 
      AND column_name = 'wallet_transaction_id'
    `);
    
    if (columnResult.length === 0) {
      console.log('❌ Columna wallet_transaction_id no existe en tournament_entries');
      console.log('   Agregando columna...');
      
      await sequelize.query(`
        ALTER TABLE tournament_entries 
        ADD COLUMN wallet_transaction_id UUID REFERENCES wallet_transactions(id);
        
        CREATE INDEX idx_tournament_entries_wallet_transaction_id 
        ON tournament_entries(wallet_transaction_id);
      `);
      
      console.log('✅ Columna wallet_transaction_id agregada');
    } else {
      console.log('✅ Columna wallet_transaction_id existe');
    }

    // PASO 3: Limpiar solicitudes pendientes
    console.log('\n🧹 PASO 3: Limpiando solicitudes pendientes...');
    
    // Limpiar depósitos pendientes
    const depositResult = await DepositRequest.update(
      { status: 'EXPIRED' },
      { where: { status: 'PENDING' } }
    );
    
    console.log(`✅ ${depositResult[0]} depósitos pendientes marcados como expirados`);
    
    // Limpiar retiros pendientes
    const withdrawalResult = await WithdrawalRequest.findAll({
      where: { status: ['PENDING', 'PROCESSING'] },
      include: [{ model: WalletTransaction, as: 'transaction' }]
    });
    
    for (const withdrawal of withdrawalResult) {
      const t = await sequelize.transaction();
      
      try {
        // Obtener wallet
        const wallet = await Wallet.findByPk(withdrawal.walletId, {
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        
        if (wallet) {
          // Devolver fondos a la wallet
          const newBalance = parseFloat(wallet.balance) + parseFloat(withdrawal.amount);
          await wallet.update({ balance: newBalance }, { transaction: t });
          
          // Marcar transacción como cancelada
          if (withdrawal.transaction) {
            await withdrawal.transaction.update({ status: 'CANCELLED' }, { transaction: t });
          }
          
          // Marcar retiro como cancelado
          await withdrawal.update({ 
            status: 'CANCELLED',
            adminNotes: 'Cancelado automáticamente por sistema de reparación'
          }, { transaction: t });
          
          console.log(`✅ Retiro ${withdrawal.id} cancelado y fondos devueltos: S/ ${withdrawal.amount}`);
        }
        
        await t.commit();
      } catch (error) {
        await t.rollback();
        console.error(`❌ Error procesando retiro ${withdrawal.id}:`, error.message);
      }
    }

    // PASO 4: Crear wallets para usuarios que no tienen
    console.log('\n🏦 PASO 4: Creando wallets para usuarios sin wallet...');
    
    const [usersWithoutWallet] = await sequelize.query(`
      SELECT id FROM users
      WHERE id NOT IN (SELECT user_id FROM wallets)
    `);
    
    for (const user of usersWithoutWallet) {
      await Wallet.create({
        userId: user.id,
        balance: 0,
        status: 'ACTIVE',
        currency: 'PEN'
      });
    }
    
    console.log(`✅ ${usersWithoutWallet.length} wallets creadas`);

    // PASO 5: Agregar saldo a usuarios de prueba
    console.log('\n💰 PASO 5: Agregando saldo a usuarios de prueba...');
    
    const testUsers = ['admin@iasport.pe', 'premium@test.com', 'demo@iasport.pe'];
    
    for (const email of testUsers) {
      const user = await User.findOne({ where: { email } });
      
      if (user) {
        const wallet = await Wallet.findOne({ where: { userId: user.id } });
        
        if (wallet && parseFloat(wallet.balance) < 100) {
          await wallet.update({ 
            balance: 300,
            totalDeposits: parseFloat(wallet.totalDeposits) + (300 - parseFloat(wallet.balance))
          });
          console.log(`✅ Saldo de ${email} actualizado a S/ 300`);
        } else if (wallet) {
          console.log(`ℹ️ ${email} ya tiene saldo suficiente: S/ ${wallet.balance}`);
        }
      }
    }

    // PASO 6: Verificar asociaciones en el modelo
    console.log('\n🔗 PASO 6: Verificando asociaciones en modelos...');
    
    // Verificar que User tenga el método getWallet
    const testUser = await User.findOne();
    if (testUser && typeof testUser.getWallet === 'function') {
      console.log('✅ Método User.getWallet existe');
    } else {
      console.log('❌ Método User.getWallet no existe');
      console.log('   Verifica las asociaciones en src/models/index.js');
    }

    console.log('\n🎉 INTEGRACIÓN WALLET-TORNEOS REPARADA!');
    console.log('====================================');
    console.log('✅ Tablas de wallet verificadas');
    console.log('✅ Columna wallet_transaction_id verificada');
    console.log('✅ Solicitudes pendientes limpiadas');
    console.log('✅ Wallets creadas para todos los usuarios');
    console.log('✅ Saldo agregado a usuarios de prueba');
    console.log('\n🚀 Ahora ejecuta: node test-wallet-integration.js');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    
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
  fixWalletIntegration();
}

module.exports = fixWalletIntegration;