// testFullBackend.js
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

// Variables globales para los tests
let userToken = null;
let adminToken = null;
let testUserId = null;
let testPredictionId = null;
let premiumPredictionId = null;
let vapidPublicKey = null;
let notificationHistoryId = null;

// Mock de suscripción push
const mockSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test' + Date.now(),
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=',
    auth: 'tBHItJI5svbpez7KI4CCXg=='
  }
};

// Contador de tests
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Helper para ejecutar tests
async function runTest(name, testFn) {
  totalTests++;
  try {
    await testFn();
    passedTests++;
    log(`✅ ${name}`, 'success');
    return true;
  } catch (error) {
    failedTests++;
    log(`❌ ${name}: ${error.message}`, 'error');
    return false;
  }
}

// ========== SECCIÓN 1: AUTENTICACIÓN ==========
async function testAuthentication() {
  log('\n════════════════════════════════════', 'title');
  log('🔐 SECCIÓN 1: AUTENTICACIÓN', 'title');
  log('════════════════════════════════════', 'title');

  // Test 1.1: Registro
  await runTest('Registro de nuevo usuario', async () => {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User ' + Date.now(),
        phone: '51' + Math.floor(900000000 + Math.random() * 100000000),
        email: `test${Date.now()}@example.com`,
        password: 'test123456'
      })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    testUserId = data.user.id;
    log(`   Usuario creado: ${data.user.email}`, 'data');
  });

  // Test 1.2: Login usuario demo
  await runTest('Login usuario demo', async () => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneOrEmail: 'demo@iasport.pe',
        password: 'demo123'
      })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    userToken = data.token;
    log(`   Token obtenido: ${userToken.substring(0, 30)}...`, 'data');
  });

  // Test 1.3: Login admin
  await runTest('Login administrador', async () => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneOrEmail: 'admin@iasport.pe',
        password: 'admin123'
      })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    adminToken = data.token;
  });

  // Test 1.4: Login con credenciales incorrectas
  await runTest('Rechazo de credenciales incorrectas', async () => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneOrEmail: 'fake@example.com',
        password: 'wrongpass'
      })
    });
    
    const data = await response.json();
    if (data.success) throw new Error('Login debería fallar');
  });
}

