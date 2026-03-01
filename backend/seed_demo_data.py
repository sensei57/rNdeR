#!/usr/bin/env python3
"""
Script de seed pour ajouter des données de démonstration.
Ajoute des employés, des demandes de congés, des actualités, etc.
"""

import asyncio
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime, timezone, timedelta

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

async def seed_demo_data():
    """Ajoute des données de démonstration à la base de données."""
    
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'cabinet_medical')
    
    if not mongo_url:
        print("❌ MONGO_URL non défini")
        return
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🌱 Seed des données de démonstration...")
    
    # 1. Récupérer le premier centre existant
    centre = await db.centres.find_one({"actif": True})
    centre_id = centre["id"] if centre else None
    
    if not centre_id:
        print("⚠️ Aucun centre trouvé. Création d'un centre par défaut...")
        centre_id = str(uuid.uuid4())
        await db.centres.insert_one({
            "id": centre_id,
            "nom": "Centre Principal",
            "adresse": "1 rue de la Santé",
            "actif": True,
            "date_creation": datetime.now(timezone.utc)
        })
        print(f"✅ Centre créé: {centre_id}")
    else:
        print(f"✅ Centre existant: {centre.get('nom')} ({centre_id[:8]}...)")
    
    # 2. Récupérer le directeur existant
    directeur = await db.users.find_one({"$or": [{"role": "Directeur"}, {"role": "Super-Admin"}]})
    if not directeur:
        print("❌ Aucun directeur trouvé. Lancez d'abord init_db.py")
        client.close()
        return
    
    directeur_id = directeur["id"]
    print(f"✅ Directeur: {directeur.get('prenom')} {directeur.get('nom')}")
    
    # Mettre à jour le directeur avec le centre
    await db.users.update_one(
        {"id": directeur_id},
        {"$set": {"centre_id": centre_id, "centre_ids": [centre_id]}}
    )
    
    # 3. Créer des employés de démo avec dates de naissance
    employes_demo = [
        {
            "id": str(uuid.uuid4()),
            "email": "julie.martin@cabinet.fr",
            "password_hash": pwd_context.hash("employee123"),
            "nom": "MARTIN",
            "prenom": "Julie",
            "role": "Assistant",
            "date_naissance": "1992-03-27",  # Format YYYY-MM-DD
            "telephone": "0612345678",
            "centre_id": centre_id,
            "centre_ids": [centre_id],
            "actif": True,
            "date_creation": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "email": "thomas.dubois@cabinet.fr",
            "password_hash": pwd_context.hash("employee123"),
            "nom": "DUBOIS",
            "prenom": "Thomas",
            "role": "Médecin",
            "date_naissance": "1985-07-15",
            "telephone": "0687654321",
            "centre_id": centre_id,
            "centre_ids": [centre_id],
            "actif": True,
            "date_creation": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "email": "sophie.bernard@cabinet.fr",
            "password_hash": pwd_context.hash("employee123"),
            "nom": "BERNARD",
            "prenom": "Sophie",
            "role": "Secrétaire",
            "date_naissance": "1990-12-03",
            "telephone": "0698765432",
            "centre_id": centre_id,
            "centre_ids": [centre_id],
            "actif": True,
            "date_creation": datetime.now(timezone.utc)
        }
    ]
    
    for emp in employes_demo:
        existing = await db.users.find_one({"email": emp["email"]})
        if not existing:
            await db.users.insert_one(emp)
            print(f"✅ Employé créé: {emp['prenom']} {emp['nom']} ({emp['role']}) - Anniversaire: {emp['date_naissance']}")
        else:
            # Mettre à jour avec date_naissance et centre si manquants
            await db.users.update_one(
                {"email": emp["email"]},
                {"$set": {
                    "date_naissance": emp["date_naissance"],
                    "centre_id": centre_id,
                    "centre_ids": [centre_id]
                }}
            )
            print(f"✅ Employé mis à jour: {emp['prenom']} {emp['nom']}")
    
    # 4. Créer des demandes de congés de démo
    julie = await db.users.find_one({"email": "julie.martin@cabinet.fr"})
    thomas = await db.users.find_one({"email": "thomas.dubois@cabinet.fr"})
    
    if julie and thomas:
        conges_demo = [
            {
                "id": str(uuid.uuid4()),
                "utilisateur_id": julie["id"],
                "type_conge": "Congés payés",
                "date_debut": (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d"),
                "date_fin": (datetime.now() + timedelta(days=21)).strftime("%Y-%m-%d"),
                "motif": "Vacances d'été",
                "statut": "en_attente",
                "centre_id": centre_id,
                "date_demande": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "utilisateur_id": thomas["id"],
                "type_conge": "RTT",
                "date_debut": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
                "date_fin": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
                "motif": "Rendez-vous personnel",
                "statut": "en_attente",
                "centre_id": centre_id,
                "date_demande": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "utilisateur_id": julie["id"],
                "type_conge": "Maladie",
                "date_debut": (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d"),
                "date_fin": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
                "motif": "Grippe",
                "statut": "approuve",
                "centre_id": centre_id,
                "date_demande": datetime.now(timezone.utc) - timedelta(days=6)
            }
        ]
        
        existing_conges = await db.demandes_conges.count_documents({"centre_id": centre_id})
        if existing_conges == 0:
            await db.demandes_conges.insert_many(conges_demo)
            print(f"✅ {len(conges_demo)} demandes de congés créées")
        else:
            print(f"ℹ️ {existing_conges} congés déjà existants pour ce centre")
    
    # 5. Créer une actualité de démo
    existing_actus = await db.actualites.count_documents({"centre_id": centre_id})
    if existing_actus == 0:
        actu_demo = {
            "id": str(uuid.uuid4()),
            "titre": "Bienvenue sur l'application !",
            "contenu": "Cette application vous permet de gérer le planning, les congés et les actualités de votre cabinet médical.",
            "groupe_cible": "tous",
            "centre_id": centre_id,
            "auteur_id": directeur_id,
            "date_creation": datetime.now(timezone.utc),
            "actif": True,
            "priorite": 1,
            "signature_requise": False
        }
        await db.actualites.insert_one(actu_demo)
        print("✅ Actualité de bienvenue créée")
    
    print("\n🎉 Seed terminé avec succès!")
    print(f"\n📋 Résumé:")
    print(f"   - Centre: {centre.get('nom') if centre else 'Centre Principal'}")
    print(f"   - Employés avec anniversaires: Julie (27/03), Thomas (15/07), Sophie (03/12)")
    print(f"   - Demandes de congés: 3 (en attente et approuvé)")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_demo_data())
