// stress-performance-tests.js - TESTS DE STRESS Y PERFORMANCE
const axios = require('axios');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3001';

// =====================================================
// WORKER PARA TESTS CONCURRENTES
// =====================================================

if (!isMainThread) {
  const { testType, config, token } = workerData;
  
  const runWorkerTest = async () => {
    const results = [];
    
    for (let i = 0; i < config.requestsPerWorker; i++) {
      const start = performance.now();
      
      try {
        let response;
        
        switch (testType) {
          case 'predictions':
            response = await axios.get(`${BASE_URL}/api/predictions`);
            break;
          case 'tournaments':
            response = await axios.get(`${BASE_URL}/api/tournaments`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            break;
          case 'wallet':
            response = await axios.get(`${BASE_URL}/api/wallet/balance`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            break;
          case 'admin_stats':
            response = await axios.get(`${BASE_URL}/api/admin/stats`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            break;
        }
        
        const duration = performance.now() - start;
        results.push({
          success: true,
          duration: Math.round(duration),
          status: response.status
        });
        
      } catch (error) {
        const duration = performance.now() - start;
        results.push({
          success: false,
          duration: Math.round(duration),
          status: error.response?.status || 0,
          error: error.message
        });
      }
      
      // Pequeña pausa entre requests
      await new Promise(resolve => setTimeout(resolve, config.delayBetweenRequests || 50));
    }
    
    parentPort.postMessage(results);
  };
  
  runWorkerTest();
}

// =====================================================
// CLASE PARA TESTS DE PERFORMANCE
// =====================================================

class PerformanceTestSuite {
  constructor() {
    this.results = {
      tests: [],
      summary: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        throughput: 0
      }
    };
  }

  async runStressTest(testName, testType, config, token = null) {
    console.log(`\n🔥 Ejecutando test de stress: ${testName}`);
    console.log(`   Workers: ${config.workers}`);
    console.log(`   Requests por worker: ${config.requestsPerWorker}`);
    console.log(`   Total requests: ${config.workers * config.requestsPerWorker}`);
    
    const startTime = performance.now();
    const workers = [];
    const workerPromises = [];
    
    // Crear workers
    for (let i = 0; i < config.workers; i++) {
      const worker = new Worker(__filename, {
        workerData: { testType, config, token }
      });
      
      workers.push(worker);
      
      const workerPromise = new Promise((resolve, reject) => {
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });
      
      workerPromises.push(workerPromise);
    }
    
    // Esperar todos los workers
    const workerResults = await Promise.all(workerPromises);
    const endTime = performance.now();
    
    // Terminar workers
    workers.forEach(worker => worker.terminate());
    
    // Procesar resultados
    const allResults = workerResults.flat();
    const successful = allResults.filter(r => r.success);
    const failed = allResults.filter(r => !r.success);
    const durations = allResults.map(r => r.duration);
    
    const testResult = {
      testName,
      testType,
      config,
      duration: Math.round(endTime - startTime),
      totalRequests: allResults.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      successRate: (successful.length / allResults.length * 100).toFixed(2),
      averageResponseTime: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      minResponseTime: Math.min(...durations),
      maxResponseTime: Math.max(...durations),
      throughput: Math.round(allResults.length / (endTime - startTime) * 1000),
      errors: failed.map(f => ({ status: f.status, error: f.error }))
    };
    
    this.results.tests.push(testResult);
    this.updateSummary(testResult);
    
    // Mostrar resultados
    console.log(`   ✅ Requests exitosos: ${testResult.successfulRequests}/${testResult.totalRequests} (${testResult.successRate}%)`);
    console.log(`   ⏱️  Tiempo promedio: ${testResult.averageResponseTime}ms`);
    console.log(`   📈 Throughput: ${testResult.throughput} req/seg`);
    console.log(`   🕐 Duración total: ${testResult.duration}ms`);
    
    if (testResult.failedRequests > 0) {
      console.log(`   ❌ Errores: ${testResult.failedRequests}`);
      const errorCounts = {};
      testResult.errors.forEach(err => {
        const key = `${err.status}: ${err.error}`;
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      });
      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`      ${count}x ${error}`);
      });
    }
    
    return testResult;
  }

  updateSummary(testResult) {
    this.results.summary.totalRequests += testResult.totalRequests;
    this.results.summary.successfulRequests += testResult.successfulRequests;
    this.results.summary.failedRequests += testResult.failedRequests;
    
    this.results.summary.minResponseTime = Math.min(
      this.results.summary.minResponseTime, 
      testResult.minResponseTime
    );
    this.results.summary.maxResponseTime = Math.max(
      this.results.summary.maxResponseTime, 
      testResult.maxResponseTime
    );
  }

  calculateFinalSummary() {
    const { summary } = this.results;
    
    if (summary.totalRequests > 0) {
      summary.averageResponseTime = Math.round(
        this.results.tests.reduce((sum, test) => 
          sum + (test.averageResponseTime * test.totalRequests), 0
        ) / summary.totalRequests
      );
      
      summary.throughput = Math.round(
        this.results.tests.reduce((sum, test) => sum + test.throughput, 0) / this.results.tests.length
      );
    }
  }

  showFinalReport() {
    this.calculateFinalSummary();
    
    console.log('\n' + '═'.repeat(80));
    console.log('📊 REPORTE FINAL DE PERFORMANCE');
    console.log('═'.repeat(80));
    
    const { summary } = this.results;
    
    console.log(`\n📈 RESUMEN GLOBAL:`);
    console.log(`   Total de requests: ${summary.totalRequests}`);
    console.log(`   Exitosos: ${summary.successfulRequests} (${(summary.successfulRequests/summary.totalRequests*100).toFixed(2)}%)`);
    console.log(`   Fallidos: ${summary.failedRequests} (${(summary.failedRequests/summary.totalRequests*100).toFixed(2)}%)`);
    console.log(`   Tiempo promedio: ${summary.averageResponseTime}ms`);
    console.log(`   Rango: ${summary.minResponseTime}ms - ${summary.maxResponseTime}ms`);
    console.log(`   Throughput promedio: ${summary.throughput} req/seg`);
    
    console.log(`\n🔍 DETALLE POR TEST:`);
    this.results.tests.forEach(test => {
      console.log(`   ${test.testName}:`);
      console.log(`     Tasa de éxito: ${test.successRate}%`);
      console.log(`     Tiempo promedio: ${test.averageResponseTime}ms`);
      console.log(`     Throughput: ${test.throughput} req/seg`);
    });
    
    console.log(`\n💡 RECOMENDACIONES:`);
    
    if (summary.averageResponseTime > 1000) {
      console.log(`   ⚠️  Tiempo de respuesta alto (${summary.averageResponseTime}ms). Considerar optimización.`);
    } else if (summary.averageResponseTime < 200) {
      console.log(`   ✅ Excelente tiempo de respuesta (${summary.averageResponseTime}ms).`);
    } else {
      console.log(`   ✅ Buen tiempo de respuesta (${summary.averageResponseTime}ms).`);
    }
    
    if (summary.failedRequests / summary.totalRequests > 0.05) {
      console.log(`   ⚠️  Alta tasa de errores (${(summary.failedRequests/summary.totalRequests*100).toFixed(2)}%). Revisar logs.`);
    } else {
      console.log(`   ✅ Baja tasa de errores (${(summary.failedRequests/summary.totalRequests*100).toFixed(2)}%).`);
    }
    
    if (summary.throughput < 10) {
      console.log(`   ⚠️  Throughput bajo (${summary.throughput} req/seg). Considerar escalado.`);
    } else {
      console.log(`   ✅ Buen throughput (${summary.throughput} req/seg).`);
    }
  }
}

