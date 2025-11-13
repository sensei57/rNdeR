#!/usr/bin/env python3
"""
Script d'initialisation de la base de données de production
Créé les utilisateurs par défaut et les données nécessaires
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime, timezone

# Add backend to path
backend_path = Path(__file__).parent.parent / 'backend'
sys.path.insert(0, str(backend_path))

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

# Load environment variables
env_path = backend_path / '.env'
load_dotenv(env_path)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'gestion_cabinet')

# Rôles
DIRECTEUR = "Directeur"
MEDECIN = "Médecin"
ASSISTANT = "Assistant"
SECRETAIRE = "Secrétaire"

def hash_password(password: str) -> str:
    """Hash un mot de passe"""
    return pwd_context.hash(password)

async def init_database():
    """Initialize the database with default users and rooms"""
    
    print(f"🔗 Connexion à MongoDB: {MONGO_URL}")
    print(f"📦 Base de données: {DB_NAME}")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Check if database is already initialized
        existing_users = await db.users.count_documents({})
        if existing_users > 0:
            print(f"⚠️  La base de données contient déjà {existing_users} utilisateurs.")
            response = input("Voulez-vous réinitialiser la base de données ? (oui/non): ")
            if response.lower() != 'oui':
                print("❌ Annulé par l'utilisateur")
                return
            
            # Drop collections
            print("🗑️  Suppression des collections existantes...")
            await db.users.drop()
            await db.salles.drop()
            await db.configuration.drop()
            print("✅ Collections supprimées")
        
        print("\n" + "="*60)
        print("🚀 INITIALISATION DE LA BASE DE DONNÉES")
        print("="*60)
        
        # 1. Créer les utilisateurs
        print("\n👥 Création des utilisateurs...")
        
        users = [
            {
                "id": "user-directeur-001",
                "email": "directeur@cabinet.fr",
                "password_hash": hash_password("admin123"),
                "prenom": "Pierre",
                "nom": "Martin",
                "role": DIRECTEUR,
                "telephone": "0601020304",
                "actif": True,
                "date_creation": datetime.now(timezone.utc),
                "derniere_connexion": None
            },
            {
                "id": "user-medecin-001",
                "email": "dr.dupont@cabinet.fr",
                "password_hash": hash_password("medecin123"),
                "prenom": "Marie",
                "nom": "Dupont",
                "role": MEDECIN,
                "telephone": "0612345678",
                "specialite": "Médecine générale",
                "actif": True,
                "date_creation": datetime.now(timezone.utc),
                "derniere_connexion": None
            },
            {
                "id": "user-medecin-002",
                "email": "dr.bernard@cabinet.fr",
                "password_hash": hash_password("medecin123"),
                "prenom": "Jean",
                "nom": "Bernard",
                "role": MEDECIN,
                "telephone": "0623456789",
                "specialite": "Pédiatrie",
                "actif": True,
                "date_creation": datetime.now(timezone.utc),
                "derniere_connexion": None
            },
            {
                "id": "user-assistant-001",
                "email": "julie.moreau@cabinet.fr",
                "password_hash": hash_password("assistant123"),
                "prenom": "Julie",
                "nom": "Moreau",
                "role": ASSISTANT,
                "telephone": "0634567890",
                "actif": True,
                "date_creation": datetime.now(timezone.utc),
                "derniere_connexion": None
            },
            {
                "id": "user-assistant-002",
                "email": "sophie.petit@cabinet.fr",
                "password_hash": hash_password("assistant123"),
                "prenom": "Sophie",
                "nom": "Petit",
                "role": ASSISTANT,
                "telephone": "0645678901",
                "actif": True,
                "date_creation": datetime.now(timezone.utc),
                "derniere_connexion": None
            },
            {
                "id": "user-secretaire-001",
                "email": "emma.leroy@cabinet.fr",
                "password_hash": hash_password("secretaire123"),
                "prenom": "Emma",
                "nom": "Leroy",
                "role": SECRETAIRE,
                "telephone": "0656789012",
                "actif": True,
                "date_creation": datetime.now(timezone.utc),
                "derniere_connexion": None
            }
        ]
        
        result = await db.users.insert_many(users)
        print(f"✅ {len(result.inserted_ids)} utilisateurs créés")
        
        for user in users:
            print(f"   ✓ {user['prenom']} {user['nom']} ({user['role']}) - {user['email']}")
        
        # 2. Créer les salles
        print("\n🏥 Création des salles...")
        
        salles = [
            {
                "id": "salle-001",
                "nom": "Cabinet 1",
                "type_salle": "Cabinet médical",
                "capacite": 1,
                "equipements": ["Bureau", "Chaise", "Ordinateur", "Lit d'examen"],
                "actif": True,
                "position_x": 100,
                "position_y": 100
            },
            {
                "id": "salle-002",
                "nom": "Cabinet 2",
                "type_salle": "Cabinet médical",
                "capacite": 1,
                "equipements": ["Bureau", "Chaise", "Ordinateur", "Lit d'examen"],
                "actif": True,
                "position_x": 300,
                "position_y": 100
            },
            {
                "id": "salle-003",
                "nom": "Salle de soin 1",
                "type_salle": "Salle de soin",
                "capacite": 2,
                "equipements": ["Lit", "Chaise", "Armoire médicale", "Lavabo"],
                "actif": True,
                "position_x": 100,
                "position_y": 300
            },
            {
                "id": "salle-004",
                "nom": "Salle de soin 2",
                "type_salle": "Salle de soin",
                "capacite": 2,
                "equipements": ["Lit", "Chaise", "Armoire médicale", "Lavabo"],
                "actif": True,
                "position_x": 300,
                "position_y": 300
            },
            {
                "id": "salle-005",
                "nom": "Salle d'attente",
                "type_salle": "Salle d'attente",
                "capacite": 10,
                "equipements": ["Chaises", "Table basse", "Magazines"],
                "actif": True,
                "position_x": 200,
                "position_y": 500
            }
        ]
        
        result = await db.salles.insert_many(salles)
        print(f"✅ {len(result.inserted_ids)} salles créées")
        
        for salle in salles:
            print(f"   ✓ {salle['nom']} ({salle['type_salle']})")
        
        # 3. Créer la configuration
        print("\n⚙️  Création de la configuration...")
        
        configuration = {
            "id": "config-001",
            "max_medecins_par_creneau": 6,
            "max_assistants_par_creneau": 8,
            "horaires_matin": {
                "debut": "08:00",
                "fin": "12:00"
            },
            "horaires_apres_midi": {
                "debut": "14:00",
                "fin": "18:00"
            },
            "delai_notification_jours": 7,
            "actif": True
        }
        
        await db.configuration.insert_one(configuration)
        print("✅ Configuration créée")
        
        # Vérification finale
        print("\n" + "="*60)
        print("🎯 VÉRIFICATION FINALE")
        print("="*60)
        
        user_count = await db.users.count_documents({})
        salle_count = await db.salles.count_documents({})
        config_count = await db.configuration.count_documents({})
        
        print(f"✅ Utilisateurs: {user_count}")
        print(f"✅ Salles: {salle_count}")
        print(f"✅ Configuration: {config_count}")
        
        print("\n" + "="*60)
        print("🎉 INITIALISATION TERMINÉE AVEC SUCCÈS !")
        print("="*60)
        
        print("\n📝 IDENTIFIANTS DE CONNEXION:")
        print("-" * 60)
        print("Directeur:")
        print("  Email: directeur@cabinet.fr")
        print("  Mot de passe: admin123")
        print("\nMédecins:")
        print("  Email: dr.dupont@cabinet.fr")
        print("  Mot de passe: medecin123")
        print("\n  Email: dr.bernard@cabinet.fr")
        print("  Mot de passe: medecin123")
        print("\nAssistants:")
        print("  Email: julie.moreau@cabinet.fr")
        print("  Mot de passe: assistant123")
        print("\n  Email: sophie.petit@cabinet.fr")
        print("  Mot de passe: assistant123")
        print("\nSecrétaire:")
        print("  Email: emma.leroy@cabinet.fr")
        print("  Mot de passe: secretaire123")
        print("-" * 60)
        
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
    print("║  SCRIPT D'INITIALISATION - CABINET MÉDICAL            ║")
    print("╚" + "="*58 + "╝")
    print()
    
    success = asyncio.run(init_database())
    
    if success:
        print("\n✅ La base de données est prête !")
        sys.exit(0)
    else:
        print("\n❌ L'initialisation a échoué")
        sys.exit(1)
