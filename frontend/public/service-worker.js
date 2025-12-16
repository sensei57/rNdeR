/* eslint-disable no-restricted-globals */

// Service Worker simplifié pour PWA et notifications push

const CACHE_NAME = 'gestion-cabinet-v2'; // Incrémenté pour forcer le rafraîchissement

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installation v2');
  // Force le nouveau SW à prendre le contrôle immédiatement
  self.skipWaiting();
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activation v2');
  
  // Nettoyer les anciens caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Suppression ancien cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Prendre le contrôle immédiatement
      return self.clients.claim();
    })
  );
});

// PAS de cache fetch pour éviter les erreurs
// Seulement les notifications push

// Gestion des notifications push
self.addEventListener('push', (event) => {
  console.log('Service Worker: Notification Push reçue');
  
  let notificationData = {
    title: 'Planning du jour',
    body: 'Votre planning est disponible',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'planning-notification',
    requireInteraction: true
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data
      };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data || {}
    })
  );
});

// Gestion des clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Clic sur notification');
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si une fenêtre est déjà ouverte, la focus
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Sinon, ouvre une nouvelle fenêtre
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