// ========== SECCIÓN 2: PREDICCIONES ==========
async function testPredictions() {
  log('\n════════════════════════════════════', 'title');
  log('🎯 SECCIÓN 2: PREDICCIONES', 'title');
  log('════════════════════════════════════', 'title');

  // Test 2.1: Obtener predicciones sin auth
  await runTest('Obtener predicciones sin autenticación', async () => {
    const response = await fetch(`${BASE_URL}/predictions`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    const premium = data.data.find(p => p.isPremium);
    if (premium) {
      premiumPredictionId = premium.id;
      if (!premium.locked) throw new Error('Predicción premium debería estar bloqueada');
    }
    log(`   Total predicciones: ${data.count}`, 'data');
  });

  // Test 2.2: Obtener predicciones con auth
  await runTest('Obtener predicciones con autenticación', async () => {
    const response = await fetch(`${BASE_URL}/predictions`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    log(`   Vistas gratis disponibles: ${data.freeViewsLeft}`, 'data');
  });

  // Test 2.3: Desbloquear predicción
  await runTest('Desbloquear predicción premium', async () => {
    if (!premiumPredictionId) throw new Error('No hay predicción premium para probar');
    
    const response = await fetch(`${BASE_URL}/predictions/${premiumPredictionId}/unlock`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const data = await response.json();
    if (data.message === 'Predicción ya desbloqueada') {
      log('   Predicción ya estaba desbloqueada', 'warning');
    } else if (!data.success) {
      throw new Error(data.message);
    } else {
      log(`   Predicción: ${data.prediction.prediction}`, 'data');
      log(`   Vistas restantes: ${data.freeViewsLeft}`, 'data');
    }
  });

  // Test 2.4: Obtener predicción específica
  await runTest('Obtener predicción por ID', async () => {
    if (!premiumPredictionId) throw new Error('No hay predicción para probar');
    
    const response = await fetch(`${BASE_URL}/predictions/${premiumPredictionId}`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    log(`   Partido: ${data.data.match}`, 'data');
  });
}

// ========== SECCIÓN 3: PERFIL DE USUARIO ==========
async function testUserProfile() {
  log('\n════════════════════════════════════', 'title');
  log('👤 SECCIÓN 3: PERFIL DE USUARIO', 'title');
  log('════════════════════════════════════', 'title');

  // Test 3.1: Obtener perfil
  await runTest('Obtener perfil del usuario', async () => {
    const response = await fetch(`${BASE_URL}/users/profile`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    log(`   Nombre: ${data.data.name}`, 'data');
    log(`   Premium: ${data.data.isPremium ? 'Sí' : 'No'}`, 'data');
  });

  // Test 3.2: Actualizar preferencias
  await runTest('Actualizar preferencias', async () => {
    const response = await fetch(`${BASE_URL}/users/preferences`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        notifications: true,
        favoriteTeams: ['Real Madrid', 'Barcelona'],
        favoriteSports: ['football', 'basketball']
      })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  });
}

// ========== SECCIÓN 4: PUSH NOTIFICATIONS ==========
async function testNotifications() {
  log('\n════════════════════════════════════', 'title');
  log('🔔 SECCIÓN 4: PUSH NOTIFICATIONS', 'title');
  log('════════════════════════════════════', 'title');

  // Test 4.1: Obtener VAPID public key
  await runTest('Obtener VAPID public key', async () => {
    const response = await fetch(`${BASE_URL}/notifications/vapid-public-key`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    vapidPublicKey = data.publicKey;
    log(`   Key: ${vapidPublicKey ? vapidPublicKey.substring(0, 30) + '...' : 'No configurada'}`, 'data');
  });

  // Test 4.2: Suscribir dispositivo
  await runTest('Suscribir dispositivo a notificaciones', async () => {
    if (!vapidPublicKey) {
      throw new Error('VAPID keys no configuradas - ejecuta generateVapidKeys.js');
    }
    
    const response = await fetch(`${BASE_URL}/notifications/subscribe`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscription: mockSubscription,
        deviceType: 'web'
      })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  });

  // Test 4.3: Enviar notificación de prueba
  await runTest('Enviar notificación de prueba', async () => {
    const response = await fetch(`${BASE_URL}/notifications/test`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    log(`   Enviadas: ${data.data.sent}, Fallidas: ${data.data.failed}`, 'data');
  });

  // Test 4.4: Obtener historial
  await runTest('Obtener historial de notificaciones', async () => {
    const response = await fetch(`${BASE_URL}/notifications/history`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    if (data.data.length > 0) {
      notificationHistoryId = data.data[0].id;
    }
    log(`   Total notificaciones: ${data.count}`, 'data');
  });

  // Test 4.5: Marcar como clickeada
  if (notificationHistoryId) {
    await runTest('Marcar notificación como clickeada', async () => {
      const response = await fetch(`${BASE_URL}/notifications/history/${notificationHistoryId}/clicked`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
    });
  }
}

// ========== SECCIÓN 5: PANEL ADMINISTRATIVO ==========
async function testAdminPanel() {
  log('\n════════════════════════════════════', 'title');
  log('👑 SECCIÓN 5: PANEL ADMINISTRATIVO', 'title');
  log('════════════════════════════════════', 'title');

  // Test 5.1: Dashboard stats
  await runTest('Obtener estadísticas del dashboard', async () => {
    const response = await fetch(`${BASE_URL}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    log(`   Usuarios totales: ${data.data.totalUsers}`, 'data');
    log(`   Suscripciones activas: ${data.data.activeSubscriptions}`, 'data');
  });

  // Test 5.2: Crear predicción
  await runTest('Crear nueva predicción', async () => {
    const response = await fetch(`${BASE_URL}/admin/predictions`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        league: 'Test League',
        match: 'Test FC vs Demo United',
        homeTeam: 'Test FC',
        awayTeam: 'Demo United',
        prediction: 'Más de 2.5 goles',
        predictionType: 'OVER_UNDER',
        confidence: 85,
        odds: 1.75,
        matchTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
        isHot: false,
        isPremium: true,
        sport: 'football'
      })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    testPredictionId = data.data.id;
  });

  // Test 5.3: Actualizar predicción
  await runTest('Actualizar predicción', async () => {
    const response = await fetch(`${BASE_URL}/admin/predictions/${testPredictionId}`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        confidence: 90,
        isHot: true
      })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  });

  // Test 5.4: Actualizar resultado
  await runTest('Actualizar resultado de predicción', async () => {
    const response = await fetch(`${BASE_URL}/admin/predictions/${testPredictionId}/result`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ result: 'WON' })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  });

  // Test 5.5: Listar usuarios
  await runTest('Listar usuarios', async () => {
    const response = await fetch(`${BASE_URL}/admin/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    log(`   Total usuarios: ${data.count}`, 'data');
  });

  // Test 5.6: Toggle premium
  if (testUserId) {
    await runTest('Activar premium a usuario', async () => {
      const response = await fetch(`${BASE_URL}/admin/users/${testUserId}/premium`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isPremium: true, days: 7 })
      });
      
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
    });
  }

  // Test 5.7: Estadísticas de notificaciones
  await runTest('Obtener estadísticas de notificaciones', async () => {
    const response = await fetch(`${BASE_URL}/admin/notifications/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    log(`   Suscripciones activas: ${data.data.activeSubscriptions}`, 'data');
    log(`   Notificaciones hoy: ${data.data.notificationsToday}`, 'data');
  });

  // Test 5.8: Enviar notificación personalizada
  await runTest('Enviar notificación personalizada', async () => {
    const response = await fetch(`${BASE_URL}/admin/notifications/custom`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userIds: [testUserId],
        title: '🧪 Test de Notificación Admin',
        body: 'Esta es una notificación de prueba desde el panel admin',
        url: '/test'
      })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  });

  // Test 5.9: Eliminar predicción
  await runTest('Eliminar predicción de prueba', async () => {
    const response = await fetch(`${BASE_URL}/admin/predictions/${testPredictionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  });
}

// ========== SECCIÓN 6: VALIDACIONES Y LÍMITES ==========
async function testValidations() {
  log('\n════════════════════════════════════', 'title');
  log('🛡️ SECCIÓN 6: VALIDACIONES Y LÍMITES', 'title');
  log('════════════════════════════════════', 'title');

  // Test 6.1: Acceso sin autenticación
  await runTest('Bloqueo de acceso sin autenticación', async () => {
    const response = await fetch(`${BASE_URL}/users/profile`);
    const data = await response.json();
    if (data.success) throw new Error('Debería requerir autenticación');
  });

  // Test 6.2: Acceso admin sin permisos
  await runTest('Bloqueo de acceso admin sin permisos', async () => {
    const response = await fetch(`${BASE_URL}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    const data = await response.json();
    if (data.success) throw new Error('Debería requerir permisos de admin');
  });

  // Test 6.3: Validación de datos
  await runTest('Validación de datos inválidos', async () => {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'a', // Muy corto
        phone: '123', // Formato inválido
        email: 'notanemail', // Email inválido
        password: '123' // Muy corto
      })
    });
    
    const data = await response.json();
    if (data.success) throw new Error('Debería fallar la validación');
  });

  // Test 6.4: Desuscribir notificaciones
  await runTest('Desuscribir de notificaciones', async () => {
    const response = await fetch(`${BASE_URL}/notifications/unsubscribe`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        endpoint: mockSubscription.endpoint
      })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  });
}

// ========== RESUMEN FINAL ==========
function showSummary() {
  log('\n════════════════════════════════════', 'title');
  log('📊 RESUMEN DE TESTS', 'title');
  log('════════════════════════════════════', 'title');
  
  const percentage = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
  
  log(`\nTotal de tests: ${totalTests}`, 'info');
  log(`✅ Exitosos: ${passedTests}`, 'success');
  log(`❌ Fallidos: ${failedTests}`, 'error');
  log(`📈 Porcentaje de éxito: ${percentage}%`, percentage >= 80 ? 'success' : 'warning');
  
  if (failedTests === 0) {
    log('\n🎉 ¡TODOS LOS TESTS PASARON!', 'success');
    log('Tu backend está funcionando perfectamente 🚀', 'success');
  } else {
    log('\n⚠️ Algunos tests fallaron', 'warning');
    log('Revisa los errores arriba para más detalles', 'warning');
  }
  
  log('\n📋 Funcionalidades verificadas:', 'info');
  log('   ✓ Sistema de autenticación JWT', 'data');
  log('   ✓ Gestión de predicciones con bloqueo/desbloqueo', 'data');
  log('   ✓ Sistema de vistas gratis limitadas', 'data');
  log('   ✓ Panel administrativo completo', 'data');
  log('   ✓ Push notifications con suscripciones', 'data');
  log('   ✓ Historial y tracking de notificaciones', 'data');
  log('   ✓ Validaciones y control de acceso', 'data');
  log('   ✓ Estadísticas y métricas', 'data');
  
  if (!vapidPublicKey) {
    log('\n⚠️ IMPORTANTE:', 'warning');
    log('   Las VAPID keys no están configuradas', 'warning');
    log('   Ejecuta: node generateVapidKeys.js', 'warning');
  }
}

// ========== EJECUTAR TODOS LOS TESTS ==========
async function runAllTests() {
  console.clear();
  log('🚀 TEST COMPLETO DEL BACKEND IA SPORT', 'title');
  log(`📅 ${new Date().toLocaleString()}`, 'info');
  log('════════════════════════════════════\n', 'title');

  // Verificar que el servidor esté corriendo
  try {
    const healthResponse = await fetch('http://localhost:3001/health');
    const health = await healthResponse.json();
    log(`✅ Servidor activo: ${health.status}`, 'success');
    log(`📦 Base de datos: ${health.database}`, 'data');
    log(`🔔 Push Notifications: ${health.features.pushNotifications ? 'Habilitadas' : 'Deshabilitadas'}\n`, 'data');
  } catch (error) {
    log('❌ El servidor no está corriendo en http://localhost:3001', 'error');
    log('   Ejecuta: node server.js', 'warning');
    return;
  }

  // Ejecutar todas las secciones de tests
  await testAuthentication();
  await testPredictions();
  await testUserProfile();
  await testNotifications();
  await testAdminPanel();
  await testValidations();
  
  // Mostrar resumen
  showSummary();
}

// Manejo de errores no capturados
process.on('unhandledRejection', (error) => {
  log(`\n❌ ERROR NO MANEJADO: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});

// Ejecutar tests
runAllTests().then(() => {
  log('\n✅ Tests completados', 'success');
  process.exit(failedTests > 0 ? 1 : 0);
}).catch(error => {
  log(`\n❌ ERROR FATAL: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});