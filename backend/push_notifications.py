"""
Module pour gérer les notifications push via Firebase Admin SDK
Supporte les credentials via:
1. Variable d'environnement FIREBASE_CREDENTIALS (JSON string) - recommandé pour Render
2. Fichier firebase-credentials.json (fallback)

Inclut aussi Firebase Storage pour les uploads d'images

IMPORTANT: Tous les imports Firebase sont LAZY pour permettre un démarrage rapide du serveur
"""
import os
import json
import logging
import tempfile
import time
import uuid
from datetime import datetime, timezone

# IMPORTS FIREBASE LAZY - Ne pas importer au niveau module pour éviter de bloquer le démarrage
_firebase_admin = None
_credentials = None
_messaging = None
_storage = None
STORAGE_AVAILABLE = True  # On assume que c'est disponible, on vérifiera au runtime

def _lazy_import_firebase():
    """Import lazy de firebase_admin et ses modules"""
    global _firebase_admin, _credentials, _messaging, _storage, STORAGE_AVAILABLE
    if _firebase_admin is None:
        try:
            import firebase_admin as fb_admin
            from firebase_admin import credentials as fb_creds, messaging as fb_msg
            _firebase_admin = fb_admin
            _credentials = fb_creds
            _messaging = fb_msg
            print("✅ [LAZY] firebase_admin importé")
            
            # Import storage séparément car optionnel
            try:
                from firebase_admin import storage as fb_storage
                _storage = fb_storage
                print("✅ [LAZY] firebase storage importé")
            except ImportError as e:
                print(f"⚠️ Firebase Storage non disponible: {e}")
                _storage = None
                STORAGE_AVAILABLE = False
        except ImportError as e:
            print(f"❌ [LAZY] Erreur import firebase_admin: {e}")
            raise
    return _firebase_admin, _credentials, _messaging

logger = logging.getLogger(__name__)

# Configuration Storage
FIREBASE_STORAGE_BUCKET = os.environ.get('FIREBASE_STORAGE_BUCKET', 'cabinet-medical-ope.firebasestorage.app')

# Initialisation Firebase Admin SDK
_firebase_app = None
_storage_bucket = None
_temp_cred_file = None  # Pour nettoyer le fichier temporaire si nécessaire

