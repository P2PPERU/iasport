// master-test-runner.js - EJECUTOR PRINCIPAL DE TODOS LOS TESTS
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

// Importar suites de tests
const { runComprehensiveTests } = require('./comprehensive-test-suite');
const { runStressTests, runResourceMonitoring } = require('./stress-performance-tests');
const { runSecurityTests } = require('./security-validation-tests');
const { createTestUsers, createTestData } = require('./createTestUsers');

class MasterTestRunner {
  constructor() {
    this.startTime = this.getTimestamp();
    this.results = {
      setup: null,
      comprehensive: null,
      security: null,
      performance: null,
      resources: null,
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        duration: 0,
        overallScore: 0
      }
    };
    this.config = {
      runSetup: true,
      runComprehensive: true,
      runSecurity: true,
      runPerformance: true,
      runResources: true,
      generateReport: true,
      cleanupAfter: false
    };
  }

  // Función auxiliar para obtener timestamp compatible
  getTimestamp() {
    try {
      return performance && performance.now ? performance.now() : Date.now();
    } catch (error) {
      return Date.now();
    }
  }

  // Configurar opciones de ejecución
  configure(options = {}) {
    this.config = { ...this.config, ...options };
    return this;
  }

  // Mostrar banner inicial
  showBanner() {
    const banner = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           🚀 PREDICTMASTER - MASTER TEST SUITE 🚀           ║
║                                                              ║
║                Suite Completa de Testing                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `;
    
    console.log(banner);
    console.log(`📅 Fecha: ${new Date().toLocaleString()}`);
    console.log(`🎯 Configuración: ${JSON.stringify(this.config, null, 2)}`);
    console.log('\n' + '═'.repeat(70));
  }

  // Paso 1: Setup y preparación
  async runSetup() {
    if (!this.config.runSetup) return { skipped: true };

    console.log('\n🔧 PASO 1: SETUP Y PREPARACIÓN');
    console.log('═'.repeat(50));
    
    const setupStart = this.getTimestamp();
    
    try {
      console.log('📋 Creando usuarios de prueba...');
      await createTestUsers();
      
      console.log('📊 Creando datos de prueba...');
      await createTestData();
      
      const setupDuration = Math.round(this.getTimestamp() - setupStart);
      
      this.results.setup = {
        success: true,
        duration: setupDuration,
        message: 'Setup completado exitosamente'
      };
      
      console.log(`✅ Setup completado en ${setupDuration}ms`);
      return this.results.setup;
      
    } catch (error) {
      const setupDuration = Math.round(this.getTimestamp() - setupStart);
      
      this.results.setup = {
        success: false,
        duration: setupDuration,
        error: error.message
      };
      
      console.log(`❌ Error en setup: ${error.message}`);
      return this.results.setup;
    }
  }

  // Paso 2: Tests comprehensivos
  async runComprehensiveTests() {
    if (!this.config.runComprehensive) return { skipped: true };

    console.log('\n🔍 PASO 2: TESTS COMPREHENSIVOS');
    console.log('═'.repeat(50));
    
    try {
      const result = await runComprehensiveTests();
      this.results.comprehensive = result;
      return result;
    } catch (error) {
      this.results.comprehensive = {
        total: 0,
        passed: 0,
        failed: 1,
        error: error.message
      };
      return this.results.comprehensive;
    }
  }

  // Paso 3: Tests de seguridad
  async runSecurityTests() {
    if (!this.config.runSecurity) return { skipped: true };

    console.log('\n🔒 PASO 3: TESTS DE SEGURIDAD');
    console.log('═'.repeat(50));
    
    try {
      const result = await runSecurityTests();
      this.results.security = result;
      return result;
    } catch (error) {
      this.results.security = {
        total: 0,
        passed: 0,
        failed: 1,
        critical: 1,
        error: error.message
      };
      return this.results.security;
    }
  }

  // Paso 4: Tests de performance
  async runPerformanceTests() {
    if (!this.config.runPerformance) return { skipped: true };

    console.log('\n⚡ PASO 4: TESTS DE PERFORMANCE');
    console.log('═'.repeat(50));
    
    try {
      const result = await runStressTests();
      this.results.performance = result;
      return result;
    } catch (error) {
      this.results.performance = {
        tests: [],
        summary: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 1
        },
        error: error.message
      };
      return this.results.performance;
    }
  }

  // Paso 5: Monitoreo de recursos
  async runResourceTests() {
    if (!this.config.runResources) return { skipped: true };

    console.log('\n💾 PASO 5: MONITOREO DE RECURSOS');
    console.log('═'.repeat(50));
    
    try {
      await runResourceMonitoring();
      this.results.resources = { success: true };
      return this.results.resources;
    } catch (error) {
      this.results.resources = {
        success: false,
        error: error.message
      };
      return this.results.resources;
    }
  }

  // Calcular resumen final
  calculateSummary() {
    const { comprehensive, security, performance } = this.results;
    
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    
    // Tests comprehensivos
    if (comprehensive && !comprehensive.skipped) {
      totalTests += comprehensive.total || 0;
      passedTests += comprehensive.passed || 0;
      failedTests += comprehensive.failed || 0;
    }
    
    // Tests de seguridad
    if (security && !security.skipped) {
      totalTests += security.total || 0;
      passedTests += security.passed || 0;
      failedTests += security.failed || 0;
    }
    
    // Tests de performance (considerar como pasados si hay menos de 5% errores)
    if (performance && !performance.skipped) {
      const perfTotal = performance.summary?.totalRequests || 0;
      const perfFailed = performance.summary?.failedRequests || 0;
      
      if (perfTotal > 0) {
        totalTests += 1; // Considerar como 1 test
        if (perfFailed / perfTotal < 0.05) {
          passedTests += 1;
        } else {
          failedTests += 1;
        }
      }
    }
    
    const duration = Math.round(this.getTimestamp() - this.startTime);
    const overallScore = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    this.results.summary = {
      totalTests,
      passedTests,
      failedTests,
      duration,
      overallScore
    };
  }

  // Generar reporte detallado
  async generateDetailedReport() {
    if (!this.config.generateReport) return;

    const reportData = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        memory: process.memoryUsage()
      },
      configuration: this.config,
      results: this.results,
      recommendations: this.generateRecommendations()
    };
    
    const reportPath = path.join(__dirname, `test-report-${Date.now()}.json`);
    
    try {
      await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`📄 Reporte detallado guardado en: ${reportPath}`);
    } catch (error) {
      console.log(`❌ Error guardando reporte: ${error.message}`);
    }
  }

  // Generar recomendaciones basadas en resultados
  generateRecommendations() {
    const recommendations = [];
    const { comprehensive, security, performance } = this.results;
    
    // Recomendaciones basadas en tests comprehensivos
    if (comprehensive && comprehensive.failed > 0) {
      recommendations.push({
        type: 'functionality',
        priority: 'high',
        message: `${comprehensive.failed} tests funcionales fallaron. Revisar logs para detalles específicos.`
      });
    }
    
    // Recomendaciones basadas en seguridad
    if (security && security.critical > 0) {
      recommendations.push({
        type: 'security',
        priority: 'critical',
        message: `${security.critical} vulnerabilidades críticas encontradas. ACCIÓN INMEDIATA REQUERIDA.`
      });
    }
    
    if (security && security.failed > security.critical) {
      recommendations.push({
        type: 'security',
        priority: 'medium',
        message: `${security.failed - security.critical} problemas de seguridad menores encontrados.`
      });
    }
    
    // Recomendaciones basadas en performance
    if (performance && performance.summary) {
      const errorRate = performance.summary.failedRequests / performance.summary.totalRequests;
      const avgResponseTime = performance.summary.averageResponseTime;
      
      if (errorRate > 0.05) {
        recommendations.push({
          type: 'performance',
          priority: 'high',
          message: `Alta tasa de errores: ${(errorRate * 100).toFixed(2)}%. Revisar estabilidad del sistema.`
        });
      }
      
      if (avgResponseTime > 1000) {
        recommendations.push({
          type: 'performance',
          priority: 'medium',
          message: `Tiempo de respuesta alto: ${avgResponseTime}ms. Considerar optimización.`
        });
      }
    }
    
    // Recomendaciones generales
    const { overallScore } = this.results.summary;
    
    if (overallScore >= 95) {
      recommendations.push({
        type: 'general',
        priority: 'info',
        message: 'Excelente! El sistema pasa casi todos los tests. Mantener buenas prácticas.'
      });
    } else if (overallScore >= 80) {
      recommendations.push({
        type: 'general',
        priority: 'low',
        message: 'Buen estado general. Revisar tests fallidos para mejoras menores.'
      });
    } else if (overallScore >= 60) {
      recommendations.push({
        type: 'general',
        priority: 'medium',
        message: 'Estado aceptable pero con margen de mejora significativo.'
      });
    } else {
      recommendations.push({
        type: 'general',
        priority: 'high',
        message: 'Múltiples problemas detectados. Revisión completa del sistema recomendada.'
      });
    }
    
    return recommendations;
  }

  // Mostrar reporte final
  showFinalReport() {
    this.calculateSummary();
    
    console.log('\n' + '═'.repeat(70));
    console.log('📊 REPORTE FINAL - MASTER TEST SUITE');
    console.log('═'.repeat(70));
    
    const { summary } = this.results;
    
    // Resumen ejecutivo
    console.log('\n🎯 RESUMEN EJECUTIVO:');
    console.log(`   Total de tests ejecutados: ${summary.totalTests}`);
    console.log(`   ✅ Tests pasados: ${summary.passedTests}`);
    console.log(`   ❌ Tests fallidos: ${summary.failedTests}`);
    console.log(`   📈 Score general: ${summary.overallScore}%`);
    console.log(`   ⏱️  Duración total: ${summary.duration}ms`);
    
    // Estado por categoría
    console.log('\n📋 ESTADO POR CATEGORÍA:');
    
    if (this.results.setup) {
      const icon = this.results.setup.success ? '✅' : '❌';
      console.log(`   ${icon} Setup: ${this.results.setup.success ? 'Exitoso' : 'Falló'}`);
    }
    
    if (this.results.comprehensive && !this.results.comprehensive.skipped) {
      const rate = ((this.results.comprehensive.passed / this.results.comprehensive.total) * 100).toFixed(1);
      console.log(`   📋 Funcionalidad: ${rate}% (${this.results.comprehensive.passed}/${this.results.comprehensive.total})`);
    }
    
    if (this.results.security && !this.results.security.skipped) {
      const rate = ((this.results.security.passed / this.results.security.total) * 100).toFixed(1);
      const critical = this.results.security.critical || 0;
      console.log(`   🔒 Seguridad: ${rate}% (${critical} críticos)`);
    }
    
    if (this.results.performance && !this.results.performance.skipped) {
      const perf = this.results.performance.summary;
      const rate = perf.totalRequests > 0 ? ((perf.successfulRequests / perf.totalRequests) * 100).toFixed(1) : 0;
      console.log(`   ⚡ Performance: ${rate}% (${perf.successfulRequests}/${perf.totalRequests} requests)`);
    }
    
    // Recomendaciones
    const recommendations = this.generateRecommendations();
    
    if (recommendations.length > 0) {
      console.log('\n💡 RECOMENDACIONES:');
      
      const critical = recommendations.filter(r => r.priority === 'critical');
      const high = recommendations.filter(r => r.priority === 'high');
      const medium = recommendations.filter(r => r.priority === 'medium');
      const low = recommendations.filter(r => r.priority === 'low');
      
      critical.forEach(r => console.log(`   🚨 CRÍTICO: ${r.message}`));
      high.forEach(r => console.log(`   ⚠️  ALTO: ${r.message}`));
      medium.forEach(r => console.log(`   📋 MEDIO: ${r.message}`));
      low.forEach(r => console.log(`   💡 BAJO: ${r.message}`));
    }
    
    // Próximos pasos
    console.log('\n🚀 PRÓXIMOS PASOS:');
    console.log('   1. Revisar tests fallidos en detalle');
    console.log('   2. Corregir vulnerabilidades críticas primero');
    console.log('   3. Optimizar performance según necesidad');
    console.log('   4. Implementar tests automatizados en CI/CD');
    console.log('   5. Configurar monitoreo continuo');
    
    // Status final
    console.log('\n' + '═'.repeat(70));
    
    if (summary.overallScore >= 90) {
      console.log('🎉 ¡EXCELENTE! El sistema está en muy buen estado.');
    } else if (summary.overallScore >= 75) {
      console.log('✅ BUENO. El sistema funciona bien con mejoras menores.');
    } else if (summary.overallScore >= 60) {
      console.log('⚠️  ACEPTABLE. Se requieren mejoras importantes.');
    } else {
      console.log('🚨 CRÍTICO. El sistema requiere atención inmediata.');
    }
    
    console.log('═'.repeat(70));
  }

  // Ejecutar toda la suite
  async runAll() {
    this.showBanner();
    
    try {
      // Ejecutar todas las fases
      await this.runSetup();
      await this.runComprehensiveTests();
      await this.runSecurityTests();
      await this.runPerformanceTests();
      await this.runResourceTests();
      
      // Generar reportes
      this.showFinalReport();
      await this.generateDetailedReport();
      
      return this.results;
      
    } catch (error) {
      console.error('\n❌ Error crítico en la ejecución de tests:', error);
      return null;
    }
  }
}

// =====================================================
// FUNCIÓN PRINCIPAL
// =====================================================

const runMasterTestSuite = async (options = {}) => {
  const runner = new MasterTestRunner();
  runner.configure(options);
  return await runner.runAll();
};

// Ejecutar si es llamado directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  // Configuración basada en argumentos
  const config = {
    runSetup: !args.includes('--no-setup'),
    runComprehensive: !args.includes('--no-comprehensive'),
    runSecurity: !args.includes('--no-security'),
    runPerformance: !args.includes('--no-performance'),
    runResources: !args.includes('--no-resources'),
    generateReport: !args.includes('--no-report'),
    cleanupAfter: args.includes('--cleanup')
  };
  
  console.log('🚀 Iniciando Master Test Suite...');
  
  runMasterTestSuite(config)
    .then(results => {
      if (results) {
        process.exit(results.summary.failedTests > 0 ? 1 : 0);
      } else {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Error fatal:', error);
      process.exit(1);
    });
}

module.exports = {
  runMasterTestSuite,
  MasterTestRunner
};