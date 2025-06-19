// comprehensive-test-suite.js - SUITE COMPLETA DE TESTS
const axios = require('axios');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3001';
let tokens = {
  admin: '',
  premium: '',
  regular: ''
};
let testData = {
  users: {},
  tournaments: {},
  predictions: {},
  wallet: {}
};

// Configuración de axios
axios.defaults.timeout = 15000;

// =====================================================
// UTILIDADES DE TESTING
// =====================================================

const makeRequest = async (method, url, data = null, token = null) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {}
    };
    
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (data) {
      config.data = data;
      config.headers['Content-Type'] = 'application/json';
    }
    
    const start = performance.now();
    const response = await axios(config);
    const duration = performance.now() - start;
    
    return { 
      success: true, 
      data: response.data, 
      status: response.status,
      duration: Math.round(duration)
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
      duration: 0
    };
  }
};

const showResult = (testName, success, details = '', duration = null) => {
  const icon = success ? '✅' : '❌';
  const timing = duration ? ` (${duration}ms)` : '';
  console.log(`${icon} ${testName}${details ? ': ' + details : ''}${timing}`);
};

const showSection = (title) => {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🔍 ${title}`);
  console.log(`${'═'.repeat(60)}`);
};

// =====================================================
// TEST RUNNERS
// =====================================================

class TestRunner {
  constructor() {
    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      duration: 0
    };
  }

  async runTest(name, testFunction, ...args) {
    this.stats.total++;
    const start = performance.now();
    
    try {
      const result = await testFunction(...args);
      const duration = Math.round(performance.now() - start);
      this.stats.duration += duration;
      
      if (result.success !== false) {
        this.stats.passed++;
        showResult(name, true, result.message || '', duration);
      } else {
        this.stats.failed++;
        showResult(name, false, result.error || '', duration);
      }
      
      return result;
    } catch (error) {
      this.stats.failed++;
      const duration = Math.round(performance.now() - start);
      this.stats.duration += duration;
      showResult(name, false, error.message, duration);
      return { success: false, error: error.message };
    }
  }

  showStats() {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 RESUMEN DE TESTS`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`Total: ${this.stats.total}`);
    console.log(`✅ Pasados: ${this.stats.passed}`);
    console.log(`❌ Fallidos: ${this.stats.failed}`);
    console.log(`⏱️  Tiempo total: ${this.stats.duration}ms`);
    console.log(`📈 Tasa de éxito: ${((this.stats.passed / this.stats.total) * 100).toFixed(1)}%`);
  }
}

// =====================================================
// TESTS DE INFRAESTRUCTURA
// =====================================================

const testServerHealth = async () => {
  const result = await makeRequest('GET', '/health');
  if (!result.success) {
    return { success: false, error: 'Servidor no disponible' };
  }
  
  const health = result.data;
  const checks = [
    health.status === 'OK',
    health.database?.connected === true,
    health.features?.predictions === true,
    health.features?.tournaments === true,
    health.features?.wallet === true
  ];
  
  const allPassed = checks.every(check => check);
  return { 
    success: allPassed, 
    message: allPassed ? 'Todos los servicios funcionando' : 'Algunos servicios fallan'
  };
};

const testDatabaseConnection = async () => {
  const result = await makeRequest('GET', '/health');
  if (!result.success) return { success: false, error: 'No se puede verificar DB' };
  
  return {
    success: result.data.database?.connected === true,
    message: `DB: ${result.data.database?.database || 'unknown'}`
  };
};

// =====================================================
// TESTS DE AUTENTICACIÓN
// =====================================================

const testUserLogin = async (email, password, expectedRole) => {
  const result = await makeRequest('POST', '/api/auth/login', {
    phoneOrEmail: email,
    password: password
  });
  
  if (!result.success) {
    return { success: false, error: result.error };
  }
  
  const { token, user } = result.data;
  const roleCheck = expectedRole === 'admin' ? user.isAdmin : 
                   expectedRole === 'premium' ? user.isPremium : true;
  
  if (roleCheck) {
    tokens[expectedRole] = token;
    testData.users[expectedRole] = user;
    return { success: true, message: `Token generado para ${user.email}` };
  } else {
    return { success: false, error: `Rol incorrecto: esperado ${expectedRole}` };
  }
};

