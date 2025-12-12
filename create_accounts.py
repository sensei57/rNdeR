import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv
import os
import uuid

# Charger les variables d'environnement
load_dotenv('/app/backend/.env')

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'gestion_cabinet')

# Configuration du hachage de mot de passe
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Liste des comptes à créer
accounts = [
    # Médecins
    {"nom": "Pintiliuc", "prenom": "Corina", "role": "Médecin", "email": "corina.pintiliuc@gmail.com"},
    {"nom": "Duprat", "prenom": "Francois", "role": "Médecin", "email": "francoisduprat2@gmail.com"},
    {"nom": "Weber-Elouardighi", "prenom": "Hind", "role": "Médecin", "email": "hindweber@outlook.com"},
    {"nom": "May", "prenom": "Inna", "role": "Médecin", "email": "ophtconseil@aol.com"},
    {"nom": "Lalangue", "prenom": "Jean-Christian", "role": "Médecin", "email": "jeanla1@outlook.com"},
    {"nom": "Dohmer-Chan", "prenom": "Joyce", "role": "Médecin", "email": "j.doehmer-chan@aen.lu"},
    {"nom": "Szabo", "prenom": "Julie", "role": "Médecin", "email": "szabo.julie@hotmail.com"},
    {"nom": "Bisorca-Gassendorf", "prenom": "Lukas", "role": "Médecin", "email": "dr.bisorca@gmail.com"},
    {"nom": "Terlinchamp", "prenom": "Matthieu", "role": "Médecin", "email": "matthieu.terlinchamp@gmail.com"},
    {"nom": "Hyzy", "prenom": "Nicoline", "role": "Médecin", "email": "nicoline.hyzy@gmx.de"},
    {"nom": "Mediavilla", "prenom": "Roger", "role": "Médecin", "email": "roger.mediavilla1@gmail.com"},
    {"nom": "Soto", "prenom": "Victor", "role": "Médecin", "email": "vssotob@gmail.com"},
    
    # Assistants
    {"nom": "Rosu", "prenom": "Andrada", "role": "Assistant", "email": "andrada_923@yahoo.com"},
    {"nom": "Hesse", "prenom": "Pauline", "role": "Assistant", "email": "paulinehesse15@gmail.com"},
    {"nom": "Muller", "prenom": "Alexia", "role": "Assistant", "email": "alexia.muller29@gmail.com"},
    {"nom": "Bimboes", "prenom": "Thomas", "role": "Assistant", "email": "thomas.bimboes@gmail.com"},
    {"nom": "Houdin", "prenom": "Julie", "role": "Assistant", "email": "julie.houdin@live.fr"},
    {"nom": "Härtwig", "prenom": "Isabel", "role": "Assistant", "email": "isabel.haertwig@web.de"},
    
    # Secrétaires
    {"nom": "Vuillermet", "prenom": "Agnès", "role": "Secrétaire", "email": "av.ophtaetoile@gmail.com"},
    {"nom": "Monteiro", "prenom": "Marta", "role": "Secrétaire", "email": "martamonteiro969@gmail.com"},
    {"nom": "Kohn", "prenom": "Nathalie", "role": "Secrétaire", "email": "nathaliekohn1@gmail.com"},
    {"nom": "Antonacci", "prenom": "Chiara", "role": "Secrétaire", "email": "chiaraant1008@outlook.fr"},
    {"nom": "Ferreira de Sousa", "prenom": "Patrick", "role": "Secrétaire", "email": "patrick sousa1992@hotmail.fr"},
    {"nom": "Jacinto", "prenom": "Mélanie", "role": "Secrétaire", "email": "jacinto.melanie@hotmail.com"},
    {"nom": "Heftrich", "prenom": "Juliette", "role": "Secrétaire", "email": "julieheftrich@yahoo.com"},
]

async def create_accounts():
    """Créer tous les comptes dans la base de données"""
    
    # Connexion à MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    users_collection = db['users']
    
    # Mot de passe pour tous les comptes
    password = "azerty"
    hashed_password = pwd_context.hash(password)
    
    print(f"🔗 Connexion à MongoDB: {MONGO_URL}")
    print(f"📊 Base de données: {DB_NAME}")
    print(f"👥 Nombre de comptes à créer: {len(accounts)}")
    print("\n" + "="*60)
    
    created_count = 0
    skipped_count = 0
    
    for account in accounts:
        email = account['email']
        
        # Vérifier si l'utilisateur existe déjà
        existing_user = await users_collection.find_one({"email": email})
        
        if existing_user:
            print(f"⚠️  EXISTE DÉJÀ: {account['prenom']} {account['nom']} ({account['role']}) - {email}")
            skipped_count += 1
            continue
        
        # Créer l'utilisateur
        user_data = {
            "id": str(uuid.uuid4()),
            "email": email,
            "password_hash": hashed_password,
            "nom": account['nom'],
            "prenom": account['prenom'],
            "role": account['role'],
            "actif": True,
            "telephone": "",  # À ajouter manuellement plus tard
            "date_creation": None,
            "is_protected": False
        }
        
        await users_collection.insert_one(user_data)
        print(f"✅ CRÉÉ: {account['prenom']} {account['nom']} ({account['role']}) - {email}")
        created_count += 1
    
    print("\n" + "="*60)
    print(f"\n📊 RÉSUMÉ:")
    print(f"   ✅ Comptes créés: {created_count}")
    print(f"   ⚠️  Comptes déjà existants: {skipped_count}")
    print(f"   📝 Total dans la liste: {len(accounts)}")
    print(f"\n🔑 Mot de passe pour tous les comptes: azerty")
    print(f"📞 Les numéros de téléphone peuvent être ajoutés manuellement plus tard")
    
    # Afficher le récapitulatif par rôle
    medecins = [a for a in accounts if a['role'] == 'Médecin']
    assistants = [a for a in accounts if a['role'] == 'Assistant']
    secretaires = [a for a in accounts if a['role'] == 'Secrétaire']
    
    print(f"\n📋 RÉPARTITION PAR RÔLE:")
    print(f"   👨‍⚕️ Médecins: {len(medecins)}")
    print(f"   👥 Assistants: {len(assistants)}")
    print(f"   📝 Secrétaires: {len(secretaires)}")
    
    # Fermer la connexion
    client.close()

if __name__ == "__main__":
    asyncio.run(create_accounts())
