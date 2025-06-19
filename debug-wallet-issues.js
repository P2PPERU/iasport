// debug-wallet-issues.js - Diagnosticar problemas específicos de wallet
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

// Colores para la consola
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

const log = (message, type = 'info') => {
  const color = {
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
    info: colors.blue,
    data: colors.cyan
  }[type] || colors.reset;
  
  console.log(`${color}${message}${colors.reset}`);
};

let premiumToken = '';

async function makeRequest(method, url, data = null, token = null) {
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
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status,
      details: error.response?.data
    };
  }
}

async function debugWalletIssues() {
  console.log('\n🔍 DIAGNÓSTICO DE PROBLEMAS DE WALLET');
  console.log('=====================================\n');

  // 1. Login usuario premium
  log('1️⃣ Login usuario premium...', 'info');
  const loginResult = await makeRequest('POST', '/auth/login', {
    phoneOrEmail: 'premium@test.com',
    password: 'test123'
  });

  if (!loginResult.success) {
    log('❌ Error en login:', 'error');
    console.log(loginResult.error);
    return;
  }

  premiumToken = loginResult.data.token;
  const userId = loginResult.data.user.id;
  log(`✅ Login exitoso - User ID: ${userId}`, 'success');

  // 2. Verificar balance
  log('\n2️⃣ Verificando balance...', 'info');
  const balanceResult = await makeRequest('GET', '/wallet/balance', null, premiumToken);
  
  if (balanceResult.success) {
    log(`✅ Balance: S/ ${balanceResult.data.data.balance}`, 'success');
  } else {
    log('❌ Error obteniendo balance:', 'error');
    console.log(balanceResult.details);
  }

  // 3. Intentar obtener dashboard
  log('\n3️⃣ Intentando obtener dashboard...', 'info');
  const dashboardResult = await makeRequest('GET', '/wallet/dashboard', null, premiumToken);
  
  if (dashboardResult.success) {
    log('✅ Dashboard obtenido exitosamente', 'success');
    console.log('Dashboard data:', JSON.stringify(dashboardResult.data, null, 2));
  } else {
    log('❌ Error obteniendo dashboard:', 'error');
    console.log('Status:', dashboardResult.status);
    console.log('Error details:', dashboardResult.details);
    
    // Verificar si es problema de modelo
    if (dashboardResult.details?.message?.includes('getWallet')) {
      log('🔍 Problema detectado: Método getWallet no existe en el modelo User', 'warning');
    }
  }

  // 4. Intentar obtener historial de transacciones
  log('\n4️⃣ Intentando obtener historial...', 'info');
  const historyResult = await makeRequest('GET', '/wallet/transactions', null, premiumToken);
  
  if (historyResult.success) {
    log('✅ Historial obtenido exitosamente', 'success');
    log(`📊 Total transacciones: ${historyResult.data.data.length}`, 'data');
  } else {
    log('❌ Error obteniendo historial:', 'error');
    console.log('Status:', historyResult.status);
    console.log('Error details:', historyResult.details);
  }

  // 5. Verificar depósitos pendientes
  log('\n5️⃣ Verificando depósitos pendientes...', 'info');
  const depositsResult = await makeRequest('GET', '/wallet/deposits', null, premiumToken);
  
  if (depositsResult.success) {
    log('✅ Depósitos obtenidos exitosamente', 'success');
    const pendingDeposits = depositsResult.data.data.filter(d => d.status === 'PENDING');
    log(`📊 Depósitos pendientes: ${pendingDeposits.length}`, 'data');
    
    if (pendingDeposits.length > 0) {
      log('⚠️ Hay depósitos pendientes que bloquean nuevas solicitudes', 'warning');
      pendingDeposits.forEach(deposit => {
        log(`   - ID: ${deposit.id}, Monto: S/ ${deposit.amount}`, 'data');
      });
    }
  } else {
    log('❌ Error obteniendo depósitos:', 'error');
    console.log('Error details:', depositsResult.details);
  }

  // 6. Verificar retiros pendientes
  log('\n6️⃣ Verificando retiros pendientes...', 'info');
  const withdrawalsResult = await makeRequest('GET', '/wallet/withdrawals', null, premiumToken);
  
  if (withdrawalsResult.success) {
    log('✅ Retiros obtenidos exitosamente', 'success');
    const pendingWithdrawals = withdrawalsResult.data.data.filter(w => 
      w.status === 'PENDING' || w.status === 'PROCESSING'
    );
    log(`📊 Retiros en proceso: ${pendingWithdrawals.length}`, 'data');
    
    if (pendingWithdrawals.length > 0) {
      log('⚠️ Hay retiros en proceso que bloquean nuevas solicitudes', 'warning');
      pendingWithdrawals.forEach(withdrawal => {
        log(`   - ID: ${withdrawal.id}, Monto: S/ ${withdrawal.amount}, Status: ${withdrawal.status}`, 'data');
      });
    }
  } else {
    log('❌ Error obteniendo retiros:', 'error');
    console.log('Error details:', withdrawalsResult.details);
  }

  // 7. Verificar estructura de base de datos
  log('\n7️⃣ Verificando estructura de BD...', 'info');
  
  // Hacer una consulta simple para verificar que las tablas existen
  const healthResult = await makeRequest('GET', '/health');
  if (healthResult.success && healthResult.data.database?.connecte) {
    log('✅ Conexión a base de datos OK', 'success');
  } else {
    log('⚠️ Posible problema con la base de datos', 'warning');
  }

  log('\n🔍 DIAGNÓSTICO COMPLETO', 'info');
  log('=====================', 'info');
  log('1. Verifica que las tablas de wallet existan en la base de datos', 'data');
  log('2. Revisa los logs del servidor para errores específicos', 'data');
  log('3. Ejecuta: node createWalletTables.js (si existe)', 'data');
  log('4. Verifica que las asociaciones en src/models/index.js estén correctas', 'data');
}

// Ejecutar diagnóstico
debugWalletIssues();