def initialize_firebase():
    """Initialise Firebase Admin SDK avec les credentials (LAZY)"""
    global _firebase_app, _storage_bucket, _temp_cred_file
    
    if _firebase_app is not None:
        return _firebase_app
    
    # Import lazy de firebase
    firebase_admin, credentials, messaging = _lazy_import_firebase()
    
    try:
        cred = None
        
        # Option 1: Variable d'environnement FIREBASE_CREDENTIALS (JSON string)
        firebase_creds_env = os.environ.get('FIREBASE_CREDENTIALS')
        
        # LOG DE DIAGNOSTIC
        print(f"🔍 [FIREBASE DEBUG] Variable FIREBASE_CREDENTIALS présente: {bool(firebase_creds_env)}")
        if firebase_creds_env:
            print(f"🔍 [FIREBASE DEBUG] Longueur du JSON: {len(firebase_creds_env)} caractères")
        
        if firebase_creds_env:
            try:
                # Parser le JSON depuis la variable d'environnement
                cred_dict = json.loads(firebase_creds_env)
                print(f"✅ [FIREBASE DEBUG] JSON parsé avec succès. Clés trouvées: {list(cred_dict.keys())}")
                cred = credentials.Certificate(cred_dict)
                logger.info("✅ Firebase credentials chargées depuis variable d'environnement FIREBASE_CREDENTIALS")
                print("✅ Firebase credentials chargées depuis variable d'environnement")
            except json.JSONDecodeError as e:
                logger.error(f"❌ Erreur parsing JSON FIREBASE_CREDENTIALS: {e}")
                print(f"❌ [FIREBASE DEBUG] Erreur parsing JSON: {e}")
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
        
        # Initialiser Firebase Admin avec Storage
        _firebase_app = firebase_admin.initialize_app(cred, {
            'storageBucket': FIREBASE_STORAGE_BUCKET
        })
        
        # Initialiser le bucket Storage si disponible
        if STORAGE_AVAILABLE and _storage:
            _storage_bucket = _storage.bucket()
            logger.info("✅ Firebase Admin SDK initialisé avec succès (Storage activé)")
            print(f"✅ Firebase Admin SDK initialisé avec succès - Storage: {FIREBASE_STORAGE_BUCKET}")
        else:
            logger.info("✅ Firebase Admin SDK initialisé (Storage non disponible)")
            print("✅ Firebase Admin SDK initialisé (Storage non disponible)")
        
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
    
    # Initialiser Firebase si pas déjà fait (LAZY)
    if _firebase_app is None:
        initialize_firebase()
    
    if _firebase_app is None:
        logger.warning("Firebase non initialisé, notification push non envoyée")
        return False
    
    # Import lazy pour avoir messaging
    _, _, messaging = _lazy_import_firebase()
    
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
        # IMPORTANT: Utiliser un tag UNIQUE pour chaque notification (sinon elles se remplacent)
        unique_tag = f"notif-{int(time.time() * 1000)}-{notification_data.get('type', 'default')}"
        
        webpush_notification_config = {
            "title": title,  # CRITIQUE: Inclure le titre dans webpush
            "body": body,    # CRITIQUE: Inclure le corps dans webpush
            "icon": "/icon-192.png",
            "badge": "/icon-192.png",
            "require_interaction": True,
            "vibrate": [200, 100, 200],
            "tag": unique_tag,  # Tag unique pour chaque notification
            "renotify": True
        }
        
        # Ajouter les actions si disponibles
        if actions:
            webpush_notification_config["actions"] = actions
        
        # Construire le message
        # Récupérer l'URL frontend pour le lien de la notification
        frontend_url = os.environ.get('FRONTEND_URL', '').strip()
        
        # IMPORTANT: Inclure title et body dans data pour que le SW puisse les lire
        # même si Firebase gère automatiquement le notification payload
        notification_data["title"] = title
        notification_data["body"] = body
        
        # Construire la config webpush avec ou sans lien selon la disponibilité
        webpush_config_args = {
            "notification": messaging.WebpushNotification(**webpush_notification_config)
        }
        
        # Ajouter le lien seulement si FRONTEND_URL est configuré avec HTTPS
        if frontend_url and frontend_url.startswith('https://'):
            webpush_config_args["fcm_options"] = messaging.WebpushFCMOptions(
                link=frontend_url
            )
        elif frontend_url:
            logger.warning(f"⚠️ FRONTEND_URL ({frontend_url}) n'utilise pas HTTPS, lien non inclus dans la notification")
        
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data=notification_data,
            token=fcm_token,
            webpush=messaging.WebpushConfig(**webpush_config_args)
        )
        
        # Log détaillé pour debug
        print("📤 [PUSH] Envoi notification:")
        print(f"   - Title: {title}")
        print(f"   - Body: {body[:50]}..." if len(body) > 50 else f"   - Body: {body}")
        print(f"   - Token: {fcm_token[:40]}...")
        print(f"   - Data keys: {list(notification_data.keys())}")
        
        # Envoyer la notification
        response = messaging.send(message)
        logger.info(f"✅ Push notification envoyée avec succès: {response}")
        print(f"✅ [PUSH] Notification envoyée - Response ID: {response}")
        return True
        
    except Exception as e:
        # Gérer l'erreur Firebase avec import lazy
        firebase_admin, _, _ = _lazy_import_firebase()
        if hasattr(firebase_admin, 'exceptions') and isinstance(e, firebase_admin.exceptions.FirebaseError):
            error_msg = str(e)
            logger.error(f"❌ Erreur Firebase lors de l'envoi: {error_msg}")
            print(f"❌ [PUSH] Erreur Firebase: {error_msg}")
            return False
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
        # Récupérer l'URL frontend pour le lien de la notification
        frontend_url = os.environ.get('FRONTEND_URL', '').strip()
        
        # Tag unique pour cette notification
        unique_tag = f"multi-{int(time.time() * 1000)}"
        
        # Construire la config webpush avec title et body
        webpush_notification_config = messaging.WebpushNotification(
            title=title,
            body=body,
            icon='/icon-192.png',
            badge='/icon-192.png',
            tag=unique_tag,
            renotify=True,
            require_interaction=True,
            vibrate=[200, 100, 200]
        )
        
        webpush_config_args = {
            "notification": webpush_notification_config
        }
        
        # Ajouter le lien seulement si FRONTEND_URL est configuré avec HTTPS
        if frontend_url and frontend_url.startswith('https://'):
            webpush_config_args["fcm_options"] = messaging.WebpushFCMOptions(
                link=frontend_url
            )
        
        # Construire le message multicast
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data={k: str(v) for k, v in (data or {}).items()},
            tokens=fcm_tokens,
            webpush=messaging.WebpushConfig(**webpush_config_args)
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


# NE PAS initialiser Firebase au démarrage du module
# L'initialisation se fait de manière lazy au premier appel de send_push_notification
# Cela évite de bloquer le démarrage du serveur


# ==================== COMPRESSION D'IMAGES ====================

