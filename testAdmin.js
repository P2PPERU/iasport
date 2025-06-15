async function testAdmin() {
  try {
    // 1. Login como admin
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneOrEmail: 'admin@iasport.pe',
        password: 'admin123'
      })
    });
    
    const { token } = await loginRes.json();
    console.log('✅ Login como admin exitoso');

    // 2. Obtener stats del dashboard
    const statsRes = await fetch('http://localhost:3001/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const stats = await statsRes.json();
    console.log('\n📊 Estadísticas del Dashboard:');
    console.log(stats.data);

    // 3. Obtener perfil
    const profileRes = await fetch('http://localhost:3001/api/users/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const profile = await profileRes.json();
    console.log('\n👤 Perfil del usuario:');
    console.log('Email:', profile.data.email);
    console.log('Admin:', profile.data.isAdmin);
    console.log('Preferencias:', profile.data.preferences);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAdmin();