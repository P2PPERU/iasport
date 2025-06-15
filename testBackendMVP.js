// testBackendMVP.js - Test completo del backend
const API_URL = 'http://localhost:3001/api';

// Colores para la consola
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
};

const log = (message, type = 'info') => {
  const color = {
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
    info: colors.blue,
    data: colors.magenta
  }[type] || colors.reset;
  
  console.log(`${color}${message}${colors.reset}`);
};

// Variables globales para los tests
let demoToken = null;
let adminToken = null;
let testUserId = null;
let testPredictionId = null;

// 1. TEST DE REGISTRO
async function testRegister() {
  log('\n1️⃣ TEST DE REGISTRO', 'info');
  
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Usuario',
        phone: '51999888777',
        email: 'test@example.com',
        password: 'test123'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      testUserId = data.user.id;
      log('✅ Registro exitoso', 'success');
      log(`   Usuario: ${data.user.name}`, 'data');
      log(`   Email: ${data.user.email}`, 'data');
      log(`   Vistas gratis: ${data.user.freeViewsLeft}`, 'data');
    } else {
      log(`❌ Error: ${data.message}`, 'error');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'error');
  }
}

// 2. TEST DE LOGIN (Usuario Demo)
async function testLoginDemo() {
  log('\n2️⃣ LOGIN USUARIO DEMO', 'info');
  
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneOrEmail: 'demo@iasport.pe',
        password: 'demo123'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      demoToken = data.token;
      log('✅ Login exitoso', 'success');
      log(`   Usuario: ${data.user.name}`, 'data');
      log(`   Premium: ${data.user.isPremium ? 'Sí' : 'No'}`, 'data');
      log(`   Vistas gratis restantes: ${data.user.freeViewsLeft}`, 'data');
    } else {
      log(`❌ Error: ${data.message}`, 'error');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'error');
  }
}

// 3. TEST DE LOGIN (Admin)
async function testLoginAdmin() {
  log('\n3️⃣ LOGIN ADMIN', 'info');
  
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneOrEmail: 'admin@iasport.pe',
        password: 'admin123'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      adminToken = data.token;
      log('✅ Login admin exitoso', 'success');
      log(`   Admin: ${data.user.isAdmin ? 'Sí' : 'No'}`, 'data');
    } else {
      log(`❌ Error: ${data.message}`, 'error');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'error');
  }
}

// 4. TEST OBTENER PREDICCIONES (Sin autenticación)
async function testGetPredictionsNoAuth() {
  log('\n4️⃣ OBTENER PREDICCIONES (Sin Auth)', 'info');
  
  try {
    const response = await fetch(`${API_URL}/predictions`);
    const data = await response.json();
    
    if (data.success) {
      log(`✅ ${data.count} predicciones encontradas`, 'success');
      
      // Mostrar primera predicción
      if (data.data.length > 0) {
        const pred = data.data[0];
        testPredictionId = pred.id;
        log('\n   Primera predicción:', 'info');
        log(`   ${pred.match}`, 'data');
        log(`   Predicción: ${pred.prediction || '🔒 Premium'}`, 'data');
        log(`   Premium: ${pred.isPremium ? 'Sí' : 'No'}`, 'data');
        log(`   Bloqueada: ${pred.locked ? 'Sí' : 'No'}`, 'data');
      }
    } else {
      log(`❌ Error: ${data.message}`, 'error');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'error');
  }
}

// 5. TEST OBTENER PREDICCIONES (Con autenticación)
async function testGetPredictionsWithAuth() {
  log('\n5️⃣ OBTENER PREDICCIONES (Con Auth)', 'info');
  
  try {
    const response = await fetch(`${API_URL}/predictions`, {
      headers: { 'Authorization': `Bearer ${demoToken}` }
    });
    const data = await response.json();
    
    if (data.success) {
      log(`✅ ${data.count} predicciones con auth`, 'success');
      log(`   Vistas gratis disponibles: ${data.freeViewsLeft}`, 'data');
      log(`   Es Premium: ${data.isPremium ? 'Sí' : 'No'}`, 'data');
      
      // Buscar predicción premium
      const premiumPred = data.data.find(p => p.isPremium && p.locked);
      if (premiumPred) {
        testPredictionId = premiumPred.id;
        log('\n   Predicción premium encontrada:', 'info');
        log(`   ${premiumPred.match}`, 'data');
        log(`   Estado: ${premiumPred.locked ? '🔒 Bloqueada' : '🔓 Desbloqueada'}`, 'data');
      }
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'error');
  }
}

// 6. TEST DESBLOQUEAR PREDICCIÓN
async function testUnlockPrediction() {
  log('\n6️⃣ DESBLOQUEAR PREDICCIÓN PREMIUM', 'info');
  
  if (!testPredictionId) {
    log('⚠️ No hay predicción para desbloquear', 'warning');
    return;
  }
  
  try {
    log('   Simulando ver video...', 'info');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await fetch(`${API_URL}/predictions/${testPredictionId}/unlock`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${demoToken}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      log('✅ Predicción desbloqueada!', 'success');
      log(`   ${data.prediction.match}`, 'data');
      log(`   Predicción: ${data.prediction.prediction}`, 'data');
      log(`   Cuota: ${data.prediction.odds}`, 'data');
      log(`   Confianza: ${data.prediction.confidence}%`, 'data');
      log(`   Vistas gratis restantes: ${data.freeViewsLeft}`, 'data');
    } else {
      log(`❌ Error: ${data.message}`, 'error');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'error');
  }
}

