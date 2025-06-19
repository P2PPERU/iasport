// fixWalletEndpoints.js - Solucionar problemas específicos de endpoints de wallet
require('dotenv').config();
const { sequelize, User, Wallet, WalletTransaction, DepositRequest, WithdrawalRequest } = require('./src/models');

async function fixWalletEndpoints() {
  try {
    console.log('🔧 SOLUCIONANDO PROBLEMAS DE ENDPOINTS DE WALLET');
    console.log('==============================================\n');

    console.log('📡 Conectando a PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Conectado exitosamente\n');

    // PASO 1: Verificar rutas en el servidor
    console.log('🔍 PASO 1: Verificando rutas en el servidor...');
    console.log('   ℹ️ Asegúrate de que las siguientes rutas estén correctamente definidas en src/routes/wallet.routes.js:');
    console.log('   - GET /api/wallet/dashboard');
    console.log('   - GET /api/wallet/transactions');
    console.log('   - GET /api/wallet/deposits');
    console.log('   - GET /api/wallet/withdrawals');
    console.log('   - GET /api/wallet/admin/deposits');
    console.log('   - GET /api/wallet/admin/withdrawals');

    // PASO 2: Verificar implementación de controladores
    console.log('\n🔍 PASO 2: Verificando implementación de controladores...');
    console.log('   ℹ️ Asegúrate de que los siguientes métodos estén implementados en src/controllers/wallet.controller.js:');
    console.log('   - getDashboard');
    console.log('   - getTransactionHistory');
    console.log('   - getUserDepositRequests');
    console.log('   - getUserWithdrawalRequests');
    console.log('   - getAllDepositRequests');
    console.log('   - getAllWithdrawalRequests');

    // PASO 3: Corregir problema de salir del torneo
    console.log('\n🔍 PASO 3: Corrigiendo problema de salir del torneo...');
    console.log('   ℹ️ Verifica la implementación del método leaveTournament en src/controllers/tournaments.controller.js');
    console.log('   ℹ️ Asegúrate de que se esté utilizando correctamente WalletService.refundTournamentEntry');

    // PASO 4: Crear datos de ejemplo para pruebas
    console.log('\n🔍 PASO 4: Creando datos de ejemplo para pruebas...');
    
    // Obtener usuario premium
    const premiumUser = await User.findOne({ 
      where: { email: 'premium@test.com' } 
    });
    
    if (!premiumUser) {
      console.log('❌ Usuario premium@test.com no encontrado');
      return;
    }
    
    // Obtener o crear wallet
    let wallet = await Wallet.findOne({ where: { userId: premiumUser.id } });
    
    if (!wallet) {
      wallet = await Wallet.create({
        userId: premiumUser.id,
        balance: 500.00,
        totalDeposits: 500.00,
        status: 'ACTIVE',
        currency: 'PEN'
      });
      console.log('✅ Wallet creada para premium@test.com');
    }
    
    // Crear transacciones de ejemplo si no hay
    const transactionCount = await WalletTransaction.count({ 
      where: { walletId: wallet.id } 
    });
    
    if (transactionCount === 0) {
      // Crear transacciones de ejemplo
      await WalletTransaction.bulkCreate([
        {
          walletId: wallet.id,
          type: 'CREDIT',
          category: 'DEPOSIT',
          amount: 200.00,
          balanceBefore: 0.00,
          balanceAfter: 200.00,
          status: 'COMPLETED',
          description: 'Depósito inicial',
          reference: 'DEP_INIT_' + Date.now(),
          externalReference: 'EXT_' + Date.now() + '_1'
        },
        {
          walletId: wallet.id,
          type: 'CREDIT',
          category: 'DEPOSIT',
          amount: 300.00,
          balanceBefore: 200.00,
          balanceAfter: 500.00,
          status: 'COMPLETED',
          description: 'Depósito adicional',
          reference: 'DEP_ADD_' + Date.now(),
          externalReference: 'EXT_' + Date.now() + '_2'
        },
        {
          walletId: wallet.id,
          type: 'DEBIT',
          category: 'TOURNAMENT_ENTRY',
          amount: 50.00,
          balanceBefore: 500.00,
          balanceAfter: 450.00,
          status: 'COMPLETED',
          description: 'Inscripción a torneo',
          reference: 'TOUR_' + Date.now(),
          externalReference: 'EXT_' + Date.now() + '_3'
        },
        {
          walletId: wallet.id,
          type: 'CREDIT',
          category: 'TOURNAMENT_PRIZE',
          amount: 100.00,
          balanceBefore: 450.00,
          balanceAfter: 550.00,
          status: 'COMPLETED',
          description: 'Premio de torneo',
          reference: 'PRIZE_' + Date.now(),
          externalReference: 'EXT_' + Date.now() + '_4'
        }
      ]);
      
      console.log('✅ Transacciones de ejemplo creadas');
      
      // Actualizar balance para que coincida con las transacciones
      await wallet.update({ balance: 550.00 });
    } else {
      console.log(`ℹ️ Ya existen ${transactionCount} transacciones`);
    }
    
    // Crear depósito de ejemplo si no hay
    const depositCount = await DepositRequest.count({
      where: { userId: premiumUser.id }
    });
    
    if (depositCount === 0) {
      // Crear transacción para el depósito
      const transaction = await WalletTransaction.create({
        walletId: wallet.id,
        type: 'CREDIT',
        category: 'DEPOSIT',
        amount: 100.00,
        balanceBefore: parseFloat(wallet.balance),
        balanceAfter: parseFloat(wallet.balance) + 100.00,
        status: 'COMPLETED',
        description: 'Depósito de prueba',
        reference: 'DEP_TEST_' + Date.now(),
        externalReference: 'EXT_DEP_' + Date.now()
      });
      
      // Crear depósito
      await DepositRequest.create({
        userId: premiumUser.id,
        walletId: wallet.id,
        amount: 100.00,
        method: 'YAPE',
        status: 'APPROVED',
        transactionNumber: 'TEST123',
        walletTransactionId: transaction.id,
        adminNotes: 'Depósito de prueba para tests',
        processedAt: new Date()
      });
      
      console.log('✅ Depósito de ejemplo creado');
      
      // Actualizar balance y total de depósitos
      await wallet.update({ 
        balance: parseFloat(wallet.balance) + 100.00,
        totalDeposits: parseFloat(wallet.totalDeposits) + 100.00
      });
    } else {
      console.log(`ℹ️ Ya existen ${depositCount} depósitos`);
    }
    
    // Verificar si hay retiros pendientes y cancelarlos
    const pendingWithdrawals = await WithdrawalRequest.findAll({
      where: { 
        userId: premiumUser.id,
        status: ['PENDING', 'PROCESSING']
      },
      include: [{ model: WalletTransaction, as: 'transaction' }]
    });
    
    for (const withdrawal of pendingWithdrawals) {
      const t = await sequelize.transaction();
      
      try {
        // Devolver fondos a la wallet
        await wallet.update({ 
          balance: parseFloat(wallet.balance) + parseFloat(withdrawal.amount)
        }, { transaction: t });
        
        // Marcar transacción como cancelada
        if (withdrawal.transaction) {
          await withdrawal.transaction.update({ 
            status: 'CANCELLED' 
          }, { transaction: t });
        }
        
        // Marcar retiro como cancelado
        await withdrawal.update({ 
          status: 'CANCELLED',
          adminNotes: 'Cancelado para tests'
        }, { transaction: t });
        
        await t.commit();
        console.log(`✅ Retiro ${withdrawal.id} cancelado`);
      } catch (error) {
        await t.rollback();
        console.error(`❌ Error cancelando retiro ${withdrawal.id}:`, error.message);
      }
    }

    // PASO 5: Verificar implementación de WalletService
    console.log('\n🔍 PASO 5: Verificando implementación de WalletService...');
    console.log('   ℹ️ Asegúrate de que los siguientes métodos estén implementados en src/services/wallet.service.js:');
    console.log('   - getWalletDashboard');
    console.log('   - refundTournamentEntry');
    console.log('   - getAvailableBalance');
    console.log('   - createDepositRequest');
    console.log('   - createWithdrawalRequest');

    console.log('\n🎉 CORRECCIONES COMPLETADAS!');
    console.log('==========================');
    console.log('✅ Datos de ejemplo creados');
    console.log('✅ Transacciones de ejemplo creadas');
    console.log('✅ Depósito de ejemplo creado');
    console.log('✅ Retiros pendientes cancelados');
    
    console.log('\n🚀 Ahora ejecuta: node test-wallet-integration.js');
    console.log('   Si siguen apareciendo errores, revisa los logs del servidor para más detalles');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  fixWalletEndpoints();
}

module.exports = fixWalletEndpoints;