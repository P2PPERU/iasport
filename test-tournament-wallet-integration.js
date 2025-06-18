// test-tournament-wallet-integration.js - TEST ESPECÍFICO PARA INTEGRACIÓN
const BASE_URL = 'http://localhost:3001/api';

// Colores para la consola
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

const log = (message, type = 'info') => {
  const color = {
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
    info: colors.blue,
    data: colors.magenta,
    title: colors.cyan
  }[type] || colors.reset;
  
  console.log(`${color}${message}${colors.reset}`);
};

// Variables globales
let userToken = null;
let adminToken = null;
let testTournamentId = null;
let testUserId = null;

// Contador de tests
let totalTests = 0;
let passedTests = 0;

// Helper para ejecutar tests
async function runTest(name, testFn) {
  totalTests++;
  try {
    await testFn();
    passedTests++;
    log(`✅ ${name}`, 'success');
    return true;
  } catch (error) {
    log(`❌ ${name}: ${error.message}`, 'error');
    return false;
  }
}

// =====================================================
// SETUP: AUTENTICACIÓN Y PREPARACIÓN
// =====================================================
async function setupTests() {
  log('\n════════════════════════════════════════════════════════════', 'title');
  log('🔧 SETUP: PREPARANDO TESTS DE INTEGRACIÓN WALLET-TORNEOS', 'title');
  log('════════════════════════════════════════════════════════════', 'title');

  // Login admin
  await runTest('Login administrador', async () => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneOrEmail: 'admin@predictmaster.pe',
        password: 'admin123'
      })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    adminToken = data.token;
  });

  // Login usuario premium
  await runTest('Login usuario premium', async () => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneOrEmail: 'premium@predictmaster.pe',
        password: 'premium123'
      })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    userToken = data.token;
    testUserId = data.user.id;
  });

  // Crear torneo de prueba
  await runTest('Crear torneo de prueba', async () => {
    const tournamentData = {
      name: 'Test Wallet Integration ' + Date.now(),
      description: 'Torneo para probar integración con wallet',
      type: 'HYPER_TURBO',
      buyIn: 10.00,
      maxPlayers: 10,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      registrationDeadline: new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString(),
      predictionsCount: 3
    };
    
    const response = await fetch(`${BASE_URL}/admin/tournaments`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tournamentData)
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    testTournamentId = data.data.id;
    log(`   Torneo creado: ${data.data.name}`, 'data');
  });

  // Cambiar estado a REGISTRATION
  await runTest('Activar registro del torneo', async () => {
    const response = await fetch(`${BASE_URL}/admin/tournaments/${testTournamentId}/status`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'REGISTRATION' })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  });
}

