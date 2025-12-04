"""
Module pour gérer les notifications push via Firebase Admin SDK
"""
import os
import logging
import firebase_admin
from firebase_admin import credentials, messaging

logger = logging.getLogger(__name__)

# Initialisation Firebase Admin SDK
_firebase_app = None

def initialize_firebase():
    """Initialise Firebase Admin SDK avec les credentials"""
    global _firebase_app
    
    if _firebase_app is not None:
        return _firebase_app
    
    try:
        # Chemin vers le fichier de credentials
        cred_path = os.path.join(os.path.dirname(__file__), 'firebase-credentials.json')
        
        if not os.path.exists(cred_path):
            logger.error(f"Fichier de credentials Firebase introuvable: {cred_path}")
            return None
        
        # Initialiser Firebase Admin
        cred = credentials.Certificate(cred_path)
        _firebase_app = firebase_admin.initialize_app(cred)
        
        logger.info("✅ Firebase Admin SDK initialisé avec succès")
        return _firebase_app
        
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'initialisation Firebase: {e}")
        return None


async def send_push_notification(fcm_token: str, title: str, body: str, data: dict = None):
    """
    Envoie une notification push à un utilisateur via Firebase Admin SDK
    
    Args:
        fcm_token: Token FCM de l'utilisateur
        title: Titre de la notification
        body: Corps de la notification
        data: Données supplémentaires (optionnel)
    """
    # Initialiser Firebase si pas déjà fait
    if _firebase_app is None:
        initialize_firebase()
    
    if _firebase_app is None:
        logger.warning("Firebase non initialisé, notification push non envoyée")
        return False
    
    try:
        # Construire le message
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data={k: str(v) for k, v in (data or {}).items()},  # Convertir toutes les valeurs en string
            token=fcm_token,
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    icon='/icon-192.png',
                    badge='/icon-192.png',
                    require_interaction=True,
                    vibrate=[200, 100, 200]
                ),
                fcm_options=messaging.WebpushFCMOptions(
                    link='/'
                )
            )
        )
        
        # Envoyer la notification
        response = messaging.send(message)
        logger.info(f"✅ Push notification envoyée avec succès: {response}")
        return True
        
    except firebase_admin.exceptions.FirebaseError as e:
        logger.error(f"❌ Erreur Firebase lors de l'envoi: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'envoi de la notification push: {e}")
        return False


async def send_push_to_multiple(fcm_tokens: list, title: str, body: str, data: dict = None):
    """
    Envoie une notification push à plusieurs utilisateurs via Firebase Admin SDK
    
    Args:
        fcm_tokens: Liste des tokens FCM
        title: Titre de la notification
        body: Corps de la notification
        data: Données supplémentaires (optionnel)
    """
    if not fcm_tokens:
        return 0
    
    # Initialiser Firebase si pas déjà fait
    if _firebase_app is None:
        initialize_firebase()
    
    if _firebase_app is None:
        logger.warning("Firebase non initialisé, notifications push non envoyées")
        return 0
    
    try:
        # Construire le message multicast
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data={k: str(v) for k, v in (data or {}).items()},
            tokens=fcm_tokens,
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    icon='/icon-192.png',
                    badge='/icon-192.png',
                    require_interaction=True,
                    vibrate=[200, 100, 200]
                )
            )
        )
        
        # Envoyer les notifications
        response = messaging.send_multicast(message)
        
        logger.info(f"✅ Notifications envoyées: {response.success_count}/{len(fcm_tokens)} succès")
        
        # Gérer les erreurs individuelles
        if response.failure_count > 0:
            failed_tokens = []
            for idx, resp in enumerate(response.responses):
                if not resp.success:
                    failed_tokens.append(fcm_tokens[idx])
                    logger.warning(f"⚠️ Échec pour token {idx}: {resp.exception}")
        
        return response.success_count
        
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'envoi multicast: {e}")
        return 0


# Initialiser Firebase au démarrage du module
initialize_firebase()
