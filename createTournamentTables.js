// createTournamentTables.js - Migración para crear todas las tablas de torneos
require('dotenv').config();
const { sequelize } = require('./src/models');

async function createTournamentTables() {
  try {
    console.log('🏗️ Creando tablas para PredictMaster...\n');

    // 1. Crear tabla de ligas
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS leagues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) UNIQUE NOT NULL,
        level INTEGER UNIQUE NOT NULL,
        min_tournaments INTEGER NOT NULL DEFAULT 0,
        min_roi DECIMAL(5,2),
        min_success_rate DECIMAL(5,2),
        benefits JSONB DEFAULT '{"freerollAccess": [], "discountPercentage": 0, "specialTournaments": false, "premiumSupport": false}',
        color VARCHAR(7) NOT NULL,
        icon VARCHAR(50) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla leagues creada');

    // 2. Crear tabla de torneos
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(20) NOT NULL CHECK (type IN ('HYPER_TURBO', 'DAILY_CLASSIC', 'WEEKLY_MASTERS', 'FREEROLL', 'SPECIAL')),
        buy_in DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(3) DEFAULT 'PEN',
        max_players INTEGER NOT NULL,
        current_players INTEGER DEFAULT 0,
        prize_pool DECIMAL(10,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'REGISTRATION', 'ACTIVE', 'FINISHED', 'CANCELLED')),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        registration_deadline TIMESTAMP NOT NULL,
        predictions_count INTEGER NOT NULL DEFAULT 4,
        payout_structure JSONB DEFAULT '{"1": 50, "2": 30, "3": 20}',
        rules JSONB DEFAULT '{"scoring": "CONFIDENCE_BASED", "bonusMultipliers": {"streak": 1.1, "perfectPick": 1.5, "roi": 1.15}}',
        is_hot BOOLEAN DEFAULT FALSE,
        is_featured BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla tournaments creada');

    // 3. Crear tabla de entradas de torneo
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS tournament_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        buy_in_paid DECIMAL(10,2) NOT NULL,
        payment_id UUID REFERENCES payments(id),
        current_rank INTEGER,
        final_rank INTEGER,
        total_score DECIMAL(10,2) DEFAULT 0.00,
        predictions_submitted INTEGER DEFAULT 0,
        correct_predictions INTEGER DEFAULT 0,
        roi DECIMAL(8,4) DEFAULT 0.0000,
        streak_count INTEGER DEFAULT 0,
        bonus_points DECIMAL(10,2) DEFAULT 0.00,
        prize_won DECIMAL(10,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ELIMINATED', 'FINISHED')),
        eliminated_at TIMESTAMP,
        statistics JSONB DEFAULT '{"predictionsByType": {}, "accuracyRate": 0, "averageOdds": 0, "bestStreak": 0, "worstStreak": 0}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, tournament_id)
      );
    `);
    console.log('✅ Tabla tournament_entries creada');

    // 4. Crear tabla de predicciones de torneo
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS tournament_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        entry_id UUID NOT NULL REFERENCES tournament_entries(id) ON DELETE CASCADE,
        base_prediction_id UUID REFERENCES predictions(id),
        league VARCHAR(100) NOT NULL,
        match VARCHAR(255) NOT NULL,
        home_team VARCHAR(100) NOT NULL,
        away_team VARCHAR(100) NOT NULL,
        user_prediction VARCHAR(255) NOT NULL,
        prediction_type VARCHAR(20) NOT NULL,
        selected_odds DECIMAL(10,2) NOT NULL,
        confidence INTEGER NOT NULL CHECK (confidence >= 1 AND confidence <= 100),
        match_time TIMESTAMP NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        result VARCHAR(20) DEFAULT 'PENDING' CHECK (result IN ('WON', 'LOST', 'VOID', 'PENDING')),
        points DECIMAL(10,2) DEFAULT 0.00,
        bonus_multiplier DECIMAL(4,2) DEFAULT 1.00,
        final_points DECIMAL(10,2) DEFAULT 0.00,
        is_correct BOOLEAN DEFAULT FALSE,
        roi_contribution DECIMAL(8,4) DEFAULT 0.0000,
        sequence_number INTEGER NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tournament_id, user_id, sequence_number)
      );
    `);
    console.log('✅ Tabla tournament_predictions creada');

    // 5. Crear tabla de estadísticas de usuario
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS user_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        league_id UUID REFERENCES leagues(id),
        total_tournaments INTEGER DEFAULT 0,
        active_tournaments INTEGER DEFAULT 0,
        won_tournaments INTEGER DEFAULT 0,
        top3_finishes INTEGER DEFAULT 0,
        total_earnings DECIMAL(10,2) DEFAULT 0.00,
        total_spent DECIMAL(10,2) DEFAULT 0.00,
        net_profit DECIMAL(10,2) DEFAULT 0.00,
        roi DECIMAL(8,4) DEFAULT 0.0000,
        total_predictions INTEGER DEFAULT 0,
        correct_predictions INTEGER DEFAULT 0,
        success_rate DECIMAL(5,2) DEFAULT 0.00,
        average_odds DECIMAL(8,4) DEFAULT 0.0000,
        average_confidence DECIMAL(5,2) DEFAULT 0.00,
        global_rank INTEGER,
        monthly_rank INTEGER,
        weekly_rank INTEGER,
        current_streak INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        worst_streak INTEGER DEFAULT 0,
        monthly_stats JSONB DEFAULT '{"tournaments": 0, "predictions": 0, "correct": 0, "earnings": 0, "spent": 0}',
        weekly_stats JSONB DEFAULT '{"tournaments": 0, "predictions": 0, "correct": 0, "earnings": 0, "spent": 0}',
        tournament_type_stats JSONB DEFAULT '{}',
        sport_stats JSONB DEFAULT '{}',
        last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla user_stats creada');

    // 6. Crear índices para mejor performance
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tournament_entries_tournament_score ON tournament_entries(tournament_id, total_score DESC);
      CREATE INDEX IF NOT EXISTS idx_tournament_entries_tournament_rank ON tournament_entries(tournament_id, current_rank);
      CREATE INDEX IF NOT EXISTS idx_tournament_predictions_entry ON tournament_predictions(entry_id);
      CREATE INDEX IF NOT EXISTS idx_tournament_predictions_result ON tournament_predictions(tournament_id, result);
      CREATE INDEX IF NOT EXISTS idx_user_stats_global_rank ON user_stats(global_rank);
      CREATE INDEX IF NOT EXISTS idx_user_stats_monthly_rank ON user_stats(monthly_rank);
      CREATE INDEX IF NOT EXISTS idx_user_stats_success_rate ON user_stats(success_rate);
      CREATE INDEX IF NOT EXISTS idx_user_stats_roi ON user_stats(roi);
      CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
      CREATE INDEX IF NOT EXISTS idx_tournaments_start_time ON tournaments(start_time);
    `);
    console.log('✅ Índices creados');

    // 7. Insertar ligas por defecto
    await sequelize.query(`
      INSERT INTO leagues (name, level, min_tournaments, min_roi, min_success_rate, color, icon, description) VALUES
      ('Bronze', 1, 0, NULL, NULL, '#CD7F32', 'fas fa-shield-alt', 'Liga inicial para nuevos jugadores'),
      ('Silver', 2, 11, NULL, NULL, '#C0C0C0', 'fas fa-shield-alt', 'Para jugadores con experiencia básica'),
      ('Gold', 3, 31, NULL, 55.0, '#FFD700', 'fas fa-award', 'Para predictores competentes'),
      ('Platinum', 4, 100, 10.0, 60.0, '#E5E4E2', 'fas fa-gem', 'Elite de predictores'),
      ('Legend', 5, 200, 25.0, 70.0, '#9932CC', 'fas fa-crown', 'Los mejores predictores del mundo')
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('✅ Ligas por defecto insertadas');

    // 8. Crear función para actualizar updated_at automáticamente
    await sequelize.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Aplicar triggers a las nuevas tablas
    const tables = ['tournaments', 'tournament_entries', 'tournament_predictions', 'user_stats'];
    for (const table of tables) {
      await sequelize.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
    }
    console.log('✅ Triggers de updated_at creados');

    // 9. Crear un torneo freeroll de ejemplo
    await sequelize.query(`
      INSERT INTO tournaments (
        name, description, type, buy_in, max_players, start_time, end_time, 
        registration_deadline, predictions_count, is_featured
      ) VALUES (
        'Freeroll Bienvenida',
        'Torneo gratuito para nuevos usuarios - ¡Gana hasta S/ 500!',
        'FREEROLL',
        0.00,
        100,
        CURRENT_TIMESTAMP + INTERVAL '2 hours',
        CURRENT_TIMESTAMP + INTERVAL '8 hours',
        CURRENT_TIMESTAMP + INTERVAL '1.5 hours',
        4,
        TRUE
      ) ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Torneo freeroll de ejemplo creado');

    console.log('\n🎉 PREDICTMASTER BACKEND COMPLETADO!');
    console.log('==========================================');
    console.log('✅ 5 nuevas tablas creadas');
    console.log('✅ Índices para performance');
    console.log('✅ Ligas por defecto');
    console.log('✅ Triggers automáticos');
    console.log('✅ Torneo de ejemplo');
    console.log('\n🚀 Listo para crear tu plataforma de torneos de pronósticos!');

  } catch (error) {
    console.error('❌ Error creando tablas:', error);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  createTournamentTables();
}

module.exports = createTournamentTables;