const testUserRegistration = async () => {
  const userData = {
    name: `Test User ${Date.now()}`,
    phone: `51987${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
    email: `test${Date.now()}@test.com`,
    password: 'test123456'
  };
  
  const result = await makeRequest('POST', '/api/auth/register', userData);
  
  if (result.success) {
    testData.users.newUser = result.data.user;
    return { success: true, message: `Usuario creado: ${userData.email}` };
  } else {
    return { success: false, error: result.error };
  }
};

// =====================================================
// TESTS DE PREDICCIONES
// =====================================================

const testGetTodayPredictions = async () => {
  const result = await makeRequest('GET', '/api/predictions');
  
  if (result.success) {
    testData.predictions.today = result.data.data;
    return { 
      success: true, 
      message: `${result.data.data.length} predicciones encontradas` 
    };
  } else {
    return { success: false, error: result.error };
  }
};

const testCreatePrediction = async () => {
  const predictionData = {
    league: 'Premier League',
    match: 'Manchester City vs Liverpool',
    homeTeam: 'Manchester City',
    awayTeam: 'Liverpool',
    prediction: 'Over 2.5 goles',
    predictionType: 'OVER_UNDER',
    confidence: 85,
    odds: 1.75,
    matchTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    isHot: true,
    isPremium: false,
    sport: 'football'
  };
  
  const result = await makeRequest('POST', '/api/admin/predictions', predictionData, tokens.admin);
  
  if (result.success) {
    testData.predictions.created = result.data.data;
    return { success: true, message: `Predicción creada: ${result.data.data.id}` };
  } else {
    return { success: false, error: result.error };
  }
};

// =====================================================
// TESTS DE TORNEOS
// =====================================================

const testGetTournaments = async () => {
  const result = await makeRequest('GET', '/api/tournaments', null, tokens.premium);
  
  if (result.success) {
    testData.tournaments.available = result.data.data;
    return { 
      success: true, 
      message: `${result.data.data.length} torneos disponibles`
    };
  } else {
    return { success: false, error: result.error };
  }
};

const testCreateTournament = async () => {
  const tournamentData = {
    name: `Test Tournament ${Date.now()}`,
    description: 'Torneo de prueba automatizado',
    type: 'DAILY_CLASSIC',
    buyIn: 15.00,
    maxPlayers: 20,
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    registrationDeadline: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    predictionsCount: 4,
    prizePool: 270.00
  };
  
  const result = await makeRequest('POST', '/api/admin/tournaments', tournamentData, tokens.admin);
  
  if (result.success) {
    testData.tournaments.created = result.data.data;
    return { success: true, message: `Torneo creado: ${result.data.data.name}` };
  } else {
    return { success: false, error: result.error };
  }
};

const testJoinTournament = async () => {
  if (!testData.tournaments.created) {
    return { success: false, error: 'No hay torneo creado para unirse' };
  }
  
  // Activar registro primero
  const activateResult = await makeRequest('PUT', 
    `/api/admin/tournaments/${testData.tournaments.created.id}/status`,
    { status: 'REGISTRATION' },
    tokens.admin
  );
  
  if (!activateResult.success) {
    return { success: false, error: 'No se pudo activar registro' };
  }
  
  const result = await makeRequest('POST', 
    `/api/tournaments/${testData.tournaments.created.id}/join`, 
    {}, 
    tokens.premium
  );
  
  if (result.success) {
    return { success: true, message: 'Inscripción exitosa al torneo' };
  } else {
    return { success: false, error: result.error };
  }
};

// =====================================================
// TESTS DE WALLET
// =====================================================

const testWalletBalance = async () => {
  const result = await makeRequest('GET', '/api/wallet/balance', null, tokens.premium);
  
  if (result.success) {
    testData.wallet.balance = result.data.data.balance;
    return { 
      success: true, 
      message: `Balance: S/ ${result.data.data.balance}` 
    };
  } else {
    return { success: false, error: result.error };
  }
};

const testCreateDeposit = async () => {
  const depositData = {
    amount: 100.00,
    method: 'YAPE',
    transactionNumber: `TEST${Date.now()}`,
    proofImageUrl: 'https://example.com/proof.jpg'
  };
  
  const result = await makeRequest('POST', '/api/wallet/deposits', depositData, tokens.premium);
  
  if (result.success) {
    testData.wallet.depositId = result.data.data.depositRequest.id;
    return { success: true, message: `Depósito creado: ${testData.wallet.depositId}` };
  } else {
    return { success: false, error: result.error };
  }
};

const testApproveDeposit = async () => {
  if (!testData.wallet.depositId) {
    return { success: false, error: 'No hay depósito para aprobar' };
  }
  
  const result = await makeRequest('PUT', 
    `/api/wallet/admin/deposits/${testData.wallet.depositId}/approve`,
    { adminNotes: 'Depósito aprobado automáticamente por test' },
    tokens.admin
  );
  
  if (result.success) {
    return { success: true, message: 'Depósito aprobado correctamente' };
  } else {
    return { success: false, error: result.error };
  }
};

// =====================================================
// TESTS DE NOTIFICACIONES
// =====================================================

const testGetVapidKey = async () => {
  const result = await makeRequest('GET', '/api/notifications/vapid-public-key');
  
  if (result.success && result.data.publicKey) {
    return { success: true, message: 'VAPID key disponible' };
  } else {
    return { success: false, error: 'VAPID key no configurada' };
  }
};

const testNotificationSubscription = async () => {
  const subscriptionData = {
    subscription: {
      endpoint: 'https://test.endpoint.com',
      keys: {
        p256dh: 'test_p256dh_key',
        auth: 'test_auth_key'
      }
    },
    deviceType: 'web'
  };
  
  const result = await makeRequest('POST', '/api/notifications/subscribe', subscriptionData, tokens.premium);
  
  if (result.success) {
    return { success: true, message: 'Suscripción a notificaciones exitosa' };
  } else {
    return { success: false, error: result.error };
  }
};

// =====================================================
// TESTS DE ADMINISTRACIÓN
// =====================================================

const testAdminStats = async () => {
  const result = await makeRequest('GET', '/api/admin/stats', null, tokens.admin);
  
  if (result.success) {
    const stats = result.data.data;
    return { 
      success: true, 
      message: `${stats.totalUsers} usuarios, ${stats.todayPredictions} predicciones hoy` 
    };
  } else {
    return { success: false, error: result.error };
  }
};

const testTournamentStats = async () => {
  const result = await makeRequest('GET', '/api/admin/tournaments/stats', null, tokens.admin);
  
  if (result.success) {
    const stats = result.data.data;
    return { 
      success: true, 
      message: `${stats.totalTournaments} torneos totales, ${stats.activeTournaments} activos` 
    };
  } else {
    return { success: false, error: result.error };
  }
};

// =====================================================
// TESTS DE PERFORMANCE
// =====================================================

const testConcurrentRequests = async () => {
  const promises = [];
  const numRequests = 10;
  
  for (let i = 0; i < numRequests; i++) {
    promises.push(makeRequest('GET', '/api/predictions'));
  }
  
  const start = performance.now();
  const results = await Promise.all(promises);
  const duration = Math.round(performance.now() - start);
  
  const successful = results.filter(r => r.success).length;
  
  if (successful === numRequests) {
    return { 
      success: true, 
      message: `${numRequests} requests concurrentes en ${duration}ms` 
    };
  } else {
    return { 
      success: false, 
      error: `Solo ${successful}/${numRequests} requests exitosos` 
    };
  }
};

// =====================================================
// RUNNER PRINCIPAL
// =====================================================

const runComprehensiveTests = async () => {
  console.log('\n🚀 INICIANDO SUITE COMPLETA DE TESTS - PREDICTMASTER');
  console.log(`📅 ${new Date().toLocaleString()}`);
  
  const runner = new TestRunner();
  
  // Tests de Infraestructura
  showSection('INFRAESTRUCTURA Y CONEXIONES');
  await runner.runTest('Salud del servidor', testServerHealth);
  await runner.runTest('Conexión a base de datos', testDatabaseConnection);
  
  // Tests de Autenticación
  showSection('AUTENTICACIÓN Y USUARIOS');
  await runner.runTest('Login administrador', testUserLogin, 'admin@iasport.pe', 'admin123', 'admin');
  await runner.runTest('Login usuario premium', testUserLogin, 'premium@test.com', 'test123', 'premium');
  await runner.runTest('Registro de nuevo usuario', testUserRegistration);
  
  // Tests de Predicciones
  showSection('SISTEMA DE PREDICCIONES');
  await runner.runTest('Obtener predicciones del día', testGetTodayPredictions);
  await runner.runTest('Crear nueva predicción', testCreatePrediction);
  
  // Tests de Torneos
  showSection('SISTEMA DE TORNEOS');
  await runner.runTest('Obtener torneos disponibles', testGetTournaments);
  await runner.runTest('Crear nuevo torneo', testCreateTournament);
  await runner.runTest('Inscribirse a torneo', testJoinTournament);
  
  // Tests de Wallet
  showSection('SISTEMA DE WALLET');
  await runner.runTest('Verificar balance de wallet', testWalletBalance);
  await runner.runTest('Crear solicitud de depósito', testCreateDeposit);
  await runner.runTest('Aprobar depósito (admin)', testApproveDeposit);
  
  // Tests de Notificaciones
  showSection('SISTEMA DE NOTIFICACIONES');
  await runner.runTest('Obtener clave VAPID', testGetVapidKey);
  await runner.runTest('Suscribirse a notificaciones', testNotificationSubscription);
  
  // Tests de Administración
  showSection('PANEL DE ADMINISTRACIÓN');
  await runner.runTest('Estadísticas generales', testAdminStats);
  await runner.runTest('Estadísticas de torneos', testTournamentStats);
  
  // Tests de Performance
  showSection('TESTS DE PERFORMANCE');
  await runner.runTest('Requests concurrentes', testConcurrentRequests);
  
  // Mostrar resumen
  runner.showStats();
  
  // Recomendaciones finales
  console.log(`\n${'═'.repeat(60)}`);
  console.log('💡 RECOMENDACIONES FINALES');
  console.log(`${'═'.repeat(60)}`);
  
  if (runner.stats.failed === 0) {
    console.log('🎉 ¡Todos los tests pasaron! El sistema está funcionando correctamente.');
  } else {
    console.log('⚠️  Algunos tests fallaron. Revisar errores arriba.');
  }
  
  console.log('\n📋 PRÓXIMOS PASOS SUGERIDOS:');
  console.log('   1. Configurar tests automáticos con CI/CD');
  console.log('   2. Implementar tests de carga con más usuarios');
  console.log('   3. Añadir monitoreo en tiempo real');
  console.log('   4. Implementar backup automático de BD');
  
  return runner.stats;
};

// Ejecutar tests si es llamado directamente
if (require.main === module) {
  runComprehensiveTests().catch(console.error);
}

module.exports = {
  runComprehensiveTests,
  makeRequest,
  TestRunner
};