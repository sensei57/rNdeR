"""Configuration et constantes de l'application"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Charger les variables d'environnement
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
MONGO_URL = os.environ.get('MONGO_URL', '')
DB_NAME = os.environ.get('DB_NAME', 'cabinet_medical')

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'default_key')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# CORS
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000')
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '').split(',') if os.environ.get('CORS_ORIGINS') else []

# Rôles utilisateurs
ROLES = {
    "SUPER_ADMIN": "Super-Admin",
    "MANAGER": "Manager",
    "DIRECTEUR": "Directeur",
    "MEDECIN": "Médecin",
    "ASSISTANT": "Assistant",
    "SECRETAIRE": "Secrétaire"
}

# Droits des managers
MANAGER_PERMISSIONS = {
    "gerer_planning": True,
    "gerer_conges": True,
    "gerer_personnel": False,
    "voir_statistiques": True,
    "envoyer_notifications": True,
}

# Salles
SALLES_MEDECINS = ["1", "2", "3", "4", "5", "6"]
SALLES_ASSISTANTS = ["A", "B", "C", "D", "O", "Blue"]

# Créneaux
CRENEAU_TYPES = ["MATIN", "APRES_MIDI"]

# Rubriques disponibles
RUBRIQUES_DISPONIBLES = [
    {"id": "dashboard", "nom": "Tableau de bord", "description": "Vue d'ensemble du centre"},
    {"id": "planning", "nom": "Planning", "description": "Gestion des créneaux et plannings"},
    {"id": "conges", "nom": "Congés", "description": "Demandes et gestion des congés"},
    {"id": "personnel", "nom": "Personnel", "description": "Liste et gestion du personnel"},
    {"id": "chat", "nom": "Messagerie", "description": "Chat interne"},
    {"id": "cabinet", "nom": "Plan du Cabinet", "description": "Disposition des salles"},
    {"id": "stocks", "nom": "Stocks", "description": "Gestion des stocks"},
    {"id": "statistiques", "nom": "Statistiques", "description": "Rapports et analyses"},
]
