// simpleTest.js - Test simple que funciona
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function makeRequest(method, url, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      }
    };

    // Solo agregar data si existe y no es GET
    if (data && method !== 'GET') {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      status: error.response?.status || 0
    };
  }
}

async function runSimpleTest() {
  log('🧪 TEST SIMPLE DEL BACKEND PREDICTMASTER', 'bold');
  log('========================================', 'cyan');

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Health Check
  log('\n1️⃣ Test Health Check', 'yellow');
  totalTests++;
  const healthResult = await makeRequest('GET', '/health');
  
  if (healthResult.success) {
    log('   ✅ Health check OK', 'green');
    log(`   📊 Status: ${healthResult.data.status}`, 'cyan');
    passedTests++;
  } else {
    log('   ❌ Health check falló', 'red');
    log(`   Error: ${healthResult.error}`, 'red');
  }

  // Test 2: Root Endpoint
  log('\n2️⃣ Test Root Endpoint', 'yellow');
  totalTests++;
  const rootResult = await makeRequest('GET', '/');
  
  if (rootResult.success) {
    log('   ✅ Root endpoint OK', 'green');
    log(`   📋 API: ${rootResult.data.message}`, 'cyan');
    passedTests++;
  } else {
    log('   ❌ Root endpoint falló', 'red');
    log(`   Error: ${rootResult.error}`, 'red');
  }

  // Test 3: Login Admin
  log('\n3️⃣ Test Admin Login', 'yellow');
  totalTests++;
  const adminLoginResult = await makeRequest('POST', '/api/auth/login', {
    phoneOrEmail: 'admin@predictmaster.pe',
    password: 'admin123'
  });
  
  let adminToken = null;
  if (adminLoginResult.success) {
    adminToken = adminLoginResult.data.token;
    log('   ✅ Admin login OK', 'green');
    log(`   👤 Usuario: ${adminLoginResult.data.user.name}`, 'cyan');
    passedTests++;
  } else {
    log('   ❌ Admin login falló', 'red');
    log(`   Error: ${adminLoginResult.error}`, 'red');
  }

  // Test 4: Login Premium
  log('\n4️⃣ Test Premium Login', 'yellow');
  totalTests++;
  const premiumLoginResult = await makeRequest('POST', '/api/auth/login', {
    phoneOrEmail: 'premium@predictmaster.pe',
    password: 'premium123'
  });
  
  let premiumToken = null;
  if (premiumLoginResult.success) {
    premiumToken = premiumLoginResult.data.token;
    log('   ✅ Premium login OK', 'green');
    log(`   👤 Usuario: ${premiumLoginResult.data.user.name}`, 'cyan');
    passedTests++;
  } else {
    log('   ❌ Premium login falló', 'red');
    log(`   Error: ${premiumLoginResult.error}`, 'red');
  }

  // Test 5: Obtener Predicciones
  log('\n5️⃣ Test Get Predictions', 'yellow');
  totalTests++;
  const predictionsResult = await makeRequest('GET', '/api/predictions');
  
  if (predictionsResult.success) {
    log('   ✅ Predicciones OK', 'green');
    log(`   📊 Total: ${predictionsResult.data.count || predictionsResult.data.data?.length || 0}`, 'cyan');
    passedTests++;
  } else {
    log('   ❌ Predicciones fallaron', 'red');
    log(`   Error: ${predictionsResult.error}`, 'red');
  }

  // Test 6: Obtener Torneos
  log('\n6️⃣ Test Get Tournaments', 'yellow');
  totalTests++;
  const tournamentsResult = await makeRequest('GET', '/api/tournaments');
  
  if (tournamentsResult.success) {
    log('   ✅ Torneos OK', 'green');
    log(`   📊 Total: ${tournamentsResult.data.count || tournamentsResult.data.data?.length || 0}`, 'cyan');
    passedTests++;
  } else {
    log('   ❌ Torneos fallaron', 'red');
    log(`   Error: ${tournamentsResult.error}`, 'red');
  }

  // Test 7: VAPID Key
  log('\n7️⃣ Test VAPID Key', 'yellow');
  totalTests++;
  const vapidResult = await makeRequest('GET', '/api/notifications/vapid-public-key');
  
  if (vapidResult.success) {
    log('   ✅ VAPID Key OK', 'green');
    passedTests++;
  } else {
    log('   ❌ VAPID Key falló', 'red');
    log(`   Error: ${vapidResult.error}`, 'red');
  }

  // Test 8: Admin Stats (si tenemos token admin)
  if (adminToken) {
    log('\n8️⃣ Test Admin Stats', 'yellow');
    totalTests++;
    const adminStatsResult = await makeRequest('GET', '/api/admin/stats', null, adminToken);
    
    if (adminStatsResult.success) {
      log('   ✅ Admin Stats OK', 'green');
      log(`   👥 Usuarios: ${adminStatsResult.data.data?.totalUsers || 'N/A'}`, 'cyan');
      passedTests++;
    } else {
      log('   ❌ Admin Stats falló', 'red');
      log(`   Error: ${adminStatsResult.error}`, 'red');
    }
  }

  // Resultados finales
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  log('\n🎉 RESULTADOS DEL TEST', 'bold');
  log('=====================', 'cyan');
  log(`📊 Tests exitosos: ${passedTests}/${totalTests} (${successRate}%)`, 
    passedTests === totalTests ? 'green' : passedTests >= totalTests * 0.7 ? 'yellow' : 'red');

  if (passedTests === totalTests) {
    log('\n✅ BACKEND FUNCIONANDO PERFECTAMENTE', 'green');
    log('🚀 Todos los endpoints funcionan correctamente', 'green');
  } else if (passedTests >= totalTests * 0.7) {
    log('\n⚠️ BACKEND FUNCIONANDO CON ALGUNAS ADVERTENCIAS', 'yellow');
    log('💡 La mayoría de funcionalidades están activas', 'yellow');
  } else {
    log('\n❌ BACKEND CON PROBLEMAS', 'red');
    log('🔧 Necesita reparación', 'red');
  }

  log('\n🔑 CREDENCIALES PARA USAR:');
  log('Admin: admin@predictmaster.pe / admin123', 'cyan');
  log('Demo: demo@predictmaster.pe / demo123', 'cyan');
  log('Premium: premium@predictmaster.pe / premium123', 'cyan');

  log('\n📍 ENDPOINTS PRINCIPALES:');
  log(`${BASE_URL}/health`, 'cyan');
  log(`${BASE_URL}/api/predictions`, 'cyan');
  log(`${BASE_URL}/api/tournaments`, 'cyan');
  log(`${BASE_URL}/api/auth/login`, 'cyan');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runSimpleTest().catch(error => {
    log(`\n❌ Error crítico: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = runSimpleTest;