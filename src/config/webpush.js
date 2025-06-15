const webpush = require('web-push');

// Configurar VAPID keys
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  email: process.env.VAPID_EMAIL || 'mailto:admin@iasport.pe'
};

// Verificar que las keys existan
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  console.error('⚠️ VAPID keys no configuradas. Ejecuta generateVapidKeys.js');
}

// Configurar web-push
webpush.setVapidDetails(
  vapidKeys.email,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Configuración adicional
webpush.setGCMAPIKey(process.env.GCM_API_KEY || null);

module.exports = {
  webpush,
  vapidPublicKey: vapidKeys.publicKey
};