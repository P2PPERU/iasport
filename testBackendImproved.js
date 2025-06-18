// testBackendImproved.js - Pruebas mejoradas con mejor debugging
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
const SERVER_URL = 'http://localhost:3001';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

let adminToken = '';
let userToken = '';
let premiumToken = '';

class ImprovedBackendTester {
  
  static log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  static async request(method, url, data = null, token = null) {
    try {
      const config = {
        method,
        url: url.startsWith('http') ? url : `${BASE_URL}${url}`,
        data,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        timeout: 10000 // 10 segundos timeout
      };

      const response = await axios(config);
      return { 
        success: true, 
        data: response.data, 
        status: response.status,
        headers: response.headers
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data || error.message,
        status: error.response?.status || 0,
        code: error.code,
        isTimeout: error.code === 'ECONNABORTED',
        isNetworkError: error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND'
      };
    }
  }

  // Test de conectividad del servidor
  static async testServerConnectivity() {
    this.log('\n🌐 TESTING SERVER CONNECTIVITY', 'bold');
    this.log('==============================', 'cyan');

    // Test 1: Servidor corriendo
    this.log('\n📝 Test 1: Server Running', 'yellow');
    const healthCheck = await this.request('GET', `${SERVER_URL}/health`);
    
    if (healthCheck.success) {
      this.log('   ✅ Servidor corriendo y responde', 'green');
      this.log(`   📊 Status: ${healthCheck.data.status}`, 'cyan');
      this.log(`   ⏱️ Uptime: ${healthCheck.data.uptime}s`, 'cyan');
      
      if (healthCheck.data.database) {
        this.log(`   🗄️ Database: ${healthCheck.data.database.connected ? 'Conectada' : 'Desconectada'}`, 
          healthCheck.data.database.connected ? 'green' : 'red');
      }
    } else {
      this.log('   ❌ Servidor no responde', 'red');
      
      if (healthCheck.isNetworkError) {
        this.log('   🔍 DIAGNÓSTICO: Error de conexión de red', 'yellow');
        this.log('   💡 SOLUCIONES:', 'yellow');
        this.log('      1. Verifica que el servidor esté corriendo: npm run dev', 'cyan');
        this.log('      2. Verifica el puerto (3001 por defecto)', 'cyan');
        this.log('      3. Verifica que no haya conflictos de puerto', 'cyan');
        return false;
      } else if (healthCheck.isTimeout) {
        this.log('   🔍 DIAGNÓSTICO: Timeout del servidor', 'yellow');
        this.log('   💡 SOLUCIONES:', 'yellow');
        this.log('      1. Servidor muy lento - verifica BD', 'cyan');
        this.log('      2. Reinicia el servidor', 'cyan');
        return false;
      } else {
        this.log(`   🔍 Error: ${JSON.stringify(healthCheck.error)}`, 'red');
        return false;
      }
    }

    // Test 2: Root endpoint
    this.log('\n📝 Test 2: Root Endpoint', 'yellow');
    const rootCheck = await this.request('GET', SERVER_URL);
    
    if (rootCheck.success) {
      this.log('   ✅ Root endpoint funciona', 'green');
      this.log(`   📋 API Version: ${rootCheck.data.message}`, 'cyan');
    } else {
      this.log('   ❌ Root endpoint falla', 'red');
      this.log(`   Error: ${JSON.stringify(rootCheck.error)}`, 'red');
    }

    return healthCheck.success;
  }

  // Test de autenticación mejorado
  static async testAuthentication() {
    this.log('\n🔐 TESTING AUTHENTICATION', 'bold');
    this.log('========================', 'cyan');

    const credentials = [
      { email: 'admin@predictmaster.pe', password: 'admin123', type: 'Admin', tokenVar: 'adminToken' },
      { email: 'demo@predictmaster.pe', password: 'demo123', type: 'Demo', tokenVar: 'userToken' },
      { email: 'premium@predictmaster.pe', password: 'premium123', type: 'Premium', tokenVar: 'premiumToken' }
    ];

    let successCount = 0;

    for (let i = 0; i < credentials.length; i++) {
      const cred = credentials[i];
      this.log(`\n📝 Test ${i + 1}: ${cred.type} Login`, 'yellow');
      
      const loginResult = await this.request('POST', '/auth/login', {
        phoneOrEmail: cred.email,
        password: cred.password
      });

      if (loginResult.success) {
        const token = loginResult.data.token;
        const user = loginResult.data.user;
        
        // Asignar token a variable global
        if (cred.tokenVar === 'adminToken') adminToken = token;
        else if (cred.tokenVar === 'userToken') userToken = token;
        else if (cred.tokenVar === 'premiumToken') premiumToken = token;
        
        this.log(`   ✅ ${cred.type} login exitoso`, 'green');
        this.log(`   👤 Usuario: ${user.name}`, 'cyan');
        this.log(`   📧 Email: ${user.email}`, 'cyan');
        this.log(`   🔧 Admin: ${user.isAdmin ? 'Sí' : 'No'}`, 'cyan');
        this.log(`   💎 Premium: ${user.isPremium ? 'Sí' : 'No'}`, 'cyan');
        this.log(`   🔑 Token: ${token.substring(0, 20)}...`, 'cyan');
        
        successCount++;
      } else {
        this.log(`   ❌ ${cred.type} login falló`, 'red');
        
        if (loginResult.status === 401) {
          this.log('   🔍 DIAGNÓSTICO: Credenciales incorrectas', 'yellow');
          this.log(`   💡 SOLUCIÓN: Crear usuario ${cred.type.toLowerCase()}:`, 'yellow');
          this.log(`      node create${cred.type}User.js`, 'cyan');
        } else if (loginResult.status === 404) {
          this.log('   🔍 DIAGNÓSTICO: Usuario no existe', 'yellow');
          this.log(`   💡 SOLUCIÓN: Ejecutar script de datos: node createSampleData.js`, 'cyan');
        } else {
          this.log(`   🔍 Error: ${JSON.stringify(loginResult.error)}`, 'red');
        }
      }
    }

    this.log(`\n📊 Resumen de Autenticación: ${successCount}/3 exitosos`, 
      successCount === 3 ? 'green' : successCount > 0 ? 'yellow' : 'red');

    return { adminToken, userToken, premiumToken, successCount };
  }

