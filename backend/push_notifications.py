"""
Module pour gérer les notifications push via Firebase Cloud Messaging
"""
import os
import logging
import httpx

logger = logging.getLogger(__name__)

# Initialiser Firebase Admin (une seule fois)
firebase_initialized = False

def initialize_firebase():
    """Initialise Firebase Admin SDK"""
    global firebase_initialized
    
    if firebase_initialized:
        return
    
    try:
        # Pour Firebase Admin, nous avons besoin d'un fichier de credentials
        # Dans un environnement de production, cela devrait être configuré via des variables d'environnement
        
        # Configuration simple pour commencer (sans fichier de credentials)
        # Note: Pour la production, il faudra un fichier service account JSON
        
        # Essayons d'initialiser avec les identifiants du projet
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": "cabinet-medical-ope",
            "private_key_id": os.environ.get("FIREBASE_PRIVATE_KEY_ID", ""),
            "private_key": os.environ.get("FIREBASE_PRIVATE_KEY", "").replace('\\n', '\n'),
            "client_email": os.environ.get("FIREBASE_CLIENT_EMAIL", ""),
            "client_id": os.environ.get("FIREBASE_CLIENT_ID", ""),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": os.environ.get("FIREBASE_CERT_URL", "")
        })
        
        firebase_admin.initialize_app(cred)
        firebase_initialized = True
        logger.info("Firebase Admin SDK initialized successfully")
    except Exception as e:
        logger.warning(f"Firebase initialization skipped: {e}")
        # On continue sans Firebase pour le moment
        pass


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
