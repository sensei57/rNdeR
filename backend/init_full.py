#!/usr/bin/env python3
"""Script d'initialisation complète de la base de données."""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import uuid
from datetime import datetime, timezone

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def init_full_database():
    """Initialise la base de données avec des données de test complètes."""
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'personnel_medical_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🔧 Initialisation de la base de données...")
    
    # Check if users already exist
    user_count = await db.users.count_documents({})
    
    print("\n👥 Création des utilisateurs...")
    
    if user_count == 0:
        # Create all users
        users = [
            {
                "id": str(uuid.uuid4()),
                "email": "directeur@cabinet.fr",
                "password_hash": pwd_context.hash("admin123"),
                "nom": "Martin",
                "prenom": "Pierre",
                "role": "Directeur",
                "actif": True,
                "date_creation": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "email": "dr.dupont@cabinet.fr",
                "password_hash": pwd_context.hash("medecin123"),
                "nom": "Dupont",
                "prenom": "Marie",
                "role": "Médecin",
                "actif": True,
                "date_creation": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "email": "dr.bernard@cabinet.fr",
                "password_hash": pwd_context.hash("medecin123"),
                "nom": "Bernard",
                "prenom": "Jean",
                "role": "Médecin",
                "actif": True,
                "date_creation": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "email": "assistant1@cabinet.fr",
                "password_hash": pwd_context.hash("assistant123"),
                "nom": "Moreau",
                "prenom": "Julie",
                "role": "Assistant",
                "actif": True,
                "date_creation": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "email": "assistant2@cabinet.fr",
                "password_hash": pwd_context.hash("assistant123"),
                "nom": "Petit",
                "prenom": "Sophie",
                "role": "Assistant",
                "actif": True,
                "date_creation": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "email": "secretaire@cabinet.fr",
                "password_hash": pwd_context.hash("secretaire123"),
                "nom": "Leroy",
                "prenom": "Emma",
                "role": "Secrétaire",
                "actif": True,
                "date_creation": datetime.now(timezone.utc)
            }
        ]
        
        await db.users.insert_many(users)
        print(f"   ✅ {len(users)} utilisateurs créés")
    else:
        # Add missing users
        missing_users = []
        
        # Check for each user
        user_emails = [
            ("dr.dupont@cabinet.fr", "Dupont", "Marie", "Médecin", "medecin123"),
            ("dr.bernard@cabinet.fr", "Bernard", "Jean", "Médecin", "medecin123"),
            ("assistant1@cabinet.fr", "Moreau", "Julie", "Assistant", "assistant123"),
            ("assistant2@cabinet.fr", "Petit", "Sophie", "Assistant", "assistant123"),
            ("secretaire@cabinet.fr", "Leroy", "Emma", "Secrétaire", "secretaire123")
        ]
        
        for email, nom, prenom, role, password in user_emails:
            existing = await db.users.find_one({"email": email})
            if not existing:
                missing_users.append({
                    "id": str(uuid.uuid4()),
                    "email": email,
                    "password_hash": pwd_context.hash(password),
                    "nom": nom,
                    "prenom": prenom,
                    "role": role,
                    "actif": True,
                    "date_creation": datetime.now(timezone.utc)
                })
        
        if missing_users:
            await db.users.insert_many(missing_users)
            print(f"   ✅ {len(missing_users)} utilisateur(s) ajouté(s)")
        
        print(f"   ℹ️  Total: {user_count + len(missing_users)} utilisateur(s)")
    
    # Create default configuration
    config_count = await db.configuration.count_documents({})
    if config_count == 0:
        print("\n⚙️  Création de la configuration par défaut...")
        
        config = {
            "id": str(uuid.uuid4()),
            "max_medecins_par_jour": 4,
            "max_assistants_par_jour": 6,
            "heures_ouverture_matin_debut": "08:00",
            "heures_ouverture_matin_fin": "12:00",
            "heures_ouverture_apres_midi_debut": "14:00",
            "heures_ouverture_apres_midi_fin": "18:00",
            "date_modification": datetime.now(timezone.utc)
        }
        
        await db.configuration.insert_one(config)
        print("   ✅ Configuration créée")
    else:
        print("   ℹ️  Configuration déjà présente")
    
    # Create some default rooms
    salle_count = await db.salles.count_documents({})
    if salle_count == 0:
        print("\n🏥 Création des salles par défaut...")
        
        salles = [
            {
                "id": str(uuid.uuid4()),
                "nom": "Cabinet 1",
                "type_salle": "MEDECIN",
                "position_x": 100,
                "position_y": 100,
                "couleur": "#3B82F6",
                "actif": True,
                "date_creation": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "nom": "Cabinet 2",
                "type_salle": "MEDECIN",
                "position_x": 300,
                "position_y": 100,
                "couleur": "#10B981",
                "actif": True,
                "date_creation": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "nom": "Salle de soin 1",
                "type_salle": "ASSISTANT",
                "position_x": 100,
                "position_y": 300,
                "couleur": "#F59E0B",
                "actif": True,
                "date_creation": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "nom": "Salle de soin 2",
                "type_salle": "ASSISTANT",
                "position_x": 300,
                "position_y": 300,
                "couleur": "#EF4444",
                "actif": True,
                "date_creation": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "nom": "Salle d'attente",
                "type_salle": "ATTENTE",
                "position_x": 200,
                "position_y": 200,
                "couleur": "#8B5CF6",
                "actif": True,
                "date_creation": datetime.now(timezone.utc)
            }
        ]
        
        await db.salles.insert_many(salles)
        print(f"   ✅ {len(salles)} salles créées")
    else:
        print(f"   ℹ️  {salle_count} salle(s) déjà présente(s)")
    
    print("\n" + "="*60)
    print("✅ Base de données initialisée avec succès!")
    print("="*60)
    print("\n🔐 Identifiants de connexion:")
    print("\n   👔 Directeur:")
    print("      Email: directeur@cabinet.fr")
    print("      Mot de passe: admin123")
    print("\n   👨‍⚕️  Médecins:")
    print("      Email: dr.dupont@cabinet.fr / dr.bernard@cabinet.fr")
    print("      Mot de passe: medecin123")
    print("\n   👩‍⚕️  Assistants:")
    print("      Email: assistant1@cabinet.fr / assistant2@cabinet.fr")
    print("      Mot de passe: assistant123")
    print("\n   📋 Secrétaire:")
    print("      Email: secretaire@cabinet.fr")
    print("      Mot de passe: secretaire123")
    print("\n⚠️  Changez ces mots de passe après la première connexion!")
    print("="*60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(init_full_database())
