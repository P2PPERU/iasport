// src/services/scoring.service.js
const { TournamentPrediction, TournamentEntry } = require('../models');

class ScoringService {
  
  // =====================================================
  // CALCULAR PUNTOS BASE SEGÚN CONFIANZA Y CUOTAS
  // =====================================================
  static calculateBasePoints(confidence, odds, predictionType = 'STANDARD') {
    // Fórmula: (100 - % probabilidad implícita) × Multiplicador
    const impliedProbability = (1 / odds) * 100;
    const basePoints = Math.max(0, 100 - impliedProbability);
    
    // Multiplicadores por tipo de predicción
    const typeMultipliers = {
      '1X2': 1.0,           // Resultado simple
      'OVER_UNDER': 1.1,    // Over/Under
      'HANDICAP': 1.2,      // Handicap
      'BTTS': 1.15,         // Both Teams to Score
      'PROPS': 1.3,         // Props específicos
      'COMBINED': 1.5       // Combinadas
    };
    
    const multiplier = typeMultipliers[predictionType] || 1.0;
    
    // Factor de confianza (50-100% confianza da 0.5-1.0 multiplicador)
    const confidenceFactor = Math.max(0.5, confidence / 100);
    
    return Math.round(basePoints * multiplier * confidenceFactor * 100) / 100;
  }
  
  // =====================================================
  // CALCULAR BONUS MULTIPLIERS
  // =====================================================
  static async calculateBonusMultiplier(userId, tournamentId, predictionSequence) {
    let bonusMultiplier = 1.0;
    
    try {
      // Obtener predicciones anteriores del usuario en este torneo
      const previousPredictions = await TournamentPrediction.findAll({
        where: {
          userId,
          tournamentId,
          sequenceNumber: { [require('sequelize').Op.lt]: predictionSequence },
          result: { [require('sequelize').Op.ne]: 'PENDING' }
        },
        order: [['sequence_number', 'DESC']]
      });
      
      // BONUS POR RACHA (3+ aciertos consecutivos)
      const streakBonus = this.calculateStreakBonus(previousPredictions);
      bonusMultiplier *= streakBonus;
      
      // BONUS POR PERFECT PICK (predicción con <5% probabilidad)
      const perfectPickBonus = this.calculatePerfectPickBonus(previousPredictions);
      bonusMultiplier *= perfectPickBonus;
      
      // BONUS POR ROI POSITIVO EN EL TORNEO
      const roiBonus = await this.calculateROIBonus(userId, tournamentId);
      bonusMultiplier *= roiBonus;
      
      return Math.round(bonusMultiplier * 100) / 100;
      
    } catch (error) {
      console.error('Error calculando bonus multiplier:', error);
      return 1.0;
    }
  }
  