// =====================================================
// FUNCIÓN PRINCIPAL PARA TESTS DE STRESS
// =====================================================

const runStressTests = async () => {
  if (!isMainThread) return; // Solo ejecutar en el hilo principal
  
  console.log('\n⚡ INICIANDO TESTS DE STRESS Y PERFORMANCE');
  console.log(`📅 ${new Date().toLocaleString()}`);
  
  const testSuite = new PerformanceTestSuite();
  
  // Obtener tokens de autenticación
  let adminToken, userToken;
  
  try {
    console.log('\n🔑 Obteniendo tokens de autenticación...');
    
    // Login admin
    const adminLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      phoneOrEmail: 'admin@iasport.pe',
      password: 'admin123'
    });
    adminToken = adminLogin.data.token;
    console.log('   ✅ Token admin obtenido');
    
    // Login usuario
    const userLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      phoneOrEmail: 'premium@test.com',
      password: 'test123'
    });
    userToken = userLogin.data.token;
    console.log('   ✅ Token usuario obtenido');
    
  } catch (error) {
    console.log('   ❌ Error obteniendo tokens:', error.message);
    console.log('   💡 Asegúrate de ejecutar primero: node createTestUsers.js');
    return;
  }
  
  // =====================================================
  // TESTS DE STRESS ESPECÍFICOS
  // =====================================================
  
  console.log('\n🚀 Ejecutando tests de stress...');
  
  // Test 1: Predicciones (sin autenticación) - Carga ligera
  await testSuite.runStressTest(
    'Predicciones - Carga Ligera',
    'predictions',
    {
      workers: 5,
      requestsPerWorker: 10,
      delayBetweenRequests: 100
    }
  );
  
  // Test 2: Predicciones - Carga pesada
  await testSuite.runStressTest(
    'Predicciones - Carga Pesada',
    'predictions',
    {
      workers: 10,
      requestsPerWorker: 20,
      delayBetweenRequests: 50
    }
  );
  
  // Test 3: Torneos (con autenticación)
  await testSuite.runStressTest(
    'Torneos - Usuarios Autenticados',
    'tournaments',
    {
      workers: 8,
      requestsPerWorker: 15,
      delayBetweenRequests: 75
    },
    userToken
  );
  
  // Test 4: Wallet (con autenticación)
  await testSuite.runStressTest(
    'Wallet - Consultas de Balance',
    'wallet',
    {
      workers: 6,
      requestsPerWorker: 12,
      delayBetweenRequests: 100
    },
    userToken
  );
  
  // Test 5: Admin Stats (con autenticación admin)
  await testSuite.runStressTest(
    'Admin Stats - Dashboard',
    'admin_stats',
    {
      workers: 3,
      requestsPerWorker: 8,
      delayBetweenRequests: 200
    },
    adminToken
  );
  
  // Test 6: Stress extremo en predicciones
  await testSuite.runStressTest(
    'Predicciones - Stress Extremo',
    'predictions',
    {
      workers: 15,
      requestsPerWorker: 25,
      delayBetweenRequests: 25
    }
  );
  
  // Mostrar reporte final
  testSuite.showFinalReport();
  
  console.log('\n🏁 Tests de stress completados!');
  
  return testSuite.results;
};

