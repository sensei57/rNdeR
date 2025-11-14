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
    if not FIREBASE_SERVER_KEY or not fcm_tokens:
        return 0
    
    success_count = 0
    
    # Envoyer individuellement à chaque token
    for token in fcm_tokens:
        if await send_push_notification(token, title, body, data):
            success_count += 1
    
    logger.info(f"Successfully sent {success_count}/{len(fcm_tokens)} push notifications")
    return success_count


# Configuration simplifiée - pas d'initialisation nécessaire