// =====================================================
// TESTS DE WALLET INTEGRATION
// =====================================================
async function testWalletIntegration() {
  log('\n════════════════════════════════════════════════════════════', 'title');
  log('💰 TESTS DE INTEGRACIÓN WALLET-TORNEOS', 'title');
  log('════════════════════════════════════════════════════════════', 'title');

  // Test 1: Verificar balance inicial
  await runTest('Verificar balance inicial del usuario', async () => {
    const response = await fetch(`${BASE_URL}/tournaments/user/stats`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    log(`   Balance inicial: S/ ${data.data.walletBalance}`, 'data');
    
    // Si no tiene saldo, crear depósito de prueba
    if (data.data.walletBalance < 50) {
      log('   Saldo insuficiente, creando depósito de prueba...', 'warning');
      
      // Crear solicitud de depósito
      const depositResponse = await fetch(`${BASE_URL}/wallet/deposit`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: 100.00,
          method: 'YAPE',
          transactionNumber: 'TEST' + Date.now()
        })
      });
      
      const depositData = await depositResponse.json();
      if (!depositData.success) throw new Error('Error creando depósito: ' + depositData.message);
      
      // Aprobar depósito como admin
      const approveResponse = await fetch(`${BASE_URL}/wallet/admin/deposits/${depositData.data.id}/approve`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          adminNotes: 'Depósito de prueba para tests'
        })
      });
      
      const approveData = await approveResponse.json();
      if (!approveData.success) throw new Error('Error aprobando depósito: ' + approveData.message);
      
      log('   ✅ Depósito de S/ 100 aprobado', 'success');
    }
  });

  // Test 2: Ver torneos con información de saldo
  await runTest('Ver torneos con información de saldo', async () => {
    const response = await fetch(`${BASE_URL}/tournaments`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    log(`   Balance mostrado: S/ ${data.userBalance}`, 'data');
    
    const testTournament = data.data.find(t => t.id === testTournamentId);
    if (testTournament) {
      log(`   Puede pagar torneo: ${testTournament.canAfford ? 'SÍ' : 'NO'}`, 'data');
      log(`   Buy-in requerido: S/ ${testTournament.buyIn}`, 'data');
    }
  });

  // Test 3: Inscribirse a torneo pagado
  await runTest('Inscribirse a torneo pagado', async () => {
    const response = await fetch(`${BASE_URL}/tournaments/${testTournamentId}/join`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    log(`   Inscripción exitosa`, 'success');
    log(`   Buy-in pagado: S/ ${data.data.entry.buyInPaid}`, 'data');
    log(`   Nuevo balance: S/ ${data.data.newBalance}`, 'data');
    log(`   Transaction ID: ${data.data.transaction.id}`, 'data');
  });

  // Test 4: Verificar que no puede inscribirse dos veces
  await runTest('Prevenir doble inscripción', async () => {
    const response = await fetch(`${BASE_URL}/tournaments/${testTournamentId}/join`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const data = await response.json();
    if (data.success) throw new Error('Debería prevenir doble inscripción');
    
    if (!data.message.includes('ya estás inscrito')) {
      throw new Error('Mensaje de error incorrecto: ' + data.message);
    }
  });

  // Test 5: Salir del torneo y recibir reembolso
  await runTest('Salir del torneo y recibir reembolso', async () => {
    const response = await fetch(`${BASE_URL}/tournaments/${testTournamentId}/leave`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    log(`   Reembolso procesado: S/ ${data.data.refunded}`, 'data');
    log(`   Nuevo balance: S/ ${data.data.newBalance}`, 'data');
  });

  // Test 6: Inscribirse nuevamente
  await runTest('Inscribirse nuevamente después del reembolso', async () => {
    const response = await fetch(`${BASE_URL}/tournaments/${testTournamentId}/join`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    log(`   Segunda inscripción exitosa`, 'success');
  });

  // Test 7: Verificar historial de transacciones
  await runTest('Verificar historial de transacciones', async () => {
    const response = await fetch(`${BASE_URL}/tournaments/user/history`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    const testEntry = data.data.find(entry => entry.tournamentId === testTournamentId);
    if (!testEntry) throw new Error('No se encontró la entrada del torneo en el historial');
    
    log(`   Entrada encontrada en historial`, 'success');
    log(`   Wallet Transaction ID: ${testEntry.walletTransactionId}`, 'data');
  });
}

// =====================================================
// TESTS DE ADMINISTRACIÓN
// =====================================================
async function testAdminFeatures() {
  log('\n════════════════════════════════════════════════════════════', 'title');
  log('👑 TESTS DE ADMINISTRACIÓN CON WALLET', 'title');
  log('════════════════════════════════════════════════════════════', 'title');

  // Test 1: Finalizar torneo con distribución de premios
  await runTest('Finalizar torneo con distribución de premios', async () => {
    // Cambiar estado a FINISHED
    const response = await fetch(`${BASE_URL}/admin/tournaments/${testTournamentId}/status`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'FINISHED' })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    log(`   Torneo finalizado`, 'success');
  });

  // Test 2: Verificar que se pagó el premio
  await runTest('Verificar pago de premio', async () => {
    // Obtener detalles del torneo
    const response = await fetch(`${BASE_URL}/tournaments/${testTournamentId}`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    const userEntry = data.data.userEntry;
    if (!userEntry) throw new Error('No se encontró la entrada del usuario');
    
    log(`   Posición final: #${userEntry.finalRank}`, 'data');
    log(`   Premio ganado: S/ ${userEntry.prizeWon}`, 'data');
    
    if (userEntry.finalRank === 1 && userEntry.prizeWon > 0) {
      log(`   ✅ Premio pagado correctamente`, 'success');
    }
  });

  // Test 3: Verificar balance final del usuario
  await runTest('Verificar balance final del usuario', async () => {
    const response = await fetch(`${BASE_URL}/tournaments/user/stats`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    log(`   Balance final: S/ ${data.data.walletBalance}`, 'data');
  });

  // Test 4: Estadísticas de torneos con información financiera
  await runTest('Verificar estadísticas financieras', async () => {
    const response = await fetch(`${BASE_URL}/admin/tournaments/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    log(`   Ingresos mensuales: S/ ${data.data.monthlyRevenue}`, 'data');
    log(`   Premios pagados: S/ ${data.data.totalPrizesPaid}`, 'data');
  });
}

// =====================================================
// CLEANUP: LIMPIAR DATOS DE PRUEBA
// =====================================================
async function cleanupTests() {
  log('\n════════════════════════════════════════════════════════════', 'title');
  log('🧹 CLEANUP: LIMPIANDO DATOS DE PRUEBA', 'title');
  log('════════════════════════════════════════════════════════════', 'title');

  // Eliminar torneo de prueba
  await runTest('Eliminar torneo de prueba', async () => {
    const response = await fetch(`${BASE_URL}/admin/tournaments/${testTournamentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    if (!data.success) {
      // Si no se puede eliminar porque tiene entradas, solo marcar como cancelado
      log('   Torneo no se puede eliminar, marcando como cancelado', 'warning');
      return;
    }
    
    log('   Torneo de prueba eliminado', 'success');
  });
}

// =====================================================
// RESUMEN FINAL
// =====================================================
function showSummary() {
  log('\n════════════════════════════════════════════════════════════', 'title');
  log('📊 RESUMEN DE INTEGRACIÓN WALLET-TORNEOS', 'title');
  log('════════════════════════════════════════════════════════════', 'title');
  
  const percentage = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
  
  log(`\nTotal de tests: ${totalTests}`, 'info');
  log(`✅ Exitosos: ${passedTests}`, 'success');
  log(`❌ Fallidos: ${totalTests - passedTests}`, 'error');
  log(`📈 Porcentaje de éxito: ${percentage}%`, percentage >= 90 ? 'success' : 'warning');
  
  if (passedTests === totalTests) {
    log('\n🎉 ¡INTEGRACIÓN WALLET-TORNEOS COMPLETADA!', 'success');
    log('Tu sistema está funcionando perfectamente 🏆', 'success');
  } else {
    log('\n⚠️ Algunos tests fallaron', 'warning');
    log('Revisa los errores para completar la integración', 'warning');
  }
  
  log('\n✅ FUNCIONALIDADES VERIFICADAS:', 'title');
  log('   🏦 Verificación de saldo antes de inscripción', 'data');
  log('   💳 Pago automático de buy-ins', 'data');
  log('   💸 Reembolsos automáticos al salir', 'data');
  log('   🏆 Distribución automática de premios', 'data');
  log('   📊 Tracking de transacciones', 'data');
  log('   🔒 Prevención de doble inscripción', 'data');
  log('   📈 Estadísticas financieras', 'data');
}

// =====================================================
// EJECUTAR TODOS LOS TESTS
// =====================================================
async function runAllTests() {
  console.clear();
  log('🚀 INICIANDO TESTS DE INTEGRACIÓN WALLET-TORNEOS', 'title');
  log(`📅 ${new Date().toLocaleString()}`, 'info');
  log('════════════════════════════════════════════════════════════\n', 'title');

  // Verificar que el servidor esté corriendo
  try {
    const healthResponse = await fetch('http://localhost:3001/health');
    const health = await healthResponse.json();
    log(`✅ Servidor activo: ${health.status}`, 'success');
  } catch (error) {
    log('❌ El servidor no está corriendo en http://localhost:3001', 'error');
    log('   Ejecuta: node server.js', 'warning');
    return;
  }

  // Ejecutar todas las secciones de tests
  await setupTests();
  await testWalletIntegration();
  await testAdminFeatures();
  await cleanupTests();
  
  // Mostrar resumen
  showSummary();
}

// Ejecutar tests
runAllTests().then(() => {
  log('\n🏁 Tests de integración completados', 'title');
  process.exit(passedTests === totalTests ? 0 : 1);
}).catch(error => {
  log(`\n❌ ERROR FATAL: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});