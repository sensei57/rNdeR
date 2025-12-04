"""
Script pour tester les notifications push pour Rui spécifiquement
"""
import asyncio
import sys
from pymongo import MongoClient

sys.path.insert(0, '/app/backend')

from push_notifications import send_push_notification

async def main():
    print("=" * 70)
    print("🧪 TEST NOTIFICATIONS PUSH - DIAGNOSTIC COMPLET")
    print("=" * 70)
    
    # Connexion MongoDB
    client = MongoClient("mongodb://localhost:27017")
    db = client.gestion_cabinet
    
    print("\n📊 ÉTAPE 1 : Recherche utilisateur 'Rui'...")
    users = list(db.users.find({"$or": [
        {"prenom": {"$regex": "rui", "$options": "i"}},
        {"nom": {"$regex": "rui", "$options": "i"}},
        {"email": {"$regex": "rui", "$options": "i"}}
    ]}))
    
    if not users:
        print("❌ Aucun utilisateur 'Rui' trouvé")
        print("\n📋 Utilisateurs disponibles :")
        all_users = list(db.users.find({}, {"prenom": 1, "nom": 1, "email": 1, "fcm_token": 1}))
        for u in all_users:
            token_status = "✅ Token FCM" if u.get('fcm_token') else "❌ Pas de token"
            print(f"  - {u.get('prenom')} {u.get('nom')} ({u.get('email')}) - {token_status}")
        return
    
    print(f"✅ Utilisateur trouvé : {users[0].get('prenom')} {users[0].get('nom')}")
    user = users[0]
    
    print(f"\n📋 ÉTAPE 2 : Vérification du token FCM...")
    fcm_token = user.get('fcm_token')
    
    if not fcm_token:
        print("❌ Pas de token FCM enregistré pour cet utilisateur")
        print("\n💡 SOLUTION :")
        print("1. Rui doit aller dans 'Mon Profil' sur l'application")
        print("2. Section 'Notifications Push'")
        print("3. Cliquer sur le bouton pour activer")
        print("4. Autoriser les notifications quand demandé")
        print("5. Attendre le message 'Notifications Firebase activées ✓'")
        return
    
    print(f"✅ Token FCM trouvé : {fcm_token[:50]}...")
    print(f"📅 Dernière mise à jour : {user.get('fcm_updated_at', 'Non renseigné')}")
    
    print(f"\n📤 ÉTAPE 3 : Envoi de la notification push...")
    success = await send_push_notification(
        fcm_token=fcm_token,
        title="🧪 Test Notification - Cabinet Médical",
        body="Si vous voyez ceci sur votre téléphone (même app fermée), les notifications fonctionnent ! 🎉",
        data={
            "type": "test",
            "test_id": "rui_test_001"
        }
    )
    
    print("\n" + "=" * 70)
    if success:
        print("✅ NOTIFICATION ENVOYÉE AVEC SUCCÈS!")
        print("\n📱 Vérifiez maintenant :")
        print("  1. Le téléphone de Rui (même si l'app est fermée)")
        print("  2. Si aucune notification n'apparaît :")
        print("     - Vérifier les paramètres de notification du téléphone")
        print("     - Vérifier que l'app a les permissions notification")
        print("     - Essayer de désactiver/réactiver dans Mon Profil")
    else:
        print("❌ ÉCHEC DE L'ENVOI")
        print("\n🔍 Causes possibles :")
        print("  - Token FCM expiré ou invalide")
        print("  - Problème de connexion avec Firebase")
        print("  - Configuration Firebase incorrecte")
        print("\n💡 Solution : Demander à Rui de réactiver les notifications")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
