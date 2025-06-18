// src/services/tournament.service.js - NUEVO SERVICIO PARA LÓGICA DE TORNEOS
const { Tournament, TournamentEntry, TournamentPrediction, User, UserStats } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const WalletService = require('./wallet.service');
const ScoringService = require('./scoring.service');

class TournamentService {

  // =====================================================
  // FINALIZAR TORNEO CON DISTRIBUCIÓN DE PREMIOS
  // =====================================================
  static async finalizeTournament(tournamentId) {
    const t = await sequelize.transaction();
    
    try {
      console.log(`🏁 Finalizando torneo ${tournamentId}...`);
      
      // Obtener torneo con lock
      const tournament = await Tournament.findByPk(tournamentId, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!tournament) {
        throw new Error('Torneo no encontrado');
      }

      if (tournament.status === 'FINISHED') {
        console.log('Torneo ya está finalizado');
        await t.commit();
        return tournament;
      }

      // Obtener todas las entradas ordenadas por puntuación
      const entries = await TournamentEntry.findAll({
        where: { tournamentId, status: 'ACTIVE' },
        order: [
          ['total_score', 'DESC'],
          ['roi', 'DESC'],
          ['correct_predictions', 'DESC'],
          ['created_at', 'ASC'] // Desempate por tiempo de inscripción
        ],
        transaction: t
      });

      console.log(`📊 Finalizando con ${entries.length} participantes`);

      // Asignar rankings finales
      for (let i = 0; i < entries.length; i++) {
        entries[i].finalRank = i + 1;
        entries[i].status = 'FINISHED';
        await entries[i].save({ transaction: t });
      }

      // Distribuir premios usando WalletService
      await this.distributePrizes(tournament, entries, t);

      // Cambiar estado del torneo
      tournament.status = 'FINISHED';
      await tournament.save({ transaction: t });

      // Recalcular estadísticas de los participantes
      for (const entry of entries) {
        await UserStats.recalculate(entry.userId);
      }

      await t.commit();
      
      console.log(`✅ Torneo ${tournament.name} finalizado exitosamente`);
      
      return tournament;

    } catch (error) {
      await t.rollback();
      console.error('Error finalizando torneo:', error);
      throw error;
    }
  }

  // =====================================================
  // DISTRIBUIR PREMIOS USANDO WALLET SERVICE
  // =====================================================
  static async distributePrizes(tournament, entries, transaction) {
    try {
      const prizePool = parseFloat(tournament.prizePool);
      const payoutStructure = tournament.payoutStructure;

      if (prizePool <= 0) {
        console.log('No hay prize pool para distribuir');
        return;
      }

      console.log(`💰 Distribuyendo S/ ${prizePool} entre ${entries.length} participantes`);

      let totalDistributed = 0;

      for (const [position, percentage] of Object.entries(payoutStructure)) {
        const rank = parseInt(position);
        
        if (rank <= entries.length) {
          const entry = entries[rank - 1];
          const prize = Math.round((prizePool * percentage / 100) * 100) / 100;
          
          if (prize > 0) {
            // Usar WalletService para pagar el premio
            const prizeResult = await WalletService.payTournamentPrize(
              entry.userId,
              tournament.id,
              prize,
              rank
            );

            if (prizeResult.success) {
              entry.prizeWon = prize;
              await entry.save({ transaction });
              totalDistributed += prize;
              
              console.log(`🏆 Premio pagado: Posición #${rank} - Usuario ${entry.userId} - S/ ${prize}`);
            } else {
              console.error(`❌ Error pagando premio a posición #${rank}:`, prizeResult.error);
            }
          }
        }
      }

      console.log(`✅ Total distribuido: S/ ${totalDistributed} de S/ ${prizePool}`);

    } catch (error) {
      console.error('Error distribuyendo premios:', error);
      throw error;
    }
  }

  // =====================================================
  // PROCESAR REEMBOLSOS AUTOMÁTICOS
  // =====================================================
  static async processAutomaticRefunds(tournamentId, reason = 'Torneo cancelado') {
    const t = await sequelize.transaction();
    
    try {
      console.log(`💸 Procesando reembolsos automáticos para torneo ${tournamentId}`);
      
      const entries = await TournamentEntry.findAll({
        where: { 
          tournamentId,
          buyInPaid: { [Op.gt]: 0 } // Solo entradas que pagaron
        },
        transaction: t
      });

      let totalRefunded = 0;
      let successfulRefunds = 0;

      for (const entry of entries) {
        try {
          const refundResult = await WalletService.refundTournamentEntry(
            entry.userId,
            tournamentId,
            entry.buyInPaid,
            reason
          );

          if (refundResult.success) {
            entry.status = 'REFUNDED';
            await entry.save({ transaction: t });
            totalRefunded += entry.buyInPaid;
            successfulRefunds++;
            
            console.log(`✅ Reembolso exitoso: Usuario ${entry.userId} - S/ ${entry.buyInPaid}`);
          } else {
            console.error(`❌ Error en reembolso: Usuario ${entry.userId}`, refundResult.error);
          }
        } catch (error) {
          console.error(`❌ Error procesando reembolso para usuario ${entry.userId}:`, error);
        }
      }

      await t.commit();
      
      console.log(`✅ Reembolsos completados: ${successfulRefunds}/${entries.length} - Total: S/ ${totalRefunded}`);
      
      return {
        totalEntries: entries.length,
        successfulRefunds,
        totalRefunded
      };

    } catch (error) {
      await t.rollback();
      console.error('Error en reembolsos automáticos:', error);
      throw error;
    }
  }