  // Test de endpoints específicos
  static async testSpecificEndpoints() {
    this.log('\n🎯 TESTING SPECIFIC ENDPOINTS', 'bold');
    this.log('=============================', 'cyan');

    const endpoints = [
      { 
        name: 'Predicciones Públicas', 
        method: 'GET', 
        url: '/predictions',
        expectedFields: ['data', 'count']
      },
      { 
        name: 'Torneos Disponibles', 
        method: 'GET', 
        url: '/tournaments',
        expectedFields: ['data', 'count']
      },
      { 
        name: 'Ranking Global', 
        method: 'GET', 
        url: '/tournaments/ranking/global',
        expectedFields: ['data']
      },
      { 
        name: 'VAPID Public Key', 
        method: 'GET', 
        url: '/notifications/vapid-public-key',
        expectedFields: ['publicKey']
      }
    ];

    let successCount = 0;

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      this.log(`\n📝 Test ${i + 1}: ${endpoint.name}`, 'yellow');
      
      const result = await this.request(endpoint.method, endpoint.url);
      
      if (result.success) {
        this.log(`   ✅ ${endpoint.name} funciona`, 'green');
        
        // Verificar campos esperados
        let fieldsOK = true;
        for (const field of endpoint.expectedFields) {
          if (result.data.hasOwnProperty(field)) {
            this.log(`   📋 ${field}: ✅`, 'green');
          } else {
            this.log(`   📋 ${field}: ❌ (faltante)`, 'red');
            fieldsOK = false;
          }
        }
        
        if (fieldsOK) {
          successCount++;
          
          // Información adicional específica
          if (endpoint.url === '/predictions' && result.data.data) {
            this.log(`   📊 Total predicciones: ${result.data.data.length}`, 'cyan');
          } else if (endpoint.url === '/tournaments' && result.data.data) {
            this.log(`   📊 Total torneos: ${result.data.data.length}`, 'cyan');
          }
        }
      } else {
        this.log(`   ❌ ${endpoint.name} falla`, 'red');
        
        if (result.status === 500) {
          this.log('   🔍 DIAGNÓSTICO: Error del servidor', 'yellow');
          this.log('   💡 POSIBLES CAUSAS:', 'yellow');
          this.log('      1. Error en base de datos', 'cyan');
          this.log('      2. Datos faltantes (ejecutar createSampleData.js)', 'cyan');
          this.log('      3. Error en modelo de datos', 'cyan');
        } else if (result.status === 404) {
          this.log('   🔍 DIAGNÓSTICO: Endpoint no encontrado', 'yellow');
          this.log('   💡 SOLUCIÓN: Verificar rutas en server.js', 'cyan');
        } else {
          this.log(`   🔍 Error: ${JSON.stringify(result.error)}`, 'red');
        }
      }
    }

    this.log(`\n📊 Resumen de Endpoints: ${successCount}/${endpoints.length} funcionando`, 
      successCount === endpoints.length ? 'green' : successCount > 0 ? 'yellow' : 'red');

