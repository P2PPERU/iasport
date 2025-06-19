// createWalletTables.js - Crear tablas del sistema de wallet
require('dotenv').config();
const { sequelize } = require('./src/models');

async function createWalletTables() {
  try {
    console.log('💰 CREANDO TABLAS DEL SISTEMA DE WALLET...\n');

    // 1. Crear tabla de wallets
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        total_deposits DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        total_withdrawals DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        total_winnings DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        total_spent DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(3) NOT NULL DEFAULT 'PEN',
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        last_transaction_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla wallets creada');

    // 2. Crear tabla de transacciones
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('DEBIT', 'CREDIT')),
        category VARCHAR(50) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        balance_before DECIMAL(10, 2) NOT NULL,
        balance_after DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        description TEXT,
        reference VARCHAR(100),
        external_reference VARCHAR(100) UNIQUE,
        metadata JSONB DEFAULT '{}',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla wallet_transactions creada');

    // 3. Crear tabla de solicitudes de depósito
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS deposit_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        method VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        transaction_number VARCHAR(50),
        proof_image_url VARCHAR(500),
        wallet_transaction_id UUID REFERENCES wallet_transactions(id),
        admin_notes TEXT,
        processed_by UUID REFERENCES users(id),
        processed_at TIMESTAMP,
        expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla deposit_requests creada');

    // 4. Crear tabla de solicitudes de retiro
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        method VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        account_number VARCHAR(50) NOT NULL,
        account_name VARCHAR(100) NOT NULL,
        wallet_transaction_id UUID NOT NULL REFERENCES wallet_transactions(id),
        external_transaction_id VARCHAR(100),
        admin_notes TEXT,
        processed_by UUID REFERENCES users(id),
        processed_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla withdrawal_requests creada');

    // 5. Agregar columna wallet_transaction_id a tournament_entries si no existe
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'tournament_entries' 
          AND column_name = 'wallet_transaction_id'
        ) THEN
          ALTER TABLE tournament_entries 
          ADD COLUMN wallet_transaction_id UUID REFERENCES wallet_transactions(id);
          
          CREATE INDEX idx_tournament_entries_wallet_transaction_id 
          ON tournament_entries(wallet_transaction_id);
        END IF;
      END $$;
    `);
    console.log('✅ Columna wallet_transaction_id agregada a tournament_entries');

    // 6. Crear índices para mejor performance
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON deposit_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(status);
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
    `);
    console.log('✅ Índices creados');

    // 7. Crear función para actualizar updated_at automáticamente
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
    const tables = ['wallets', 'wallet_transactions', 'deposit_requests', 'withdrawal_requests'];
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

    // 8. Crear wallets para usuarios existentes
    await sequelize.query(`
      INSERT INTO wallets (user_id, balance, status, currency, created_at, updated_at)
      SELECT id, 0.00, 'ACTIVE', 'PEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM users
      WHERE id NOT IN (SELECT user_id FROM wallets)
      ON CONFLICT (user_id) DO NOTHING;
    `);
    console.log('✅ Wallets creadas para usuarios existentes');

    // 9. Agregar saldo inicial a usuarios de prueba
    await sequelize.query(`
      UPDATE wallets
      SET balance = 300.00, total_deposits = 300.00
      FROM users
      WHERE wallets.user_id = users.id
      AND (users.email = 'premium@test.com' OR users.email = 'admin@iasport.pe')
      AND wallets.balance = 0;
    `);
    console.log('✅ Saldo inicial agregado a usuarios de prueba');

    console.log('\n🎉 SISTEMA DE WALLET COMPLETADO!');
    console.log('================================');
    console.log('✅ 4 nuevas tablas creadas');
    console.log('✅ Índices para performance');
    console.log('✅ Triggers automáticos');
    console.log('✅ Wallets inicializadas');
    console.log('\n🚀 Listo para usar el sistema de wallet!');

  } catch (error) {
    console.error('❌ Error creando tablas:', error);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  createWalletTables();
}

module.exports = createWalletTables;