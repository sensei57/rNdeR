"""
Module pour gérer les notifications push via Firebase Admin SDK
Supporte les credentials via:
1. Variable d'environnement FIREBASE_CREDENTIALS (JSON string) - recommandé pour Render
2. Fichier firebase-credentials.json (fallback)
"""
import os
import json
import logging
import tempfile
import firebase_admin
from firebase_admin import credentials, messaging

logger = logging.getLogger(__name__)

# Initialisation Firebase Admin SDK
_firebase_app = None
_temp_cred_file = None  # Pour nettoyer le fichier temporaire si nécessaire

def initialize_firebase():
    """Initialise Firebase Admin SDK avec les credentials"""
    global _firebase_app, _temp_cred_file
    
    if _firebase_app is not None:
        return _firebase_app
    
    try:
        cred = None
        
        # Option 1: Variable d'environnement FIREBASE_CREDENTIALS (JSON string)
        firebase_creds_env = os.environ.get('FIREBASE_CREDENTIALS')
        if firebase_creds_env:
            try:
                # Parser le JSON depuis la variable d'environnement
                cred_dict = json.loads(firebase_creds_env)
                cred = credentials.Certificate(cred_dict)
                logger.info("✅ Firebase credentials chargées depuis variable d'environnement FIREBASE_CREDENTIALS")
            except json.JSONDecodeError as e:
                logger.error(f"❌ Erreur parsing JSON FIREBASE_CREDENTIALS: {e}")
                # Continuer pour essayer le fichier
        
        # Option 2: Fichier firebase-credentials.json (fallback)
        if cred is None:
            cred_path = os.path.join(os.path.dirname(__file__), 'firebase-credentials.json')
            
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                logger.info(f"✅ Firebase credentials chargées depuis fichier: {cred_path}")
            else:
                logger.warning(f"⚠️ Fichier firebase-credentials.json introuvable: {cred_path}")
                logger.warning("⚠️ Pour activer les notifications push, configurez FIREBASE_CREDENTIALS dans les variables d'environnement")
                return None
        
        # Initialiser Firebase Admin
        _firebase_app = firebase_admin.initialize_app(cred)
        
        logger.info("✅ Firebase Admin SDK initialisé avec succès")
        print("✅ Firebase Admin SDK initialisé avec succès - Notifications push activées")
        return _firebase_app
        
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'initialisation Firebase: {e}")
        print(f"❌ Erreur Firebase: {e}")
        return None


def get_firebase_status():
    """Retourne le statut de Firebase pour diagnostic"""
    global _firebase_app
    
    has_env_var = bool(os.environ.get('FIREBASE_CREDENTIALS'))
    has_file = os.path.exists(os.path.join(os.path.dirname(__file__), 'firebase-credentials.json'))
    is_initialized = _firebase_app is not None
    
    return {
        "initialized": is_initialized,
        "credentials_source": "env_var" if has_env_var else ("file" if has_file else "none"),
        "has_env_var": has_env_var,
        "has_file": has_file,
        "status": "active" if is_initialized else "inactive",
        "message": "Firebase prêt pour les notifications push" if is_initialized else "Firebase non configuré - notifications push désactivées"
    }


async def send_push_notification(fcm_token: str, title: str, body: str, data: dict = None):
    """
    Envoie une notification push à un utilisateur via Firebase Admin SDK
    avec support des actions (réponse rapide pour les messages de chat)
    
    Args:
        fcm_token: Token FCM de l'utilisateur
        title: Titre de la notification
        body: Corps de la notification
        data: Données supplémentaires (optionnel)
            - type: "chat_message" active les actions de réponse rapide
            - requires_reply: "true" pour afficher l'action de réponse
    
    Returns:
        bool: True si envoyé avec succès, False sinon
    """
    global _firebase_app
    
    # Initialiser Firebase si pas déjà fait
    if _firebase_app is None:
        initialize_firebase()
    
    if _firebase_app is None:
        logger.warning("Firebase non initialisé, notification push non envoyée")
        return False
    
    try:
        # Préparer les données
        notification_data = {k: str(v) for k, v in (data or {}).items()}
        
        # Configurer les actions selon le type de notification
        actions = []
        if notification_data.get("type") == "chat_message" and notification_data.get("requires_reply") == "true":
            # Ajouter l'action de réponse rapide pour les messages de chat
            actions = [
                {
                    "action": "reply",
                    "title": "Répondre",
                    "type": "text",
                    "placeholder": "Tapez votre réponse..."
                },
                {
                    "action": "open",
                    "title": "Ouvrir"
                }
            ]
        
        # Construire la configuration webpush
        webpush_notification_config = {
            "icon": "/icon-192.png",
            "badge": "/icon-192.png",
            "require_interaction": True,
            "vibrate": [200, 100, 200],
            "tag": notification_data.get("message_id", "default"),  # Grouper par message
            "renotify": True
        }
        
        # Ajouter les actions si disponibles
        if actions:
            webpush_notification_config["actions"] = actions
        
        # Construire le message
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data=notification_data,
            token=fcm_token,
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(**webpush_notification_config),
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
    
    Returns:
        int: Nombre de notifications envoyées avec succès
    """
    global _firebase_app
    
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
