/**
 * Firebase Cloud Functions pour les notifications push
 * Cabinet Médical - Gestion des notifications
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialiser Firebase Admin
admin.initializeApp();

/**
 * Fonction HTTP pour envoyer une notification push à un utilisateur
 * POST /sendPushNotification
 * Body: {
 *   token: "fcm_token_utilisateur",
 *   title: "Titre de la notification",
 *   body: "Corps de la notification",
 *   data: { type: "planning", url: "/planning" }
 * }
 */
exports.sendPushNotification = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Vérifier la méthode
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  try {
    const { token, title, body, data } = req.body;

    // Validation
    if (!token || !title || !body) {
      res.status(400).json({ 
        error: 'Paramètres manquants (token, title, body requis)' 
      });
      return;
    }

    // Construire le message
    const message = {
      token: token,
      notification: {
        title: title,
        body: body
      },
      data: data || {},
      webpush: {
        notification: {
          icon: '/logo192.png',
          badge: '/logo192.png',
          requireInteraction: true,
          vibrate: [200, 100, 200]
        },
        fcmOptions: {
          link: data?.url || '/'
        }
      }
    };

    // Envoyer la notification
    const response = await admin.messaging().send(message);
    
    console.log('Notification envoyée avec succès:', response);
    res.status(200).json({ 
      success: true, 
      messageId: response 
    });

  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'envoi de la notification',
      details: error.message 
    });
  }
});

/**
 * Fonction HTTP pour envoyer des notifications à plusieurs utilisateurs
 * POST /sendMulticastNotification
 * Body: {
 *   tokens: ["token1", "token2", ...],
 *   title: "Titre",
 *   body: "Corps",
 *   data: { type: "planning" }
 * }
 */
exports.sendMulticastNotification = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  try {
    const { tokens, title, body, data } = req.body;

    // Validation
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      res.status(400).json({ 
        error: 'Liste de tokens invalide ou vide' 
      });
      return;
    }

    if (!title || !body) {
      res.status(400).json({ 
        error: 'Titre et corps requis' 
      });
      return;
    }

    // Construire le message
    const message = {
      tokens: tokens,
      notification: {
        title: title,
        body: body
      },
      data: data || {},
      webpush: {
        notification: {
          icon: '/logo192.png',
          badge: '/logo192.png',
          requireInteraction: true
        }
      }
    };

    // Envoyer les notifications
    const response = await admin.messaging().sendMulticast(message);
    
    console.log(`Notifications envoyées: ${response.successCount}/${tokens.length}`);
    
    res.status(200).json({ 
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses
    });

  } catch (error) {
    console.error('Erreur lors de l\'envoi des notifications:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'envoi des notifications',
      details: error.message 
    });
  }
});

/**
 * Fonction déclenchée par une création/modification dans Firestore
 * Exemple: envoyer une notification quand une nouvelle demande est créée
 */
exports.onNewNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    
    try {
      // Récupérer le token FCM de l'utilisateur
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(notification.userId)
        .get();
      
      if (!userDoc.exists) {
        console.log('Utilisateur non trouvé');
        return null;
      }

      const fcmToken = userDoc.data().fcmToken;
      
      if (!fcmToken) {
        console.log('Pas de token FCM pour cet utilisateur');
        return null;
      }

      // Envoyer la notification
      const message = {
        token: fcmToken,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {}
      };

      await admin.messaging().send(message);
      console.log('Notification push envoyée automatiquement');
      
      return null;
    } catch (error) {
      console.error('Erreur:', error);
      return null;
    }
  });
