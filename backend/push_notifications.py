"""
Module pour gérer les notifications push via Firebase Cloud Functions
"""
import os
import logging
import httpx

logger = logging.getLogger(__name__)

# URLs des Cloud Functions Firebase
FIREBASE_FUNCTION_SEND_PUSH = os.environ.get("FIREBASE_FUNCTION_SEND_PUSH", "")
FIREBASE_FUNCTION_MULTICAST = os.environ.get("FIREBASE_FUNCTION_MULTICAST", "")


async def send_push_notification(fcm_token: str, title: str, body: str, data: dict = None):
    """
    Envoie une notification push à un utilisateur via Firebase Cloud Function
    
    Args:
        fcm_token: Token FCM de l'utilisateur
        title: Titre de la notification
        body: Corps de la notification
        data: Données supplémentaires (optionnel)
    """
    if not FIREBASE_FUNCTION_SEND_PUSH:
        logger.warning("Firebase Cloud Function URL not configured, skipping push notification")
        return False
    
    try:
        payload = {
            "token": fcm_token,
            "title": title,
            "body": body,
            "data": data or {}
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                FIREBASE_FUNCTION_SEND_PUSH, 
                json=payload, 
                headers={"Content-Type": "application/json"},
                timeout=10.0
            )
            
            if response.status_code == 200:
                logger.info(f"Push notification sent successfully via Cloud Function")
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
