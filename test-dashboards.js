// test-dashboards.js - Test de dashboards y estadísticas
const { apiRequest, getAuthHeaders, logSection, logSubsection, wait } = require('./test-config');

async function testDashboardsAndStats() {
  logSection('DASHBOARDS Y ESTADÍSTICAS');

  try {
    // ===============================
    // DASHBOARDS ADMINISTRATIVOS
    // ===============================

    // 1. ADMIN: Dashboard principal
    logSubsection('1. Admin - Dashboard Principal');
    await apiRequest('/api/admin/stats', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 2. ADMIN: Estadísticas detalladas
    logSubsection('2. Admin - Estadísticas Detalladas');
    await apiRequest('/api/admin/stats/detailed', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 3. ADMIN: Estadísticas de torneos
    logSubsection('3. Admin - Estadísticas de Torneos');
    await apiRequest('/api/admin/tournaments/stats', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 4. ADMIN: Dashboard de wallet
    logSubsection('4. Admin - Dashboard de Wallet');
    await apiRequest('/api/wallet/admin/dashboard', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 5. ADMIN: Estadísticas de notificaciones
    logSubsection('5. Admin - Estadísticas de Notificaciones');
    await apiRequest('/api/admin/notifications/stats', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // ===============================
    // LISTADOS ADMINISTRATIVOS
    // ===============================

    // 6. ADMIN: Listar usuarios
    logSubsection('6. Admin - Listar Usuarios');
    await apiRequest('/api/admin/users', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 7. ADMIN: Filtrar usuarios premium
    logSubsection('7. Admin - Usuarios Premium');
    await apiRequest('/api/admin/users?isPremium=true', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 8. ADMIN: Usuarios con notificaciones activas
    logSubsection('8. Admin - Usuarios con Notificaciones');
    await apiRequest('/api/admin/users?hasNotifications=true', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 9. ADMIN: Buscar usuarios
    logSubsection('9. Admin - Buscar Usuarios');
    await apiRequest('/api/admin/users?search=juan', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 10. ADMIN: Listar todas las predicciones
    logSubsection('10. Admin - Listar Predicciones');
    await apiRequest('/api/admin/predictions', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 11. ADMIN: Filtrar predicciones por estado
    logSubsection('11. Admin - Predicciones por Estado');
    await apiRequest('/api/admin/predictions?result=PENDING', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 12. ADMIN: Predicciones hot
    logSubsection('12. Admin - Predicciones Hot');
    await apiRequest('/api/admin/predictions?isHot=true', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 13. ADMIN: Listar todos los torneos
    logSubsection('13. Admin - Listar Torneos');
    await apiRequest('/api/admin/tournaments', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 14. ADMIN: Torneos activos
    logSubsection('14. Admin - Torneos Activos');
    await apiRequest('/api/admin/tournaments?status=ACTIVE', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 15. ADMIN: Listar pagos
    logSubsection('15. Admin - Listar Pagos');
    await apiRequest('/api/admin/payments', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // ===============================
    // WALLET ADMINISTRATIVO
    // ===============================

    // 16. ADMIN: Solicitudes de depósito
    logSubsection('16. Admin - Solicitudes de Depósito');
    await apiRequest('/api/wallet/admin/deposits', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 17. ADMIN: Depósitos pendientes
    logSubsection('17. Admin - Depósitos Pendientes');
    await apiRequest('/api/wallet/admin/deposits?status=PENDING', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 18. ADMIN: Solicitudes de retiro
    logSubsection('18. Admin - Solicitudes de Retiro');
    await apiRequest('/api/wallet/admin/withdrawals', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 19. ADMIN: Retiros pendientes
    logSubsection('19. Admin - Retiros Pendientes');
    await apiRequest('/api/wallet/admin/withdrawals?status=PENDING', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // ===============================
    // ESTADÍSTICAS DE USUARIO
    // ===============================

    // 20. USUARIO: Dashboard personal
    logSubsection('20. Usuario - Dashboard Personal');
    await apiRequest('/api/wallet/dashboard', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 21. USUARIO: Estadísticas de torneos
    logSubsection('21. Usuario - Estadísticas de Torneos');
    await apiRequest('/api/tournaments/user/stats', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 22. USUARIO: Historial de torneos
    logSubsection('22. Usuario - Historial de Torneos');
    await apiRequest('/api/tournaments/user/history', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 23. USUARIO: Estadísticas de wallet
    logSubsection('23. Usuario - Estadísticas de Wallet');
    await apiRequest('/api/wallet/stats', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // 24. USUARIO: Historial de transacciones
    logSubsection('24. Usuario - Historial de Transacciones');
    await apiRequest('/api/wallet/transactions', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // ===============================
    // RANKINGS Y LEADERBOARDS
    // ===============================

    // 25. PÚBLICO: Ranking global
    logSubsection('25. Público - Ranking Global');
    await apiRequest('/api/tournaments/ranking/global');

    await wait(1000);

    // 26. PÚBLICO: Ranking mensual
    logSubsection('26. Público - Ranking Mensual');
    await apiRequest('/api/tournaments/ranking/global?period=monthly');

    await wait(1000);

    // 27. PÚBLICO: Ranking semanal
    logSubsection('27. Público - Ranking Semanal');
    await apiRequest('/api/tournaments/ranking/global?period=weekly');

    await wait(1000);

    // ===============================
    // ESTADÍSTICAS AVANZADAS
    // ===============================

    // 28. ADMIN: Estadísticas detalladas por período
    logSubsection('28. Admin - Stats Detalladas (Semana)');
    await apiRequest('/api/admin/stats/detailed?period=week', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 29. ADMIN: Estadísticas detalladas por mes
    logSubsection('29. Admin - Stats Detalladas (Mes)');
    await apiRequest('/api/admin/stats/detailed?period=month', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 30. ADMIN: Estadísticas de resultados de predicciones
    logSubsection('30. Admin - Estadísticas de Resultados');
    await apiRequest('/api/prediction-results/stats', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 31. ADMIN: Historial de actualizaciones de resultados
    logSubsection('31. Admin - Historial de Actualizaciones');
    await apiRequest('/api/prediction-results/history', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // ===============================
    // HEALTH CHECK Y SISTEMA
    // ===============================

    // 32. PÚBLICO: Health check
    logSubsection('32. Público - Health Check');
    await apiRequest('/health');

    await wait(1000);

    // 33. PÚBLICO: Info de la API
    logSubsection('33. Público - Info de la API');
    await apiRequest('/');

    await wait(1000);

    // 34. USUARIO: Perfil personal
    logSubsection('34. Usuario - Perfil Personal');
    await apiRequest('/api/users/profile', {
      headers: getAuthHeaders(false)
    });

    await wait(1000);

    // ===============================
    // FILTROS Y BÚSQUEDAS AVANZADAS
    // ===============================

    // 35. ADMIN: Predicciones por fecha
    logSubsection('35. Admin - Predicciones por Fecha');
    const today = new Date().toISOString().split('T')[0];
    await apiRequest(`/api/admin/predictions?date=${today}`, {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 36. ADMIN: Torneos por tipo
    logSubsection('36. Admin - Torneos por Tipo');
    await apiRequest('/api/admin/tournaments?type=DAILY_CLASSIC', {
      headers: getAuthHeaders(true)
    });

    await wait(1000);

    // 37. ADMIN: Pagos por método
    logSubsection('37. Admin - Pagos por Método');
    await apiRequest('/api/admin/payments?method=TOURNAMENT', {
      headers: getAuthHeaders(true)
    });

    console.log('\n✅ Test de dashboards y estadísticas completado');

  } catch (error) {
    console.error('❌ Error en test de dashboards:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testDashboardsAndStats();
}

module.exports = { testDashboardsAndStats };