#!/usr/bin/env python3
"""
Script de migration pour assigner un centre_id par défaut aux données orphelines.
Assigne le premier centre actif aux:
- Demandes de congés sans centre_id
- Employés sans centre_id
- Actualités sans centre_id
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def migrate_centre_id():
    """Assigne le centre par défaut aux données orphelines."""
    
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'cabinet_medical')
    
    if not mongo_url:
        print("❌ MONGO_URL non défini")
        return
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🔄 Migration des données sans centre_id...")
    
    # 1. Récupérer le centre par défaut (premier centre actif)
    centre_defaut = await db.centres.find_one({"actif": True}, sort=[("date_creation", 1)])
    
    if not centre_defaut:
        print("❌ Aucun centre actif trouvé. Créez d'abord un centre.")
        client.close()
        return
    
    centre_id = centre_defaut["id"]
    print(f"✅ Centre par défaut: {centre_defaut.get('nom')} ({centre_id[:8]}...)")
    
    # 2. Migrer les demandes de congés
    result_conges = await db.demandes_conges.update_many(
        {"$or": [
            {"centre_id": None},
            {"centre_id": {"$exists": False}},
            {"centre_id": ""}
        ]},
        {"$set": {"centre_id": centre_id}}
    )
    print(f"📋 Congés migrés: {result_conges.modified_count}")
    
    # 3. Migrer les employés (users)
    result_users = await db.users.update_many(
        {"$and": [
            {"role": {"$ne": "Directeur"}},  # Ne pas toucher aux directeurs
            {"role": {"$ne": "Super-Admin"}},
            {"$or": [
                {"centre_id": None},
                {"centre_id": {"$exists": False}},
                {"centre_id": ""}
            ]}
        ]},
        {"$set": {"centre_id": centre_id, "centre_ids": [centre_id]}}
    )
    print(f"👥 Employés migrés: {result_users.modified_count}")
    
    # 4. Migrer les actualités
    result_actus = await db.actualites.update_many(
        {"$or": [
            {"centre_id": None},
            {"centre_id": {"$exists": False}},
            {"centre_id": ""}
        ]},
        {"$set": {"centre_id": centre_id}}
    )
    print(f"📰 Actualités migrées: {result_actus.modified_count}")
    
    # 5. Migrer les plannings
    result_planning = await db.planning.update_many(
        {"$or": [
            {"centre_id": None},
            {"centre_id": {"$exists": False}},
            {"centre_id": ""}
        ]},
        {"$set": {"centre_id": centre_id}}
    )
    print(f"📅 Plannings migrés: {result_planning.modified_count}")
    
    # 6. Migrer les salles
    result_salles = await db.salles.update_many(
        {"$or": [
            {"centre_id": None},
            {"centre_id": {"$exists": False}},
            {"centre_id": ""}
        ]},
        {"$set": {"centre_id": centre_id}}
    )
    print(f"🏠 Salles migrées: {result_salles.modified_count}")
    
    print("\n🎉 Migration terminée!")
    print(f"\nToutes les données orphelines ont été assignées au centre: {centre_defaut.get('nom')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_centre_id())
