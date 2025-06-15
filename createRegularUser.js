require('dotenv').config();
const bcrypt = require('bcrypt');
const { User } = require('./src/models');

async function createRegularUser() {
  try {
    // Crear usuario regular
    const hashedPassword = await bcrypt.hash('juan123', 10);
    
    const user = await User.create({
      name: 'Juan Pérez',
      phone: '51987654321',
      email: 'juan@example.com',
      password: hashedPassword,
      isAdmin: false,
      isPremium: false,
      isVerified: true,
      preferences: {
        notifications: true,
        favoriteTeams: ['Alianza Lima', 'Real Madrid'],
        favoriteSports: ['football', 'basketball']
      }
    });
    
    console.log('✅ Usuario regular creado:');
    console.log('   Email:', user.email);
    console.log('   Teléfono:', user.phone);
    console.log('   Contraseña: juan123');
    
    // Mostrar todos los usuarios
    const allUsers = await User.findAll({
      attributes: ['name', 'email', 'phone', 'isAdmin', 'isPremium']
    });
    
    console.log('\n📋 Todos los usuarios:');
    console.table(allUsers.map(u => u.toJSON()));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit();
  }
}

createRegularUser();