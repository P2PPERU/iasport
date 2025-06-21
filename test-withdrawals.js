// test-withdrawals.js - Test completo del flujo de retiros (CORREGIDO)
const { apiRequest, getAuthHeaders, logSection, logSubsection, wait } = require('./test-config');

let withdrawalRequestId = null;

async function testWithdrawalFlow() {
  logSection('FLUJO COMPLETO DE RETIROS');

  try {
    // 1. USUARIO: Ver balance inicial
    logSubsection('1. Usuario - Verificar Balance Inicial');
    const initialBalance = await apiRequest('/api/wallet/balance', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 2. ADMIN: Asegurar que usuario tenga saldo suficiente
    logSubsection('2. Admin - Asegurar Saldo Suficiente para Retiro');
    await apiRequest('/api/wallet/admin/adjustment', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        userId: 'd3962b07-2e25-48d6-8814-1a3e2aadedfe',
        amount: 150,
        type: 'CREDIT',
        reason: 'Saldo para pruebas de retiro'
      })
    });

    await wait(1000);

    // 3. USUARIO: Verificar saldo actualizado
    logSubsection('3. Usuario - Verificar Saldo Actualizado');
    await apiRequest('/api/wallet/balance', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 4. USUARIO: Ver métodos de pago disponibles
    logSubsection('4. Usuario - Ver Métodos de Pago');
    await apiRequest('/api/wallet/payment-methods', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 4.1. ADMIN: Cancelar solicitudes pendientes del usuario (LIMPIEZA)
    logSubsection('4.1. Admin - Cancelar Solicitudes Pendientes del Usuario');
    const pendingWithdrawals = await apiRequest('/api/wallet/admin/withdrawals?status=PENDING', {
      headers: getAuthHeaders(true)
    });

    if (pendingWithdrawals.success && pendingWithdrawals.data.data.length > 0) {
      for (const withdrawal of pendingWithdrawals.data.data) {
        if (withdrawal.userId === 'd3962b07-2e25-48d6-8814-1a3e2aadedfe') {
          console.log(`   ✅ Cancelando solicitud pendiente: ${withdrawal.id}`);
          await apiRequest(`/api/wallet/admin/withdrawals/${withdrawal.id}/reject`, {
            method: 'PUT',
            headers: getAuthHeaders(true),
            body: JSON.stringify({
              reason: 'Cancelado para test limpio'
            })
          });
          await wait(500);
        }
      }
      console.log('✅ Solicitudes pendientes limpiadas');
    } else {
      console.log('ℹ️ No hay solicitudes pendientes que limpiar');
    }

    await wait(1000);

    // 5. USUARIO: Crear solicitud de retiro
    logSubsection('5. Usuario - Crear Solicitud de Retiro');
    const withdrawalRequest = await apiRequest('/api/wallet/withdrawals', {
      method: 'POST',
      headers: getAuthHeaders(false),
      body: JSON.stringify({
        amount: 50,
        method: 'YAPE',
        accountNumber: '999888777',
        accountName: 'Juan Perez Test'
      })
    });

    if (withdrawalRequest.success) {
      withdrawalRequestId = withdrawalRequest.data.data.withdrawalRequest.id;
      console.log('✅ Solicitud de retiro creada:', withdrawalRequestId);
    }

    await wait(1000);

    // 6. USUARIO: Ver balance después de solicitud (fondos congelados)
    logSubsection('6. Usuario - Balance Después de Solicitud');
    await apiRequest('/api/wallet/balance', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 7. USUARIO: Ver historial de transacciones
    logSubsection('7. Usuario - Historial de Transacciones');
    await apiRequest('/api/wallet/transactions', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 8. USUARIO: Ver sus solicitudes de retiro
    logSubsection('8. Usuario - Ver Solicitudes de Retiro');
    await apiRequest('/api/wallet/withdrawals', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 9. USUARIO: Intentar crear otra solicitud (debería fallar)
    logSubsection('9. Usuario - Intentar Segunda Solicitud (Debería Fallar)');
    await apiRequest('/api/wallet/withdrawals', {
      method: 'POST',
      headers: getAuthHeaders(false),
      body: JSON.stringify({
        amount: 30,
        method: 'PLIN',
        accountNumber: '999777666',
        accountName: 'Juan Perez'
      })
    });

    await wait(1000);

    // 10. ADMIN: Ver dashboard de wallet
    logSubsection('10. Admin - Ver Dashboard de Wallet');
    await apiRequest('/api/wallet/admin/dashboard', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 11. ADMIN: Ver todas las solicitudes de retiro
    logSubsection('11. Admin - Ver Todas las Solicitudes de Retiro');
    await apiRequest('/api/wallet/admin/withdrawals', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 12. ADMIN: Procesar la solicitud de retiro
    if (withdrawalRequestId) {
      logSubsection('12. Admin - Procesar Solicitud de Retiro');
      await apiRequest(`/api/wallet/admin/withdrawals/${withdrawalRequestId}/process`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          adminNotes: 'Verificado y aprobado para procesamiento',
          externalTransactionId: 'YAPE_TEST_123456'
        })
      });
    }

    await wait(1000);

    // 13. ADMIN: Ver estado actualizado de la solicitud
    if (withdrawalRequestId) {
      logSubsection('13. Admin - Verificar Estado Actualizado');
      await apiRequest('/api/wallet/admin/withdrawals?status=PROCESSING', {
        headers: getAuthHeaders(true)
      });
    }

    await wait(1000);

    // 14. ADMIN: Completar el retiro
    if (withdrawalRequestId) {
      logSubsection('14. Admin - Completar Retiro');
      await apiRequest(`/api/wallet/admin/withdrawals/${withdrawalRequestId}/complete`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          externalTransactionId: 'YAPE_COMPLETED_789123'
        })
      });
    }

    await wait(1000);

    // 15. USUARIO: Ver balance final
    logSubsection('15. Usuario - Balance Final');
    await apiRequest('/api/wallet/balance', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 16. USUARIO: Ver historial actualizado
    logSubsection('16. Usuario - Historial Actualizado');
    await apiRequest('/api/wallet/transactions', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 17. USUARIO: Ver estado final de solicitudes
    logSubsection('17. Usuario - Estado Final de Solicitudes');
    await apiRequest('/api/wallet/withdrawals', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // FLUJO ALTERNATIVO: Test de cancelación de retiro
    logSubsection('FLUJO ALTERNATIVO - Test de Cancelación');

    // 18. USUARIO: Crear nueva solicitud para cancelar
    logSubsection('18. Usuario - Nueva Solicitud para Cancelar');
    const cancelRequest = await apiRequest('/api/wallet/withdrawals', {
      method: 'POST',
      headers: getAuthHeaders(false),
      body: JSON.stringify({
        amount: 25,
        method: 'PLIN',
        accountNumber: '888777666',
        accountName: 'Juan Perez Cancel Test'
      })
    });

    let cancelRequestId = null;
    if (cancelRequest.success) {
      cancelRequestId = cancelRequest.data.data.withdrawalRequest.id;
      console.log('✅ Solicitud para cancelar creada:', cancelRequestId);
    } else {
      console.log('⚠️ No se pudo crear segunda solicitud (esperado si el flujo principal falló)');
    }

    await wait(1000);

    // 19. ADMIN: Rechazar/cancelar la solicitud
    if (cancelRequestId) {
      logSubsection('19. Admin - Rechazar Solicitud');
      await apiRequest(`/api/wallet/admin/withdrawals/${cancelRequestId}/reject`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          reason: 'Solicitud rechazada para pruebas - fondos devueltos'
        })
      });
    } else {
      logSubsection('19. Admin - Rechazar Solicitud (SALTADO - No hay solicitud)');
      console.log('ℹ️ No hay solicitud de cancelación para rechazar');
    }

    await wait(1000);

    // 20. USUARIO: Verificar que fondos fueron devueltos
    logSubsection('20. Usuario - Verificar Fondos Devueltos');
    await apiRequest('/api/wallet/balance', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 21. USUARIO: Ver estadísticas de wallet
    logSubsection('21. Usuario - Estadísticas de Wallet');
    await apiRequest('/api/wallet/stats', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 22. LIMPIEZA FINAL: Asegurar que no queden solicitudes pendientes
    logSubsection('22. Admin - Limpieza Final');
    const finalPendingWithdrawals = await apiRequest('/api/wallet/admin/withdrawals?status=PENDING', {
      headers: getAuthHeaders(true)
    });

    if (finalPendingWithdrawals.success && finalPendingWithdrawals.data.data.length > 0) {
      for (const withdrawal of finalPendingWithdrawals.data.data) {
        if (withdrawal.userId === 'd3962b07-2e25-48d6-8814-1a3e2aadedfe') {
          console.log(`   🧹 Limpieza final: cancelando ${withdrawal.id}`);
          await apiRequest(`/api/wallet/admin/withdrawals/${withdrawal.id}/reject`, {
            method: 'PUT',
            headers: getAuthHeaders(true),
            body: JSON.stringify({
              reason: 'Limpieza automática post-test'
            })
          });
          await wait(500);
        }
      }
    }

    console.log('\n✅ Test de flujo completo de retiros completado');
    console.log('🧹 Limpieza finalizada - listo para siguientes tests');

  } catch (error) {
    console.error('❌ Error en test de retiros:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testWithdrawalFlow();
}

module.exports = { testWithdrawalFlow };