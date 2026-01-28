#!/usr/bin/env python3
import asyncio, os, uuid
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime, timezone

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

async def init_francis_complet():
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'ope91')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # 1. Création de TOI (Francis)
    await db.users.delete_many({"email": "directeur@cabinet.fr"})
    await db.users.insert_one({
        "id": str(uuid.uuid4()), "email": "directeur@cabinet.fr",
        "password_hash": pwd_context.hash("admin123"),
        "nom": "LEBLOND", "prenom": "Francis", "role": "Directeur",
        "actif": True, "date_creation": datetime.now(timezone.utc)
    })

    # 2. Création des Salles (Le décor)
    if await db.salles.count_documents({}) == 0:
        salles = [
            {"id": str(uuid.uuid4()), "nom": "Cabinet 1", "type_salle": "MEDECIN", "position_x": 100, "position_y": 100, "couleur": "#3B82F6", "actif": True},
            {"id": str(uuid.uuid4()), "nom": "Salle d'attente", "type_salle": "ATTENTE", "position_x": 200, "position_y": 200, "couleur": "#8B5CF6", "actif": True}
        ]
        await db.salles.insert_many(salles)

    print("✅ COMPTE FRANCIS CRÉÉ ET SALLES INSTALLÉES !")
    client.close()

if __name__ == "__main__":
    asyncio.run(init_francis_complet())
