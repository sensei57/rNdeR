// firebase-messaging-sw.js - Service Worker pour notifications push
// Version simplifiée sans SDK Firebase pour garantir l'affichage

console.log('🚀 [SW] Chargement du Service Worker...');

// ============================================================
// LISTENER PUSH - Gère TOUTES les notifications entrantes
// ============================================================
self.addEventListener('push', function(event) {
  console.log('🔔 [SW] Push event reçu!');
  
  let notificationTitle = 'Cabinet Médical';
  let notificationBody = 'Vous avez une nouvelle notification';
  let notificationData = {};
  
  try {
    if (event.data) {
      const payload = event.data.json();
      console.log('📦 [SW] Payload JSON:', JSON.stringify(payload, null, 2));
      
      // Firebase envoie les données dans notification et/ou data
      if (payload.notification) {
        notificationTitle = payload.notification.title || notificationTitle;
        notificationBody = payload.notification.body || notificationBody;
      }
      
      if (payload.data) {
        // Backup: title et body peuvent aussi être dans data
        notificationTitle = payload.data.title || notificationTitle;
        notificationBody = payload.data.body || notificationBody;
        notificationData = payload.data;
      }
    } else {
      console.log('⚠️ [SW] Pas de données dans le push event');
    }
  } catch (e) {
    console.error('❌ [SW] Erreur parsing payload:', e);
    // Essayer de récupérer le texte brut
    if (event.data) {
      try {
        notificationBody = event.data.text();
      } catch (e2) {
        console.error('❌ [SW] Impossible de lire les données');
      }
    }
  }
  
  console.log('📢 [SW] Affichage notification:');
  console.log('   Titre:', notificationTitle);
  console.log('   Corps:', notificationBody);
  
  const options = {
    body: notificationBody,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'cabinet-' + Date.now(),
    requireInteraction: true,
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: notificationData
  };

  // FORCER l'affichage - c'est la ligne CRITIQUE
  const promiseChain = self.registration.showNotification(notificationTitle, options)
    .then(function() {
      console.log('✅ [SW] Notification affichée avec succès!');
    })
    .catch(function(err) {
      console.error('❌ [SW] Erreur showNotification:', err);
    });
    
  event.waitUntil(promiseChain);
});

// ============================================================
// GESTION DES CLICS SUR NOTIFICATIONS
// ============================================================
self.addEventListener('notificationclick', function(event) {
  console.log('👆 [SW] Clic sur notification');
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow('/');
      })
  );
});

// ============================================================
// INSTALLATION ET ACTIVATION
// ============================================================
self.addEventListener('install', function(event) {
  console.log('🔧 [SW] Installation');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('✅ [SW] Activation');
  event.waitUntil(clients.claim());
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('✅ [SW] Service Worker prêt pour les notifications');
