// firebase-messaging-sw.js - Service Worker avec support des réponses rapides
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// URL de l'API backend
const API_BASE_URL = self.location.origin;

// Configuration Firebase depuis variables d'environnement via fetch
fetch('/firebase-config.json')
  .then(response => response.json())
  .then(firebaseConfig => {
    firebase.initializeApp(firebaseConfig);

    const messaging = firebase.messaging();

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
      console.log('Background message received:', payload);
      
      const notificationTitle = payload.notification?.title || 'Cabinet Medical';
      const data = payload.data || {};
      
      // Vérifier si c'est un message de chat qui nécessite une réponse rapide
      const isReplyable = data.requires_reply === 'true' || data.type === 'chat_message';
      
      const notificationOptions = {
        body: payload.notification?.body || data.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.message_id ? `msg-${data.message_id}` : 'cabinet-notification',
        requireInteraction: true,
        data: data,
        // Ajouter les actions de réponse rapide si c'est un message
        actions: isReplyable ? [
          { action: 'reply', title: '💬 Répondre', type: 'text' },
          { action: 'open', title: '📱 Ouvrir' }
        ] : [
          { action: 'open', title: '📱 Ouvrir' }
        ]
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  })
  .catch(error => {
    console.error('Error loading Firebase config:', error);
  });

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
