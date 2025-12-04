"""
Script de test pour vérifier les notifications push Firebase
"""
import asyncio
import sys
import os
from pymongo import MongoClient

# Ajouter le répertoire backend au path
sys.path.insert(0, '/app/backend')

from push_notifications import send_push_notification

async def test_push():
    """Test d'envoi de notification push"""
    
    print("🔍 Recherche d'un utilisateur avec token FCM...")
    
    # Connexion à MongoDB
    client = MongoClient("mongodb://localhost:27017")
    db = client.gestion_cabinet
    
    # Trouver un utilisateur avec un token FCM
    user = db.users.find_one({"fcm_token": {"$exists": True, "$ne": None}})
    
    if not user:
        print("❌ Aucun utilisateur avec token FCM trouvé")
        print("📝 Conseil: Allez dans l'application, section 'Mon Profil' et activez les notifications")
        return False
    
    print(f"✅ Utilisateur trouvé: {user.get('prenom')} {user.get('nom')}")
    print(f"📱 Token FCM: {user.get('fcm_token')[:50]}...")
    
    # Envoyer une notification de test
    print("\n📤 Envoi de la notification push...")
    
    success = await send_push_notification(
        fcm_token=user.get('fcm_token'),
        title="🧪 Test Notification Push",
        body="Si vous voyez ceci sur votre téléphone, les notifications push fonctionnent ! 🎉",
        data={
            "type": "test",
            "test_id": "123"
        }
    )
    
    if success:
        print("✅ Notification push envoyée avec succès!")
        print("📱 Vérifiez votre téléphone (même si l'app est fermée)")
        return True
    else:
        print("❌ Échec de l'envoi de la notification")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🧪 TEST DES NOTIFICATIONS PUSH FIREBASE")
    print("=" * 60)
    
    result = asyncio.run(test_push())
    
    print("\n" + "=" * 60)
    if result:
        print("✅ TEST RÉUSSI - Notifications push opérationnelles")
    else:
        print("❌ TEST ÉCHOUÉ - Vérifiez la configuration")
    print("=" * 60)