  // =====================================================
  // BONUS POR RACHA
  // =====================================================
  static calculateStreakBonus(previousPredictions) {
    if (previousPredictions.length < 3) return 1.0;
    
    // Contar aciertos consecutivos desde la más reciente
    let currentStreak = 0;
    for (const prediction of previousPredictions) {
      if (prediction.isCorrect) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Bonus progresivo por racha
    if (currentStreak >= 5) return 1.25; // 25% bonus
    if (currentStreak >= 4) return 1.20; // 20% bonus
    if (currentStreak >= 3) return 1.15; // 15% bonus
    
    return 1.0;
  }
  
  // =====================================================
  // BONUS POR PERFECT PICK
  // =====================================================
  static calculatePerfectPickBonus(previousPredictions) {
    // Verificar si la última predicción fue un "perfect pick"
    if (previousPredictions.length === 0) return 1.0;
    
    const lastPrediction = previousPredictions[0];
    if (!lastPrediction.isCorrect) return 1.0;
    
    // Calcular probabilidad implícita
    const impliedProbability = (1 / lastPrediction.selectedOdds) * 100;
    
    if (impliedProbability < 5) return 1.5; // 50% bonus para picks <5%
    if (impliedProbability < 10) return 1.3; // 30% bonus para picks <10%
    if (impliedProbability < 15) return 1.2; // 20% bonus para picks <15%
    
    return 1.0;
  }
  
  // =====================================================
  // BONUS POR ROI POSITIVO
  // =====================================================
  static async calculateROIBonus(userId, tournamentId) {
    try {
      const entry = await TournamentEntry.findOne({
        where: { userId, tournamentId }
      });
      
      if (!entry || entry.roi <= 0) return 1.0;
      
      // Bonus basado en ROI
      if (entry.roi >= 50) return 1.25; // 25% bonus para ROI >= 50%
      if (entry.roi >= 25) return 1.20; // 20% bonus para ROI >= 25%
      if (entry.roi >= 10) return 1.15; // 15% bonus para ROI >= 10%
      
      return 1.0;
      
    } catch (error) {
      console.error('Error calculando ROI bonus:', error);
      return 1.0;
    }
  }
  
  // =====================================================
  // ACTUALIZAR RESULTADO DE PREDICCIÓN
  // =====================================================
  static async updatePredictionResult(predictionId, result, actualOdds = null) {
    try {
      const prediction = await TournamentPrediction.findByPk(predictionId);
      if (!prediction) {
        throw new Error('Predicción no encontrada');
      }
      
      // Actualizar resultado
      prediction.result = result;
      prediction.isCorrect = result === 'WON';
      
      if (result === 'WON') {
        // Calcular puntos base
        const basePoints = this.calculateBasePoints(
          prediction.confidence,
          prediction.selectedOdds,
          prediction.predictionType
        );
        
        // Calcular bonus multiplier
        const bonusMultiplier = await this.calculateBonusMultiplier(
          prediction.userId,
          prediction.tournamentId,
          prediction.sequenceNumber
        );
        
        prediction.points = basePoints;
        prediction.bonusMultiplier = bonusMultiplier;
        prediction.finalPoints = Math.round(basePoints * bonusMultiplier * 100) / 100;
        
        // Calcular contribución al ROI
        const stake = 100; // Stake estándar para cálculo
        const returns = actualOdds ? stake * actualOdds : stake * prediction.selectedOdds;
        prediction.roiContribution = ((returns - stake) / stake) * 100;
        
      } else if (result === 'LOST') {
        prediction.points = 0;
        prediction.bonusMultiplier = 1.0;
        prediction.finalPoints = 0;
        prediction.roiContribution = -100; // Pérdida completa del stake
      } else if (result === 'VOID') {
        prediction.points = 0;
        prediction.bonusMultiplier = 1.0;
        prediction.finalPoints = 0;
        prediction.roiContribution = 0; // Sin ganancia ni pérdida
      }
      
      await prediction.save();
      
      // Actualizar totales en la entrada del torneo
      await this.updateTournamentEntryTotals(prediction.entryId);
      
      return prediction;
      
    } catch (error) {
      console.error('Error actualizando resultado:', error);
      throw error;
    }
  }
  
  // =====================================================
  // ACTUALIZAR TOTALES EN ENTRADA DE TORNEO
  // =====================================================
  static async updateTournamentEntryTotals(entryId) {
    try {
      const entry = await TournamentEntry.findByPk(entryId);
      if (!entry) return;
      
      // Obtener todas las predicciones de esta entrada
      const predictions = await TournamentPrediction.findAll({
        where: { entryId }
      });
      
      // Calcular totales
      let totalScore = 0;
      let correctPredictions = 0;
      let totalPredictions = predictions.length;
      let bonusPoints = 0;
      let roiSum = 0;
      let streakCount = 0;
      let currentStreak = 0;
      
      // Ordenar por secuencia para calcular racha
      const sortedPredictions = predictions.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      
      sortedPredictions.forEach(prediction => {
        if (prediction.result !== 'PENDING') {
          totalScore += parseFloat(prediction.finalPoints || 0);
          roiSum += parseFloat(prediction.roiContribution || 0);
          
          if (prediction.isCorrect) {
            correctPredictions++;
            currentStreak++;
            streakCount = Math.max(streakCount, currentStreak);
          } else {
            currentStreak = 0;
          }
          
          // Calcular bonus points (diferencia entre puntos finales y base)
          const basePoints = parseFloat(prediction.points || 0);
          const finalPoints = parseFloat(prediction.finalPoints || 0);
          bonusPoints += Math.max(0, finalPoints - basePoints);
        }
      });
      
      // Calcular ROI promedio
      const finishedPredictions = predictions.filter(p => p.result !== 'PENDING').length;
      const averageROI = finishedPredictions > 0 ? roiSum / finishedPredictions : 0;
      
      // Actualizar entrada
      await entry.update({
        totalScore: Math.round(totalScore * 100) / 100,
        correctPredictions,
        predictionsSubmitted: totalPredictions,
        bonusPoints: Math.round(bonusPoints * 100) / 100,
        roi: Math.round(averageROI * 100) / 100,
        streakCount
      });
      
      console.log(`✅ Totales actualizados para entrada ${entryId}: ${totalScore} puntos, ${correctPredictions}/${totalPredictions} aciertos`);
      
    } catch (error) {
      console.error('Error actualizando totales:', error);
      throw error;
    }
  }
  
  // =====================================================
  // ACTUALIZAR RANKINGS EN TIEMPO REAL
  // =====================================================
  static async updateTournamentRankings(tournamentId) {
    try {
      // Obtener todas las entradas ordenadas por puntuación
      const entries = await TournamentEntry.findAll({
        where: { tournamentId, status: 'ACTIVE' },
        order: [
          ['total_score', 'DESC'],
          ['roi', 'DESC'],
          ['correct_predictions', 'DESC'],
          ['created_at', 'ASC'] // Desempate por tiempo de inscripción
        ]
      });
      
      // Actualizar rankings
      for (let i = 0; i < entries.length; i++) {
        const newRank = i + 1;
        if (entries[i].currentRank !== newRank) {
          entries[i].currentRank = newRank;
          await entries[i].save();
        }
      }
      
      console.log(`✅ Rankings actualizados para torneo ${tournamentId}: ${entries.length} participantes`);
      
    } catch (error) {
      console.error('Error actualizando rankings:', error);
      throw error;
    }
  }
  
  // =====================================================
  // OBTENER ESTADÍSTICAS DE SCORING
  // =====================================================
  static async getScoringStats(tournamentId) {
    try {
      const predictions = await TournamentPrediction.findAll({
        where: { tournamentId, result: { [require('sequelize').Op.ne]: 'PENDING' } }
      });
      
      if (predictions.length === 0) {
        return {
          totalPredictions: 0,
          averagePoints: 0,
          highestScore: 0,
          averageOdds: 0,
          accuracyRate: 0
        };
      }
      
      const totalPoints = predictions.reduce((sum, p) => sum + parseFloat(p.finalPoints || 0), 0);
      const correctPredictions = predictions.filter(p => p.isCorrect).length;
      const totalOdds = predictions.reduce((sum, p) => sum + parseFloat(p.selectedOdds || 0), 0);
      const highestScore = Math.max(...predictions.map(p => parseFloat(p.finalPoints || 0)));
      
      return {
        totalPredictions: predictions.length,
        averagePoints: Math.round((totalPoints / predictions.length) * 100) / 100,
        highestScore: Math.round(highestScore * 100) / 100,
        averageOdds: Math.round((totalOdds / predictions.length) * 100) / 100,
        accuracyRate: Math.round((correctPredictions / predictions.length) * 100 * 100) / 100
      };
      
    } catch (error) {
      console.error('Error obteniendo estadísticas de scoring:', error);
      throw error;
    }
  }
}

module.exports = ScoringService;