  // =====================================================
  // CANCELAR TORNEO CON REEMBOLSOS
  // =====================================================
  static async cancelTournament(tournamentId, reason = 'Torneo cancelado por administración') {
    const t = await sequelize.transaction();
    
    try {
      const tournament = await Tournament.findByPk(tournamentId, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!tournament) {
        throw new Error('Torneo no encontrado');
      }

      if (tournament.status === 'FINISHED' || tournament.status === 'CANCELLED') {
        throw new Error('El torneo ya está finalizado o cancelado');
      }

      // Procesar reembolsos automáticos
      const refundResult = await this.processAutomaticRefunds(tournamentId, reason);

      // Cambiar estado del torneo
      tournament.status = 'CANCELLED';
      tournament.metadata = {
        ...tournament.metadata,
        cancelledAt: new Date(),
        cancelReason: reason,
        refundsSummary: refundResult
      };
      await tournament.save({ transaction: t });

      await t.commit();
      
      console.log(`✅ Torneo ${tournament.name} cancelado con reembolsos procesados`);
      
      return {
        tournament,
        refunds: refundResult
      };

    } catch (error) {
      await t.rollback();
      console.error('Error cancelando torneo:', error);
      throw error;
    }
  }

  // =====================================================
  // VERIFICAR SALDO ANTES DE INSCRIPCIÓN
  // =====================================================
  static async canUserAffordTournament(userId, tournamentId) {
    try {
      const tournament = await Tournament.findByPk(tournamentId);
      if (!tournament) {
        return { canAfford: false, reason: 'Torneo no encontrado' };
      }

      if (tournament.buyIn === 0) {
        return { canAfford: true, reason: 'Torneo gratuito' };
      }

      const userBalance = await WalletService.getAvailableBalance(userId);
      
      return {
        canAfford: userBalance >= tournament.buyIn,
        reason: userBalance >= tournament.buyIn ? 
          'Saldo suficiente' : 
          `Saldo insuficiente. Necesitas S/ ${tournament.buyIn}, tienes S/ ${userBalance}`,
        required: tournament.buyIn,
        available: userBalance,
        missing: Math.max(0, tournament.buyIn - userBalance)
      };

    } catch (error) {
      console.error('Error verificando saldo:', error);
      return { canAfford: false, reason: 'Error verificando saldo' };
    }
  }

  // =====================================================
  // OBTENER ESTADÍSTICAS DE TORNEO
  // =====================================================
  static async getTournamentStats(tournamentId) {
    try {
      const tournament = await Tournament.findByPk(tournamentId, {
        include: [{
          model: TournamentEntry,
          as: 'entries',
          include: [{
            model: User,
            attributes: ['id', 'name']
          }]
        }]
      });

      if (!tournament) {
        throw new Error('Torneo no encontrado');
      }

      const stats = {
        tournament: {
          id: tournament.id,
          name: tournament.name,
          status: tournament.status,
          type: tournament.type,
          buyIn: tournament.buyIn,
          prizePool: tournament.prizePool,
          maxPlayers: tournament.maxPlayers,
          currentPlayers: tournament.entries.length
        },
        participation: {
          totalEntries: tournament.entries.length,
          activeEntries: tournament.entries.filter(e => e.status === 'ACTIVE').length,
          finishedEntries: tournament.entries.filter(e => e.status === 'FINISHED').length,
          eliminatedEntries: tournament.entries.filter(e => e.status === 'ELIMINATED').length
        },
        financial: {
          totalBuyIns: tournament.entries.reduce((sum, e) => sum + parseFloat(e.buyInPaid || 0), 0),
          totalPrizes: tournament.entries.reduce((sum, e) => sum + parseFloat(e.prizeWon || 0), 0),
          prizePool: parseFloat(tournament.prizePool || 0)
        },
        performance: {
          averageScore: 0,
          topScore: 0,
          totalPredictions: 0
        }
      };

      // Calcular estadísticas de performance
      if (tournament.entries.length > 0) {
        const scores = tournament.entries.map(e => parseFloat(e.totalScore || 0));
        stats.performance.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        stats.performance.topScore = Math.max(...scores);
        stats.performance.totalPredictions = tournament.entries.reduce((sum, e) => sum + (e.predictionsSubmitted || 0), 0);
      }

      return stats;

    } catch (error) {
      console.error('Error obteniendo estadísticas del torneo:', error);
      throw error;
    }
  }

  // =====================================================
  // VERIFICAR INTEGRIDAD DE PRIZE POOL
  // =====================================================
  static async verifyPrizePoolIntegrity(tournamentId) {
    try {
      const tournament = await Tournament.findByPk(tournamentId, {
        include: [{
          model: TournamentEntry,
          as: 'entries'
        }]
      });

      if (!tournament) {
        throw new Error('Torneo no encontrado');
      }

      const totalBuyIns = tournament.entries.reduce((sum, entry) => {
        return sum + parseFloat(entry.buyInPaid || 0);
      }, 0);

      const expectedPrizePool = totalBuyIns * 0.9; // 90% va al prize pool
      const actualPrizePool = parseFloat(tournament.prizePool || 0);
      const difference = Math.abs(expectedPrizePool - actualPrizePool);

      return {
        isValid: difference < 0.01, // Tolerancia de 1 centavo
        totalBuyIns,
        expectedPrizePool,
        actualPrizePool,
        difference,
        commission: totalBuyIns * 0.1
      };

    } catch (error) {
      console.error('Error verificando integridad del prize pool:', error);
      throw error;
    }
  }
}

module.exports = TournamentService;