// checkServer.js - Diagnóstico del servidor
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkServer() {
  log('🔍 DIAGNÓSTICO DEL SERVIDOR', 'bold');
  log('===========================', 'cyan');

  // 1. Verificar si hay un proceso en el puerto 3001
  log('\n1️⃣ Verificando puerto 3001...', 'yellow');
  try {
    let portInUse = false;
    let portProcess = 'No encontrado';

    try {
      // Windows
      const result = execSync('netstat -ano | findstr :3001', { encoding: 'utf8' });
      if (result.trim()) {
        portInUse = true;
        portProcess = result.trim();
        log('   ✅ Puerto 3001 en uso:', 'green');
        log(`   📊 Proceso: ${portProcess}`, 'cyan');
      }
    } catch (error) {
      try {
        // Linux/Mac alternativo  
        const result = execSync('lsof -i :3001', { encoding: 'utf8' });
        if (result.trim()) {
          portInUse = true;
          portProcess = result.trim();
          log('   ✅ Puerto 3001 en uso:', 'green');
          log(`   📊 Proceso: ${portProcess}`, 'cyan');
        }
      } catch (error2) {
        // No pudo determinar
        log('   ⚠️ No se puede determinar el estado del puerto', 'yellow');
      }
    }

    if (!portInUse) {
      log('   ❌ Puerto 3001 NO está en uso', 'red');
      log('   💡 SOLUCIÓN: El servidor no está corriendo', 'yellow');
    }
  } catch (error) {
    log('   ⚠️ Error verificando puerto:', 'yellow');
    log(`   ${error.message}`, 'red');
  }

  // 2. Verificar archivos necesarios
  log('\n2️⃣ Verificando archivos del servidor...', 'yellow');
  
  const requiredFiles = [
    'server.js',
    'package.json',
    'src/models/index.js',
    '.env'
  ];

  let missingFiles = [];
  
  requiredFiles.forEach(file => {
    if (fs.existsSync(path.join(process.cwd(), file))) {
      log(`   ✅ ${file}`, 'green');
    } else {
      log(`   ❌ ${file} (FALTANTE)`, 'red');
      missingFiles.push(file);
    }
  });

  if (missingFiles.length > 0) {
    log('\n   💡 SOLUCIÓN: Archivos faltantes detectados', 'yellow');
    missingFiles.forEach(file => {
      log(`      - Crear: ${file}`, 'cyan');
    });
  }

  // 3. Verificar configuración de .env
  log('\n3️⃣ Verificando configuración .env...', 'yellow');
  
  try {
    require('dotenv').config();
    
    const requiredEnvVars = [
      'DB_HOST',
      'DB_PORT', 
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD'
    ];

    let envOK = true;
    requiredEnvVars.forEach(envVar => {
      if (process.env[envVar]) {
        log(`   ✅ ${envVar}`, 'green');
      } else {
        log(`   ❌ ${envVar} (FALTANTE)`, 'red');
        envOK = false;
      }
    });

    if (!envOK) {
      log('\n   💡 SOLUCIÓN: Variables de entorno faltantes', 'yellow');
      log('      Verifica tu archivo .env', 'cyan');
    }

  } catch (error) {
    log('   ❌ Error leyendo .env:', 'red');
    log(`   ${error.message}`, 'red');
  }

  // 4. Verificar dependencias
  log('\n4️⃣ Verificando dependencias...', 'yellow');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const dependencies = Object.keys(packageJson.dependencies || {});
    
    log(`   📦 Total dependencias: ${dependencies.length}`, 'cyan');
    
    // Verificar algunas críticas
    const criticalDeps = ['express', 'sequelize', 'pg', 'bcrypt'];
    criticalDeps.forEach(dep => {
      if (dependencies.includes(dep)) {
        log(`   ✅ ${dep}`, 'green');
      } else {
        log(`   ❌ ${dep} (FALTANTE)`, 'red');
      }
    });

    // Verificar node_modules
    if (fs.existsSync('node_modules')) {
      log('   ✅ node_modules presente', 'green');
    } else {
      log('   ❌ node_modules faltante', 'red');
      log('   💡 SOLUCIÓN: Ejecuta npm install', 'yellow');
    }

  } catch (error) {
    log('   ❌ Error verificando dependencias:', 'red');
    log(`   ${error.message}`, 'red');
  }

  // 5. Verificar procesos de Node
  log('\n5️⃣ Verificando procesos de Node.js...', 'yellow');
  
  try {
    const result = execSync('tasklist | findstr node', { encoding: 'utf8' });
    if (result.trim()) {
      log('   ✅ Procesos de Node.js encontrados:', 'green');
      const processes = result.trim().split('\n');
      processes.forEach(process => {
        log(`   📊 ${process.trim()}`, 'cyan');
      });
    } else {
      log('   ❌ No hay procesos de Node.js corriendo', 'red');
    }
  } catch (error) {
    try {
      // Alternativo para Linux/Mac
      const result = execSync('ps aux | grep node', { encoding: 'utf8' });
      if (result.trim()) {
        log('   ✅ Procesos de Node.js encontrados', 'green');
      }
    } catch (error2) {
      log('   ⚠️ No se pueden verificar procesos de Node.js', 'yellow');
    }
  }

  // 6. Instrucciones de solución
  log('\n6️⃣ INSTRUCCIONES DE SOLUCIÓN', 'bold');
  log('=============================', 'cyan');
  
  log('\n🚀 PASOS PARA ARRANCAR EL SERVIDOR:', 'yellow');
  log('', '');
  log('1. Asegúrate de estar en el directorio correcto:', 'cyan');
  log('   cd C:\\Users\\USER\\ia-sport-backend', 'blue');
  log('', '');
  log('2. Instalar dependencias (si no están):', 'cyan');
  log('   npm install', 'blue');
  log('', '');
  log('3. Verificar que PostgreSQL esté corriendo:', 'cyan');
  log('   net start postgresql-x64-14', 'blue');
  log('', '');
  log('4. ARRANCAR EL SERVIDOR:', 'cyan');
  log('   npm run dev', 'blue');
  log('   # O alternativamente:', 'green');
  log('   node server.js', 'blue');
  log('', '');
  log('5. Verificar que esté corriendo:', 'cyan');
  log('   curl http://localhost:3001/health', 'blue');
  log('   # O abrir en navegador: http://localhost:3001/health', 'green');
  log('', '');
  log('6. Si funciona, ejecutar el test:', 'cyan');
  log('   node simpleTest.js', 'blue');

  log('\n⚠️ PROBLEMAS COMUNES:', 'yellow');
  log('', '');
  log('• Puerto ocupado:', 'cyan');
  log('  - Mata procesos: taskkill /f /im node.exe', 'blue');
  log('  - O cambiar puerto en .env: PORT=3002', 'blue');
  log('', '');
  log('• Base de datos no conecta:', 'cyan');
  log('  - Verificar PostgreSQL: services.msc', 'blue');
  log('  - Verificar credenciales en .env', 'blue');
  log('', '');
  log('• Errores de dependencias:', 'cyan');
  log('  - Borrar node_modules y reinstalar', 'blue');
  log('  - npm cache clean --force', 'blue');
  log('  - npm install', 'blue');

  log('\n📞 SIGUIENTE PASO:', 'bold');
  log('Ejecuta: npm run dev', 'green');
  log('Luego en otra terminal: node simpleTest.js', 'green');
}

// Ejecutar
checkServer();