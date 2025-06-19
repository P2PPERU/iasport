// test-config.js - Configuración base para todos los tests
const fetch = require('node-fetch');

const CONFIG = {
  BASE_URL: 'http://localhost:3001',
  
  // Tokens de autenticación
  TOKENS: {
    USER: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQzOTYyYjA3LTJlMjUtNDhkNi04ODE0LTFhM2UyYWFkZWRmZSIsImVtYWlsIjoianVhbjFAdGVzdC5jb20iLCJpc0FkbWluIjpmYWxzZSwiaXNQcmVtaXVtIjpmYWxzZSwiaWF0IjoxNzUwMzI5OTQ1LCJleHAiOjE3NTA5MzQ3NDV9.06NJBWxgZN8w28cBMBLr3Y25JbT-YgWS6WmsO4y1I4c',
    ADMIN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjQ1MGY1ZmExLWE5NDEtNDg4Yi1hYzI3LWVkMTQ4M2QyYWVmMSIsImVtYWlsIjoiYWRtaW4xQHRlc3QuY29tIiwiaXNBZG1pbiI6dHJ1ZSwiaXNQcmVtaXVtIjpmYWxzZSwiaWF0IjoxNzUwMzMxNzA3LCJleHAiOjE3NTA5MzY1MDd9.h1sUNnD-7iKh8k9VNsalZtHVREc6A_vBWndkj0E12C4'
  }
};

// Función helper para hacer requests
async function apiRequest(endpoint, options = {}) {
  const url = `${CONFIG.BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  };

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };

  console.log(`\n🔄 ${finalOptions.method} ${endpoint}`);
  if (finalOptions.body) {
    console.log('📤 Body:', JSON.parse(finalOptions.body));
  }

  try {
    const response = await fetch(url, finalOptions);
    const data = await response.json();
    
    console.log(`📊 Status: ${response.status}`);
    console.log('📥 Response:', data);
    
    return { status: response.status, data, success: response.ok };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { error: error.message, success: false };
  }
}

// Headers para usuarios autenticados
function getAuthHeaders(isAdmin = false) {
  const token = isAdmin ? CONFIG.TOKENS.ADMIN : CONFIG.TOKENS.USER;
  return {
    'Authorization': `Bearer ${token}`
  };
}

// Helper para esperar
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper para logs bonitos
function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`🧪 ${title}`);
  console.log('='.repeat(60));
}

function logSubsection(title) {
  console.log(`\n📋 ${title}`);
  console.log('-'.repeat(40));
}

module.exports = {
  CONFIG,
  apiRequest,
  getAuthHeaders,
  wait,
  logSection,
  logSubsection
};