// firebase-messaging-sw.js - Service Worker pour notifications push
// Version mise à jour pour garantir l'affichage des notifications

// ============================================================
// FALLBACK: Listener push AVANT l'import de Firebase
// Cela garantit qu'on capture les events même si Firebase échoue
// ============================================================
self.addEventListener('push', function(event) {
  console.log('🔔 [SW PUSH] Event reçu:', event);
  
  // Empêcher le comportement par défaut de Firebase
  event.stopImmediatePropagation();
  
  let payload = {};
  
  try {
    if (event.data) {
      payload = event.data.json();
      console.log('📦 [SW PUSH] Payload:', JSON.stringify(payload));
    }
  } catch (e) {
    console.log('📦 [SW PUSH] Payload texte:', event.data ? event.data.text() : 'vide');
    payload = { 
      notification: { 
        title: 'Cabinet Médical', 
        body: event.data ? event.data.text() : 'Nouvelle notification' 
      } 
    };
  }
  
  // Extraire titre et corps - chercher dans notification ET data
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Cabinet Médical';
  const notificationBody = payload.notification?.body || payload.data?.body || 'Vous avez une nouvelle notification';
  const data = payload.data || {};
  
  console.log('📢 [SW PUSH] Titre:', notificationTitle);
  console.log('📢 [SW PUSH] Corps:', notificationBody);
  
  const notificationOptions = {
    body: notificationBody,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'cabinet-notif-' + Date.now(),
    requireInteraction: true,
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: data
  };

  // FORCER l'affichage de la notification
  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
      .then(() => {
        console.log('✅ [SW PUSH] Notification affichée avec succès!');
      })
      .catch(err => {
        console.error('❌ [SW PUSH] Erreur showNotification:', err);
      })
  );
});

// ============================================================
// FIREBASE SDK - Configuration et onBackgroundMessage
// ============================================================
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAyFIWDwfSGmcLzfPpPL_qo1w5Vxm6ctS4",
  authDomain: "cabinet-medical-ope.firebaseapp.com",
  projectId: "cabinet-medical-ope",
  storageBucket: "cabinet-medical-ope.appspot.com",
  messagingSenderId: "752001506338",
  appId: "1:752001506338:web:2eb60761bd9d7c00973e7b"
};

let messaging = null;
try {
  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
  console.log('✅ [SW] Firebase Messaging initialisé');
} catch (error) {
  console.error('❌ [SW] Erreur init Firebase:', error);
}

// Handler Firebase pour les messages en arrière-plan
if (messaging) {
  messaging.onBackgroundMessage(function(payload) {
    console.log('📩 [SW onBackgroundMessage] Reçu:', payload);
    
    const notificationTitle = payload.notification?.title || payload.data?.title || 'Cabinet Médical';
    const notificationBody = payload.notification?.body || payload.data?.body || 'Nouvelle notification';
    
    const notificationOptions = {
      body: notificationBody,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'cabinet-bg-' + Date.now(),
      requireInteraction: true,
      renotify: true,
      data: payload.data || {}
    };

    console.log('📢 [SW onBackgroundMessage] Affichage:', notificationTitle);
    
    // Appel EXPLICITE à showNotification
    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// ============================================================
// GESTION DES CLICS SUR NOTIFICATIONS
// ============================================================
self.addEventListener('notificationclick', function(event) {
  console.log('👆 [SW] Clic sur notification:', event);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const targetUrl = data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Chercher une fenêtre existante
        for (let client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Sinon ouvrir une nouvelle fenêtre
        return clients.openWindow(targetUrl);
      })
  );
});

// ============================================================
// INSTALLATION ET ACTIVATION DU SERVICE WORKER
// ============================================================
self.addEventListener('install', function(event) {
  console.log('🔧 [SW] Installation...');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('✅ [SW] Activation...');
  event.waitUntil(clients.claim());
});

// Écouter les messages du client
self.addEventListener('message', function(event) {
  console.log('💬 [SW] Message reçu:', event.data);
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('🚀 [SW] Firebase Messaging Service Worker chargé');
