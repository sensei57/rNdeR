#!/usr/bin/env python3
"""Script d'initialisation de la base de données avec un utilisateur directeur."""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import uuid
from datetime import datetime, timezone

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def init_database():
    """Initialise la base de données avec un utilisateur directeur."""
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'personnel_medical_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Check if users already exist
    user_count = await db.users.count_documents({})
    if user_count > 0:
        print(f"✅ La base de données contient déjà {user_count} utilisateur(s).")
        
        # Show existing directors
        directors = await db.users.find({"role": "Directeur"}).to_list(10)
        if directors:
            print("\n📋 Directeurs existants:")
            for director in directors:
                print(f"   - {director.get('prenom')} {director.get('nom')} ({director.get('email')})")
        
        client.close()
        return
    
    # Create default director user
    hashed_password = pwd_context.hash("admin123")
    
    director = {
        "id": str(uuid.uuid4()),
        "email": "directeur@cabinet.fr",
        "password_hash": hashed_password,
        "nom": "Martin",
        "prenom": "Pierre",
        "role": "Directeur",
        "actif": True,
        "date_creation": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(director)
    
    print("✅ Base de données initialisée avec succès!")
    print("\n🔐 Identifiants du directeur:")
    print(f"   Email: directeur@cabinet.fr")
    print(f"   Mot de passe: admin123")
    print("\n⚠️  Changez ce mot de passe après la première connexion!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(init_database())