// =====================================================
// TESTS DE MEMORIA Y RECURSOS
// =====================================================

const monitorResources = () => {
  const used = process.memoryUsage();
  return {
    rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(used.external / 1024 / 1024 * 100) / 100
  };
};

const runResourceMonitoring = async () => {
  console.log('\n💾 MONITOREANDO RECURSOS DEL SISTEMA');
  
  const initialMemory = monitorResources();
  console.log(`Memoria inicial: RSS ${initialMemory.rss}MB, Heap ${initialMemory.heapUsed}/${initialMemory.heapTotal}MB`);
  
  // Simular carga
  const promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(axios.get(`${BASE_URL}/api/predictions`).catch(() => {}));
  }
  
  await Promise.all(promises);
  
  const finalMemory = monitorResources();
  console.log(`Memoria final: RSS ${finalMemory.rss}MB, Heap ${finalMemory.heapUsed}/${finalMemory.heapTotal}MB`);
  
  const memoryIncrease = finalMemory.rss - initialMemory.rss;
  console.log(`Incremento de memoria: ${memoryIncrease}MB`);
  
  if (memoryIncrease > 50) {
    console.log('⚠️  Posible memory leak detectado');
  } else {
    console.log('✅ Uso de memoria estable');
  }
};

// Ejecutar si es llamado directamente
if (require.main === module && isMainThread) {
  const runAllTests = async () => {
    await runStressTests();
    await runResourceMonitoring();
  };
  
  runAllTests().catch(console.error);
}

module.exports = {
  runStressTests,
  runResourceMonitoring,
  PerformanceTestSuite
};