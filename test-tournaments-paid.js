// test-tournaments-paid.js - Test completo de flujo de torneo pagado
const { apiRequest, getAuthHeaders, logSection, logSubsection, wait } = require('./test-config');

let tournamentId = null;
let predictionIds = [];

async function testPaidTournamentFlow() {
  logSection('FLUJO COMPLETO DE TORNEO PAGADO');

  try {
    // 1. ADMIN: Crear torneo pagado
    logSubsection('1. Admin - Crear Torneo Pagado');
    const tournament = await apiRequest('/api/admin/tournaments', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        name: 'Torneo Premium Test',
        description: 'Torneo de prueba para flujo completo',
        type: 'DAILY_CLASSIC',
        buyIn: 25.00,
        maxPlayers: 10,
        predictionsCount: 3,
        startTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
        registrationDeadline: new Date(Date.now() + 25 * 60 * 1000).toISOString(), // 25 min
        payoutStructure: {
          "1": 50,
          "2": 30, 
          "3": 20
        },
        isHot: true,
        isFeatured: true
      })
    });

    if (tournament.success) {
      tournamentId = tournament.data.data.id;
      console.log('✅ Torneo creado:', tournamentId);
    }

    await wait(1000);

    // 2. USUARIO: Ver torneos disponibles
    logSubsection('2. Usuario - Ver Torneos Disponibles');
    await apiRequest('/api/tournaments', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 3. USUARIO: Ver detalles del torneo
    if (tournamentId) {
      logSubsection('3. Usuario - Ver Detalles del Torneo');
      await apiRequest(`/api/tournaments/${tournamentId}`, {
        headers: getAuthHeaders(false)
      });
    }

    await wait(1000);

    // 4. USUARIO: Intentar inscribirse sin saldo (debería fallar)
    if (tournamentId) {
      logSubsection('4. Usuario - Intentar Inscribirse Sin Saldo');
      await apiRequest(`/api/tournaments/${tournamentId}/join`, {
        method: 'POST',
        headers: getAuthHeaders(false)
      });
    }

    await wait(1000);

    // 5. ADMIN: Dar saldo al usuario
    logSubsection('5. Admin - Dar Saldo al Usuario');
    await apiRequest('/api/wallet/admin/adjustment', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        userId: 'd3962b07-2e25-48d6-8814-1a3e2aadedfe',
        amount: 100,
        type: 'CREDIT',
        reason: 'Saldo para pruebas de torneo'
      })
    });

    await wait(1000);

    // 6. USUARIO: Verificar balance
    logSubsection('6. Usuario - Verificar Balance');
    await apiRequest('/api/wallet/balance', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 7. USUARIO: Inscribirse al torneo (ahora con saldo)
    if (tournamentId) {
      logSubsection('7. Usuario - Inscribirse al Torneo');
      await apiRequest(`/api/tournaments/${tournamentId}/join`, {
        method: 'POST',
        headers: getAuthHeaders(false)
      });
    }

    await wait(1000);

    // 8. USUARIO: Ver balance después de inscripción
    logSubsection('8. Usuario - Verificar Balance Después de Inscripción');
    await apiRequest('/api/wallet/balance', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 9. ADMIN: Cambiar estado del torneo a ACTIVO
    if (tournamentId) {
      logSubsection('9. Admin - Activar Torneo');
      await apiRequest(`/api/admin/tournaments/${tournamentId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          status: 'ACTIVE'
        })
      });
    }

    await wait(1000);

    // 10. USUARIO: Enviar predicciones al torneo
    if (tournamentId) {
      for (let i = 1; i <= 3; i++) {
        logSubsection(`10.${i} Usuario - Enviar Predicción #${i}`);
        
        const matches = [
          { home: 'Arsenal', away: 'Chelsea', prediction: 'Arsenal gana', odds: 2.1 },
          { home: 'City', away: 'United', prediction: 'Over 2.5 goles', odds: 1.8 },
          { home: 'Liverpool', away: 'Tottenham', prediction: 'Liverpool gana', odds: 1.9 }
        ];

        const match = matches[i - 1];
        
        const predictionResult = await apiRequest(`/api/tournaments/${tournamentId}/predictions`, {
          method: 'POST',
          headers: getAuthHeaders(false),
          body: JSON.stringify({
            predictionData: {
              league: 'Premier League',
              match: `${match.home} vs ${match.away}`,
              homeTeam: match.home,
              awayTeam: match.away,
              prediction: match.prediction,
              type: i === 2 ? 'OVER_UNDER' : '1X2',
              odds: match.odds,
              confidence: 70 + (i * 5),
              matchTime: new Date(Date.now() + (i * 2) * 60 * 60 * 1000).toISOString()
            },
            sequenceNumber: i
          })
        });

        if (predictionResult.success) {
          predictionIds.push(predictionResult.data.data.id);
        }

        await wait(500);
      }
    }

    await wait(1000);

    // 11. USUARIO: Ver historial de torneos
    logSubsection('11. Usuario - Ver Historial de Torneos');
    await apiRequest('/api/tournaments/user/history', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 12. ADMIN: Ver participantes del torneo
    if (tournamentId) {
      logSubsection('12. Admin - Ver Participantes del Torneo');
      await apiRequest(`/api/admin/tournaments/${tournamentId}/participants`, {
        headers: getAuthHeaders(true)
      });
    }

    await wait(1000);

    // 13. ADMIN: Actualizar resultados de las predicciones
    logSubsection('13. Admin - Actualizar Resultados de Predicciones');
    const results = ['WON', 'LOST', 'WON']; // 2 aciertos de 3
    
    for (let i = 0; i < predictionIds.length && i < results.length; i++) {
      console.log(`   Actualizando predicción ${i + 1} a ${results[i]}`);
      await apiRequest(`/api/prediction-results/${predictionIds[i]}/result`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          result: results[i],
          actualOdds: [2.05, 1.75, 1.85][i]
        })
      });
      await wait(500);
    }

    await wait(1000);

    // 14. ADMIN: Ver estadísticas del torneo
    if (tournamentId) {
      logSubsection('14. Admin - Ver Estadísticas del Torneo');
      await apiRequest(`/api/admin/tournaments/stats?tournamentId=${tournamentId}`, {
        headers: getAuthHeaders(true)
      });
    }

    await wait(1000);

    // 15. ADMIN: Finalizar torneo y distribuir premios
    if (tournamentId) {
      logSubsection('15. Admin - Finalizar Torneo');
      await apiRequest(`/api/admin/tournaments/${tournamentId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          status: 'FINISHED'
        })
      });
    }

    await wait(2000); // Dar tiempo para procesar premios

    // 16. USUARIO: Ver balance final después de premios
    logSubsection('16. Usuario - Verificar Balance Final');
    await apiRequest('/api/wallet/balance', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 17. USUARIO: Ver dashboard de wallet
    logSubsection('17. Usuario - Ver Dashboard de Wallet');
    await apiRequest('/api/wallet/dashboard', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 18. USUARIO: Ver estadísticas personales actualizadas
    logSubsection('18. Usuario - Ver Estadísticas Personales');
    await apiRequest('/api/tournaments/user/stats', {
      headers: getAuthHeaders(false)
    });

    console.log('\n✅ Test de flujo completo de torneo pagado completado');

  } catch (error) {
    console.error('❌ Error en test de torneo pagado:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testPaidTournamentFlow();
}

module.exports = { testPaidTournamentFlow };