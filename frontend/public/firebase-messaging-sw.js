// firebase-messaging-sw.js - Service Worker avec support des réponses rapides
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// URL de l'API backend
const API_BASE_URL = self.location.origin;

// Configuration Firebase avec les vraies clés
const firebaseConfig = {
  apiKey: "AIzaSyAyFIWDwfSGmcLzfPpPL_qo1w5Vxm6ctS4",
  authDomain: "cabinet-medical-ope.firebaseapp.com",
  projectId: "cabinet-medical-ope",
  storageBucket: "cabinet-medical-ope.appspot.com",
  messagingSenderId: "752001506338",
  appId: "1:752001506338:web:2eb60761bd9d7c00973e7b"
};

// Clé VAPID pour l'authentification des notifications push
const VAPID_KEY = 'BLDFCJN6pePvpIaVCTQtAhcwNhlusiMzFjPDdzll12vBWZcvkYJ4Bc60R9RSBcTx-hpqwT3ngTWn4lgVh4qQS-E';

// Initialiser Firebase immédiatement (synchrone)
let messaging = null;
try {
  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
  console.log('✅ Firebase Messaging initialisé dans le Service Worker');
  console.log('🔑 VAPID Key configurée:', VAPID_KEY.substring(0, 20) + '...');
} catch (error) {
  console.error('❌ Erreur initialisation Firebase:', error);
}

// IMPORTANT: Intercepter l'événement push directement pour garantir l'affichage
self.addEventListener('push', (event) => {
  console.log('🔔 [SW] Push event reçu:', event);
  
  let payload = {};
  
  try {
    if (event.data) {
      payload = event.data.json();
      console.log('📦 [SW] Payload JSON:', payload);
    }
  } catch (e) {
    console.log('📦 [SW] Payload texte:', event.data?.text());
    payload = { notification: { title: 'Notification', body: event.data?.text() || 'Nouveau message' } };
  }
  
  // Extraire les données de notification
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Cabinet Médical';
  const notificationBody = payload.notification?.body || payload.data?.body || 'Vous avez une nouvelle notification';
  const data = payload.data || {};
  
  const isReplyable = data.requires_reply === 'true' || data.type === 'chat_message';
  
  const notificationOptions = {
    body: notificationBody,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.message_id ? `msg-${data.message_id}` : `notif-${Date.now()}`,
    requireInteraction: true,
    renotify: true,
    vibrate: [200, 100, 200],
    data: data,
    actions: isReplyable ? [
      { action: 'reply', title: '💬 Répondre' },
      { action: 'open', title: '📱 Ouvrir' }
    ] : [
      { action: 'open', title: '📱 Ouvrir' }
    ]
  };

  console.log('📢 [SW] Affichage notification:', notificationTitle, notificationOptions);
  
  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
      .then(() => console.log('✅ [SW] Notification affichée avec succès'))
      .catch(err => console.error('❌ [SW] Erreur affichage notification:', err))
  );
});

// Handle background messages via Firebase (backup si push event ne se déclenche pas)
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('📩 [SW] onBackgroundMessage reçu:', payload);
    
    // Note: L'événement push devrait déjà avoir géré cela
    // Ce handler est un backup au cas où
    const notificationTitle = payload.notification?.title || 'Cabinet Medical';
    const data = payload.data || {};
    
    const isReplyable = data.requires_reply === 'true' || data.type === 'chat_message';
    
    const notificationOptions = {
      body: payload.notification?.body || data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.message_id ? `msg-${data.message_id}` : 'cabinet-notification',
      requireInteraction: true,
      data: data,
      actions: isReplyable ? [
        { action: 'reply', title: '💬 Répondre' },
        { action: 'open', title: '📱 Ouvrir' }
      ] : [
        { action: 'open', title: '📱 Ouvrir' }
      ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  notification.close();
  
  // Si c'est une action de réponse
  if (action === 'reply' && event.reply) {
    // L'utilisateur a écrit une réponse via l'input de notification
    const replyText = event.reply;
    
    if (replyText && data.message_id) {
      // Envoyer la réponse rapide au backend
      event.waitUntil(
        sendQuickReply(data.message_id, replyText)
          .then(() => {
            // Afficher une notification de confirmation
            return self.registration.showNotification('✅ Réponse envoyée', {
              body: replyText.substring(0, 50) + (replyText.length > 50 ? '...' : ''),
              icon: '/icon-192.png',
              tag: 'reply-sent',
              requireInteraction: false
            });
          })
          .catch(err => {
            console.error('Erreur envoi réponse rapide:', err);
            return self.registration.showNotification('❌ Erreur', {
              body: 'Impossible d\'envoyer la réponse. Ouvrez l\'application.',
              icon: '/icon-192.png',
              tag: 'reply-error'
            });
          })
      );
      return;
    }
  }
  
  // Ouvrir ou focus l'application
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Chercher une fenêtre déjà ouverte
        for (let client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Si c'est un message, naviguer vers la section messages
            if (data.type === 'chat_message') {
              client.postMessage({
                type: 'NAVIGATE_TO',
                path: '/messages',
                data: data
              });
            }
            return client.focus();
          }
        }
        // Sinon ouvrir une nouvelle fenêtre
        const targetUrl = data.type === 'chat_message' ? '/?section=messages' : '/';
        return clients.openWindow(targetUrl);
      })
  );
});

// Fonction pour envoyer une réponse rapide
async function sendQuickReply(messageId, replyContent) {
  // Récupérer le token depuis IndexedDB ou autre storage
  const token = await getStoredToken();
  
  if (!token) {
    throw new Error('Non authentifié');
  }
  
  const response = await fetch(`${API_BASE_URL}/api/notifications/quick-reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      message_id: messageId,
      reply_content: replyContent
    })
  });
  
  if (!response.ok) {
    throw new Error(`Erreur API: ${response.status}`);
  }
  
  return response.json();
}

// Récupérer le token stocké (depuis IndexedDB)
async function getStoredToken() {
  return new Promise((resolve) => {
    const request = indexedDB.open('ophtaGestionDB', 1);
    
    request.onerror = () => resolve(null);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('auth')) {
        db.createObjectStore('auth', { keyPath: 'key' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      try {
        const transaction = db.transaction(['auth'], 'readonly');
        const store = transaction.objectStore('auth');
        const getRequest = store.get('token');
        
        getRequest.onsuccess = () => {
          resolve(getRequest.result?.value || null);
        };
        getRequest.onerror = () => resolve(null);
      } catch (e) {
        // Fallback: essayer depuis les clients
        resolve(null);
      }
    };
  });
}

// Écouter les messages du client principal pour stocker le token
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'STORE_TOKEN') {
    storeToken(event.data.token);
  }
  // Permettre la mise à jour immédiate du SW
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Stocker le token dans IndexedDB
async function storeToken(token) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ophtaGestionDB', 1);
    
    request.onerror = () => reject(new Error('IndexedDB error'));
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('auth')) {
        db.createObjectStore('auth', { keyPath: 'key' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['auth'], 'readwrite');
      const store = transaction.objectStore('auth');
      store.put({ key: 'token', value: token });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Store error'));
    };
  });
}

console.log('Firebase Messaging Service Worker loaded with Quick Reply support');
