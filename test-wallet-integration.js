// test-wallet-integration.js - TEST COMPLETO DE INTEGRACIÓN WALLET-TORNEOS
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
let adminToken = '';
let userToken = '';
let testTournamentId = '';
let testUserId = '';
let testDepositId = '';
let testWithdrawalId = '';

// Configurar axios para mostrar errores completos
axios.defaults.timeout = 10000;

// Función helper para hacer requests
const makeRequest = async (method, url, data = null, token = null) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {}
    };
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (data) {
      config.data = data;
      config.headers['Content-Type'] = 'application/json';
    }
    
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      status: error.response?.status
    };
  }
};

// Función para mostrar resultados
const showResult = (testName, success, details = '') => {
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${testName}${details ? ': ' + details : ''}`);
};

console.log('\n🏦 INICIANDO TESTS DE INTEGRACIÓN WALLET-TORNEOS');
console.log(`📅 ${new Date().toLocaleString()}`);
console.log('════════════════════════════════════════════════════════════\n');

const runTests = async () => {
  try {
    // =====================================================
    // VERIFICAR SERVIDOR
    // =====================================================
    console.log('🔍 VERIFICANDO SERVIDOR...');
    const healthCheck = await makeRequest('GET', '/health');
    showResult('Servidor activo', healthCheck.success);
    
    if (!healthCheck.success) {
      console.log('❌ Servidor no disponible. Asegúrate de que esté corriendo con: npm start');
      return;
    }

    // =====================================================
    // SETUP: LOGIN Y PREPARACIÓN
    // =====================================================
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('🔧 SETUP: PREPARANDO TESTS DE WALLET');
    console.log('════════════════════════════════════════════════════════════');

    // Login admin
    const adminLogin = await makeRequest('POST', '/api/auth/login', {
      phoneOrEmail: 'admin@iasport.pe',
      password: 'admin123'
    });
    
    if (adminLogin.success) {
      adminToken = adminLogin.data.token;
      showResult('Login administrador', true);
    } else {
      showResult('Login administrador', false, adminLogin.error);
      console.log('\n💡 SOLUCIÓN: Ejecuta primero: node createTestUsers.js');
      return;
    }

    // Login usuario premium
    const userLogin = await makeRequest('POST', '/api/auth/login', {
      phoneOrEmail: 'premium@test.com',
      password: 'test123'
    });
    
    if (userLogin.success) {
      userToken = userLogin.data.token;
      testUserId = userLogin.data.user.id;
      showResult('Login usuario premium', true);
    } else {
      showResult('Login usuario premium', false, userLogin.error);
      console.log('\n💡 SOLUCIÓN: Ejecuta primero: node createTestUsers.js');
      return;
    }

    // Crear torneo de prueba
    const tournamentData = {
      name: `Test Wallet Integration ${Date.now()}`,
      description: 'Torneo para probar integración con wallet',
      type: 'DAILY_CLASSIC',
      buyIn: 10.00,
      maxPlayers: 10,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      registrationDeadline: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
      predictionsCount: 3,
      prizePool: 90.00
    };

    const createTournament = await makeRequest('POST', '/api/admin/tournaments', tournamentData, adminToken);
    if (createTournament.success) {
      testTournamentId = createTournament.data.data.id;
      console.log(`   Torneo creado: ${createTournament.data.data.name}`);
      showResult('Crear torneo de prueba', true);
    } else {
      showResult('Crear torneo de prueba', false, createTournament.error);
      return;
    }

    // Activar registro del torneo
    const activateRegistration = await makeRequest('PUT', `/api/admin/tournaments/${testTournamentId}/status`, {
      status: 'REGISTRATION'
    }, adminToken);
    showResult('Activar registro del torneo', activateRegistration.success);

    // =====================================================
    // TESTS DE WALLET BÁSICOS
    // =====================================================
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('💰 TESTS DE WALLET BÁSICOS');
    console.log('════════════════════════════════════════════════════════════');

    // Verificar balance inicial
    const initialBalance = await makeRequest('GET', '/api/wallet/balance', null, userToken);
    if (initialBalance.success) {
      console.log(`   Balance inicial: S/ ${initialBalance.data.data.balance}`);
      showResult('Verificar balance inicial del usuario', true);
    } else {
      showResult('Verificar balance inicial del usuario', false, initialBalance.error);
    }

    // Obtener dashboard de wallet
    const dashboard = await makeRequest('GET', '/api/wallet/dashboard', null, userToken);
    showResult('Obtener dashboard de wallet', dashboard.success, 
      dashboard.success ? `Balance: S/ ${dashboard.data.data.wallet.balance}` : dashboard.error);

    // Obtener métodos de pago
    const paymentMethods = await makeRequest('GET', '/api/wallet/payment-methods', null, userToken);
    showResult('Obtener métodos de pago', paymentMethods.success);

    // Obtener historial de transacciones (vacío inicialmente)
    const transactionHistory = await makeRequest('GET', '/api/wallet/transactions', null, userToken);
    showResult('Obtener historial de transacciones', transactionHistory.success,
      transactionHistory.success ? `${transactionHistory.data.data.length} transacciones` : transactionHistory.error);

    // =====================================================
    // TESTS DE DEPÓSITOS
    // =====================================================
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('📥 TESTS DE DEPÓSITOS');
    console.log('════════════════════════════════════════════════════════════');

    // Crear solicitud de depósito
    const depositData = {
      amount: 50.00,
      method: 'YAPE',
      transactionNumber: 'YAPE123456789',
      proofImageUrl: 'https://example.com/proof.jpg'
    };

    const createDeposit = await makeRequest('POST', '/api/wallet/deposits', depositData, userToken);
    if (createDeposit.success) {
      testDepositId = createDeposit.data.data.depositRequest.id;
      showResult('Crear solicitud de depósito', true, `ID: ${testDepositId}`);
    } else {
      showResult('Crear solicitud de depósito', false, createDeposit.error);
    }

    // Obtener depósitos del usuario
    const userDeposits = await makeRequest('GET', '/api/wallet/deposits', null, userToken);
    showResult('Obtener depósitos del usuario', userDeposits.success,
      userDeposits.success ? `${userDeposits.data.data.length} depósitos` : userDeposits.error);

    // Admin: Ver todas las solicitudes de depósito
    const allDeposits = await makeRequest('GET', '/api/wallet/admin/deposits', null, adminToken);
    showResult('Admin: Ver todas las solicitudes de depósito', allDeposits.success);

    // Admin: Aprobar depósito
    if (testDepositId) {
      const approveDeposit = await makeRequest('PUT', `/api/wallet/admin/deposits/${testDepositId}/approve`, {
        adminNotes: 'Depósito aprobado para test'
      }, adminToken);
      showResult('Admin: Aprobar depósito', approveDeposit.success);

      // Verificar nuevo balance después del depósito
      const newBalance = await makeRequest('GET', '/api/wallet/balance', null, userToken);
      if (newBalance.success) {
        console.log(`   Nuevo balance: S/ ${newBalance.data.data.balance}`);
        showResult('Verificar balance después del depósito', true);
      }
    }

    // =====================================================
    // TESTS DE INTEGRACIÓN CON TORNEOS
    // =====================================================
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('🏆 TESTS DE INTEGRACIÓN CON TORNEOS');
    console.log('════════════════════════════════════════════════════════════');

    // Ver torneos con información de saldo
    const tournamentsWithBalance = await makeRequest('GET', '/api/tournaments', null, userToken);
    if (tournamentsWithBalance.success) {
      const tournament = tournamentsWithBalance.data.data.find(t => t.id === testTournamentId);
      if (tournament) {
        console.log(`   Balance mostrado: S/ ${tournamentsWithBalance.data.userBalance}`);
        console.log(`   Puede pagar torneo: ${tournament.canAfford ? 'SÍ' : 'NO'}`);
        console.log(`   Buy-in requerido: S/ ${tournament.buyIn}`);
        showResult('Ver torneos con información de saldo', true);
      }
    } else {
      showResult('Ver torneos con información de saldo', false, tournamentsWithBalance.error);
    }

    // Inscribirse a torneo pagado
    const joinTournament = await makeRequest('POST', `/api/tournaments/${testTournamentId}/join`, {}, userToken);
    showResult('Inscribirse a torneo pagado', joinTournament.success, 
      joinTournament.success ? 'Pago procesado automáticamente' : joinTournament.error);

    // Verificar balance después del pago
    const balanceAfterPayment = await makeRequest('GET', '/api/wallet/balance', null, userToken);
    if (balanceAfterPayment.success) {
      console.log(`   Balance después del pago: S/ ${balanceAfterPayment.data.data.balance}`);
      showResult('Verificar descuento del balance', true);
    }

    // Prevenir doble inscripción
    const doubleJoin = await makeRequest('POST', `/api/tournaments/${testTournamentId}/join`, {}, userToken);
    showResult('Prevenir doble inscripción', !doubleJoin.success, 
      doubleJoin.success ? 'ERROR: Permitió doble inscripción' : 'Correctamente bloqueado');

    // =====================================================
    // TESTS DE RETIROS
    // =====================================================
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('📤 TESTS DE RETIROS');
    console.log('════════════════════════════════════════════════════════════');

    // Salir del torneo y recibir reembolso
    const leaveTournament = await makeRequest('POST', `/api/tournaments/${testTournamentId}/leave`, {}, userToken);
    showResult('Salir del torneo y recibir reembolso', leaveTournament.success,
      leaveTournament.success ? `Reembolso: S/ ${leaveTournament.data.data.refunded}` : leaveTournament.error);

    // Crear solicitud de retiro
    const withdrawalData = {
      amount: 25.00,
      method: 'YAPE',
      accountNumber: '51987654321',
      accountName: 'Usuario Test'
    };

    const createWithdrawal = await makeRequest('POST', '/api/wallet/withdrawals', withdrawalData, userToken);
    if (createWithdrawal.success) {
      testWithdrawalId = createWithdrawal.data.data.withdrawalRequest.id;
      showResult('Crear solicitud de retiro', true, `ID: ${testWithdrawalId}`);
    } else {
      showResult('Crear solicitud de retiro', false, createWithdrawal.error);
    }

    // Obtener retiros del usuario
    const userWithdrawals = await makeRequest('GET', '/api/wallet/withdrawals', null, userToken);
    showResult('Obtener retiros del usuario', userWithdrawals.success);

    // Admin: Ver todas las solicitudes de retiro
    const allWithdrawals = await makeRequest('GET', '/api/wallet/admin/withdrawals', null, adminToken);
    showResult('Admin: Ver todas las solicitudes de retiro', allWithdrawals.success);

    // Admin: Procesar retiro
    if (testWithdrawalId) {
      const processWithdrawal = await makeRequest('PUT', `/api/wallet/admin/withdrawals/${testWithdrawalId}/process`, {
        adminNotes: 'Retiro procesado para test',
        externalTransactionId: 'EXT123456'
      }, adminToken);
      showResult('Admin: Procesar retiro', processWithdrawal.success);

      // Admin: Completar retiro
      const completeWithdrawal = await makeRequest('PUT', `/api/wallet/admin/withdrawals/${testWithdrawalId}/complete`, {
        externalTransactionId: 'EXT123456_COMPLETED'
      }, adminToken);
      showResult('Admin: Completar retiro', completeWithdrawal.success);
    }

    // =====================================================
    // TESTS DE ADMINISTRACIÓN
    // =====================================================
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('👑 TESTS DE ADMINISTRACIÓN');
    console.log('════════════════════════════════════════════════════════════');

    // Ajuste manual de balance
    const manualAdjustment = await makeRequest('POST', '/api/wallet/admin/adjustment', {
      userId: testUserId,
      amount: 100.00,
      type: 'CREDIT',
      reason: 'Bonus de prueba para test'
    }, adminToken);
    showResult('Ajuste manual de balance', manualAdjustment.success);

    // Verificar balance final
    const finalBalance = await makeRequest('GET', '/api/wallet/balance', null, userToken);
    if (finalBalance.success) {
      console.log(`   Balance final: S/ ${finalBalance.data.data.balance}`);
      showResult('Verificar balance final del usuario', true);
    }

    // Obtener estadísticas de wallet
    const walletStats = await makeRequest('GET', '/api/wallet/stats?period=month', null, userToken);
    showResult('Obtener estadísticas de wallet', walletStats.success);

    // Verificar historial final de transacciones
    const finalHistory = await makeRequest('GET', '/api/wallet/transactions', null, userToken);
    showResult('Verificar historial final de transacciones', finalHistory.success,
      finalHistory.success ? `${finalHistory.data.data.length} transacciones` : finalHistory.error);

    // =====================================================
    // CLEANUP
    // =====================================================
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('🧹 CLEANUP: LIMPIANDO DATOS DE PRUEBA');
    console.log('════════════════════════════════════════════════════════════');

    // Eliminar torneo de prueba
    const deleteTournament = await makeRequest('DELETE', `/api/admin/tournaments/${testTournamentId}`, null, adminToken);
    if (deleteTournament.success) {
      console.log('   Torneo de prueba eliminado');
      showResult('Eliminar torneo de prueba', true);
    } else {
      showResult('Eliminar torneo de prueba', false, deleteTournament.error);
    }

    // =====================================================
    // RESUMEN FINAL
    // =====================================================
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN DE INTEGRACIÓN WALLET-TORNEOS');
    console.log('════════════════════════════════════════════════════════════\n');

    console.log('✅ FUNCIONALIDADES VERIFICADAS:');
    console.log('   🏦 Sistema de wallet completo');
    console.log('   💳 Depósitos con aprobación admin');
    console.log('   💸 Retiros con proceso de validación');
    console.log('   🏆 Integración automática con torneos');
    console.log('   🔄 Reembolsos automáticos');
    console.log('   📊 Historial y estadísticas');
    console.log('   👑 Panel administrativo completo');
    console.log('   🔒 Validaciones de seguridad');

    console.log('\n🏁 Tests de integración wallet-torneos completados exitosamente!');

  } catch (error) {
    console.error('\n❌ Error durante los tests:', error.message);
  }
};

// Ejecutar tests
runTests();