/**
 * Configuration et gestion de Firebase Cloud Messaging
 * Pour les notifications push
 */
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import axios from 'axios';

// Configuration Firebase
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// VAPID Key pour les notifications Web
const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY;

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Initialiser Messaging
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (error) {
  console.error("Erreur lors de l'initialisation de Firebase Messaging:", error);
}

/**
 * Demande la permission et récupère le token FCM
 * @returns {Promise<string|null>} Token FCM ou null en cas d'échec
 */
export const requestNotificationPermission = async () => {
  try {
    // Vérifier si les notifications sont supportées
    if (!('Notification' in window)) {
      console.warn('Ce navigateur ne supporte pas les notifications');
      return null;
    }

    if (!messaging) {
      console.error('Firebase Messaging non initialisé');
      return null;
    }

    // Demander la permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('Permission accordée pour les notifications');
      
      // Récupérer le token
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      
      if (token) {
        console.log('Token FCM obtenu:', token);
        return token;
      } else {
        console.warn('Aucun token FCM obtenu');
        return null;
      }
    } else {
      console.warn('Permission refusée pour les notifications');
      return null;
    }
  } catch (error) {
    console.error('Erreur lors de la demande de permission:', error);
    return null;
  }
};

/**
 * Enregistre le token FCM sur le backend
 * @param {string} token - Token FCM à enregistrer
 * @param {string} apiUrl - URL de l'API backend
 */
export const registerFCMToken = async (token, apiUrl) => {
  try {
    await axios.post(`${apiUrl}/users/me/fcm-token`, { token });
    console.log('Token FCM enregistré sur le serveur');
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du token FCM:', error);
    return false;
  }
};

/**
 * Supprime le token FCM du backend (désactivation des notifications)
 * @param {string} apiUrl - URL de l'API backend
 */
export const unregisterFCMToken = async (apiUrl) => {
  try {
    await axios.delete(`${apiUrl}/users/me/fcm-token`);
    console.log('Token FCM supprimé du serveur');
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression du token FCM:', error);
    return false;
  }
};

/**
 * Configure l'écoute des messages quand l'app est au premier plan
 * @param {Function} onMessageReceived - Callback appelé quand un message est reçu
 */
export const setupForegroundMessageListener = (onMessageReceived) => {
  if (!messaging) return;

  onMessage(messaging, (payload) => {
    console.log('Message reçu au premier plan:', payload);
    
    // Afficher une notification navigateur
    if (Notification.permission === 'granted') {
      const notificationTitle = payload.notification?.title || 'Notification';
      const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/logo192.png',
        badge: '/logo192.png',
        data: payload.data
      };

      new Notification(notificationTitle, notificationOptions);
    }

    // Appeler le callback
    if (onMessageReceived) {
      onMessageReceived(payload);
    }
  });
};

export default { 
  requestNotificationPermission, 
  registerFCMToken, 
  unregisterFCMToken,
  setupForegroundMessageListener 
};