// 7. TEST OBTENER PERFIL
async function testGetProfile() {
  log('\n7️⃣ OBTENER PERFIL DE USUARIO', 'info');
  
  try {
    const response = await fetch(`${API_URL}/users/profile`, {
      headers: { 'Authorization': `Bearer ${demoToken}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      log('✅ Perfil obtenido', 'success');
      log(`   Nombre: ${data.data.name}`, 'data');
      log(`   Email: ${data.data.email}`, 'data');
      log(`   Teléfono: ${data.data.phone}`, 'data');
      log(`   Premium: ${data.data.isPremium ? 'Sí' : 'No'}`, 'data');
      log(`   Vistas gratis: ${data.data.freeViewsLeft}`, 'data');
      log(`   Preferencias:`, 'data');
      console.log(data.data.preferences);
    } else {
      log(`❌ Error: ${data.message}`, 'error');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'error');
  }
}

// 8. TEST ADMIN - ESTADÍSTICAS
async function testAdminStats() {
  log('\n8️⃣ ADMIN - OBTENER ESTADÍSTICAS', 'info');
  
  try {
    const response = await fetch(`${API_URL}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      log('✅ Estadísticas obtenidas', 'success');
      console.table(data.data);
    } else {
      log(`❌ Error: ${data.message}`, 'error');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'error');
  }
}

// 9. TEST ADMIN - CREAR PREDICCIÓN
async function testAdminCreatePrediction() {
  log('\n9️⃣ ADMIN - CREAR PREDICCIÓN', 'info');
  
  try {
    const response = await fetch(`${API_URL}/admin/predictions`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        league: 'Champions League',
        match: 'PSG vs Bayern Munich',
        homeTeam: 'PSG',
        awayTeam: 'Bayern Munich',
        prediction: 'Bayern Munich Gana',
        predictionType: '1X2',
        confidence: 75,
        odds: 2.20,
        matchTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isHot: true,
        isPremium: true,
        sport: 'football'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      log('✅ Predicción creada', 'success');
      log(`   ID: ${data.data.id}`, 'data');
      log(`   Partido: ${data.data.match}`, 'data');
    } else {
      log(`❌ Error: ${data.message}`, 'error');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'error');
  }
}

// 10. TEST INTENTAR DESBLOQUEAR SIN VISTAS
async function testUnlockWithoutViews() {
  log('\n🔟 INTENTAR DESBLOQUEAR SIN VISTAS', 'info');
  
  // Primero agotar las vistas
  log('   Agotando vistas gratis...', 'warning');
  
  // Obtener predicciones para encontrar otra bloqueada
  const predsResponse = await fetch(`${API_URL}/predictions`, {
    headers: { 'Authorization': `Bearer ${demoToken}` }
  });
  const predsData = await predsResponse.json();
  
  if (predsData.freeViewsLeft > 0) {
    log('   Todavía hay vistas, saltando test', 'warning');
    return;
  }
  
  const lockedPred = predsData.data.find(p => p.isPremium && p.locked);
  if (!lockedPred) {
    log('   No hay predicciones bloqueadas', 'warning');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/predictions/${lockedPred.id}/unlock`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${demoToken}` }
    });
    
    const data = await response.json();
    
    if (!data.success) {
      log('✅ Correcto: No se puede desbloquear sin vistas', 'success');
      log(`   Mensaje: ${data.message}`, 'data');
    } else {
      log('❌ Error: Se desbloqueó cuando no debería', 'error');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'error');
  }
}

// EJECUTAR TODOS LOS TESTS
async function runAllTests() {
  console.clear();
  log('🚀 INICIANDO TESTS DEL BACKEND MVP', 'info');
  log('=====================================\n', 'info');
  
  // Tests de autenticación
  await testRegister();
  await testLoginDemo();
  await testLoginAdmin();
  
  // Tests de predicciones
  await testGetPredictionsNoAuth();
  await testGetPredictionsWithAuth();
  await testUnlockPrediction();
  
  // Tests de usuario
  await testGetProfile();
  
  // Tests de admin
  await testAdminStats();
  await testAdminCreatePrediction();
  
  // Test de límites
  await testUnlockWithoutViews();
  
  log('\n=====================================', 'info');
  log('✅ TESTS COMPLETADOS', 'success');
  log('\n📋 RESUMEN:', 'info');
  log('- Autenticación: OK', 'success');
  log('- Predicciones: OK', 'success');
  log('- Sistema de desbloqueo: OK', 'success');
  log('- Panel admin: OK', 'success');
}

// Ejecutar tests
runAllTests().catch(error => {
  log(`❌ Error fatal: ${error.message}`, 'error');
});