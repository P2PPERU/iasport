// test-predictions.js - Test del sistema de predicciones principal
const { apiRequest, getAuthHeaders, logSection, logSubsection, wait } = require('./test-config');

let predictionId = null;

async function testPredictionsSystem() {
  logSection('SISTEMA DE PREDICCIONES - TEST COMPLETO');

  try {
    // 1. ADMIN: Crear predicción gratuita
    logSubsection('1. Crear Predicción Gratuita');
    const freePrediction = await apiRequest('/api/admin/predictions', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        league: 'Premier League',
        match: 'Manchester United vs Liverpool',
        homeTeam: 'Manchester United',
        awayTeam: 'Liverpool', 
        prediction: 'Over 2.5 goles',
        confidence: 75,
        odds: 1.85,
        matchTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 horas en el futuro
        isHot: false,
        isPremium: false,
        sport: 'football',
        predictionType: 'OVER_UNDER',
        aiAnalysis: {
          factors: ['Alta media de goles', 'Equipos ofensivos'],
          confidence: 75
        }
      })
    });

    if (freePrediction.success) {
      predictionId = freePrediction.data.data.id;
      console.log('✅ Predicción gratuita creada:', predictionId);
    }

    await wait(1000);

    // 2. ADMIN: Crear predicción premium HOT
    logSubsection('2. Crear Predicción Premium HOT');
    const hotPrediction = await apiRequest('/api/admin/predictions', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        league: 'Champions League',
        match: 'Real Madrid vs Barcelona',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        prediction: 'Real Madrid gana',
        confidence: 92,
        odds: 2.10,
        matchTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        isHot: true,
        isPremium: true,
        sport: 'football',
        predictionType: '1X2'
      })
    });

    let hotPredictionId = null;
    if (hotPrediction.success) {
      hotPredictionId = hotPrediction.data.data.id;
      console.log('✅ Predicción hot premium creada:', hotPredictionId);
    }

    await wait(1000);

    // 3. USUARIO: Obtener predicciones del día (sin auth)
    logSubsection('3. Obtener Predicciones del Día (Público)');
    await apiRequest('/api/predictions');

    await wait(1000);

    // 4. USUARIO: Obtener predicciones del día (autenticado)
    logSubsection('4. Obtener Predicciones del Día (Usuario Autenticado)');
    await apiRequest('/api/predictions', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 5. USUARIO: Ver predicción específica
    if (predictionId) {
      logSubsection('5. Ver Predicción Específica');
      await apiRequest(`/api/predictions/${predictionId}`, {
        headers: getAuthHeaders(false)
      });
    }

    await wait(1000);

    // 6. USUARIO: Intentar desbloquear predicción premium (usuario no premium)
    if (hotPredictionId) {
      logSubsection('6. Intentar Desbloquear Predicción Premium (Usuario No Premium)');
      await apiRequest(`/api/predictions/${hotPredictionId}/unlock`, {
        method: 'POST',
        headers: getAuthHeaders(false)
      });
    }

    await wait(1000);

    // 7. ADMIN: Hacer usuario premium
    logSubsection('7. Hacer Usuario Premium');
    await apiRequest('/api/admin/users/d3962b07-2e25-48d6-8814-1a3e2aadedfe/premium', {
      method: 'PUT',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        isPremium: true,
        days: 30
      })
    });

    await wait(1000);

    // 8. USUARIO PREMIUM: Obtener predicciones (debería ver contenido premium)
    logSubsection('8. Usuario Premium - Ver Predicciones');
    await apiRequest('/api/predictions', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 9. ADMIN: Actualizar resultado de predicción
    if (predictionId) {
      logSubsection('9. Actualizar Resultado de Predicción');
      await apiRequest(`/api/admin/predictions/${predictionId}/result`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          result: 'WON'
        })
      });
    }

    await wait(1000);

    // 10. ADMIN: Listar todas las predicciones
    logSubsection('10. Admin - Listar Todas las Predicciones');
    await apiRequest('/api/admin/predictions', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 11. ADMIN: Obtener predicciones pendientes de resultado
    logSubsection('11. Admin - Predicciones Pendientes de Resultado');
    await apiRequest('/api/prediction-results/pending', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 12. ADMIN: Estadísticas de resultados
    logSubsection('12. Admin - Estadísticas de Resultados');
    await apiRequest('/api/prediction-results/stats', {
      headers: getAuthHeaders(true)
    });

    console.log('\n✅ Test del sistema de predicciones completado');

  } catch (error) {
    console.error('❌ Error en test de predicciones:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testPredictionsSystem();
}

module.exports = { testPredictionsSystem };