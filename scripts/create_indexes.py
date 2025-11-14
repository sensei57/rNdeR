#!/usr/bin/env python3
"""
Script pour créer les index MongoDB et améliorer les performances
Optimise les requêtes fréquentes sur les champs actif, email, role, date, etc.
"""
import asyncio
import sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment variables
backend_path = Path(__file__).parent.parent / 'backend'
env_path = backend_path / '.env'
load_dotenv(env_path)

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'gestion_cabinet')

async def create_indexes():
    """Crée les index MongoDB pour optimiser les performances"""
    
    print(f"🔗 Connexion à MongoDB: {MONGO_URL}")
    print(f"📦 Base de données: {DB_NAME}")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        print("\n" + "="*60)
        print("🚀 CRÉATION DES INDEX MONGODB")
        print("="*60)
        
        # Index pour la collection users
        print("\n📊 Collection: users")
        await db.users.create_index("email", unique=True)
        print("  ✅ Index créé: email (unique)")
        
        await db.users.create_index("actif")
        print("  ✅ Index créé: actif")
        
        await db.users.create_index("role")
        print("  ✅ Index créé: role")
        
        await db.users.create_index([("role", 1), ("actif", 1)])
        print("  ✅ Index composé créé: role + actif")
        
        # Index pour la collection planning
        print("\n📅 Collection: planning")
        await db.planning.create_index("date")
        print("  ✅ Index créé: date")
        
        await db.planning.create_index("employe_id")
        print("  ✅ Index créé: employe_id")
        
        await db.planning.create_index([("date", 1), ("creneau", 1)])
        print("  ✅ Index composé créé: date + creneau")
        
        await db.planning.create_index([("date", 1), ("creneau", 1), ("employe_id", 1)])
        print("  ✅ Index composé créé: date + creneau + employe_id")
        
        # Index pour la collection demandes_conges
        print("\n🏖️ Collection: demandes_conges")
        await db.demandes_conges.create_index("utilisateur_id")
        print("  ✅ Index créé: utilisateur_id")
        
        await db.demandes_conges.create_index("statut")
        print("  ✅ Index créé: statut")
        
        await db.demandes_conges.create_index([("utilisateur_id", 1), ("statut", 1)])
        print("  ✅ Index composé créé: utilisateur_id + statut")
        
        # Index pour la collection assignations
        print("\n👥 Collection: assignations")
        await db.assignations.create_index("actif")
        print("  ✅ Index créé: actif")
        
        await db.assignations.create_index("medecin_id")
        print("  ✅ Index créé: medecin_id")
        
        await db.assignations.create_index("assistant_id")
        print("  ✅ Index créé: assistant_id")
        
        # Index pour la collection reservations_salles
        print("\n🏥 Collection: reservations_salles")
        await db.reservations_salles.create_index("date")
        print("  ✅ Index créé: date")
        
        await db.reservations_salles.create_index("salle_id")
        print("  ✅ Index créé: salle_id")
        
        await db.reservations_salles.create_index([("date", 1), ("creneau", 1), ("salle_id", 1)])
        print("  ✅ Index composé créé: date + creneau + salle_id")
        
        # Index pour la collection notifications
        print("\n🔔 Collection: notifications")
        await db.notifications.create_index([("employe_id", 1), ("date", 1)])
        print("  ✅ Index composé créé: employe_id + date")
        
        # Index pour la collection salles
        print("\n🏢 Collection: salles")
        await db.salles.create_index("actif")
        print("  ✅ Index créé: actif")
        
        await db.salles.create_index("nom")
        print("  ✅ Index créé: nom")
        
        print("\n" + "="*60)
        print("✅ TOUS LES INDEX ONT ÉTÉ CRÉÉS AVEC SUCCÈS !")
        print("="*60)
        
        # Afficher les index créés
        print("\n📋 Récapitulatif des index par collection:")
        
        collections = ['users', 'planning', 'demandes_conges', 'assignations', 
                      'reservations_salles', 'notifications', 'salles']
        
        for collection_name in collections:
            collection = db[collection_name]
            indexes = await collection.index_information()
            print(f"\n{collection_name}:")
            for index_name, index_info in indexes.items():
                if index_name != '_id_':  # Ignorer l'index _id par défaut
                    keys = index_info.get('key', [])
                    unique = ' (UNIQUE)' if index_info.get('unique', False) else ''
                    print(f"  • {index_name}: {keys}{unique}")
        
        print("\n" + "="*60)
        print("🎉 OPTIMISATION TERMINÉE !")
        print("="*60)
        print("\n💡 Les performances des requêtes devraient être considérablement améliorées.")
        print("📈 Les requêtes sur les champs indexés seront beaucoup plus rapides.")
        
    except Exception as e:
        print(f"\n❌ ERREUR: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        client.close()
    
    return True

if __name__ == "__main__":
    print("╔" + "="*58 + "╗")
    print("║  CRÉATION DES INDEX MONGODB - OPTIMISATION              ║")
    print("╚" + "="*58 + "╝")
    print()
    
    success = asyncio.run(create_indexes())
    
    if success:
        print("\n✅ Les index ont été créés avec succès !")
        sys.exit(0)
    else:
        print("\n❌ La création des index a échoué")
        sys.exit(1)
