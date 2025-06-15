const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

console.log('🔑 Generando VAPID Keys para Push Notifications...\n');

// Generar keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ Keys generadas exitosamente!\n');
console.log('📋 Copia estas líneas en tu archivo .env:\n');
console.log('# Push Notification Keys');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:admin@iasport.pe`);
console.log('\n');

// Verificar si existe .env
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

if (envExists) {
  console.log('💡 Tu archivo .env existe. Agrega las keys manualmente.');
  console.log('⚠️  NO compartas las PRIVATE KEYS con nadie.\n');
} else {
  console.log('📝 No se encontró archivo .env');
  console.log('   Crea uno con las keys mostradas arriba.\n');
}

// Crear archivo de ejemplo
const exampleContent = `# Push Notification Keys (EJEMPLO - GENERA TUS PROPIAS)
# Ejecuta: node generateVapidKeys.js
VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
VAPID_EMAIL=mailto:admin@iasport.pe

# IMPORTANTE: 
# - La PUBLIC_KEY se usa en el frontend
# - La PRIVATE_KEY NUNCA debe exponerse
# - Regenera las keys para producción
`;

fs.writeFileSync('.env.push.example', exampleContent);
console.log('📄 Archivo .env.push.example creado como referencia');
console.log('\n🔒 Seguridad:');
console.log('   - NUNCA subas las PRIVATE KEYS a git');
console.log('   - Agrega .env a .gitignore');
console.log('   - Usa keys diferentes para producción\n');