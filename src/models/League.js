// src/models/League.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const League = sequelize.define('League', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  level: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  minTournaments: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'min_tournaments'
  },
  minROI: {
    type: DataTypes.DECIMAL(5, 2),
    field: 'min_roi'
  },
  minSuccessRate: {
    type: DataTypes.DECIMAL(5, 2),
    field: 'min_success_rate'
  },
  benefits: {
    type: DataTypes.JSONB,
    defaultValue: {
      freerollAccess: [],
      discountPercentage: 0,
      specialTournaments: false,
      premiumSupport: false
    }
  },
  color: {
    type: DataTypes.STRING(7), // Hex color
    allowNull: false
  },
  icon: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'leagues',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Método estático para obtener la liga de un usuario
League.getUserLeague = async function(userId) {
  const { TournamentEntry } = require('./index');
  
  // Obtener estadísticas del usuario
  const userStats = await TournamentEntry.findAll({
    where: { userId },
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalTournaments'],
      [sequelize.fn('AVG', sequelize.col('roi')), 'avgROI'],
      [sequelize.fn('AVG', 
        sequelize.literal('CASE WHEN correct_predictions > 0 THEN (correct_predictions::float / predictions_submitted::float) * 100 ELSE 0 END')
      ), 'successRate']
    ],
    raw: true
  });

  if (!userStats[0] || userStats[0].totalTournaments === 0) {
    // Usuario nuevo - Liga Bronze
    return await League.findOne({ where: { level: 1 } });
  }

  const { totalTournaments, avgROI, successRate } = userStats[0];

  // Buscar la liga más alta que califica
  const leagues = await League.findAll({
    order: [['level', 'DESC']],
    where: { isActive: true }
  });

  for (const league of leagues) {
    const qualifies = 
      totalTournaments >= league.minTournaments &&
      (league.minROI === null || avgROI >= league.minROI) &&
      (league.minSuccessRate === null || successRate >= league.minSuccessRate);
    
    if (qualifies) {
      return league;
    }
  }

  // Si no califica para ninguna, devolver la más baja
  return await League.findOne({ where: { level: 1 } });
};

module.exports = League;