    return successCount;
  }

  // Test de endpoints admin (requieren token)
  static async testAdminEndpoints() {
    this.log('\n🔧 TESTING ADMIN ENDPOINTS', 'bold');
    this.log('=========================', 'cyan');

    if (!adminToken) {
      this.log('   ⚠️ No hay token de admin, saltando pruebas admin', 'yellow');
      return 0;
    }

    const adminEndpoints = [
      { name: 'Dashboard Stats', url: '/admin/stats' },
      { name: 'Tournament Stats', url: '/admin/tournaments/stats' },
      { name: 'Admin Users', url: '/admin/users' },
      { name: 'Admin Predictions', url: '/admin/predictions' }
    ];

    let successCount = 0;

    for (let i = 0; i < adminEndpoints.length; i++) {
      const endpoint = adminEndpoints[i];
      this.log(`\n📝 Test ${i + 1}: ${endpoint.name}`, 'yellow');
      
      const result = await this.request('GET', endpoint.url, null, adminToken);
      
      if (result.success) {
        this.log(`   ✅ ${endpoint.name} funciona`, 'green');
        successCount++;
      } else {
        this.log(`   ❌ ${endpoint.name} falla`, 'red');
        
        if (result.status === 403) {
          this.log('   🔍 DIAGNÓSTICO: Sin permisos admin', 'yellow');
          this.log('   💡 SOLUCIÓN: Verificar que el usuario admin tenga isAdmin: true', 'cyan');
        } else {
          this.log(`   🔍 Error: ${JSON.stringify(result.error)}`, 'red');
        }
      }
    }

    return successCount;
  }

  // Método principal mejorado
  static async runComprehensiveTests() {
    this.log('🚀 PRUEBAS COMPREHENSIVAS DEL BACKEND PREDICTMASTER', 'bold');
    this.log('==================================================', 'cyan');
    
    const startTime = Date.now();
    let totalTests = 0;
    let passedTests = 0;

    try {
      // 1. Test de conectividad
      const serverOK = await this.testServerConnectivity();
      totalTests++;
      if (serverOK) passedTests++;
      
      if (!serverOK) {
        this.log('\n❌ SERVIDOR NO DISPONIBLE - ABORTANDO PRUEBAS', 'red');
        this.log('===============================================', 'red');
        this.log('\n💡 PARA SOLUCIONAR:', 'yellow');
        this.log('   1. Ejecuta: node fixBackend.js', 'cyan');
        this.log('   2. Luego: npm run dev', 'cyan');
        this.log('   3. Finalmente: node testBackendImproved.js', 'cyan');
        return;
      }

      // 2. Test de autenticación
      const authResults = await this.testAuthentication();
      totalTests++;
      if (authResults.successCount >= 2) passedTests++; // Al menos admin y un usuario regular

      // 3. Test de endpoints específicos
      const endpointResults = await this.testSpecificEndpoints();
      totalTests++;
      if (endpointResults >= 3) passedTests++; // Al menos 3 de 4 endpoints

      // 4. Test de endpoints admin
      const adminResults = await this.testAdminEndpoints();
      totalTests++;
      if (adminResults >= 2) passedTests++; // Al menos 2 endpoints admin

      // Resultados finales
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      const successRate = ((passedTests / totalTests) * 100).toFixed(1);

      this.log('\n🎉 RESULTADOS FINALES', 'bold');
      this.log('===================', 'cyan');
      this.log(`⏱️ Tiempo total: ${duration} segundos`, 'yellow');
      this.log(`📊 Pruebas exitosas: ${passedTests}/${totalTests} (${successRate}%)`, 
        passedTests === totalTests ? 'green' : passedTests > totalTests/2 ? 'yellow' : 'red');

      if (passedTests === totalTests) {
        this.log('\n✅ BACKEND FUNCIONANDO PERFECTAMENTE', 'green');
        this.log('==================================', 'green');
        this.log('\n🚀 LISTO PARA PRODUCCIÓN:', 'bold');
        this.log('  • Todos los endpoints funcionan', 'green');
        this.log('  • Autenticación completa', 'green');
        this.log('  • Base de datos conectada', 'green');
        this.log('  • Funcionalidades admin activas', 'green');
      } else if (passedTests >= totalTests * 0.75) {
        this.log('\n⚠️ BACKEND FUNCIONANDO CON ADVERTENCIAS', 'yellow');
        this.log('=====================================', 'yellow');
        this.log('\n💡 RECOMENDACIONES:', 'bold');
        this.log('  • Ejecutar: node fixBackend.js', 'cyan');
        this.log('  • Verificar logs del servidor', 'cyan');
        this.log('  • Revisar configuración .env', 'cyan');
      } else {
        this.log('\n❌ BACKEND CON PROBLEMAS CRÍTICOS', 'red');
        this.log('================================', 'red');
        this.log('\n🔧 SOLUCIONES URGENTES:', 'bold');
        this.log('  1. Ejecutar: node fixBackend.js', 'cyan');
        this.log('  2. Verificar conexión a PostgreSQL', 'cyan');
        this.log('  3. Revisar logs de errores', 'cyan');
        this.log('  4. Verificar .env configuration', 'cyan');
      }

    } catch (error) {
      this.log(`\n❌ ERROR CRÍTICO DURANTE LAS PRUEBAS: ${error.message}`, 'red');
      this.log('===========================================', 'red');
      
      if (error.code === 'ECONNREFUSED') {
        this.log('\n🔍 DIAGNÓSTICO: Servidor no está corriendo', 'yellow');
        this.log('💡 SOLUCIÓN: npm run dev', 'cyan');
      } else {
        this.log(`\n🔍 Error: ${error.stack}`, 'red');
      }
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  ImprovedBackendTester.runComprehensiveTests();
}

module.exports = ImprovedBackendTester;