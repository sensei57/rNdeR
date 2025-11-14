"""
Module pour gérer les notifications push via Firebase Cloud Messaging
Version simplifiée sans Firebase Admin SDK
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
    Envoie une notification push à un utilisateur spécifique via FCM HTTP API
    
    Args:
        fcm_token: Token FCM de l'utilisateur
        title: Titre de la notification
        body: Corps de la notification
        data: Données supplémentaires (optionnel)
    """
    if not FIREBASE_SERVER_KEY:
        logger.warning("Firebase server key not configured, skipping push notification")
        return False
    
    try:
        headers = {
            "Authorization": f"key={FIREBASE_SERVER_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "to": fcm_token,
            "notification": {
                "title": title,
                "body": body,
                "icon": "/logo192.png",
                "click_action": "FCM_PLUGIN_ACTIVITY",
                "sound": "default"
            },
            "data": data or {},
            "priority": "high"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(FCM_URL, json=payload, headers=headers, timeout=10.0)
            
            if response.status_code == 200:
                logger.info(f"Push notification sent successfully")
                return True
            else:
                logger.error(f"Failed to send push notification: {response.status_code} - {response.text}")
                return False
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


# Configuration simplifiée - pas d'initialisation nécessaire
