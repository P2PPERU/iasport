// testAdminComplete.js
const BASE_URL = 'http://localhost:3001/api';
let adminToken = null;
let testPredictionId = null;
let testUserId = null;

// Colores para la consola
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function log(message, type = 'info') {
  const color = {
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
    info: colors.blue
  }[type] || colors.reset;
  
  console.log(`${color}${message}${colors.reset}`);
}

async function testLogin() {
  try {
    log('\n1️⃣ LOGIN COMO ADMIN', 'info');
    
    const response = await fetch(`${BASE_URL}/auth/login`, {
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
      log('✅ Login exitoso', 'success');
      log(`Token: ${adminToken.substring(0, 50)}...`);
      log(`Usuario: ${data.user.name} (${data.user.email})`);
      return true;
    } else {
      log('❌ Error en login: ' + data.message, 'error');
      return false;
    }
  } catch (error) {
    log('❌ Error: ' + error.message, 'error');
    return false;
  }
}

async function testDashboardStats() {
  try {
    log('\n2️⃣ DASHBOARD STATS', 'info');
    
    const response = await fetch(`${BASE_URL}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      log('✅ Estadísticas obtenidas:', 'success');
      console.table(data.data);
    } else {
      log('❌ Error: ' + data.message, 'error');
    }
  } catch (error) {
    log('❌ Error: ' + error.message, 'error');
  }
}

async function testGetPredictions() {
  try {
    log('\n3️⃣ LISTAR PREDICCIONES', 'info');
    
    const response = await fetch(`${BASE_URL}/admin/predictions`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      log(`✅ ${data.count} predicciones encontradas`, 'success');
      if (data.data.length > 0) {
        testPredictionId = data.data[0].id;
        console.log('\nPrimeras 3 predicciones:');
        console.table(data.data.slice(0, 3).map(p => ({
          liga: p.league,
          partido: p.match,
          prediccion: p.prediction,
          cuota: p.odds,
          resultado: p.result
        })));
      }
    } else {
      log('❌ Error: ' + data.message, 'error');
    }
  } catch (error) {
    log('❌ Error: ' + error.message, 'error');
  }
}

async function testCreatePrediction() {
  try {
    log('\n4️⃣ CREAR NUEVA PREDICCIÓN', 'info');
    
    const newPrediction = {
      league: 'Liga Test',
      match: 'Test FC vs Prueba United',
      homeTeam: 'Test FC',
      awayTeam: 'Prueba United',
      prediction: 'Test FC Gana',
      predictionType: '1X2',
      confidence: 75,
      odds: 2.10,
      matchTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Mañana
      isHot: true,
      isPremium: true,
      sport: 'football'
    };
    
    const response = await fetch(`${BASE_URL}/admin/predictions`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newPrediction)
    });
    
    const data = await response.json();
    
    if (data.success) {
      testPredictionId = data.data.id;
      log('✅ Predicción creada exitosamente', 'success');
      log(`ID: ${testPredictionId}`);
      log(`Partido: ${data.data.match}`);
    } else {
      log('❌ Error: ' + data.message, 'error');
    }
  } catch (error) {
    log('❌ Error: ' + error.message, 'error');
  }
}

async function testUpdateResult() {
  try {
    log('\n5️⃣ ACTUALIZAR RESULTADO DE PREDICCIÓN', 'info');
    
    if (!testPredictionId) {
      log('⚠️ No hay predicción de prueba', 'warning');
      return;
    }
    
    const response = await fetch(`${BASE_URL}/admin/predictions/${testPredictionId}/result`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ result: 'WON' })
    });
    
    const data = await response.json();
    
    if (data.success) {
      log('✅ Resultado actualizado a WON', 'success');
    } else {
      log('❌ Error: ' + data.message, 'error');
    }
  } catch (error) {
    log('❌ Error: ' + error.message, 'error');
  }
}

async function testGetUsers() {
  try {
    log('\n6️⃣ LISTAR USUARIOS', 'info');
    
    const response = await fetch(`${BASE_URL}/admin/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      log(`✅ ${data.count} usuarios encontrados`, 'success');
      if (data.data.length > 0) {
        testUserId = data.data.find(u => !u.isAdmin)?.id || data.data[0].id;
        console.table(data.data.map(u => ({
          nombre: u.name,
          email: u.email,
          telefono: u.phone,
          premium: u.isPremium ? 'Sí' : 'No',
          admin: u.isAdmin ? 'Sí' : 'No'
        })));
      }
    } else {
      log('❌ Error: ' + data.message, 'error');
    }
  } catch (error) {
    log('❌ Error: ' + error.message, 'error');
  }
}

async function testTogglePremium() {
  try {
    log('\n7️⃣ TOGGLE PREMIUM DE USUARIO', 'info');
    
    if (!testUserId) {
      log('⚠️ No hay usuario de prueba', 'warning');
      return;
    }
    
    const response = await fetch(`${BASE_URL}/admin/users/${testUserId}/premium`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isPremium: true, days: 30 })
    });
    
    const data = await response.json();
    
    if (data.success) {
      log('✅ Usuario actualizado a premium por 30 días', 'success');
      log(`Usuario: ${data.data.email}`);
      log(`Expira: ${data.data.premiumExpiresAt}`);
    } else {
      log('❌ Error: ' + data.message, 'error');
    }
  } catch (error) {
    log('❌ Error: ' + error.message, 'error');
  }
}