def compress_image(image_data: bytes, max_size_kb: int = 300, max_dimension: int = 1920) -> tuple:
    """
    Compresse une image pour qu'elle ne dépasse pas max_size_kb.
    
    Args:
        image_data: Données de l'image en bytes
        max_size_kb: Taille maximale en KB (défaut: 300KB)
        max_dimension: Dimension maximale (largeur ou hauteur) en pixels
    
    Returns:
        tuple (compressed_data: bytes, content_type: str)
    """
    from PIL import Image
    import io
    
    try:
        # Ouvrir l'image
        img = Image.open(io.BytesIO(image_data))
        
        # Convertir en RGB si nécessaire (pour JPEG)
        if img.mode in ('RGBA', 'LA', 'P'):
            # Créer un fond blanc pour les images avec transparence
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Redimensionner si trop grand
        original_size = img.size
        if max(img.size) > max_dimension:
            ratio = max_dimension / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
            logger.info(f"📐 Image redimensionnée: {original_size} -> {img.size}")
        
        # Compresser progressivement jusqu'à atteindre la taille cible
        quality = 85
        max_size_bytes = max_size_kb * 1024
        
        while quality >= 20:
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=quality, optimize=True)
            compressed_data = output.getvalue()
            
            if len(compressed_data) <= max_size_bytes:
                logger.info(f"✅ Image compressée: {len(image_data)/1024:.1f}KB -> {len(compressed_data)/1024:.1f}KB (qualité: {quality}%)")
                return compressed_data, 'image/jpeg'
            
            quality -= 10
        
        # Si toujours trop grand, réduire encore les dimensions
        while len(compressed_data) > max_size_bytes and min(img.size) > 200:
            new_size = (int(img.size[0] * 0.8), int(img.size[1] * 0.8))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
            
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=60, optimize=True)
            compressed_data = output.getvalue()
        
        logger.info(f"✅ Image compressée (final): {len(image_data)/1024:.1f}KB -> {len(compressed_data)/1024:.1f}KB")
        return compressed_data, 'image/jpeg'
        
    except Exception as e:
        logger.error(f"❌ Erreur compression image: {e}")
        # Retourner l'image originale en cas d'erreur
        return image_data, 'image/jpeg'


# ==================== FIREBASE STORAGE ====================

def get_storage_bucket():
    """Récupère le bucket Firebase Storage (initialise Firebase si nécessaire)"""
    global _storage_bucket
    
    if not STORAGE_AVAILABLE:
        raise Exception("Firebase Storage non disponible - google-cloud-storage non installé")
    
    if _storage_bucket is None:
        initialize_firebase()
    
    return _storage_bucket


def upload_file_to_firebase(file_data: bytes, filename: str, content_type: str = None, folder: str = "uploads") -> dict:
    """
    Upload un fichier vers Firebase Storage
    
    Args:
        file_data: Contenu du fichier en bytes
        filename: Nom du fichier
        content_type: Type MIME du fichier
        folder: Dossier de destination dans le bucket
    
    Returns:
        dict avec url, filename, et type
    """
    try:
        bucket = get_storage_bucket()
        
        if bucket is None:
            raise Exception("Firebase Storage non initialisé")
        
        # Générer un nom unique pour éviter les conflits
        unique_filename = f"{folder}/{uuid.uuid4().hex}_{filename}"
        
        # Créer le blob
        blob = bucket.blob(unique_filename)
        
        # Upload le fichier
        blob.upload_from_string(file_data, content_type=content_type)
        
        # Rendre le fichier public pour un accès direct
        blob.make_public()
        
        # Récupérer l'URL publique
        public_url = blob.public_url
        
        logger.info(f"✅ Fichier uploadé vers Firebase Storage: {unique_filename}")
        
        # Déterminer le type de fichier
        file_type = "file"
        if content_type:
            if content_type.startswith("image/"):
                file_type = "image"
            elif content_type == "application/pdf":
                file_type = "pdf"
        
        return {
            "url": public_url,
            "filename": filename,
            "type": file_type,
            "storage_path": unique_filename
        }
        
    except Exception as e:
        logger.error(f"❌ Erreur upload Firebase Storage: {e}")
        raise e


def delete_file_from_firebase(storage_path: str) -> bool:
    """
    Supprime un fichier de Firebase Storage
    
    Args:
        storage_path: Chemin du fichier dans le bucket
    
    Returns:
        True si succès, False sinon
    """
    try:
        bucket = get_storage_bucket()
        
        if bucket is None:
            raise Exception("Firebase Storage non initialisé")
        
        blob = bucket.blob(storage_path)
        blob.delete()
        
        logger.info(f"✅ Fichier supprimé de Firebase Storage: {storage_path}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Erreur suppression Firebase Storage: {e}")
        return False

# initialize_firebase()
