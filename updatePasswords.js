require('dotenv').config();
const bcrypt = require('bcrypt');
const { User } = require('./src/models');

async function updatePasswords() {
  try {
    // Hashear las contraseñas
    const adminHash = await bcrypt.hash('admin123', 10);
    const demoHash = await bcrypt.hash('demo123', 10);

    // Actualizar usuario admin
    const adminUpdate = await User.update(
      { password: adminHash },
      { where: { email: 'admin@iasport.pe' } }
    );

    // Actualizar usuario demo
    const demoUpdate = await User.update(
      { password: demoHash },
      { where: { email: 'demo@example.com' } }
    );

    console.log('✅ Contraseñas actualizadas:');
    console.log('   - admin@iasport.pe → admin123');
    console.log('   - demo@example.com → demo123');

    // Verificar
    const users = await User.findAll({
      attributes: ['email', 'phone', 'isAdmin', 'isVerified']
    });
    
    console.log('\n📋 Usuarios en la BD:');
    console.table(users.map(u => u.toJSON()));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

updatePasswords();