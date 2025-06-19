// security-validation-tests.js - TESTS DE SEGURIDAD Y VALIDACIÓN
const axios = require('axios');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3001';

// =====================================================
// UTILIDADES DE TESTING DE SEGURIDAD
// =====================================================

const makeSecurityRequest = async (method, url, data = null, headers = {}) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      validateStatus: () => true // No lanzar error en códigos de estado >= 400
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return {
      status: response.status,
      data: response.data,
      headers: response.headers
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message
    };
  }
};

const showSecurityResult = (testName, passed, details = '') => {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${testName}${details ? ': ' + details : ''}`);
  return passed;
};

// =====================================================
// TESTS DE AUTENTICACIÓN Y AUTORIZACIÓN
// =====================================================

class SecurityTestSuite {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      critical: 0,
      tests: []
    };
    this.tokens = {};
  }

  async runTest(testName, testFunction, severity = 'medium') {
    this.results.total++;
    
    try {
      const result = await testFunction();
      const passed = result.passed !== false;
      
      if (passed) {
        this.results.passed++;
      } else {
        this.results.failed++;
        if (severity === 'critical') {
          this.results.critical++;
        }
      }
      
      this.results.tests.push({
        name: testName,
        passed,
        severity,
        details: result.details || '',
        vulnerability: result.vulnerability || null
      });
      
      showSecurityResult(testName, passed, result.details);
      return result;
      
    } catch (error) {
      this.results.failed++;
      if (severity === 'critical') {
        this.results.critical++;
      }
      
      this.results.tests.push({
        name: testName,
        passed: false,
        severity,
        details: error.message,
        vulnerability: 'TEST_ERROR'
      });
      
      showSecurityResult(testName, false, error.message);
      return { passed: false, details: error.message };
    }
  }

  // Test: Endpoints sin autenticación
  async testPublicEndpoints() {
    const publicEndpoints = [
      { url: '/health', expectedStatus: 200 },
      { url: '/api/predictions', expectedStatus: 200 },
      { url: '/api/notifications/vapid-public-key', expectedStatus: 200 },
      { url: '/api/auth/login', method: 'POST', expectedStatus: 400 }, // Sin datos
      { url: '/api/auth/register', method: 'POST', expectedStatus: 400 } // Sin datos
    ];
    
    let allPassed = true;
    
    for (const endpoint of publicEndpoints) {
      const response = await makeSecurityRequest(
        endpoint.method || 'GET',
        endpoint.url,
        endpoint.method === 'POST' ? {} : null
      );
      
      const passed = response.status === endpoint.expectedStatus;
      if (!passed) {
        allPassed = false;
        console.log(`   ❌ ${endpoint.url}: esperado ${endpoint.expectedStatus}, recibido ${response.status}`);
      }
    }
    
    return {
      passed: allPassed,
      details: allPassed ? 'Todos los endpoints públicos responden correctamente' : 'Algunos endpoints fallan'
    };
  }

  // Test: Protección de endpoints privados
  async testPrivateEndpointsProtection() {
    const privateEndpoints = [
      '/api/users/profile',
      '/api/wallet/balance',
      '/api/wallet/dashboard',
      '/api/notifications/subscribe',
      '/api/tournaments/user/stats'
    ];
    
    let allProtected = true;
    
    for (const endpoint of privateEndpoints) {
      const response = await makeSecurityRequest('GET', endpoint);
      
      if (response.status !== 401) {
        allProtected = false;
        console.log(`   ❌ ${endpoint}: no protegido (status: ${response.status})`);
      }
    }
    
    return {
      passed: allProtected,
      details: allProtected ? 'Todos los endpoints privados están protegidos' : 'Algunos endpoints no están protegidos',
      vulnerability: !allProtected ? 'UNPROTECTED_ENDPOINTS' : null
    };
  }

  // Test: Protección de endpoints de admin
  async testAdminEndpointsProtection() {
    const adminEndpoints = [
      '/api/admin/stats',
      '/api/admin/predictions',
      '/api/admin/users',
      '/api/admin/tournaments',
      '/api/wallet/admin/dashboard'
    ];
    
    // Obtener token de usuario regular
    const userLogin = await makeSecurityRequest('POST', '/api/auth/login', {
      phoneOrEmail: 'regular@test.com',
      password: 'test123'
    });
    
    if (userLogin.status !== 200) {
      return {
        passed: false,
        details: 'No se pudo obtener token de usuario regular para prueba'
      };
    }
    
    const userToken = userLogin.data.token;
    let allProtected = true;
    
    for (const endpoint of adminEndpoints) {
      const response = await makeSecurityRequest('GET', endpoint, null, {
        'Authorization': `Bearer ${userToken}`
      });
      
      if (response.status !== 403) {
        allProtected = false;
        console.log(`   ❌ ${endpoint}: accesible por usuario regular (status: ${response.status})`);
      }
    }
    
    return {
      passed: allProtected,
      details: allProtected ? 'Todos los endpoints de admin están protegidos' : 'Algunos endpoints de admin son accesibles',
      vulnerability: !allProtected ? 'ADMIN_BYPASS' : null
    };
  }

  // Test: Validación de JWT
  async testJWTValidation() {
    const tests = [
      {
        name: 'Token inválido',
        token: 'invalid.token.here',
        shouldFail: true
      },
      {
        name: 'Token vacío',
        token: '',
        shouldFail: true
      },
      {
        name: 'Token mal formado',
        token: 'Bearer malformed-token',
        shouldFail: true
      },
      {
        name: 'Token expirado',
        token: jwt.sign({ id: 'test', exp: Math.floor(Date.now() / 1000) - 3600 }, 'fake-secret'),
        shouldFail: true
      }
    ];
    
    let allPassed = true;
    
    for (const test of tests) {
      const response = await makeSecurityRequest('GET', '/api/users/profile', null, {
        'Authorization': `Bearer ${test.token}`
      });
      
      const passed = test.shouldFail ? response.status === 401 : response.status === 200;
      
      if (!passed) {
        allPassed = false;
        console.log(`   ❌ ${test.name}: status ${response.status}`);
      }
    }
    
    return {
      passed: allPassed,
      details: allPassed ? 'Validación JWT funciona correctamente' : 'Problemas en validación JWT',
      vulnerability: !allPassed ? 'JWT_BYPASS' : null
    };
  }

  // Test: Inyección SQL
  async testSQLInjection() {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "'; INSERT INTO users (email) VALUES ('hacked@test.com'); --"
    ];
    
    let vulnerabilityFound = false;
    
    for (const payload of sqlPayloads) {
      const response = await makeSecurityRequest('POST', '/api/auth/login', {
        phoneOrEmail: payload,
        password: 'test'
      });
      
      // Si el servidor devuelve error 500, podría indicar problema SQL
      if (response.status === 500) {
        vulnerabilityFound = true;
        console.log(`   ⚠️  Posible vulnerabilidad con payload: ${payload}`);
      }
    }
    
    return {
      passed: !vulnerabilityFound,
      details: vulnerabilityFound ? 'Posibles vulnerabilidades SQL detectadas' : 'No se detectaron vulnerabilidades SQL',
      vulnerability: vulnerabilityFound ? 'SQL_INJECTION' : null
    };
  }

  // Test: Rate Limiting
  async testRateLimit() {
    const requests = [];
    const maxRequests = 20; // Debería exceder el límite
    
    // Hacer múltiples requests rápidos
    for (let i = 0; i < maxRequests; i++) {
      requests.push(makeSecurityRequest('POST', '/api/auth/login', {
        phoneOrEmail: 'test@test.com',
        password: 'wrong'
      }));
    }
    
    const responses = await Promise.all(requests);
    const blockedRequests = responses.filter(r => r.status === 429).length;
    
    return {
      passed: blockedRequests > 0,
      details: blockedRequests > 0 ? 
        `Rate limiting activo: ${blockedRequests} requests bloqueados` : 
        'Rate limiting no detectado - posible problema',
      vulnerability: blockedRequests === 0 ? 'NO_RATE_LIMIT' : null
    };
  }

  // Test: Validación de input
  async testInputValidation() {
    const invalidInputs = [
      {
        endpoint: '/api/auth/register',
        data: {
          name: 'A'.repeat(1000), // Nombre muy largo
          email: 'invalid-email',
          phone: 'invalid-phone',
          password: '123' // Muy corta
        }
      },
      {
        endpoint: '/api/wallet/deposits',
        data: {
          amount: -100, // Monto negativo
          method: 'INVALID_METHOD',
          transactionNumber: ''
        },
        needsAuth: true
      }
    ];
    
    let validationPassed = true;
    
    for (const test of invalidInputs) {
      const headers = {};
      if (test.needsAuth && this.tokens.regular) {
        headers.Authorization = `Bearer ${this.tokens.regular}`;
      }
      
      const response = await makeSecurityRequest('POST', test.endpoint, test.data, headers);
      
      // Debería devolver 400 para datos inválidos
      if (response.status !== 400 && response.status !== 401) {
        validationPassed = false;
        console.log(`   ❌ ${test.endpoint}: acepta datos inválidos (status: ${response.status})`);
      }
    }
    
    return {
      passed: validationPassed,
      details: validationPassed ? 'Validación de input funciona correctamente' : 'Problemas en validación de input',
      vulnerability: !validationPassed ? 'INPUT_VALIDATION' : null
    };
  }

  // Test: Headers de seguridad
  async testSecurityHeaders() {
    const response = await makeSecurityRequest('GET', '/health');
    const headers = response.headers;
    
    const securityHeaders = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': ['DENY', 'SAMEORIGIN'],
      'x-xss-protection': '1; mode=block'
    };
    
    let headersPassed = true;
    const missingHeaders = [];
    
    for (const [header, expectedValue] of Object.entries(securityHeaders)) {
      const actualValue = headers[header];
      
      if (!actualValue) {
        headersPassed = false;
        missingHeaders.push(header);
      } else if (Array.isArray(expectedValue)) {
        if (!expectedValue.includes(actualValue)) {
          headersPassed = false;
          missingHeaders.push(`${header} (valor incorrecto: ${actualValue})`);
        }
      } else if (actualValue !== expectedValue) {
        headersPassed = false;
        missingHeaders.push(`${header} (valor incorrecto: ${actualValue})`);
      }
    }
    
    return {
      passed: headersPassed,
      details: headersPassed ? 
        'Headers de seguridad configurados correctamente' : 
        `Headers faltantes/incorrectos: ${missingHeaders.join(', ')}`,
      vulnerability: !headersPassed ? 'MISSING_SECURITY_HEADERS' : null
    };
  }

  // Test: CORS Configuration
  async testCORSConfiguration() {
    const response = await makeSecurityRequest('OPTIONS', '/api/predictions', null, {
      'Origin': 'https://malicious-site.com',
      'Access-Control-Request-Method': 'GET'
    });
    
    const corsHeader = response.headers['access-control-allow-origin'];
    
    // No debería permitir cualquier origen
    const isVulnerable = corsHeader === '*';
    
    return {
      passed: !isVulnerable,
      details: isVulnerable ? 
        'CORS permite cualquier origen (*)' : 
        'CORS configurado correctamente',
      vulnerability: isVulnerable ? 'PERMISSIVE_CORS' : null
    };
  }

  // Obtener tokens para tests
  async setupTokens() {
    try {
      // Token regular
      const regularLogin = await makeSecurityRequest('POST', '/api/auth/login', {
        phoneOrEmail: 'regular@test.com',
        password: 'test123'
      });
      
      if (regularLogin.status === 200) {
        this.tokens.regular = regularLogin.data.token;
      }
      
      // Token admin
      const adminLogin = await makeSecurityRequest('POST', '/api/auth/login', {
        phoneOrEmail: 'admin@iasport.pe',
        password: 'admin123'
      });
      
      if (adminLogin.status === 200) {
        this.tokens.admin = adminLogin.data.token;
      }
      
    } catch (error) {
      console.log('⚠️  No se pudieron obtener tokens para tests');
    }
  }

  // Ejecutar todos los tests
  async runAllSecurityTests() {
    console.log('\n🔒 INICIANDO TESTS DE SEGURIDAD');
    console.log(`📅 ${new Date().toLocaleString()}`);
    console.log('═'.repeat(60));
    
    await this.setupTokens();
    
    console.log('\n🔐 TESTS DE AUTENTICACIÓN Y AUTORIZACIÓN');
    await this.runTest('Endpoints públicos accesibles', () => this.testPublicEndpoints(), 'low');
    await this.runTest('Protección de endpoints privados', () => this.testPrivateEndpointsProtection(), 'critical');
    await this.runTest('Protección de endpoints de admin', () => this.testAdminEndpointsProtection(), 'critical');
    await this.runTest('Validación de JWT', () => this.testJWTValidation(), 'high');
    
    console.log('\n🛡️  TESTS DE VULNERABILIDADES');
    await this.runTest('Protección contra inyección SQL', () => this.testSQLInjection(), 'critical');
    await this.runTest('Rate Limiting', () => this.testRateLimit(), 'medium');
    await this.runTest('Validación de input', () => this.testInputValidation(), 'high');
    
    console.log('\n📡 TESTS DE CONFIGURACIÓN');
    await this.runTest('Headers de seguridad', () => this.testSecurityHeaders(), 'medium');
    await this.runTest('Configuración CORS', () => this.testCORSConfiguration(), 'medium');
    
    this.showSecurityReport();
  }

  showSecurityReport() {
    console.log('\n═'.repeat(60));
    console.log('📊 REPORTE DE SEGURIDAD');
    console.log('═'.repeat(60));
    
    const { total, passed, failed, critical } = this.results;
    const passRate = ((passed / total) * 100).toFixed(1);
    
    console.log(`\n📈 RESUMEN:`);
    console.log(`   Total de tests: ${total}`);
    console.log(`   ✅ Pasados: ${passed} (${passRate}%)`);
    console.log(`   ❌ Fallidos: ${failed}`);
    console.log(`   🚨 Críticos fallidos: ${critical}`);
    
    // Clasificar por severidad
    const criticalIssues = this.results.tests.filter(t => !t.passed && t.severity === 'critical');
    const highIssues = this.results.tests.filter(t => !t.passed && t.severity === 'high');
    const mediumIssues = this.results.tests.filter(t => !t.passed && t.severity === 'medium');
    
    if (criticalIssues.length > 0) {
      console.log(`\n🚨 VULNERABILIDADES CRÍTICAS:`);
      criticalIssues.forEach(issue => {
        console.log(`   ❌ ${issue.name}: ${issue.details}`);
      });
    }
    
    if (highIssues.length > 0) {
      console.log(`\n⚠️  VULNERABILIDADES ALTAS:`);
      highIssues.forEach(issue => {
        console.log(`   ❌ ${issue.name}: ${issue.details}`);
      });
    }
    
    if (mediumIssues.length > 0) {
      console.log(`\n⚡ VULNERABILIDADES MEDIAS:`);
      mediumIssues.forEach(issue => {
        console.log(`   ❌ ${issue.name}: ${issue.details}`);
      });
    }
    
    console.log(`\n💡 RECOMENDACIONES:`);
    
    if (critical === 0) {
      console.log(`   ✅ No se encontraron vulnerabilidades críticas`);
    } else {
      console.log(`   🚨 URGENTE: Corregir ${critical} vulnerabilidades críticas`);
    }
    
    if (passRate >= 90) {
      console.log(`   ✅ Excelente nivel de seguridad (${passRate}%)`);
    } else if (passRate >= 75) {
      console.log(`   ⚠️  Buen nivel de seguridad, pero hay mejoras posibles (${passRate}%)`);
    } else {
      console.log(`   🚨 Nivel de seguridad insuficiente (${passRate}%) - Acción requerida`);
    }
    
    console.log(`\n📋 PRÓXIMOS PASOS:`);
    console.log(`   1. Corregir vulnerabilidades críticas inmediatamente`);
    console.log(`   2. Implementar WAF (Web Application Firewall)`);
    console.log(`   3. Configurar monitoreo de seguridad`);
    console.log(`   4. Realizar auditorías periódicas`);
    console.log(`   5. Implementar logging de seguridad`);
  }
}

// =====================================================
// FUNCIÓN PRINCIPAL
// =====================================================

const runSecurityTests = async () => {
  const testSuite = new SecurityTestSuite();
  await testSuite.runAllSecurityTests();
  return testSuite.results;
};

// Ejecutar si es llamado directamente
if (require.main === module) {
  runSecurityTests().catch(console.error);
}

module.exports = {
  runSecurityTests,
  SecurityTestSuite
};