async function testGetPayments() {
  try {
    log('\n8️⃣ LISTAR PAGOS', 'info');
    
    const response = await fetch(`${BASE_URL}/admin/payments`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      log(`✅ ${data.count} pagos encontrados`, 'success');
      log(`Total recaudado: S/ ${data.totalAmount}`);
      if (data.data.length > 0) {
        console.table(data.data.slice(0, 5).map(p => ({
          usuario: p.User?.name || 'N/A',
          monto: `S/ ${p.amount}`,
          metodo: p.method,
          estado: p.status,
          fecha: new Date(p.created_at).toLocaleDateString()
        })));
      }
    } else {
      log('❌ Error: ' + data.message, 'error');
    }
  } catch (error) {
    log('❌ Error: ' + error.message, 'error');
  }
}

async function testDetailedStats() {
    try {
        log('\n9️⃣ ESTADÍSTICAS DETALLADAS', 'info');
        
        const response = await fetch(`${BASE_URL}/admin/stats/detailed?period=month`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            log('✅ Estadísticas detalladas obtenidas', 'success');
            
            if (data.data.sportStats && data.data.sportStats.length > 0) {
                console.log('\nEstadísticas por deporte:');
                console.table(data.data.sportStats.map(s => ({
                    deporte: s.sport,
                    total: s.total,
                    ganadas: s.won,
                    perdidas: s.lost,
                    pendientes: s.pending,
                    precisión: s.accuracy + '%'
                })));
            }
            
            if (data.data.leagueStats && data.data.leagueStats.length > 0) {
                console.log('\nTop ligas:');
                console.table(data.data.leagueStats.slice(0, 5).map(l => ({
                    liga: l.league,
                    predicciones: l.total,
                    ganadas: l.won,
                    perdidas: l.lost,
                    precisión: l.accuracy + '%'
                })));
            }
        } else {
            log('❌ Error: ' + data.message, 'error');
        }
    } catch (error) {
        log('❌ Error: ' + error.message, 'error');
    }
}

async function testDeletePrediction() {
  try {
    log('\n🔟 ELIMINAR PREDICCIÓN DE PRUEBA', 'info');
    
    if (!testPredictionId) {
      log('⚠️ No hay predicción de prueba para eliminar', 'warning');
      return;
    }
    
    const response = await fetch(`${BASE_URL}/admin/predictions/${testPredictionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      log('✅ Predicción eliminada exitosamente', 'success');
    } else {
      log('❌ Error: ' + data.message, 'error');
    }
  } catch (error) {
    log('❌ Error: ' + error.message, 'error');
  }
}

// Función principal
async function runAllTests() {
  console.log('🚀 INICIANDO TESTS DEL PANEL ADMINISTRATIVO');
  console.log('==========================================\n');
  
  // Login primero
  const loginSuccess = await testLogin();
  if (!loginSuccess) {
    log('❌ No se puede continuar sin autenticación', 'error');
    return;
  }
  
  // Ejecutar todos los tests
  await testDashboardStats();
  await testGetPredictions();
  await testCreatePrediction();
  await testUpdateResult();
  await testGetUsers();
  await testTogglePremium();
  await testGetPayments();
  await testDetailedStats();
  await testDeletePrediction();
  
  console.log('\n==========================================');
  log('✅ TESTS COMPLETADOS', 'success');
}

// Ejecutar tests
runAllTests().catch(error => {
  log('❌ Error fatal: ' + error.message, 'error');
});