// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Configuration Firebase depuis variables d'environnement via fetch
// Note: Service Workers ne peuvent pas accéder à process.env directement
fetch('/firebase-config.json')
  .then(response => response.json())
  .then(firebaseConfig => {
    firebase.initializeApp(firebaseConfig);

    const messaging = firebase.messaging();

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
      console.log('Background message received:', payload);
      
      const notificationTitle = payload.notification?.title || 'Cabinet Medical';
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'cabinet-notification',
        requireInteraction: true,
        data: payload.data || {}
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
  
  event.notification.close();
  
  // Focus or open the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});