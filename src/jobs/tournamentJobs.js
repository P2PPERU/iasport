// src/jobs/tournamentJobs.js
const cron = require('node-cron');
const { Tournament, TournamentEntry, TournamentPrediction, User, UserStats } = require('../models');
const { Op } = require('sequelize');
const ScoringService = require('../services/scoring.service');
const NotificationService = require('../services/notification.service');

class TournamentJobs {
  static jobs = [];

  // Inicializar todos los jobs
  static init() {
    console.log('🏆 Iniciando jobs de torneos...');

    // Job 1: Actualizar estado de torneos (cada 5 minutos)
    this.scheduleStatusUpdates();

    // Job 2: Actualizar rankings (cada 10 minutos)
    this.scheduleRankingUpdates();

    // Job 3: Finalizar torneos completados (cada 15 minutos)
    this.scheduleCompletionCheck();

    // Job 4: Notificar sobre torneos próximos (cada hora)
    this.scheduleUpcomingNotifications();

    // Job 5: Limpiar torneos cancelados/antiguos (diario)
    this.scheduleCleanup();

    // Job 6: Recalcular estadísticas de usuarios (diario)
    this.scheduleStatsRecalculation();

    console.log(`✅ ${this.jobs.length} jobs de torneos activos`);
  }

  // Detener todos los jobs
  static stop() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    console.log('🛑 Jobs de torneos detenidos');
  }

  // =====================================================
  // JOB 1: ACTUALIZAR ESTADO DE TORNEOS
  // =====================================================
  static scheduleStatusUpdates() {
    const job = cron.schedule('*/5 * * * *', async () => {
      console.log('🔄 Actualizando estados de torneos...');
      
      try {
        const now = new Date();
        let updated = 0;

        // UPCOMING → REGISTRATION
        const upcomingToRegistration = await Tournament.update(
          { status: 'REGISTRATION' },
          {
            where: {
              status: 'UPCOMING',
              registrationDeadline: { [Op.lte]: now }
            }
          }
        );
        updated += upcomingToRegistration[0];

        // REGISTRATION → ACTIVE
        const registrationToActive = await Tournament.update(
          { status: 'ACTIVE' },
          {
            where: {
              status: 'REGISTRATION',
              startTime: { [Op.lte]: now }
            }
          }
        );
        updated += registrationToActive[0];

        // ACTIVE → FINISHED (si ya pasó el tiempo de fin)
        const activeToFinished = await Tournament.findAll({
          where: {
            status: 'ACTIVE',
            endTime: { [Op.lte]: now }
          }
        });

        for (const tournament of activeToFinished) {
          await this.finalizeTournament(tournament);
          updated++;
        }

        if (updated > 0) {
          console.log(`   ✅ ${updated} torneos actualizados`);
        }

      } catch (error) {
        console.error('❌ Error actualizando estados:', error);
      }
    });

    job.start();
    this.jobs.push(job);
  }

  // =====================================================
  // JOB 2: ACTUALIZAR RANKINGS
  // =====================================================
  static scheduleRankingUpdates() {
    const job = cron.schedule('*/10 * * * *', async () => {
      console.log('📊 Actualizando rankings...');
      
      try {
        // Obtener torneos activos
        const activeTournaments = await Tournament.findAll({
          where: { status: 'ACTIVE' },
          attributes: ['id', 'name']
        });

        for (const tournament of activeTournaments) {
          await ScoringService.updateTournamentRankings(tournament.id);
        }

        if (activeTournaments.length > 0) {
          console.log(`   ✅ Rankings actualizados en ${activeTournaments.length} torneos`);
        }

      } catch (error) {
        console.error('❌ Error actualizando rankings:', error);
      }
    });

    job.start();
    this.jobs.push(job);
  }

  // =====================================================
  // JOB 3: VERIFICAR TORNEOS PARA FINALIZAR
  // =====================================================
  static scheduleCompletionCheck() {
    const job = cron.schedule('*/15 * * * *', async () => {
      console.log('🏁 Verificando torneos para finalizar...');
      
      try {
        // Buscar torneos activos que deberían estar terminados
        const tournamentsToFinish = await Tournament.findAll({
          where: {
            status: 'ACTIVE',
            endTime: { [Op.lte]: new Date() }
          }
        });

        for (const tournament of tournamentsToFinish) {
          await this.finalizeTournament(tournament);
          console.log(`   ✅ Torneo finalizado: ${tournament.name}`);
        }

        // También verificar torneos con todas las predicciones completas
        const tournamentsWithAllPredictions = await Tournament.findAll({
          where: { status: 'ACTIVE' },
          include: [{
            model: TournamentPrediction,
            as: 'predictions',
            where: { result: 'PENDING' },
            required: false
          }]
        });

        for (const tournament of tournamentsWithAllPredictions) {
          // Si no hay predicciones pendientes y ya pasó tiempo suficiente
          if (tournament.predictions.length === 0) {
            const hoursSinceStart = (new Date() - new Date(tournament.startTime)) / (1000 * 60 * 60);
            if (hoursSinceStart >= 2) { // Al menos 2 horas después del inicio
              await this.finalizeTournament(tournament);
              console.log(`   ✅ Torneo finalizado por predicciones completas: ${tournament.name}`);
            }
          }
        }

      } catch (error) {
        console.error('❌ Error verificando finalizaciones:', error);
      }
    });

    job.start();
    this.jobs.push(job);
  }

  // =====================================================
  // JOB 4: NOTIFICAR SOBRE TORNEOS PRÓXIMOS
  // =====================================================
  static scheduleUpcomingNotifications() {
    const job = cron.schedule('0 * * * *', async () => {
      console.log('📢 Verificando notificaciones de torneos...');
      
      try {
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

        // Torneos que empiezan en 1 hora
        const tournamentsStartingSoon = await Tournament.findAll({
          where: {
            status: 'REGISTRATION',
            startTime: {
              [Op.between]: [now, oneHourFromNow]
            },
            isHot: true // Solo torneos marcados como hot
          }
        });

        for (const tournament of tournamentsStartingSoon) {
          await this.notifyTournamentStarting(tournament, '1 hora');
        }

        // Registro cerrando en 30 minutos
        const registrationClosingSoon = await Tournament.findAll({
          where: {
            status: 'REGISTRATION',
            registrationDeadline: {
              [Op.between]: [now, thirtyMinutesFromNow]
            }
          }
        });

        for (const tournament of registrationClosingSoon) {
          await this.notifyRegistrationClosing(tournament);
        }

      } catch (error) {
        console.error('❌ Error enviando notificaciones:', error);
      }
    });

    job.start();
    this.jobs.push(job);
  }

  // =====================================================
  // JOB 5: LIMPIAR DATOS ANTIGUOS
  // =====================================================
  static scheduleCleanup() {
    const job = cron.schedule('0 2 * * *', async () => { // 2 AM diario
      console.log('🧹 Limpiando datos antiguos...');
      
      try {
        // Eliminar torneos cancelados de más de 30 días
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const deletedTournaments = await Tournament.destroy({
          where: {
            status: 'CANCELLED',
            updatedAt: { [Op.lte]: thirtyDaysAgo }
          }
        });

        // Limpiar predicciones de torneos muy antiguos sin actividad
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const deletedPredictions = await TournamentPrediction.destroy({
          where: {
            createdAt: { [Op.lte]: sixMonthsAgo },
            result: 'PENDING'
          }
        });

        console.log(`   ✅ Limpieza completada: ${deletedTournaments} torneos, ${deletedPredictions} predicciones`);

      } catch (error) {
        console.error('❌ Error en limpieza:', error);
      }
    });

    job.start();
    this.jobs.push(job);
  }

  // =====================================================
  // JOB 6: RECALCULAR ESTADÍSTICAS
  // =====================================================
  static scheduleStatsRecalculation() {
    const job = cron.schedule('0 3 * * *', async () => { // 3 AM diario
      console.log('📈 Recalculando estadísticas de usuarios...');
      
      try {
        // Obtener usuarios que participaron en torneos recientemente
        const recentParticipants = await User.findAll({
          include: [{
            model: TournamentEntry,
            as: 'tournamentEntries',
            where: {
              updatedAt: {
                [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Última semana
              }
            },
            required: true
          }],
          group: ['User.id']
        });

        let updated = 0;
        for (const user of recentParticipants) {
          await UserStats.recalculate(user.id);
          updated++;
        }

        console.log(`   ✅ Estadísticas recalculadas para ${updated} usuarios`);

      } catch (error) {
        console.error('❌ Error recalculando estadísticas:', error);
      }
    });

    job.start();
    this.jobs.push(job);
  }

  // =====================================================
  // MÉTODOS HELPER
  // =====================================================

  // Finalizar un torneo
  static async finalizeTournament(tournament) {
    try {
      // Obtener todas las entradas del torneo ordenadas por puntuación
      const entries = await TournamentEntry.findAll({
        where: { tournamentId: tournament.id, status: 'ACTIVE' },
        order: [
          ['total_score', 'DESC'],
          ['roi', 'DESC'],
          ['correct_predictions', 'DESC'],
          ['created_at', 'ASC'] // Desempate por tiempo de inscripción
        ]
      });

      // Asignar rankings finales
      for (let i = 0; i < entries.length; i++) {
        entries[i].finalRank = i + 1;
        entries[i].status = 'FINISHED';
        await entries[i].save();
      }

      // Calcular y distribuir premios
      await this.distributePrizes(tournament, entries);

      // Cambiar estado del torneo
      tournament.status = 'FINISHED';
      await tournament.save();

      // Notificar a los participantes sobre los resultados
      await this.notifyTournamentResults(tournament, entries);

      // Recalcular estadísticas de los participantes
      for (const entry of entries) {
        await UserStats.recalculate(entry.userId);
      }

    } catch (error) {
      console.error('Error finalizando torneo:', error);
      throw error;
    }
  }

  // Distribuir premios según la estructura de payout
  static async distributePrizes(tournament, entries) {
    const prizePool = parseFloat(tournament.prizePool);
    const payoutStructure = tournament.payoutStructure;

    if (prizePool <= 0) return;

    for (const [position, percentage] of Object.entries(payoutStructure)) {
      const rank = parseInt(position);
      if (rank <= entries.length) {
        const entry = entries[rank - 1];
        const prize = Math.round((prizePool * percentage / 100) * 100) / 100;
        entry.prizeWon = prize;
        await entry.save();
      }
    }
  }

  // Notificar inicio de torneo
  static async notifyTournamentStarting(tournament, timeLeft) {
    try {
      // Obtener usuarios inscritos en el torneo
      const entries = await TournamentEntry.findAll({
        where: { tournamentId: tournament.id },
        include: [{
          model: User,
          include: [{
            model: require('../models').PushSubscription,
            where: { isActive: true },
            required: true
          }]
        }]
      });

      const userIds = entries.map(entry => entry.userId);

      if (userIds.length > 0) {
        await NotificationService.sendToUsers(
          userIds,
          'tournament_starting',
          {
            title: `🏆 Torneo empezando en ${timeLeft}`,
            body: `${tournament.name} está por comenzar. ¡Prepárate!`,
            tournamentId: tournament.id,
            tournamentName: tournament.name
          }
        );
      }

    } catch (error) {
      console.error('Error notificando inicio:', error);
    }
  }

  // Notificar cierre de registro
  static async notifyRegistrationClosing(tournament) {
    try {
      // Notificar a todos los usuarios premium sobre registro cerrando
      const premiumUsers = await User.findAll({
        where: { isPremium: true },
        include: [{
          model: require('../models').PushSubscription,
          where: { isActive: true },
          required: true
        }]
      });

      const userIds = premiumUsers.map(user => user.id);

      if (userIds.length > 0) {
        await NotificationService.sendToUsers(
          userIds,
          'registration_closing',
          {
            title: '⏰ Registro cerrando pronto',
            body: `Últimos 30 min para inscribirse a ${tournament.name}`,
            tournamentId: tournament.id
          }
        );
      }

    } catch (error) {
      console.error('Error notificando cierre:', error);
    }
  }

  // Notificar resultados del torneo
  static async notifyTournamentResults(tournament, entries) {
    try {
      // Notificar a los ganadores (top 3)
      const winners = entries.slice(0, 3);

      for (const winner of winners) {
        const position = winner.finalRank === 1 ? '🥇' : 
                        winner.finalRank === 2 ? '🥈' : '🥉';
        
        await NotificationService.sendToUser(
          winner.userId,
          'tournament_result',
          {
            title: `${position} ¡Felicitaciones!`,
            body: `Terminaste #${winner.finalRank} en ${tournament.name}${winner.prizeWon > 0 ? ` - Ganaste S/ ${winner.prizeWon}` : ''}`,
            tournamentId: tournament.id,
            rank: winner.finalRank,
            prize: winner.prizeWon
          }
        );
      }

    } catch (error) {
      console.error('Error notificando resultados:', error);
    }
  }

  // Obtener estadísticas de los jobs
  static async getJobStats() {
    try {
      const stats = {
        totalJobs: this.jobs.length,
        activeJobs: this.jobs.filter(job => job.running).length,
        lastExecution: new Date().toISOString(),
        tournaments: {
          total: await Tournament.count(),
          active: await Tournament.count({ where: { status: 'ACTIVE' } }),
          registration: await Tournament.count({ where: { status: 'REGISTRATION' } }),
          finished: await Tournament.count({ where: { status: 'FINISHED' } })
        },
        entries: {
          total: await TournamentEntry.count(),
          active: await TournamentEntry.count({ where: { status: 'ACTIVE' } })
        }
      };

      return stats;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return null;
    }
  }
}

module.exports = TournamentJobs;