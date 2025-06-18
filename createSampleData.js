// createSampleData.js - ARCHIVO QUE FALTABA
require('dotenv').config();
const { sequelize, User } = require('./src/models');
const bcrypt = require('bcrypt');

async function createSampleData() {
  try {
    console.log('🎲 Verificando usuarios de ejemplo...');

    await sequelize.authenticate();
    
    // Verificar si el usuario premium existe
    const existingPremium = await User.findOne({ 
      where: { email: 'premium@predictmaster.pe' } 
    });

    if (existingPremium) {
      console.log('✅ Usuario premium ya existe');
      
      // Asegurar que esté configurado como premium
      if (!existingPremium.isPremium) {
        existingPremium.isPremium = true;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        existingPremium.premiumExpiresAt = expiresAt;
        await existingPremium.save();
        console.log('✅ Usuario premium actualizado');
      }
    } else {
      // Crear usuario premium con teléfono único
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      // Buscar un teléfono que no esté usado
      let phoneNumber = '51999000003';
      let phoneExists = await User.findOne({ where: { phone: phoneNumber } });
      
      let counter = 4;
      while (phoneExists) {
        phoneNumber = `5199900000${counter}`;
        phoneExists = await User.findOne({ where: { phone: phoneNumber } });
        counter++;
      }

      await User.create({
        name: 'Usuario Premium',
        phone: phoneNumber,
        email: 'premium@predictmaster.pe',
        password: await bcrypt.hash('premium123', 10),
        isAdmin: false,
        isPremium: true,
        premiumExpiresAt: expiresAt,
        isVerified: true,
        freeViewsLeft: 999,
        preferences: {
          notifications: true,
          favoriteTeams: [],
          favoriteSports: ['football']
        }
      });
      
      console.log('✅ Usuario premium creado con teléfono:', phoneNumber);
    }

    console.log('✅ Datos de ejemplo verificados');
    return true;

  } catch (error) {
    console.error('❌ Error en createSampleData:', error.message);
    return false;
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  createSampleData();
}

module.exports = createSampleData;