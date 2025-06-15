async function testDebug() {
  try {
    // 1. Ver todos los endpoints
    console.log('🔍 Verificando endpoints...\n');
    
    const mainRes = await fetch('http://localhost:3001/');
    const mainData = await mainRes.json();
    console.log('Endpoints disponibles:', JSON.stringify(mainData.endpoints, null, 2));
    
    // 2. Login como admin
    console.log('\n🔐 Login como admin...');
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneOrEmail: 'admin@iasport.pe',
        password: 'admin123'
      })
    });
    
    const loginData = await loginRes.json();
    console.log('Login response:', loginData.success ? 'Exitoso' : 'Fallido');
    const token = loginData.token;
    
    // 3. Intentar acceder a admin/stats
    console.log('\n📊 Intentando acceder a /api/admin/stats...');
    const statsRes = await fetch('http://localhost:3001/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Status:', statsRes.status);
    console.log('Headers:', statsRes.headers.get('content-type'));
    
    const statsText = await statsRes.text();
    console.log('Response raw:', statsText);
    
    // 4. Verificar predicciones con token
    console.log('\n🎯 Obteniendo predicciones CON token...');
    const predRes = await fetch('http://localhost:3001/api/predictions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const predData = await predRes.json();
    console.log('Predicciones obtenidas:', predData.count);
    console.log('Primera predicción premium:');
    const premiumPred = predData.data.find(p => p.isPremium);
    console.log('- Prediction:', premiumPred?.prediction);
    console.log('- Odds:', premiumPred?.odds);
    console.log('- Confidence:', premiumPred?.confidence);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDebug();