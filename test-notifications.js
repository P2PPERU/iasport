// test-notifications.js - Test del sistema de notificaciones
const { apiRequest, getAuthHeaders, logSection, logSubsection, wait } = require('./test-config');

async function testNotificationSystem() {
  logSection('SISTEMA DE NOTIFICACIONES PUSH');

  try {
    // 1. PÚBLICO: Obtener clave VAPID pública
    logSubsection('1. Obtener Clave VAPID Pública');
    const vapidKey = await apiRequest('/api/notifications/vapid-public-key');
    
    let publicKey = null;
    if (vapidKey.success) {
      publicKey = vapidKey.data.publicKey;
      console.log('✅ Clave VAPID obtenida:', publicKey ? 'Sí' : 'No');
    }

    await wait(1000);

    // 2. USUARIO: Simular suscripción push (datos ficticios para test)
    logSubsection('2. Usuario - Simular Suscripción Push');
    const mockSubscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-123',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8YiKkAXR7P9sBk5V5wELEQzONmUFM',
        auth: 'tBHItJI5svbpez7KI4CCXg'
      }
    };

    await apiRequest('/api/notifications/subscribe', {
      method: 'POST',
      headers: getAuthHeaders(false),
      body: JSON.stringify({
        subscription: mockSubscription,
        deviceType: 'web'
      })
    });

    await wait(1000);

    // 3. USUARIO: Enviar notificación de prueba
    logSubsection('3. Usuario - Enviar Notificación de Prueba');
    await apiRequest('/api/notifications/test', {
      method: 'POST',
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 4. ADMIN: Ver estadísticas de notificaciones
    logSubsection('4. Admin - Estadísticas de Notificaciones');
    await apiRequest('/api/admin/notifications/stats', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 5. ADMIN: Crear predicción HOT (debería disparar notificaciones)
    logSubsection('5. Admin - Crear Predicción HOT (Trigger Notificación)');
    const hotPrediction = await apiRequest('/api/admin/predictions', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        league: 'Liga de Campeones',
        match: 'Bayern Munich vs PSG',
        homeTeam: 'Bayern Munich',
        awayTeam: 'PSG',
        prediction: 'Bayern Munich gana',
        confidence: 95,
        odds: 2.20,
        matchTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        isHot: true,
        isPremium: true,
        sport: 'football',
        predictionType: '1X2'
      })
    });

    let hotPredictionId = null;
    if (hotPrediction.success) {
      hotPredictionId = hotPrediction.data.data.id;
      console.log('✅ Predicción hot creada (debería disparar notificación):', hotPredictionId);
    }

    await wait(2000); // Dar tiempo para procesar notificaciones

    // 6. ADMIN: Enviar notificación manual de predicción hot
    if (hotPredictionId) {
      logSubsection('6. Admin - Enviar Notificación Manual de Predicción Hot');
      await apiRequest(`/api/notifications/hot-prediction/${hotPredictionId}`, {
        method: 'POST',
        headers: getAuthHeaders(true)
      });
    }

    await wait(1000);

    // 7. ADMIN: Actualizar resultado de predicción (debería disparar notificación)
    if (hotPredictionId) {
      logSubsection('7. Admin - Actualizar Resultado (Trigger Notificación)');
      await apiRequest(`/api/admin/predictions/${hotPredictionId}/result`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          result: 'WON'
        })
      });
    }

    await wait(2000);

    // 8. ADMIN: Enviar notificación manual de resultado
    if (hotPredictionId) {
      logSubsection('8. Admin - Enviar Notificación Manual de Resultado');
      await apiRequest(`/api/notifications/prediction-result/${hotPredictionId}`, {
        method: 'POST',
        headers: getAuthHeaders(true)
      });
    }

    await wait(1000);

    // 9. ADMIN: Enviar notificación personalizada
    logSubsection('9. Admin - Enviar Notificación Personalizada');
    await apiRequest('/api/admin/notifications/custom', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        userIds: ['d3962b07-2e25-48d6-8814-1a3e2aadedfe'],
        title: '🎉 ¡Nueva Funcionalidad!',
        body: 'Ahora puedes retirar tus ganancias directamente desde la app',
        url: '/wallet'
      })
    });

    await wait(1000);

    // 10. ADMIN: Enviar notificación masiva a todos
    logSubsection('10. Admin - Notificación Masiva');
    await apiRequest('/api/admin/notifications/custom', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        sendToAll: true,
        title: '📢 Anuncio Importante',
        body: 'Nuevos torneos con premios incrementados disponibles',
        url: '/tournaments'
      })
    });

    await wait(1000);

    // 11. USUARIO: Ver historial de notificaciones
    logSubsection('11. Usuario - Ver Historial de Notificaciones');
    await apiRequest('/api/notifications/history', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 12. USUARIO: Marcar notificación como clickeada (simular)
    logSubsection('12. Usuario - Marcar Notificación como Clickeada');
    // En un flujo real, obtendríamos el ID del historial
    // Por ahora simulamos con un ID ficticio
    await apiRequest('/api/notifications/history/123e4567-e89b-12d3-a456-426614174000/clicked', {
      method: 'PUT',
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 13. ADMIN: Ver estadísticas actualizadas
    logSubsection('13. Admin - Estadísticas Actualizadas');
    await apiRequest('/api/admin/notifications/stats', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 14. USUARIO: Desuscribirse de notificaciones
    logSubsection('14. Usuario - Desuscribirse');
    await apiRequest('/api/notifications/unsubscribe', {
      method: 'POST',
      headers: getAuthHeaders(false),
      body: JSON.stringify({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-123'
      })
    });

    await wait(1000);

    // 15. ADMIN: Verificar cambio en estadísticas
    logSubsection('15. Admin - Verificar Estadísticas Después de Desuscripción');
    await apiRequest('/api/admin/notifications/stats', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 16. Test de notificaciones de premium por expirar
    logSubsection('16. Admin - Test Notificación Premium Expirando');
    
    // Primero, configurar fecha de expiración cercana para el usuario
    await apiRequest('/api/admin/users/d3962b07-2e25-48d6-8814-1a3e2aadedfe/premium', {
      method: 'PUT',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        isPremium: true,
        days: 2 // Expira en 2 días
      })
    });

    await wait(1000);

    // En un entorno real, esto sería manejado por un job automático
    // Aquí lo simulamos manualmente
    console.log('ℹ️ Nota: Las notificaciones de premium expirando se envían automáticamente por jobs programados');

    console.log('\n✅ Test del sistema de notificaciones completado');

  } catch (error) {
    console.error('❌ Error en test de notificaciones:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testNotificationSystem();
}

module.exports = { testNotificationSystem };