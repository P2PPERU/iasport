// createWalletTables.js - Crear tablas para el sistema de wallet
require('dotenv').config();
const { sequelize } = require('./src/models');

async function createWalletTables() {
  try {
    console.log('🏗️ CREANDO TABLAS PARA SISTEMA DE WALLET...\n');

    // 1. Conectar a la base de datos
    console.log('📡 Conectando a PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Conectado exitosamente\n');

    // 2. Crear tipos ENUM
    console.log('🔧 Creando tipos ENUM...');
    
    // ENUM para status de wallet
    try {
      await sequelize.query(`
        CREATE TYPE enum_wallets_status AS ENUM (
          'ACTIVE', 
          'FROZEN', 
          'CLOSED'
        );
      `);
      console.log('   ✅ enum_wallets_status creado');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️ enum_wallets_status ya existe');
      } else {
        throw error;
      }
    }

    // ENUM para tipo de transacción
    try {
      await sequelize.query(`
        CREATE TYPE enum_wallet_transactions_type AS ENUM (
          'DEBIT', 
          'CREDIT'
        );
      `);
      console.log('   ✅ enum_wallet_transactions_type creado');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️ enum_wallet_transactions_type ya existe');
      } else {
        throw error;
      }
    }

    // ENUM para categoría de transacción
    try {
      await sequelize.query(`
        CREATE TYPE enum_wallet_transactions_category AS ENUM (
          'DEPOSIT',
          'WITHDRAWAL', 
          'TOURNAMENT_ENTRY',
          'TOURNAMENT_PRIZE',
          'TOURNAMENT_REFUND',
          'BONUS',
          'FEE',
          'ADMIN_ADJUSTMENT'
        );
      `);
      console.log('   ✅ enum_wallet_transactions_category creado');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️ enum_wallet_transactions_category ya existe');
      } else {
        throw error;
      }
    }

    // ENUM para status de transacción
    try {
      await sequelize.query(`
        CREATE TYPE enum_wallet_transactions_status AS ENUM (
          'PENDING', 
          'COMPLETED', 
          'FAILED', 
          'CANCELLED', 
          'REVERSED'
        );
      `);
      console.log('   ✅ enum_wallet_transactions_status creado');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️ enum_wallet_transactions_status ya existe');
      } else {
        throw error;
      }
    }

    // 3. Crear tabla wallets
    console.log('\n🏦 Creando tabla wallets...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_deposits DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_withdrawals DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_winnings DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_spent DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(3) NOT NULL DEFAULT 'PEN',
        status enum_wallets_status NOT NULL DEFAULT 'ACTIVE',
        last_transaction_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla wallets creada');

    // 4. Crear tabla wallet_transactions
    console.log('\n💸 Creando tabla wallet_transactions...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
        type enum_wallet_transactions_type NOT NULL,
        category enum_wallet_transactions_category NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        balance_before DECIMAL(10,2) NOT NULL,
        balance_after DECIMAL(10,2) NOT NULL,
        status enum_wallet_transactions_status NOT NULL DEFAULT 'PENDING',
        description VARCHAR(255),
        reference VARCHAR(100),
        external_reference VARCHAR(100) UNIQUE,
        metadata JSONB DEFAULT '{}',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla wallet_transactions creada');

    // 5. Crear tabla deposit_requests
    console.log('\n📥 Creando tabla deposit_requests...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS deposit_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        method VARCHAR(20) NOT NULL CHECK (method IN ('YAPE', 'PLIN', 'BANK_TRANSFER')),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
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

    // 6. Crear tabla withdrawal_requests
    console.log('\n📤 Creando tabla withdrawal_requests...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        method VARCHAR(20) NOT NULL CHECK (method IN ('YAPE', 'PLIN', 'BANK_TRANSFER')),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED')),
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

    // 7. Crear índices para mejor performance
    console.log('\n🔗 Creando índices...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
      CREATE INDEX IF NOT EXISTS idx_wallets_status ON wallets(status);
      
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_category ON wallet_transactions(category);
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference);
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);
      
      CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON deposit_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_deposit_requests_wallet_id ON deposit_requests(wallet_id);
      CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(status);
      CREATE INDEX IF NOT EXISTS idx_deposit_requests_created_at ON deposit_requests(created_at);
      
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_wallet_id ON withdrawal_requests(wallet_id);
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON withdrawal_requests(created_at);
    `);
    console.log('✅ Índices creados');

    // 8. Crear función para actualizar updated_at automáticamente
    console.log('\n⚡ Creando triggers...');
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
    console.log('✅ Triggers creados');

    // 9. Agregar columna wallet_transaction_id a tournament_entries
    console.log('\n🔄 Agregando columna wallet_transaction_id a tournament_entries...');
    
    // Verificar si la columna ya existe
    const [checkResult] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tournament_entries' 
      AND column_name = 'wallet_transaction_id'
    `);

    if (checkResult.length > 0) {
      console.log('✅ La columna wallet_transaction_id ya existe');
    } else {
      await sequelize.query(`
        ALTER TABLE tournament_entries 
        ADD COLUMN wallet_transaction_id UUID REFERENCES wallet_transactions(id)
      `);
      console.log('✅ Columna wallet_transaction_id agregada a tournament_entries');
      
      await sequelize.query(`
        CREATE INDEX idx_tournament_entries_wallet_transaction_id 
        ON tournament_entries(wallet_transaction_id)
      `);
      console.log('✅ Índice creado para wallet_transaction_id');
    }

    console.log('\n🎉 TABLAS DE WALLET CREADAS EXITOSAMENTE!');
    console.log('=====================================');
    console.log('✅ 4 nuevas tablas creadas');
    console.log('✅ Índices para performance');
    console.log('✅ Triggers automáticos');
    console.log('✅ Integración con tournament_entries');
    console.log('\n🚀 Listo para usar el sistema de wallet!');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    
    if (error.message.includes('permission denied')) {
      console.log('\n🔧 Error de permisos en PostgreSQL');
      console.log('   Verifica que estás usando el usuario correcto en .env');
    } else if (error.message.includes('does not exist')) {
      console.log('\n🔧 Error: Alguna tabla o tipo no existe');
      console.log('   Asegúrate de que la base de datos esté correctamente configurada');
    } else {
      console.log('\n🔧 Error de PostgreSQL:');
      console.log(`   ${error.message}`);
    }
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  createWalletTables();
}

module.exports = createWalletTables;