// master-test-runner.js - Ejecutor principal de todos los tests
const { logSection, wait } = require('./test-config');

// Importar todos los tests
const { testPredictionsSystem } = require('./test-predictions');
const { testPaidTournamentFlow } = require('./test-tournaments-paid');
const { testWithdrawalFlow } = require('./test-withdrawals');
const { testNotificationSystem } = require('./test-notifications');
const { testDashboardsAndStats } = require('./test-dashboards');

async function runAllTests() {
  console.log('\n🚀 INICIANDO SUITE COMPLETA DE TESTS PARA IA SPORT & PREDICTMASTER API');
  console.log('📅 Fecha:', new Date().toLocaleString());
  console.log('🔗 URL Base: http://localhost:3001');
  console.log('\n' + '='.repeat(80));

  const startTime = Date.now();
  let completedTests = 0;
  let failedTests = 0;

  try {
    // Test 1: Sistema de Predicciones
    logSection('TEST 1/5: SISTEMA DE PREDICCIONES');
    console.log('🎯 Probando predicciones gratuitas, premium, hot y resultados...');
    try {
      await testPredictionsSystem();
      completedTests++;
      console.log('✅ Test 1 COMPLETADO');
    } catch (error) {
      console.error('❌ Test 1 FALLÓ:', error.message);
      failedTests++;
    }

    await wait(3000);

    // Test 2: Flujo de Torneo Pagado
    logSection('TEST 2/5: FLUJO COMPLETO DE TORNEO PAGADO');
    console.log('🏆 Probando inscripción, predicciones, resultados y premios...');
    try {
      await testPaidTournamentFlow();
      completedTests++;
      console.log('✅ Test 2 COMPLETADO');
    } catch (error) {
      console.error('❌ Test 2 FALLÓ:', error.message);
      failedTests++;
    }

    await wait(3000);

    // Test 3: Sistema de Retiros
    logSection('TEST 3/5: SISTEMA DE RETIROS');
    console.log('💰 Probando solicitudes, procesamiento y completado de retiros...');
    try {
      await testWithdrawalFlow();
      completedTests++;
      console.log('✅ Test 3 COMPLETADO');
    } catch (error) {
      console.error('❌ Test 3 FALLÓ:', error.message);
      failedTests++;
    }

    await wait(3000);

    // Test 4: Sistema de Notificaciones
    logSection('TEST 4/5: SISTEMA DE NOTIFICACIONES');
    console.log('🔔 Probando suscripciones, envío y gestión de notificaciones...');
    try {
      await testNotificationSystem();
      completedTests++;
      console.log('✅ Test 4 COMPLETADO');
    } catch (error) {
      console.error('❌ Test 4 FALLÓ:', error.message);
      failedTests++;
    }

    await wait(3000);

    // Test 5: Dashboards y Estadísticas
    logSection('TEST 5/5: DASHBOARDS Y ESTADÍSTICAS');
    console.log('📊 Probando dashboards, reportes y estadísticas...');
    try {
      await testDashboardsAndStats();
      completedTests++;
      console.log('✅ Test 5 COMPLETADO');
    } catch (error) {
      console.error('❌ Test 5 FALLÓ:', error.message);
      failedTests++;
    }

  } catch (error) {
    console.error('❌ Error general en la suite de tests:', error);
  }

  // Resumen final
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);

  console.log('\n' + '='.repeat(80));
  logSection('RESUMEN FINAL DE TESTS');
  console.log(`⏱️  Tiempo total: ${duration} segundos`);
  console.log(`✅ Tests completados: ${completedTests}/5`);
  console.log(`❌ Tests fallidos: ${failedTests}/5`);
  console.log(`📊 Tasa de éxito: ${Math.round((completedTests / 5) * 100)}%`);

  if (failedTests === 0) {
    console.log('\n🎉 ¡TODOS LOS TESTS COMPLETADOS EXITOSAMENTE!');
    console.log('🚀 Tu API está funcionando correctamente en todas las áreas críticas.');
  } else {
    console.log('\n⚠️  Algunos tests fallaron. Revisa los logs para más detalles.');
  }

  console.log('\n📋 FUNCIONALIDADES PROBADAS:');
  console.log('   ✓ Sistema de autenticación (admin/usuario)');
  console.log('   ✓ Gestión de predicciones (crear, ver, desbloquear, resultados)');
  console.log('   ✓ Sistema de torneos completo (crear, inscribir, participar, premios)');
  console.log('   ✓ Wallet integrado (depósitos, retiros, transacciones)');
  console.log('   ✓ Notificaciones push (suscripciones, envío, gestión)');
  console.log('   ✓ Dashboards administrativos (estadísticas, reportes)');
  console.log('   ✓ Flujos de usuario (perfil, historial, rankings)');

  console.log('\n🔧 PRÓXIMOS PASOS RECOMENDADOS:');
  if (failedTests === 0) {
    console.log('   • Implementar tests automatizados en CI/CD');
    console.log('   • Configurar monitoreo de producción');
    console.log('   • Documentar APIs para frontend');
    console.log('   • Optimizar rendimiento para carga alta');
  } else {
    console.log('   • Revisar y corregir los tests fallidos');
    console.log('   • Verificar configuración de base de datos');
    console.log('   • Comprobar variables de entorno');
    console.log('   • Re-ejecutar tests individuales para debugging');
  }

  console.log('\n📚 Para ejecutar tests individuales:');
  console.log('   node test-predictions.js');
  console.log('   node test-tournaments-paid.js');
  console.log('   node test-withdrawals.js');
  console.log('   node test-notifications.js');
  console.log('   node test-dashboards.js');

  console.log('\n' + '='.repeat(80));
}

// Ejecutar todos los tests
if (require.main === module) {
  runAllTests().then(() => {
    console.log('\n👋 Tests finalizados. Presiona Ctrl+C para salir.');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };