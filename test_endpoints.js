const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000/api';

async function runTests() {
  console.log('--- Iniciando Tests del Backend ---');
  let token = null;
  let inmateId = null;

  try {
    // 1. Test Endpoint Protegido sin Token
    console.log('\n[Test 1] Accediendo a /api/inmates sin token...');
    const res1 = await fetch(`${API_URL}/inmates`);
    if (res1.status === 401) {
      console.log('✅ Éxito: El servidor denegó el acceso (401 Unauthorized)');
    } else {
      console.error(`❌ Fallo: Se esperaba 401, se obtuvo ${res1.status}`);
    }

    // 2. Test Login
    console.log('\n[Test 2] Iniciando sesión con admin...');
    const res2 = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    if (res2.status === 200) {
      const data = await res2.json();
      token = data.data.token;
      console.log('✅ Éxito: Login correcto. Token JWT obtenido.');
    } else {
      console.error(`❌ Fallo: Se esperaba 200, se obtuvo ${res2.status}`);
      return; // Detener tests si no hay login
    }

    // 3. Test Endpoint Protegido con Token
    console.log('\n[Test 3] Accediendo a /api/inmates con token...');
    const res3 = await fetch(`${API_URL}/inmates`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res3.status === 200) {
      console.log('✅ Éxito: Acceso concedido con token (200 OK)');
      const inmatesData = await res3.json();
      // Si hay un reo, lo usamos para el test GPS, sino creamo un test ficticio
      if (inmatesData.length > 0) {
          inmateId = inmatesData[0].id;
      }
    } else {
      console.error(`❌ Fallo: Se esperaba 200, se obtuvo ${res3.status}`);
    }

    // 4. Test GPS Out of Bounds
    console.log('\n[Test 4] Enviando coordenada GPS inválida (fuera de límites globales)...');
    const res4 = await fetch(`${API_URL}/gps/position`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 100, lng: -200, inmateId: '123' })
    });
    const data4 = await res4.json();
    if (res4.status === 400 && data4.error.message.includes('fuera de rango')) {
      console.log('✅ Éxito: El servidor rechazó la coordenada fuera de rango.');
    } else {
      console.error(`❌ Fallo: Se esperaba rechazo 400 por rango. Estado: ${res4.status}`);
    }
    
    console.log('\n--- Tests Finalizados ---');
  } catch (error) {
    console.error('Error ejecutando tests:', error);
  }
}

runTests();
