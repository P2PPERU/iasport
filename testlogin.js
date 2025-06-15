async function testLogin() {
  try {
    // Login
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneOrEmail: 'admin@iasport.pe',
        password: 'admin123'
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Login exitoso!');
      console.log('👤 Usuario:', data.user.name);
      console.log('📧 Email:', data.user.email);
      console.log('👑 Admin:', data.user.isAdmin);
      console.log('🔑 Token:', data.token.substring(0, 50) + '...');
      
      // Ahora obtener predicciones con token
      console.log('\n📊 Obteniendo predicciones autenticado...');
      const predResponse = await fetch('http://localhost:3001/api/predictions', {
        headers: {
          'Authorization': `Bearer ${data.token}`
        }
      });
      
      const predictions = await predResponse.json();
      console.log(`✅ ${predictions.count} predicciones obtenidas`);
      
      // Mostrar la primera predicción premium
      const premiumPred = predictions.data.find(p => p.isPremium);
      if (premiumPred) {
        console.log('\n🌟 Predicción Premium desbloqueada:');
        console.log(`   ${premiumPred.match}`);
        console.log(`   ${premiumPred.prediction} - Cuota: ${premiumPred.odds}`);
      }
    } else {
      console.log('❌ Error:', data.message);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testLogin();