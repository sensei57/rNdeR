"""
Module pour gérer les notifications push via Firebase Cloud Messaging
"""
import os
import logging
import httpx

logger = logging.getLogger(__name__)

# Clé serveur Firebase (à configurer dans .env)
FIREBASE_SERVER_KEY = os.environ.get("FIREBASE_SERVER_KEY", "")
FCM_URL = "https://fcm.googleapis.com/fcm/send"


async def send_push_notification(fcm_token: str, title: str, body: str, data: dict = None):
    """
    Envoie une notification push à un utilisateur spécifique
    
    Args:
        fcm_token: Token FCM de l'utilisateur
        title: Titre de la notification
        body: Corps de la notification
        data: Données supplémentaires (optionnel)
    """
    if not firebase_initialized:
        logger.warning("Firebase not initialized, skipping push notification")
        return False
    
    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=data or {},
            token=fcm_token,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    sound='default',
                    priority='high',
                )
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound='default',
                        badge=1,
                    )
                )
            ),
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    icon='/logo192.png',
                    badge='/logo192.png',
                    require_interaction=True,
                    vibrate=[200, 100, 200]
                )
            )
        )
        
        response = messaging.send(message)
        logger.info(f"Successfully sent push notification: {response}")
        return True
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")
        return False


async def send_push_to_multiple(fcm_tokens: list, title: str, body: str, data: dict = None):
    """
    Envoie une notification push à plusieurs utilisateurs
    
    Args:
        fcm_tokens: Liste des tokens FCM
        title: Titre de la notification
        body: Corps de la notification
        data: Données supplémentaires (optionnel)
    """
    if not firebase_initialized or not fcm_tokens:
        return 0
    
    try:
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=data or {},
            tokens=fcm_tokens,
            android=messaging.AndroidConfig(
                priority='high'
            ),
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    icon='/logo192.png',
                    require_interaction=True
                )
            )
        )
        
        response = messaging.send_multicast(message)
        logger.info(f"Successfully sent {response.success_count} push notifications")
        return response.success_count
    except Exception as e:
        logger.error(f"Error sending multicast push notification: {e}")
        return 0


# Initialiser au chargement du module
initialize_firebase()
