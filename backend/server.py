from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import bcrypt
from contextlib import asynccontextmanager
import asyncio

# Scheduler pour les notifications automatiques
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ['SECRET_KEY']
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
security = HTTPBearer()

# Scheduler global
scheduler = AsyncIOScheduler(timezone="Europe/Paris")

# Fonction de notification automatique à 7h
async def send_morning_planning_notifications():
    """Envoie les notifications de planning à 7h du matin à tous les employés qui travaillent aujourd'hui"""
    from push_notifications import send_push_notification
    
    try:
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        print(f"🔔 [CRON 7h] Envoi des notifications de planning pour {today}")
        
        # Récupérer tous les créneaux du jour
        creneaux = await db.planning.find({"date": today, "est_repos": {"$ne": True}}).to_list(1000)
        
        # Grouper par employé
        employees_planning = {}
        for creneau in creneaux:
            emp_id = creneau.get("employe_id")
            if emp_id not in employees_planning:
                employees_planning[emp_id] = []
            employees_planning[emp_id].append(creneau)
        
        notifications_sent = 0
        
        for emp_id, emp_creneaux in employees_planning.items():
            # Récupérer l'utilisateur
            user = await db.users.find_one({"id": emp_id, "actif": True})
            if not user:
                continue
            
            # Construire le message
            creneaux_text = []
            for c in emp_creneaux:
                salle = c.get("salle_nom") or c.get("salle_id") or "Non assigné"
                creneau_type = "Matin" if c.get("creneau") == "MATIN" else "Après-midi"
                creneaux_text.append(f"{creneau_type}: Salle {salle}")
            
            # Récupérer le centre
            centre_id = user.get("centre_id") or (user.get("centre_ids", [None])[0])
            centre = await db.centres.find_one({"id": centre_id}) if centre_id else None
            centre_nom = centre.get("nom", "") if centre else ""
            
            message = f"Votre planning du jour:\n" + "\n".join(creneaux_text)
            if centre_nom:
                message = f"📍 {centre_nom}\n" + message
            
            # Envoyer la notification
            fcm_token = user.get("fcm_token")
            fcm_devices = user.get("fcm_devices", [])
            
            if fcm_token:
                await send_push_notification(fcm_token, "📅 Votre planning du jour", message, {"type": "daily_planning"})
                notifications_sent += 1
            
            for device in fcm_devices:
                if device.get("token"):
                    await send_push_notification(device["token"], "📅 Votre planning du jour", message, {"type": "daily_planning"})
                    notifications_sent += 1
        
        print(f"✅ [CRON 7h] {notifications_sent} notifications envoyées à {len(employees_planning)} employés")
        
    except Exception as e:
        print(f"❌ [CRON 7h] Erreur: {e}")

# Lifecycle events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Démarrage du serveur...")
    
    # Configurer le scheduler pour 7h du matin (heure de Paris)
    scheduler.add_job(
        send_morning_planning_notifications,
        CronTrigger(hour=7, minute=0, timezone="Europe/Paris"),
        id="daily_planning_notification",
        replace_existing=True
    )
    scheduler.start()
    print("⏰ Scheduler activé - Notifications de planning à 7h chaque jour")
    
    yield
    
    # Shutdown
    scheduler.shutdown()
    print("🛑 Serveur arrêté")

# Create the main app with lifespan
app = FastAPI(title="Gestion Personnel Médical", lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums and Constants
ROLES = {
    "SUPER_ADMIN": "Super-Admin",  # Directeur général - gère tous les centres
    "MANAGER": "Manager",  # Directeur de centre - droits limités sur un centre
    "DIRECTEUR": "Directeur",  # Legacy - sera traité comme Super-Admin
    "MEDECIN": "Médecin", 
    "ASSISTANT": "Assistant",
    "SECRETAIRE": "Secrétaire"
}

# Droits des managers (peuvent être activés/désactivés par le Super-Admin)
MANAGER_PERMISSIONS = {
    "gerer_planning": True,  # Créer/modifier le planning
    "gerer_conges": True,  # Approuver les congés
    "gerer_personnel": False,  # Créer/modifier les employés
    "voir_statistiques": True,  # Voir les stats du centre
    "envoyer_notifications": True,  # Envoyer des notifications
}

SALLES_MEDECINS = ["1", "2", "3", "4", "5", "6"]
SALLES_ASSISTANTS = ["A", "B", "C", "D", "O", "Blue"]

CRENEAU_TYPES = ["MATIN", "APRES_MIDI"]

# ===== MODÈLES CENTRES =====

# Rubriques disponibles dans l'application
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

class CentreConfig(BaseModel):
    """Configuration des rubriques visibles pour un centre"""
    rubriques_actives: List[str] = ["dashboard", "planning", "conges", "personnel", "chat", "cabinet"]

class CentreBase(BaseModel):
    nom: str
    adresse: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    actif: bool = True
    config: Optional[CentreConfig] = None  # Configuration des rubriques

class CentreCreate(CentreBase):
    pass

class Centre(CentreBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cree_par: Optional[str] = None  # ID du Super-Admin qui a créé le centre

class CentreUpdate(BaseModel):
    nom: Optional[str] = None
    adresse: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    actif: Optional[bool] = None
    config: Optional[CentreConfig] = None

# Permissions détaillées pour les managers
class ManagerPermissions(BaseModel):
    # Rubriques accessibles
    rubriques_visibles: List[str] = ["dashboard", "planning", "conges", "personnel", "chat", "cabinet"]
    
    # Droits de modification
    peut_modifier_planning: bool = True
    peut_approuver_conges: bool = True
    peut_gerer_personnel: bool = False  # Créer/modifier des employés
    peut_voir_statistiques: bool = True
    peut_envoyer_notifications: bool = True
    peut_gerer_salles: bool = False
    peut_gerer_stocks: bool = False

# Configuration de visibilité pour un employé
class EmployeeVisibility(BaseModel):
    """Définit ce qu'un employé peut voir"""
    peut_voir_tous_employes: bool = True  # Voir tous les employés du centre
    peut_voir_planning_complet: bool = False  # Voir le planning de tous
    employes_visibles: Optional[List[str]] = None  # Liste spécifique d'IDs d'employés visibles (si pas tous)

# ===== MODÈLE DEMANDE D'INSCRIPTION =====

class InscriptionRequest(BaseModel):
    email: EmailStr
    nom: str
    prenom: str
    telephone: Optional[str] = None
    centre_id: str
    role_souhaite: str  # Le rôle demandé par l'utilisateur
    message: Optional[str] = None  # Message optionnel pour la demande

class Inscription(InscriptionRequest):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date_demande: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    statut: str = "EN_ATTENTE"  # EN_ATTENTE, APPROUVE, REJETE
    traite_par: Optional[str] = None  # ID du Super-Admin qui a traité la demande
    date_traitement: Optional[datetime] = None
    commentaire_admin: Optional[str] = None

# Models
class UserBase(BaseModel):
    email: EmailStr
    nom: str
    prenom: str
    role: str
    centre_ids: Optional[List[str]] = []  # Liste des centres auxquels l'employé appartient
    centre_id: Optional[str] = None  # Centre principal (legacy/compatibilité)
    centre_actif_id: Optional[str] = None  # Centre actuellement sélectionné (pour Super-Admin)
    telephone: Optional[str] = None
    date_naissance: Optional[str] = None  # Date de naissance (YYYY-MM-DD)
    photo_url: Optional[str] = None  # URL de la photo de profil
    actif: bool = True
    vue_planning_complete: bool = False  # Vue planning comme directeur (lecture seule)
    peut_modifier_planning: bool = False  # Peut modifier le planning (créer/modifier/supprimer créneaux)
    # Permissions spécifiques pour les Managers
    manager_permissions: Optional[Dict[str, bool]] = None  # Droits personnalisés pour ce manager
    # Nouveaux champs pour la gestion des heures et semaines A/B
    heures_par_jour: Optional[float] = 7.0  # Heures par jour par défaut (pour assistants)
    heures_demi_journee_conge: Optional[float] = 4.0  # Heures par demi-journée de congé
    heures_demi_journee_travail: Optional[float] = None  # Heures par demi-journée de travail (assistants) - doit être défini manuellement
    limite_demi_journees: Optional[int] = 10  # Limite de demi-journées par semaine (legacy)
    limite_demi_journees_a: Optional[int] = 10  # Limite de demi-journées semaine A
    limite_demi_journees_b: Optional[int] = 10  # Limite de demi-journées semaine B
    semaine_a_id: Optional[str] = None  # ID de l'horaire prédéfini pour semaine A
    semaine_b_id: Optional[str] = None  # ID de l'horaire prédéfini pour semaine B
    heures_semaine_a: Optional[float] = 35.0  # Heures à faire en semaine A
    heures_semaine_b: Optional[float] = 35.0  # Heures à faire en semaine B
    heures_semaine_fixe: Optional[float] = 35.0  # Heures à faire par semaine (sans A/B)
    heures_supplementaires: Optional[float] = 0.0  # Heures supp accumulées (positif) ou à rattraper (négatif)
    # Configuration détaillée des semaines A/B (horaires par jour pour secrétaires, demi-journées pour médecins/assistants)
    semaine_a_config: Optional[list] = None  # Liste de jours avec horaires ou demi-journées
    semaine_b_config: Optional[list] = None  # Liste de jours avec horaires ou demi-journées

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    telephone: Optional[str] = None
    date_naissance: Optional[str] = None
    photo_url: Optional[str] = None
    actif: Optional[bool] = None
    centre_id: Optional[str] = None  # Centre principal (legacy)
    centre_ids: Optional[List[str]] = None  # Liste des centres
    manager_permissions: Optional[Dict[str, bool]] = None  # Permissions manager
    vue_planning_complete: Optional[bool] = None
    peut_modifier_planning: Optional[bool] = None
    heures_par_jour: Optional[float] = None
    heures_demi_journee_conge: Optional[float] = None
    heures_demi_journee_travail: Optional[float] = None
    limite_demi_journees: Optional[int] = None
    limite_demi_journees_a: Optional[int] = None
    limite_demi_journees_b: Optional[int] = None
    semaine_a_id: Optional[str] = None
    semaine_b_id: Optional[str] = None
    heures_semaine_a: Optional[float] = None
    heures_semaine_b: Optional[float] = None
    heures_semaine_fixe: Optional[float] = None
    heures_supplementaires: Optional[float] = None
    semaine_a_config: Optional[list] = None
    semaine_b_config: Optional[list] = None

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    derniere_connexion: Optional[datetime] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    centre_id: Optional[str] = None  # Centre sélectionné lors de la connexion (optionnel pour Super-Admin)

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[Any] = None  # User data
    centres: Optional[List[Any]] = None  # Liste des centres accessibles (pour Super-Admin)
    user: User

class AssignationAssistant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    medecin_id: str
    assistant_id: str
    date_assignation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    actif: bool = True

# Planning Models
class CreneauPlanning(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # YYYY-MM-DD
    creneau: str  # "MATIN" ou "APRES_MIDI"
    employe_id: str
    employe_role: str  # Role de l'employé
    centre_id: Optional[str] = None  # Centre auquel appartient ce créneau
    medecin_attribue_id: Optional[str] = None  # Pour les assistants : avec quel médecin (ancien champ, gardé pour compatibilité)
    medecin_ids: List[str] = []  # Pour les assistants : plusieurs médecins possibles
    salle_attribuee: Optional[str] = None  # Salle de travail
    salle_attente: Optional[str] = None  # Salle d'attente associée
    horaire_debut: Optional[str] = None  # Pour secrétaires : "08:00"
    horaire_fin: Optional[str] = None  # Pour secrétaires : "17:00"
    horaire_pause_debut: Optional[str] = None  # Pour secrétaires : heure de fin du matin "12:00"
    horaire_pause_fin: Optional[str] = None  # Pour secrétaires : heure de reprise après-midi "14:00"
    notes: Optional[str] = None
    heures_supplementaires: Optional[float] = 0.0  # Heures supplémentaires pour ce créneau
    est_repos: bool = False  # True si c'est un créneau de repos (non comptabilisé)
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CreneauPlanningCreate(BaseModel):
    date: str
    creneau: str
    employe_id: str
    centre_id: Optional[str] = None  # Centre auquel appartient ce créneau
    medecin_attribue_id: Optional[str] = None
    medecin_ids: List[str] = []
    salle_attribuee: Optional[str] = None
    salle_attente: Optional[str] = None
    horaire_debut: Optional[str] = None
    horaire_fin: Optional[str] = None
    horaire_pause_debut: Optional[str] = None
    horaire_pause_fin: Optional[str] = None
    notes: Optional[str] = None
    heures_supplementaires: Optional[float] = 0.0
    est_repos: bool = False

class CreneauPlanningUpdate(BaseModel):
    medecin_attribue_id: Optional[str] = None
    medecin_ids: Optional[List[str]] = None
    salle_attribuee: Optional[str] = None
    salle_attente: Optional[str] = None
    horaire_debut: Optional[str] = None
    horaire_fin: Optional[str] = None
    horaire_pause_debut: Optional[str] = None
    horaire_pause_fin: Optional[str] = None
    notes: Optional[str] = None
    heures_supplementaires: Optional[float] = None
    est_repos: Optional[bool] = None

# Groupe Chat Models
class GroupeChat(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom: str
    description: Optional[str] = None
    createur_id: str
    membres: List[str] = []  # IDs des utilisateurs membres
    actif: bool = True
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GroupeChatCreate(BaseModel):
    nom: str
    description: Optional[str] = None
    membres: List[str] = []

# Chat Models
class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    expediteur_id: str
    destinataire_id: Optional[str] = None  # None = message général
    groupe_id: Optional[str] = None  # Pour messages de groupe
    contenu: str
    type_message: str = "GENERAL"  # "GENERAL", "PRIVE", "GROUPE"
    date_envoi: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    lu: bool = False

class MessageCreate(BaseModel):
    destinataire_id: Optional[str] = None
    groupe_id: Optional[str] = None
    contenu: str
    type_message: str = "GENERAL"

# Quota Employé Models
class QuotaEmploye(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employe_id: str
    semaine_debut: str  # YYYY-MM-DD (lundi)
    demi_journees_requises: int  # Nombre de demi-journées à travailler
    demi_journees_attribuees: int = 0  # Compteur des attributions
    horaire_debut: Optional[str] = None  # Pour secrétaires
    horaire_pause_debut: Optional[str] = None
    horaire_pause_fin: Optional[str] = None
    horaire_fin: Optional[str] = None
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QuotaEmployeCreate(BaseModel):
    employe_id: str
    semaine_debut: str
    demi_journees_requises: int
    horaire_debut: Optional[str] = None
    horaire_pause_debut: Optional[str] = None
    horaire_pause_fin: Optional[str] = None
    horaire_fin: Optional[str] = None

# Permission Coffre-Fort Models
class PermissionDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    proprietaire_id: str  # Propriétaire du coffre-fort
    utilisateur_autorise_id: str  # Utilisateur qui a accès
    type_permission: str = "LECTURE"  # "LECTURE", "ECRITURE", "ADMIN"
    accorde_par: str  # ID de qui a accordé la permission
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    actif: bool = True

class PermissionDocumentCreate(BaseModel):
    proprietaire_id: str
    utilisateur_autorise_id: str
    type_permission: str = "LECTURE"

# Actualités Models
class Actualite(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    titre: str
    contenu: str
    type_contenu: str = "texte"  # "texte", "image", "fichier"
    fichier_url: Optional[str] = None
    fichier_nom: Optional[str] = None
    groupe_cible: str = "tous"  # "tous", "Médecin", "Assistant", "Secrétaire"
    centre_id: Optional[str] = None  # Centre auquel appartient cette actualité
    auteur_id: str
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    date_modification: Optional[datetime] = None
    actif: bool = True
    priorite: int = 0  # Plus élevé = plus important

class ActualiteCreate(BaseModel):
    titre: str
    contenu: str
    type_contenu: str = "texte"
    fichier_url: Optional[str] = None
    fichier_nom: Optional[str] = None
    groupe_cible: str = "tous"
    centre_id: Optional[str] = None  # Centre auquel appartient cette actualité
    priorite: int = 0

class ActualiteUpdate(BaseModel):
    titre: Optional[str] = None
    contenu: Optional[str] = None
    type_contenu: Optional[str] = None
    fichier_url: Optional[str] = None
    fichier_nom: Optional[str] = None
    groupe_cible: Optional[str] = None
    centre_id: Optional[str] = None
    priorite: Optional[int] = None
    actif: Optional[bool] = None

# Documents Coffre Fort Models
class DocumentPersonnel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    proprietaire_id: str
    nom_fichier: str
    nom_original: str
    taille: int  # en bytes
    type_mime: str
    description: Optional[str] = None
    date_upload: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    actif: bool = True

class DocumentPersonnelCreate(BaseModel):
    nom_fichier: str
    nom_original: str
    taille: int
    type_mime: str
    description: Optional[str] = None

# Notification Models
class NotificationQuotidienne(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employe_id: str
    date: str  # YYYY-MM-DD
    contenu: str
    envoye: bool = False
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Salle Management Models
class Salle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom: str
    type_salle: str  # "MEDECIN", "ASSISTANT", "ATTENTE"
    position_x: int  # Position sur le plan
    position_y: int
    couleur: str = "#3B82F6"  # Couleur par défaut
    actif: bool = True
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SalleCreate(BaseModel):
    nom: str
    type_salle: str
    position_x: int
    position_y: int
    couleur: str = "#3B82F6"

class SalleUpdate(BaseModel):
    nom: Optional[str] = None
    type_salle: Optional[str] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    couleur: Optional[str] = None
    actif: Optional[bool] = None

# Configuration Cabinet Models
class ConfigurationCabinet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    max_medecins_par_jour: int = 4
    max_assistants_par_jour: int = 6
    limite_demi_journees_medecin: int = 6  # Limite de demi-journées par semaine pour médecins
    limite_demi_journees_assistant: int = 8  # Limite de demi-journées par semaine pour assistants
    limite_demi_journees_secretaire: int = 10  # Limite de demi-journées par semaine pour secrétaires
    heures_ouverture_matin_debut: str = "08:00"
    heures_ouverture_matin_fin: str = "12:00"
    heures_ouverture_apres_midi_debut: str = "14:00"
    heures_ouverture_apres_midi_fin: str = "18:00"
    date_modification: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ConfigurationCabinetUpdate(BaseModel):
    max_medecins_par_jour: Optional[int] = None
    max_assistants_par_jour: Optional[int] = None
    limite_demi_journees_medecin: Optional[int] = None
    limite_demi_journees_assistant: Optional[int] = None
    limite_demi_journees_secretaire: Optional[int] = None
    heures_ouverture_matin_debut: Optional[str] = None
    heures_ouverture_matin_fin: Optional[str] = None
    heures_ouverture_apres_midi_debut: Optional[str] = None
    heures_ouverture_apres_midi_fin: Optional[str] = None

# Stock Management Models
class CategorieStock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom: str
    description: Optional[str] = None
    couleur: str = "#3B82F6"
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CategorieStockCreate(BaseModel):
    nom: str
    description: Optional[str] = None
    couleur: str = "#3B82F6"

class ArticleStock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom: str
    description: Optional[str] = None
    categorie_id: str
    lieu: Optional[str] = None
    photo_url: Optional[str] = None
    nombre_souhaite: int = 0
    nombre_en_stock: int = 0
    lien_commande: Optional[str] = None
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    date_modification: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ArticleStockCreate(BaseModel):
    nom: str
    description: Optional[str] = None
    categorie_id: str
    lieu: Optional[str] = None
    photo_url: Optional[str] = None
    nombre_souhaite: int = 0
    nombre_en_stock: int = 0
    lien_commande: Optional[str] = None

class ArticleStockUpdate(BaseModel):
    nom: Optional[str] = None
    description: Optional[str] = None
    categorie_id: Optional[str] = None
    lieu: Optional[str] = None
    photo_url: Optional[str] = None
    nombre_souhaite: Optional[int] = None
    nombre_en_stock: Optional[int] = None
    lien_commande: Optional[str] = None

class PermissionStock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    utilisateur_id: str
    peut_voir: bool = True
    peut_modifier: bool = False
    peut_ajouter: bool = False
    peut_supprimer: bool = False
    date_attribution: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PermissionStockCreate(BaseModel):
    utilisateur_id: str
    peut_voir: bool = True
    peut_modifier: bool = False
    peut_ajouter: bool = False
    peut_supprimer: bool = False

# Notes Journalières Planning
class NotePlanningJour(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # Format YYYY-MM-DD
    note: str = ""
    date_modification: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    modifie_par: Optional[str] = None

class NotePlanningJourCreate(BaseModel):
    date: str
    note: str = ""

# Semaine Type Models
class SemaineType(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom: str
    description: Optional[str] = None
    medecin_id: Optional[str] = None  # ID du médecin propriétaire (None = semaine type globale)
    lundi: Optional[str] = None  # "MATIN", "APRES_MIDI", "JOURNEE_COMPLETE", "REPOS"
    mardi: Optional[str] = None
    mercredi: Optional[str] = None
    jeudi: Optional[str] = None
    vendredi: Optional[str] = None
    samedi: Optional[str] = None
    dimanche: Optional[str] = None
    # Horaires types pour secrétaires
    horaire_debut: Optional[str] = None  # "08:00"
    horaire_fin: Optional[str] = None  # "18:00"
    horaire_pause_debut: Optional[str] = None  # "12:00"
    horaire_pause_fin: Optional[str] = None  # "14:00"
    actif: bool = True
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SemaineTypeCreate(BaseModel):
    nom: str
    description: Optional[str] = None
    lundi: Optional[str] = None
    mardi: Optional[str] = None
    mercredi: Optional[str] = None
    jeudi: Optional[str] = None
    vendredi: Optional[str] = None
    samedi: Optional[str] = None
    dimanche: Optional[str] = None
    # Horaires types pour secrétaires
    horaire_debut: Optional[str] = None
    horaire_fin: Optional[str] = None
    horaire_pause_debut: Optional[str] = None
    horaire_pause_fin: Optional[str] = None

# Demande Jour Travail Models
class DemandeJourTravail(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    medecin_id: str
    centre_id: Optional[str] = None  # Centre auquel appartient cette demande
    date_demandee: str  # YYYY-MM-DD
    creneau: str  # "MATIN", "APRES_MIDI", "JOURNEE_COMPLETE"
    motif: Optional[str] = None
    statut: str = "EN_ATTENTE"  # "EN_ATTENTE", "APPROUVE", "REJETE", "ANNULE", "DEMANDE_ANNULATION"
    date_demande: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approuve_par: Optional[str] = None
    date_approbation: Optional[datetime] = None
    commentaire_approbation: Optional[str] = None
    # Champs pour l'annulation
    demande_annulation: bool = False
    raison_demande_annulation: Optional[str] = None
    date_demande_annulation: Optional[datetime] = None
    annule_par: Optional[str] = None
    raison_annulation: Optional[str] = None
    date_annulation: Optional[datetime] = None

class DemandeJourTravailCreate(BaseModel):
    date_demandee: Optional[str] = None  # Optionnel si semaine_type_id fourni
    creneau: Optional[str] = None
    motif: Optional[str] = None
    centre_id: Optional[str] = None  # Centre auquel appartient cette demande
    semaine_type_id: Optional[str] = None  # Pour demande de semaine type
    date_debut_semaine: Optional[str] = None  # YYYY-MM-DD du lundi
    medecin_id: Optional[str] = None  # Pour que le directeur puisse faire une demande pour un médecin


class DemandeMensuelleCreate(BaseModel):
    medecin_id: Optional[str] = None  # Optionnel : si directeur fait la demande pour un médecin
    date_debut: str  # YYYY-MM-DD (premier jour du mois ou date de début)
    semaine_type_id: Optional[str] = None  # Optionnel : basé sur semaine type
    jours_exclus: List[str] = []  # Liste des dates à exclure (rétrocompatibilité)
    jours_avec_creneaux: Optional[List[dict]] = None  # Nouveau : [{date: "2025-01-15", creneau: "MATIN"}]
    motif: Optional[str] = None

class ApprobationJourTravailRequest(BaseModel):
    approuve: bool
    commentaire: str = ""
    creneau_partiel: Optional[str] = None  # "MATIN" ou "APRES_MIDI" pour approuver/refuser partiellement une JOURNEE_COMPLETE

class DemandeAnnulationRequest(BaseModel):
    raison: str

class AnnulationDirecteRequest(BaseModel):
    raison: str
    creneau_specifique: Optional[str] = None  # Pour annuler seulement MATIN ou APRES_MIDI d'une JOURNEE_COMPLETE

class SalleReservation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    salle: str
    type_salle: str  # "MEDECIN" ou "ASSISTANT"
    utilisateur_id: str
    date: str  # YYYY-MM-DD
    creneau: str  # "MATIN" ou "APRES_MIDI"
    notes: Optional[str] = None

class DemandeCongeCreate(BaseModel):
    utilisateur_id: Optional[str] = None  # Pour que le Directeur puisse créer des demandes pour d'autres
    date_debut: str  # YYYY-MM-DD
    date_fin: str  # YYYY-MM-DD
    type_conge: str  # "CONGE_PAYE", "CONGE_SANS_SOLDE", "MALADIE", "REPOS", "HEURES_A_RECUPERER", "HEURES_RECUPEREES"
    creneau: Optional[str] = "JOURNEE_COMPLETE"  # "MATIN", "APRES_MIDI", "JOURNEE_COMPLETE"
    motif: Optional[str] = ""
    heures_conge: Optional[float] = None  # Heures personnalisées par demi-journée (si différent de 4h)

class DemandeConge(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    utilisateur_id: str
    date_debut: str  # YYYY-MM-DD
    date_fin: str  # YYYY-MM-DD
    type_conge: str  # "CONGE_PAYE", "CONGE_SANS_SOLDE", "MALADIE", "REPOS", "HEURES_A_RECUPERER", "HEURES_RECUPEREES"
    creneau: Optional[str] = "JOURNEE_COMPLETE"  # "MATIN", "APRES_MIDI", "JOURNEE_COMPLETE"
    motif: Optional[str] = None
    heures_conge: Optional[float] = None  # Heures personnalisées par demi-journée (si différent de 4h)
    statut: str = "EN_ATTENTE"  # "EN_ATTENTE", "APPROUVE", "REJETE"
    date_demande: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approuve_par: Optional[str] = None
    date_approbation: Optional[datetime] = None
    commentaire_approbation: Optional[str] = None

class NoteGenerale(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    titre: str
    contenu: str
    auteur_id: str
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    visible: bool = True

class ApprobationRequest(BaseModel):
    approuve: bool
    commentaire: str = ""

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Impossible de valider les informations d'identification",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    return User(**user)

def require_role(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permissions insuffisantes pour cette action"
            )
        return current_user
    return role_checker

# ===== SYSTÈME DE NOTIFICATIONS =====

class NotificationSubscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    endpoint: str
    p256dh: str
    auth: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    active: bool = True

class NotificationRequest(BaseModel):
    user_id: str
    title: str
    body: str
    data: Optional[Dict] = None

async def send_notification_to_user(user_id: str, title: str, body: str, data: Optional[Dict] = None):
    """Envoie une notification à un utilisateur spécifique (in-app + push)"""
    try:
        # 1. Préparer la notification
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": title,
            "body": body,
            "data": data or {},
            "sent_at": datetime.now(timezone.utc),
            "read": False,
            "push_status": "pending"  # pending, sent, failed, no_token
        }
        
        # 2. Envoyer notification push si l'utilisateur a un token FCM
        push_sent = False
        user = await db.users.find_one({"id": user_id}, {"fcm_token": 1, "device_info": 1})
        
        if user and user.get("fcm_token"):
            try:
                from push_notifications import send_push_notification
                push_result = await send_push_notification(
                    fcm_token=user["fcm_token"],
                    title=title,
                    body=body,
                    data=data or {}
                )
                if push_result:
                    notification["push_status"] = "sent"
                    notification["push_sent_at"] = datetime.now(timezone.utc)
                    push_sent = True
                    print(f"📱 Push notification envoyée à {user_id}")
                else:
                    notification["push_status"] = "failed"
                    notification["push_error"] = "Firebase SDK returned False"
                    print(f"⚠️ Push notification échouée pour {user_id}")
            except Exception as push_error:
                notification["push_status"] = "failed"
                notification["push_error"] = str(push_error)
                print(f"❌ Erreur push pour {user_id}: {push_error}")
        else:
            notification["push_status"] = "no_token"
        
        # 3. Sauvegarder en base pour la notification in-app (avec statut push)
        await db.notifications.insert_one(notification)
        print(f"📤 Notification in-app enregistrée pour {user_id}: {title} (push_status: {notification['push_status']})")
        
        return push_sent
        
    except Exception as e:
        print(f"❌ Erreur notification: {e}")
        return False

async def notify_director_new_request(type_request: str, user_name: str, details: str):
    """Notifie le directeur d'une nouvelle demande"""
    # Trouver le directeur
    director = await db.users.find_one({"role": ROLES["DIRECTEUR"], "actif": True})
    if director:
        title = f"🆕 Nouvelle {type_request}"
        body = f"{user_name} a fait une {type_request.lower()}: {details}"
        await send_notification_to_user(
            director["id"], 
            title, 
            body, 
            {"type": "new_request", "request_type": type_request}
        )

async def notify_user_request_status(user_id: str, type_request: str, status: str, details: str):
    """Notifie un utilisateur du changement de statut de sa demande"""
    status_emoji = "✅" if status == "APPROUVE" else "❌"
    status_text = "approuvée" if status == "APPROUVE" else "refusée"
    
    title = f"{status_emoji} {type_request} {status_text}"
    body = f"Votre {type_request.lower()} du {details} a été {status_text}"
    
    await send_notification_to_user(
        user_id, 
        title, 
        body, 
        {"type": "status_change", "status": status, "request_type": type_request}
    )

async def notify_colleagues_about_leave(user_name: str, date_debut: str, date_fin: str, creneau: str, user_id: str):
    """Notifie les collègues qui travaillent pendant les jours de congé"""
    from datetime import datetime, timedelta
    
    try:
        # Convertir les dates
        debut = datetime.strptime(date_debut, '%Y-%m-%d')
        fin = datetime.strptime(date_fin, '%Y-%m-%d')
        
        # Pour chaque jour du congé
        current_date = debut
        colleagues_notified = set()
        
        while current_date <= fin:
            date_str = current_date.strftime('%Y-%m-%d')
            
            # Trouver qui travaille ce jour-là
            query = {"date": date_str, "employe_id": {"$ne": user_id}}
            
            # Filtrer par créneau si ce n'est pas une journée complète
            if creneau and creneau != "JOURNEE_COMPLETE":
                query["creneau"] = creneau
            
            working_colleagues = await db.planning.find(query).to_list(100)
            
            for colleague_slot in working_colleagues:
                colleague_id = colleague_slot["employe_id"]
                if colleague_id not in colleagues_notified:
                    colleagues_notified.add(colleague_id)
            
            current_date += timedelta(days=1)
        
        # Envoyer une notification à chaque collègue concerné
        if colleagues_notified:
            creneau_text = "toute la journée" if creneau == "JOURNEE_COMPLETE" else creneau.lower()
            dates_text = date_debut if date_debut == date_fin else f"{date_debut} au {date_fin}"
            
            for colleague_id in colleagues_notified:
                await send_notification_to_user(
                    colleague_id,
                    f"🏖️ Congé d'un collègue",
                    f"{user_name} sera en congé le {dates_text} ({creneau_text})",
                    {"type": "colleague_leave", "date_debut": date_debut, "date_fin": date_fin}
                )
        
        print(f"📤 {len(colleagues_notified)} collègues notifiés du congé de {user_name}")
        
    except Exception as e:
        print(f"❌ Erreur notification collègues congé: {e}")


async def handle_assistant_slots_for_leave(user_id: str, date_debut: str, date_fin: str, creneau: str, approve: bool):
    """
    Gère les créneaux des assistants lorsqu'un médecin prend un congé.
    - Si le congé est approuvé : supprime les créneaux des assistants assignés à ce médecin pour les jours de congé
    - Envoie des notifications aux assistants concernés
    
    Args:
        user_id: ID du médecin en congé
        date_debut: Date de début du congé (YYYY-MM-DD)
        date_fin: Date de fin du congé (YYYY-MM-DD)
        creneau: Type de créneau ("MATIN", "APRES_MIDI", "JOURNEE_COMPLETE")
        approve: True si le congé est approuvé, False si refusé
    """
    from datetime import datetime, timedelta
    
    if not approve:
        return  # Rien à faire si le congé est refusé
    
    try:
        # Vérifier si l'utilisateur est un médecin
        user = await db.users.find_one({"id": user_id})
        if not user or user.get("role") != ROLES["MEDECIN"]:
            return  # Cette logique ne s'applique qu'aux médecins
        
        medecin_name = f"Dr. {user['prenom']} {user['nom']}"
        
        # Convertir les dates
        debut = datetime.strptime(date_debut, '%Y-%m-%d')
        fin = datetime.strptime(date_fin, '%Y-%m-%d')
        
        # Déterminer les créneaux à traiter
        creneaux_a_traiter = []
        if creneau == "JOURNEE_COMPLETE":
            creneaux_a_traiter = ["MATIN", "APRES_MIDI"]
        else:
            creneaux_a_traiter = [creneau]
        
        assistants_notifies = set()
        creneaux_supprimes = 0
        
        # Pour chaque jour du congé
        current_date = debut
        while current_date <= fin:
            date_str = current_date.strftime('%Y-%m-%d')
            
            for creneau_type in creneaux_a_traiter:
                # Trouver les créneaux des assistants assignés à ce médecin pour ce jour/créneau
                # Un assistant peut être assigné via medecin_attribue_id ou dans la liste medecin_ids
                assistant_creneaux = await db.planning.find({
                    "date": date_str,
                    "creneau": creneau_type,
                    "employe_role": ROLES["ASSISTANT"],
                    "$or": [
                        {"medecin_attribue_id": user_id},
                        {"medecin_ids": user_id}
                    ]
                }).to_list(100)
                
                for creneau_assistant in assistant_creneaux:
                    assistant_id = creneau_assistant["employe_id"]
                    
                    # Vérifier si l'assistant a d'autres médecins assignés pour ce créneau
                    autres_medecins = [m for m in creneau_assistant.get("medecin_ids", []) if m != user_id]
                    
                    if autres_medecins:
                        # L'assistant a d'autres médecins - juste retirer ce médecin de la liste
                        await db.planning.update_one(
                            {"id": creneau_assistant["id"]},
                            {
                                "$pull": {"medecin_ids": user_id},
                                "$set": {
                                    "medecin_attribue_id": autres_medecins[0] if autres_medecins else None,
                                    "notes": (creneau_assistant.get("notes") or "") + f"\n⚠️ Dr. {user['nom']} en congé - réassigné"
                                }
                            }
                        )
                        print(f"📝 Créneau assistant {assistant_id} mis à jour - médecin {user_id} retiré")
                    else:
                        # L'assistant n'a plus de médecin - supprimer le créneau ou le marquer comme à réassigner
                        await db.planning.update_one(
                            {"id": creneau_assistant["id"]},
                            {
                                "$set": {
                                    "medecin_attribue_id": None,
                                    "medecin_ids": [],
                                    "notes": (creneau_assistant.get("notes") or "") + f"\n⚠️ {medecin_name} en congé - À RÉASSIGNER",
                                    "est_repos": True  # Marquer comme repos temporairement
                                }
                            }
                        )
                        creneaux_supprimes += 1
                        print(f"⚠️ Créneau assistant {assistant_id} marqué à réassigner - médecin {user_id} en congé")
                    
                    # Ajouter l'assistant à la liste pour notification
                    if assistant_id not in assistants_notifies:
                        assistants_notifies.add(assistant_id)
            
            current_date += timedelta(days=1)
        
        # Notifier les assistants concernés
        for assistant_id in assistants_notifies:
            dates_text = date_debut if date_debut == date_fin else f"{date_debut} au {date_fin}"
            creneau_text = "toute la journée" if creneau == "JOURNEE_COMPLETE" else creneau.lower()
            
            await send_notification_to_user(
                assistant_id,
                "⚠️ Modification de planning",
                f"{medecin_name} sera en congé le {dates_text} ({creneau_text}). Votre planning a été mis à jour.",
                {
                    "type": "planning_update",
                    "reason": "medecin_leave",
                    "medecin_id": user_id,
                    "date_debut": date_debut,
                    "date_fin": date_fin
                }
            )
        
        print(f"✅ Gestion des créneaux assistants terminée: {creneaux_supprimes} créneaux modifiés, {len(assistants_notifies)} assistants notifiés")
        
    except Exception as e:
        print(f"❌ Erreur lors de la gestion des créneaux assistants: {e}")


async def send_daily_planning_notifications():
    """Envoie le planning quotidien à tous les employés qui travaillent aujourd'hui"""
    from datetime import date
    today = date.today().strftime('%Y-%m-%d')
    
    print(f"🌅 Envoi des plannings quotidiens pour le {today}")
    
    try:
        # Récupérer tous les employés actifs
        users = await db.users.find({"actif": True}).to_list(1000)
        
        for user in users:
            # Récupérer le planning de l'employé pour aujourd'hui
            planning_slots = await db.planning.find({
                "date": today,
                "employe_id": user["id"]
            }).to_list(100)
            
            if planning_slots:
                # Construire le message de planning
                planning_text = await build_daily_planning_message(user, planning_slots, today)
                
                if planning_text:
                    await send_notification_to_user(
                        user["id"],
                        "🌅 Votre planning du jour",
                        planning_text,
                        {"type": "daily_planning", "date": today}
                    )
        
        print(f"✅ Plannings quotidiens envoyés avec succès")
        
    except Exception as e:
        print(f"❌ Erreur lors de l'envoi des plannings: {e}")

async def build_daily_planning_message(user, planning_slots, date):
    """Construit le message du planning quotidien pour un utilisateur"""
    if not planning_slots:
        return None
    
    messages = []
    
    # Grouper par créneau
    creneaux = {"MATIN": [], "APRES_MIDI": []}
    for slot in planning_slots:
        if slot["creneau"] in creneaux:
            creneaux[slot["creneau"]].append(slot)
    
    for creneau_type, slots in creneaux.items():
        if not slots:
            continue
            
        creneau_name = "🌅 MATIN (9h-12h)" if creneau_type == "MATIN" else "🌆 APRÈS-MIDI (14h-18h)"
        
        # Pour chaque créneau, construire le message
        slot = slots[0]  # Normalement un seul slot par créneau
        
        message_parts = [f"\n{creneau_name}"]
        
        # Salle
        if slot.get("salle_attribuee"):
            message_parts.append(f"• Salle : {slot['salle_attribuee']}")
        elif slot.get("salle_attente"):
            message_parts.append(f"• Salle : {slot['salle_attente']} (attente)")
        else:
            message_parts.append("• Salle : À définir")
        
        # Collègues (autres personnes qui travaillent en même temps)
        colleagues = await db.planning.find({
            "date": date,
            "creneau": creneau_type,
            "employe_id": {"$ne": user["id"]}
        }).to_list(100)
        
        if colleagues:
            # Optimisation: Batch fetch all colleagues at once (évite N+1 queries)
            colleague_ids = [c["employe_id"] for c in colleagues]
            colleague_users = await db.users.find(
                {"id": {"$in": colleague_ids}},
                {"_id": 0, "id": 1, "prenom": 1, "nom": 1, "role": 1}
            ).to_list(100)
            
            # Créer un map pour accès rapide O(1)
            colleagues_map = {u["id"]: u for u in colleague_users}
            
            colleague_names = []
            for colleague_slot in colleagues:
                colleague = colleagues_map.get(colleague_slot["employe_id"])
                if colleague:
                    name = f"{colleague['prenom']} {colleague['nom']}"
                    if colleague['role'] == 'Médecin':
                        name = f"Dr. {name}"
                    colleague_names.append(f"{name} ({colleague['role']})")
            
            if colleague_names:
                message_parts.append(f"• Avec : {', '.join(colleague_names[:3])}")
                if len(colleague_names) > 3:
                    message_parts.append(f"  + {len(colleague_names) - 3} autre(s)")
        else:
            message_parts.append("• Vous travaillez seul(e)")
        
        messages.append("\n".join(message_parts))
    
    if messages:
        intro = f"📅 Planning du {date}"
        return f"{intro}\n" + "\n".join(messages)
    
    return None

# ===== FIN SYSTÈME NOTIFICATIONS =====

# Endpoints pour les notifications
@api_router.get("/notifications")
async def get_user_notifications(
    current_user: User = Depends(get_current_user),
    limit: int = 20
):
    """Récupère les notifications de l'utilisateur actuel"""
    notifications = await db.notifications.find(
        {"user_id": current_user.id}
    ).sort("sent_at", -1).limit(limit).to_list(limit)
    
    # Supprimer les _id de MongoDB
    for notif in notifications:
        if '_id' in notif:
            del notif['_id']
    
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """Marque une notification comme lue"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user.id},
        {"$set": {"read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification non trouvée")
    
    return {"message": "Notification marquée comme lue"}

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """Supprime une notification"""
    result = await db.notifications.delete_one(
        {"id": notification_id, "user_id": current_user.id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification non trouvée")
    
    return {"message": "Notification supprimée"}

@api_router.post("/notifications/send-daily-planning")
async def trigger_daily_planning(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"], ROLES["SUPER_ADMIN"]]))
):
    """Déclenche manuellement l'envoi du planning quotidien (TEST)"""
    background_tasks.add_task(send_morning_planning_notifications)
    return {"message": "Envoi du planning quotidien programmé"}


@api_router.get("/notifications/scheduler-status")
async def get_scheduler_status(
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"], ROLES["SUPER_ADMIN"]]))
):
    """Récupère le statut du scheduler de notifications"""
    jobs = scheduler.get_jobs()
    
    job_info = []
    for job in jobs:
        next_run = job.next_run_time
        job_info.append({
            "id": job.id,
            "name": job.name or job.id,
            "next_run": next_run.isoformat() if next_run else None,
            "trigger": str(job.trigger)
        })
    
    return {
        "scheduler_running": scheduler.running,
        "timezone": "Europe/Paris",
        "jobs": job_info,
        "daily_notification_time": "07:00"
    }


@api_router.post("/notifications/test-scheduler")
async def test_scheduler_notification(
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"], ROLES["SUPER_ADMIN"]]))
):
    """Exécute immédiatement la tâche de notification pour tester"""
    await send_morning_planning_notifications()
    return {"message": "Notifications de planning envoyées (test)"}


# ===== NOTIFICATIONS DE TEST PERSONNALISÉES =====

class NotificationTestRequest(BaseModel):
    user_ids: List[str]  # Liste des IDs des employés à notifier
    title: str = "🔔 Notification de test"
    message: str = "Ceci est une notification de test envoyée par l'administration."

@api_router.post("/notifications/test")
async def send_test_notifications(
    request: NotificationTestRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Envoie des notifications de test personnalisées à des employés spécifiques (Directeur uniquement)"""
    if not request.user_ids:
        raise HTTPException(status_code=400, detail="Au moins un employé doit être sélectionné")
    
    # Vérifier que tous les utilisateurs existent
    users = await db.users.find({"id": {"$in": request.user_ids}}).to_list(100)
    found_ids = [u["id"] for u in users]
    
    if len(found_ids) != len(request.user_ids):
        missing = set(request.user_ids) - set(found_ids)
        raise HTTPException(status_code=404, detail=f"Utilisateurs non trouvés: {missing}")
    
    # Envoyer les notifications en arrière-plan
    success_count = 0
    for user_id in request.user_ids:
        background_tasks.add_task(
            send_notification_to_user,
            user_id,
            request.title,
            request.message,
            {"type": "test_notification", "sent_by": current_user.id}
        )
        success_count += 1
    
    return {
        "message": f"Notifications de test envoyées à {success_count} employé(s)",
        "recipients": [{"id": u["id"], "nom": f"{u['prenom']} {u['nom']}"} for u in users]
    }


@api_router.get("/notifications/employees-for-test")
async def get_employees_for_notification_test(
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Récupère la liste des employés avec leur statut de notification push pour l'interface d'envoi de test"""
    users = await db.users.find(
        {"actif": True},
        {"_id": 0, "id": 1, "prenom": 1, "nom": 1, "role": 1, "email": 1, "fcm_token": 1, "fcm_devices": 1}
    ).to_list(1000)
    
    employees = []
    for user in users:
        has_push = bool(user.get("fcm_token")) or bool(user.get("fcm_devices"))
        devices_count = len(user.get("fcm_devices", [])) if user.get("fcm_devices") else (1 if user.get("fcm_token") else 0)
        
        employees.append({
            "id": user["id"],
            "prenom": user["prenom"],
            "nom": user["nom"],
            "role": user["role"],
            "email": user["email"],
            "has_push_enabled": has_push,
            "devices_count": devices_count
        })
    
    # Trier par rôle puis par nom
    role_order = {"Directeur": 0, "Médecin": 1, "Assistant": 2, "Secrétaire": 3}
    employees.sort(key=lambda x: (role_order.get(x["role"], 99), x["nom"]))
    
    return {"employees": employees}


# ===== RÉPONSE RAPIDE AUX MESSAGES DEPUIS NOTIFICATION =====

class QuickReplyRequest(BaseModel):
    message_id: str  # ID du message original auquel on répond
    reply_content: str  # Contenu de la réponse

@api_router.post("/notifications/quick-reply")
async def quick_reply_to_message(
    request: QuickReplyRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Permet de répondre rapidement à un message depuis une notification push"""
    if not request.reply_content or not request.reply_content.strip():
        raise HTTPException(status_code=400, detail="Le contenu de la réponse ne peut pas être vide")
    
    # Récupérer le message original pour connaître l'expéditeur
    original_message = await db.messages.find_one({"id": request.message_id})
    if not original_message:
        raise HTTPException(status_code=404, detail="Message original non trouvé")
    
    # L'expéditeur du message original devient le destinataire de la réponse
    destinataire_id = original_message["expediteur_id"]
    
    # Créer le nouveau message
    nouveau_message = Message(
        expediteur_id=current_user.id,
        destinataire_id=destinataire_id,
        groupe_id=original_message.get("groupe_id"),  # Conserver le groupe si c'est un message de groupe
        contenu=request.reply_content.strip(),
        type_message=original_message.get("type_message", "PRIVE")
    )
    
    await db.messages.insert_one(nouveau_message.dict())
    
    # Envoyer une notification au destinataire
    expediteur_name = f"{current_user.prenom} {current_user.nom}"
    if current_user.role == ROLES["MEDECIN"]:
        expediteur_name = f"Dr. {expediteur_name}"
    
    background_tasks.add_task(
        send_notification_to_user,
        destinataire_id,
        f"💬 {expediteur_name}",
        request.reply_content.strip()[:100] + ("..." if len(request.reply_content.strip()) > 100 else ""),
        {
            "type": "chat_message",
            "message_id": nouveau_message.id,
            "sender_id": current_user.id,
            "sender_name": expediteur_name,
            "requires_reply": "true"
        }
    )
    
    return {
        "message": "Réponse envoyée avec succès",
        "message_id": nouveau_message.id,
        "destinataire_id": destinataire_id
    }

@api_router.post("/notifications/subscribe")
async def subscribe_to_notifications(
    subscription_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Enregistre le token FCM d'un utilisateur avec les informations de l'appareil (multi-appareils supporté)"""
    try:
        fcm_token = subscription_data.get("token")
        device_info = subscription_data.get("device_info", {})
        
        if not fcm_token:
            raise HTTPException(status_code=400, detail="Token FCM manquant")
        
        # Générer un ID unique pour cet appareil
        import hashlib
        device_id = hashlib.md5(fcm_token.encode()).hexdigest()[:12]
        
        # Construire les infos appareil
        device_data = {
            "device_id": device_id,
            "fcm_token": fcm_token,
            "user_agent": device_info.get("userAgent", "Inconnu"),
            "platform": device_info.get("platform", "Inconnu"),
            "device_name": device_info.get("deviceName", "Appareil inconnu"),
            "browser": device_info.get("browser", "Inconnu"),
            "os": device_info.get("os", "Inconnu"),
            "registered_at": datetime.now(timezone.utc).isoformat(),
            "last_used": datetime.now(timezone.utc).isoformat()
        }
        
        # Récupérer l'utilisateur actuel
        user = await db.users.find_one({"id": current_user.id})
        existing_devices = user.get("fcm_devices", []) if user else []
        
        # Vérifier si cet appareil existe déjà (même token)
        device_exists = False
        for i, dev in enumerate(existing_devices):
            if dev.get("fcm_token") == fcm_token:
                # Mettre à jour l'appareil existant
                existing_devices[i] = device_data
                device_exists = True
                break
        
        if not device_exists:
            # Ajouter le nouvel appareil (max 5 appareils)
            existing_devices.append(device_data)
            if len(existing_devices) > 5:
                # Supprimer le plus ancien
                existing_devices = existing_devices[-5:]
        
        # Mettre à jour l'utilisateur
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {
                "fcm_devices": existing_devices,
                "fcm_token": fcm_token,  # Garder le dernier token pour compatibilité
                "fcm_updated_at": datetime.now(timezone.utc),
                "device_info": device_data  # Garder pour compatibilité
            }}
        )
        
        print(f"✅ Token FCM enregistré pour {current_user.prenom} {current_user.nom} - Appareil: {device_data['device_name']} ({device_data['browser']})")
        
        return {
            "message": "Token FCM enregistré avec succès", 
            "user_id": current_user.id,
            "device_info": device_data,
            "total_devices": len(existing_devices)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erreur lors de l'enregistrement du token: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'enregistrement")

@api_router.get("/notifications/devices")
async def get_user_devices(current_user: User = Depends(get_current_user)):
    """Récupère la liste des appareils enregistrés pour les notifications"""
    try:
        user = await db.users.find_one({"id": current_user.id}, {"fcm_devices": 1, "device_info": 1, "fcm_token": 1})
        
        if not user:
            return {"devices": []}
        
        # Support ancien format (un seul appareil)
        devices = user.get("fcm_devices", [])
        if not devices and user.get("fcm_token"):
            # Migration: convertir ancien format en nouveau
            old_device = user.get("device_info", {})
            old_device["fcm_token"] = user.get("fcm_token")
            old_device["device_id"] = "legacy"
            devices = [old_device]
        
        return {"devices": devices}
    except Exception as e:
        print(f"Erreur: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération")

@api_router.delete("/notifications/devices/{device_id}")
async def remove_device(device_id: str, current_user: User = Depends(get_current_user)):
    """Supprime un appareil de la liste des notifications"""
    try:
        user = await db.users.find_one({"id": current_user.id})
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        
        devices = user.get("fcm_devices", [])
        new_devices = [d for d in devices if d.get("device_id") != device_id]
        
        if len(new_devices) == len(devices):
            raise HTTPException(status_code=404, detail="Appareil non trouvé")
        
        # Mettre à jour
        update_data = {"fcm_devices": new_devices}
        
        # Si on supprime le dernier appareil, supprimer aussi fcm_token
        if len(new_devices) == 0:
            update_data["fcm_token"] = None
            update_data["device_info"] = None
        else:
            # Mettre à jour fcm_token avec le dernier appareil
            update_data["fcm_token"] = new_devices[-1].get("fcm_token")
        
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": update_data}
        )
        
        return {"message": "Appareil supprimé", "remaining_devices": len(new_devices)}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erreur: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la suppression")

# Endpoint de diagnostic (GET - pour debug)
@api_router.get("/debug-users")
async def debug_users():
    """Diagnostic de l'état de la base utilisateurs - PRODUCTION"""
    try:
        # Compter les utilisateurs
        user_count = await db.users.count_documents({})
        
        if user_count == 0:
            return {
                "status": "empty_database",
                "message": "🔍 Base de données vide - aucun utilisateur",
                "users_count": 0,
                "suggestion": "Appelez /api/init-admin-simple pour initialiser"
            }
        
        # Lister les utilisateurs (sans mots de passe)
        users = await db.users.find({}, {"password_hash": 0}).to_list(100)
        
        users_info = []
        for user in users:
            users_info.append({
                "email": user.get("email"),
                "nom": f"{user.get('prenom')} {user.get('nom')}",
                "role": user.get("role"),
                "actif": user.get("actif")
            })
        
        return {
            "status": "users_found",
            "message": f"🔍 {user_count} utilisateur(s) trouvé(s)",
            "users_count": user_count,
            "users": users_info,
            "director_exists": any(u["role"] == "Directeur" for u in users_info)
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"❌ Erreur lors du diagnostic",
            "error": str(e)
        }

# Endpoint d'initialisation pour la production (GET - simple)
@api_router.get("/init-admin-simple")
async def init_admin_simple():
    """Initialise le compte administrateur via GET (pour navigateur) - PRODUCTION UNIQUEMENT"""
    try:
        # Vérifier s'il y a déjà des utilisateurs
        user_count = await db.users.count_documents({})
        
        if user_count > 0:
            # Récupérer le directeur existant pour afficher ses infos
            director = await db.users.find_one({"role": "Directeur"})
            if director:
                return {
                    "status": "already_initialized",
                    "message": "🔐 Base de données déjà initialisée !",
                    "existing_director": {
                        "email": director.get("email"),
                        "nom": f"{director.get('prenom')} {director.get('nom')}",
                        "password_hint": "admin123 (si non changé)"
                    },
                    "users_count": user_count,
                    "next_action": "Essayez de vous connecter avec les identifiants ci-dessus"
                }
            else:
                return {
                    "status": "users_exist_no_director",
                    "message": f"⚠️ {user_count} utilisateurs trouvés mais pas de directeur",
                    "users_count": user_count
                }
        
        # Créer le directeur LEBLOND Francis
        director_data = {
            "id": str(uuid.uuid4()),
            "email": "directeur@cabinet.fr",
            "nom": "LEBLOND",
            "prenom": "Francis",
            "role": ROLES["DIRECTEUR"],
            "password_hash": get_password_hash("admin123"),
            "actif": True,
            "date_creation": datetime.now(timezone.utc)
        }
        
        # Insérer le directeur
        await db.users.insert_one(director_data)
        
        # Créer aussi la configuration de base
        config_data = {
            "id": str(uuid.uuid4()),
            "max_medecins_par_jour": 3,
            "heures_ouverture": {
                "matin_debut": "09:00",
                "matin_fin": "12:00",
                "apres_midi_debut": "14:00",
                "apres_midi_fin": "18:00"
            },
            "jours_fermeture": ["dimanche"],
            "derniere_modification": datetime.now(timezone.utc)
        }
        await db.configuration.insert_one(config_data)
        
        return {
            "status": "success",
            "message": "🎉 CABINET MÉDICAL INITIALISÉ AVEC SUCCÈS !",
            "director_created": {
                "email": "directeur@cabinet.fr",
                "password": "admin123",
                "nom_complet": "Francis LEBLOND",
                "role": "Directeur"
            },
            "next_steps": [
                "✅ 1. Retournez à l'application",
                "✅ 2. Connectez-vous avec : directeur@cabinet.fr / admin123",
                "✅ 3. Allez dans 'Gestion Personnel' pour créer d'autres comptes",
                "✅ 4. Changez le mot de passe dans 'Mon Profil'",
                "✅ 5. Activez les notifications push dans 'Mon Profil'"
            ],
            "config_created": "Configuration de base du cabinet créée"
        }
        
    except Exception as e:
        print(f"Erreur lors de l'initialisation: {e}")
        return {
            "status": "error",
            "message": f"❌ Erreur lors de l'initialisation",
            "error": str(e),
            "suggestion": "Contactez le support technique"
        }

# Endpoint d'initialisation pour la production
@api_router.post("/init-admin")
async def init_admin():
    """Initialise le compte administrateur si la base est vide (PRODUCTION UNIQUEMENT)"""
    try:
        # Vérifier s'il y a déjà des utilisateurs
        user_count = await db.users.count_documents({})
        
        if user_count > 0:
            return {
                "message": "Base de données déjà initialisée",
                "users_count": user_count,
                "status": "already_initialized"
            }
        
        # Créer le directeur LEBLOND Francis
        director_data = {
            "id": str(uuid.uuid4()),
            "email": "directeur@cabinet.fr",
            "nom": "LEBLOND",
            "prenom": "Francis",
            "role": ROLES["DIRECTEUR"],
            "password_hash": bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "actif": True,
            "date_creation": datetime.now(timezone.utc)
        }
        
        # Insérer le directeur
        await db.users.insert_one(director_data)
        
        # Créer aussi la configuration de base
        config_data = {
            "id": str(uuid.uuid4()),
            "max_medecins_par_jour": 3,
            "heures_ouverture": {
                "matin_debut": "09:00",
                "matin_fin": "12:00",
                "apres_midi_debut": "14:00",
                "apres_midi_fin": "18:00"
            },
            "jours_fermeture": ["dimanche"],
            "derniere_modification": datetime.now(timezone.utc)
        }
        await db.configuration.insert_one(config_data)
        
        return {
            "message": "✅ Compte administrateur créé avec succès !",
            "email": "directeur@cabinet.fr",
            "password": "admin123",
            "nom": "Francis LEBLOND",
            "role": "Directeur",
            "status": "initialized",
            "next_steps": [
                "1. Connectez-vous avec les identifiants ci-dessus",
                "2. Allez dans 'Gestion Personnel' pour créer les autres comptes",
                "3. Changez le mot de passe dans 'Mon Profil'"
            ]
        }
        
    except Exception as e:
        print(f"Erreur lors de l'initialisation: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'initialisation: {str(e)}")

# Authentication routes
@api_router.post("/auth/register", response_model=User)
async def register_user(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un utilisateur avec cet email existe déjà"
        )
    
    # Validate role
    if user_data.role not in ROLES.values():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rôle invalide"
        )
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user_dict = user_data.dict()
    del user_dict['password']
    user_obj = User(**user_dict)
    user_with_password = user_obj.dict()
    user_with_password['password_hash'] = hashed_password
    
    await db.users.insert_one(user_with_password)
    return user_obj

@api_router.post("/auth/login", response_model=Token)
async def login(user_login: UserLogin):
    user = await db.users.find_one({"email": user_login.email})
    if not user or not verify_password(user_login.password, user.get('password_hash')):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )
    
    # Vérifier si l'utilisateur est actif
    if not user.get('actif', True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé. Contactez l'administrateur."
        )
    
    # Gérer les rôles legacy (Directeur -> Super-Admin)
    user_role = user.get('role')
    is_super_admin = user_role in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]
    is_manager = user_role == ROLES["MANAGER"]
    
    # Pour les Super-Admins : récupérer tous les centres
    centres_list = None
    selected_centre = None
    
    if is_super_admin:
        # Super-Admin peut voir tous les centres
        centres = await db.centres.find({"actif": True}, {"_id": 0}).to_list(100)
        centres_list = centres
        
        # Si un centre est spécifié, le valider
        if user_login.centre_id:
            centre = await db.centres.find_one({"id": user_login.centre_id, "actif": True})
            if centre:
                selected_centre = user_login.centre_id
    else:
        # Pour les autres utilisateurs : récupérer leurs centres (multi-centres supporté)
        user_centre_ids = user.get('centre_ids', [])
        user_centre_id = user.get('centre_id')  # Legacy: centre unique
        
        # Compatibilité: si centre_ids n'existe pas mais centre_id existe
        if not user_centre_ids and user_centre_id:
            user_centre_ids = [user_centre_id]
        
        if not user_centre_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Aucun centre assigné à votre compte. Contactez l'administrateur."
            )
        
        # Récupérer tous les centres de l'utilisateur
        user_centres = await db.centres.find(
            {"id": {"$in": user_centre_ids}, "actif": True}, 
            {"_id": 0, "id": 1, "nom": 1}
        ).to_list(100)
        
        if not user_centres:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vos centres ne sont plus actifs. Contactez l'administrateur."
            )
        
        centres_list = user_centres
        
        # Sélectionner le centre spécifié ou le premier disponible
        if user_login.centre_id:
            if user_login.centre_id not in user_centre_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Vous n'avez pas accès à ce centre."
                )
            selected_centre = user_login.centre_id
        else:
            selected_centre = user_centres[0]["id"]
    
    # Update last login et centre sélectionné
    update_data = {"derniere_connexion": datetime.now(timezone.utc)}
    if selected_centre:
        update_data["centre_actif_id"] = selected_centre
    
    await db.users.update_one({"id": user['id']}, {"$set": update_data})
    
    # Recharger l'utilisateur pour avoir les données à jour
    user = await db.users.find_one({"id": user['id']}, {"_id": 0, "password_hash": 0})
    
    access_token = create_access_token(data={"sub": user['id']})
    user_obj = User(**user)
    
    return Token(
        access_token=access_token, 
        token_type="bearer", 
        user=user_obj,
        centres=centres_list
    )

# ===== GESTION DES CENTRES =====

def require_super_admin():
    """Vérifie que l'utilisateur est Super-Admin"""
    async def checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
            raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
        return current_user
    return Depends(checker)

@api_router.get("/centres")
async def get_centres(current_user: User = Depends(get_current_user)):
    """Récupère la liste des centres accessibles à l'utilisateur"""
    is_super_admin = current_user.role in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]
    
    if is_super_admin:
        # Super-Admin voit tous les centres
        centres = await db.centres.find({}, {"_id": 0}).to_list(100)
    else:
        # Autres utilisateurs voient uniquement leur centre
        if current_user.centre_id:
            centre = await db.centres.find_one({"id": current_user.centre_id}, {"_id": 0})
            centres = [centre] if centre else []
        else:
            centres = []
    
    return {"centres": centres}

@api_router.get("/centres/public")
async def get_centres_public():
    """Récupère la liste des centres actifs (sans authentification - pour la page de connexion)"""
    centres = await db.centres.find({"actif": True}, {"_id": 0, "id": 1, "nom": 1}).to_list(100)
    return {"centres": centres}

@api_router.post("/centres")
async def create_centre(
    centre_data: CentreCreate,
    current_user: User = Depends(get_current_user)
):
    """Créer un nouveau centre (Super-Admin uniquement)"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    # Vérifier que le nom n'existe pas déjà
    existing = await db.centres.find_one({"nom": centre_data.nom})
    if existing:
        raise HTTPException(status_code=400, detail="Un centre avec ce nom existe déjà")
    
    centre = Centre(**centre_data.dict(), cree_par=current_user.id)
    await db.centres.insert_one(centre.dict())
    
    return {"message": "Centre créé avec succès", "centre": centre.dict()}

@api_router.put("/centres/{centre_id}")
async def update_centre(
    centre_id: str,
    centre_data: CentreUpdate,
    current_user: User = Depends(get_current_user)
):
    """Modifier un centre (Super-Admin uniquement)"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    centre = await db.centres.find_one({"id": centre_id})
    if not centre:
        raise HTTPException(status_code=404, detail="Centre non trouvé")
    
    update_dict = {k: v for k, v in centre_data.dict().items() if v is not None}
    if update_dict:
        await db.centres.update_one({"id": centre_id}, {"$set": update_dict})
    
    return {"message": "Centre mis à jour avec succès"}

@api_router.delete("/centres/{centre_id}")
async def delete_centre(
    centre_id: str,
    current_user: User = Depends(get_current_user)
):
    """Supprimer un centre (Super-Admin uniquement) - désactive le centre"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    centre = await db.centres.find_one({"id": centre_id})
    if not centre:
        raise HTTPException(status_code=404, detail="Centre non trouvé")
    
    # Vérifier s'il y a des employés dans ce centre
    employees_count = await db.users.count_documents({"centre_id": centre_id, "actif": True})
    if employees_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Impossible de supprimer: {employees_count} employé(s) actif(s) dans ce centre"
        )
    
    # Désactiver plutôt que supprimer
    await db.centres.update_one({"id": centre_id}, {"$set": {"actif": False}})
    
    return {"message": "Centre désactivé avec succès"}

@api_router.post("/centres/{centre_id}/switch")
async def switch_centre(
    centre_id: str,
    current_user: User = Depends(get_current_user)
):
    """Changer de centre actif (Super-Admin uniquement)"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    centre = await db.centres.find_one({"id": centre_id, "actif": True})
    if not centre:
        raise HTTPException(status_code=404, detail="Centre non trouvé ou inactif")
    
    # Mettre à jour le centre actif de l'utilisateur
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"centre_actif_id": centre_id}}
    )
    
    return {"message": f"Vous êtes maintenant sur le centre: {centre['nom']}", "centre": {"id": centre["id"], "nom": centre["nom"]}}


# ===== GESTION AVANCÉE DES CENTRES =====

@api_router.get("/admin/centres/details")
async def get_centres_with_details(current_user: User = Depends(get_current_user)):
    """Récupère tous les centres avec leurs statistiques (Super-Admin uniquement)"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    centres = await db.centres.find({}, {"_id": 0}).to_list(100)
    
    # Enrichir avec les stats
    for centre in centres:
        # Compter les employés par rôle
        employees = await db.users.find({"centre_id": centre["id"], "actif": True}).to_list(1000)
        centre["stats"] = {
            "total_employes": len(employees),
            "medecins": len([e for e in employees if e.get("role") == ROLES["MEDECIN"]]),
            "assistants": len([e for e in employees if e.get("role") == ROLES["ASSISTANT"]]),
            "secretaires": len([e for e in employees if e.get("role") == ROLES["SECRETAIRE"]]),
            "managers": len([e for e in employees if e.get("role") == ROLES["MANAGER"]])
        }
        
        # Récupérer les managers du centre
        centre["managers"] = [
            {"id": e["id"], "nom": e["nom"], "prenom": e["prenom"], "email": e["email"]}
            for e in employees if e.get("role") == ROLES["MANAGER"]
        ]
    
    return {"centres": centres}


@api_router.get("/admin/centres/{centre_id}/employees")
async def get_centre_employees(
    centre_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupère tous les employés d'un centre avec leurs configurations (Super-Admin uniquement)"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    centre = await db.centres.find_one({"id": centre_id})
    if not centre:
        raise HTTPException(status_code=404, detail="Centre non trouvé")
    
    employees = await db.users.find(
        {"centre_id": centre_id},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    
    return {
        "centre": {"id": centre["id"], "nom": centre["nom"]},
        "employees": employees
    }


@api_router.put("/admin/centres/{centre_id}/config")
async def update_centre_config(
    centre_id: str,
    config: CentreConfig,
    current_user: User = Depends(get_current_user)
):
    """Met à jour la configuration d'un centre (rubriques actives)"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    centre = await db.centres.find_one({"id": centre_id})
    if not centre:
        raise HTTPException(status_code=404, detail="Centre non trouvé")
    
    await db.centres.update_one(
        {"id": centre_id},
        {"$set": {"config": config.dict()}}
    )
    
    return {"message": "Configuration du centre mise à jour"}


@api_router.get("/admin/rubriques")
async def get_available_rubriques(current_user: User = Depends(get_current_user)):
    """Récupère la liste des rubriques disponibles"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    return {"rubriques": RUBRIQUES_DISPONIBLES}


# ===== GESTION DES MANAGERS =====

@api_router.post("/admin/managers")
async def create_manager(
    user_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Créer un nouveau manager pour un centre"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    # Vérifier le centre
    centre_id = user_data.get("centre_id")
    if not centre_id:
        raise HTTPException(status_code=400, detail="centre_id requis")
    
    centre = await db.centres.find_one({"id": centre_id, "actif": True})
    if not centre:
        raise HTTPException(status_code=404, detail="Centre non trouvé")
    
    # Vérifier que l'email n'existe pas
    existing = await db.users.find_one({"email": user_data.get("email")})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    # Créer le manager avec permissions par défaut
    new_manager = {
        "id": str(uuid.uuid4()),
        "email": user_data["email"],
        "nom": user_data["nom"],
        "prenom": user_data["prenom"],
        "telephone": user_data.get("telephone"),
        "role": ROLES["MANAGER"],
        "centre_id": centre_id,
        "password_hash": get_password_hash(user_data.get("password", "manager123")),
        "actif": True,
        "date_creation": datetime.now(timezone.utc),
        "manager_permissions": user_data.get("permissions", MANAGER_PERMISSIONS),
        "vue_planning_complete": True,
        "peut_modifier_planning": True
    }
    
    await db.users.insert_one(new_manager)
    
    # Retourner sans le password_hash
    del new_manager["password_hash"]
    
    return {"message": f"Manager créé pour {centre['nom']}", "manager": new_manager}


@api_router.put("/admin/managers/{manager_id}/permissions")
async def update_manager_permissions(
    manager_id: str,
    permissions: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Met à jour les permissions d'un manager"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    manager = await db.users.find_one({"id": manager_id, "role": ROLES["MANAGER"]})
    if not manager:
        raise HTTPException(status_code=404, detail="Manager non trouvé")
    
    await db.users.update_one(
        {"id": manager_id},
        {"$set": {"manager_permissions": permissions}}
    )
    
    return {"message": "Permissions du manager mises à jour"}


@api_router.get("/admin/managers/{centre_id}")
async def get_centre_managers(
    centre_id: str,
    current_user: User = Depends(get_current_user)
):
    """Récupère tous les managers d'un centre avec leurs permissions"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    managers = await db.users.find(
        {"centre_id": centre_id, "role": ROLES["MANAGER"]},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    return {"managers": managers}


# ===== GESTION DE LA VISIBILITÉ DES EMPLOYÉS =====

@api_router.put("/admin/employees/{employee_id}/visibility")
async def update_employee_visibility(
    employee_id: str,
    visibility: EmployeeVisibility,
    current_user: User = Depends(get_current_user)
):
    """Met à jour les paramètres de visibilité d'un employé"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    employee = await db.users.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {"visibility_config": visibility.dict()}}
    )
    
    return {"message": "Configuration de visibilité mise à jour"}


@api_router.put("/admin/employees/{employee_id}/centre")
async def change_employee_centre(
    employee_id: str,
    new_centre_id: str,
    current_user: User = Depends(get_current_user)
):
    """Ajoute un centre à un employé (multi-centres)"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    employee = await db.users.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    new_centre = await db.centres.find_one({"id": new_centre_id, "actif": True})
    if not new_centre:
        raise HTTPException(status_code=404, detail="Centre non trouvé")
    
    # Ajouter le centre à la liste (multi-centres)
    current_centres = employee.get('centre_ids', [])
    if employee.get('centre_id') and employee['centre_id'] not in current_centres:
        current_centres.append(employee['centre_id'])
    
    if new_centre_id not in current_centres:
        current_centres.append(new_centre_id)
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {
            "centre_ids": current_centres,
            "centre_id": current_centres[0] if current_centres else None  # Garder compatibilité
        }}
    )
    
    return {"message": f"Centre {new_centre['nom']} ajouté à l'employé", "centre_ids": current_centres}


@api_router.put("/admin/employees/{employee_id}/centres")
async def update_employee_centres(
    employee_id: str,
    centre_ids: List[str],
    current_user: User = Depends(get_current_user)
):
    """Met à jour la liste complète des centres d'un employé"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    employee = await db.users.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    if not centre_ids:
        raise HTTPException(status_code=400, detail="Au moins un centre est requis")
    
    # Vérifier que tous les centres existent
    valid_centres = await db.centres.find(
        {"id": {"$in": centre_ids}, "actif": True}
    ).to_list(100)
    
    valid_ids = [c["id"] for c in valid_centres]
    invalid_ids = set(centre_ids) - set(valid_ids)
    if invalid_ids:
        raise HTTPException(status_code=404, detail=f"Centres non trouvés: {invalid_ids}")
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {
            "centre_ids": centre_ids,
            "centre_id": centre_ids[0]  # Premier centre comme centre principal
        }}
    )
    
    centres_names = [c["nom"] for c in valid_centres]
    return {"message": f"Centres mis à jour: {', '.join(centres_names)}", "centre_ids": centre_ids}


@api_router.delete("/admin/employees/{employee_id}/centres/{centre_id}")
async def remove_employee_from_centre(
    employee_id: str,
    centre_id: str,
    current_user: User = Depends(get_current_user)
):
    """Retire un employé d'un centre"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    employee = await db.users.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    current_centres = employee.get('centre_ids', [])
    if employee.get('centre_id') and employee['centre_id'] not in current_centres:
        current_centres.append(employee['centre_id'])
    
    if centre_id not in current_centres:
        raise HTTPException(status_code=400, detail="L'employé n'appartient pas à ce centre")
    
    if len(current_centres) <= 1:
        raise HTTPException(status_code=400, detail="L'employé doit appartenir à au moins un centre")
    
    current_centres.remove(centre_id)
    
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {
            "centre_ids": current_centres,
            "centre_id": current_centres[0]  # Nouveau centre principal
        }}
    )
    
    return {"message": "Employé retiré du centre", "centre_ids": current_centres}

# ===== GESTION DES INSCRIPTIONS =====

@api_router.post("/inscriptions")
async def create_inscription(inscription_data: InscriptionRequest):
    """Créer une demande d'inscription (accès public)"""
    # Vérifier que le centre existe
    centre = await db.centres.find_one({"id": inscription_data.centre_id, "actif": True})
    if not centre:
        raise HTTPException(status_code=404, detail="Centre non trouvé")
    
    # Vérifier que l'email n'est pas déjà utilisé
    existing_user = await db.users.find_one({"email": inscription_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà associé à un compte")
    
    # Vérifier qu'une demande n'est pas déjà en cours
    existing_request = await db.inscriptions.find_one({
        "email": inscription_data.email,
        "statut": "EN_ATTENTE"
    })
    if existing_request:
        raise HTTPException(status_code=400, detail="Une demande d'inscription est déjà en cours pour cet email")
    
    # Vérifier le rôle souhaité
    valid_roles = [ROLES["MEDECIN"], ROLES["ASSISTANT"], ROLES["SECRETAIRE"]]
    if inscription_data.role_souhaite not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Rôle invalide. Choisissez parmi: {', '.join(valid_roles)}")
    
    inscription = Inscription(**inscription_data.dict())
    await db.inscriptions.insert_one(inscription.dict())
    
    # Notifier le Super-Admin (si notifications configurées)
    try:
        directors = await db.users.find({
            "role": {"$in": [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]},
            "actif": True
        }).to_list(10)
        
        for director in directors:
            await send_notification_to_user(
                director["id"],
                "📝 Nouvelle demande d'inscription",
                f"{inscription_data.prenom} {inscription_data.nom} souhaite rejoindre {centre['nom']} en tant que {inscription_data.role_souhaite}",
                {"type": "inscription_request", "inscription_id": inscription.id}
            )
    except Exception as e:
        print(f"Erreur notification inscription: {e}")
    
    return {
        "message": "Demande d'inscription envoyée avec succès. Vous recevrez une réponse par email.",
        "inscription_id": inscription.id
    }

@api_router.get("/inscriptions")
async def get_inscriptions(
    statut: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Récupérer les demandes d'inscription (Super-Admin uniquement)"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    query = {}
    if statut:
        query["statut"] = statut
    
    inscriptions = await db.inscriptions.find(query, {"_id": 0}).sort("date_demande", -1).to_list(100)
    
    # Enrichir avec les noms des centres
    for inscription in inscriptions:
        centre = await db.centres.find_one({"id": inscription.get("centre_id")}, {"_id": 0, "nom": 1})
        inscription["centre_nom"] = centre["nom"] if centre else "Centre inconnu"
    
    return {"inscriptions": inscriptions}

@api_router.put("/inscriptions/{inscription_id}/approve")
async def approve_inscription(
    inscription_id: str,
    password: str,  # Mot de passe initial pour le nouveau compte
    current_user: User = Depends(get_current_user)
):
    """Approuver une demande d'inscription et créer le compte (Super-Admin uniquement)"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    inscription = await db.inscriptions.find_one({"id": inscription_id})
    if not inscription:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    if inscription["statut"] != "EN_ATTENTE":
        raise HTTPException(status_code=400, detail="Cette demande a déjà été traitée")
    
    # Créer le compte utilisateur
    user_data = {
        "id": str(uuid.uuid4()),
        "email": inscription["email"],
        "nom": inscription["nom"],
        "prenom": inscription["prenom"],
        "telephone": inscription.get("telephone"),
        "role": inscription["role_souhaite"],
        "centre_id": inscription["centre_id"],
        "password_hash": get_password_hash(password),
        "actif": True,
        "date_creation": datetime.now(timezone.utc),
        "vue_planning_complete": False,
        "peut_modifier_planning": False
    }
    
    await db.users.insert_one(user_data)
    
    # Mettre à jour l'inscription
    await db.inscriptions.update_one(
        {"id": inscription_id},
        {"$set": {
            "statut": "APPROUVE",
            "traite_par": current_user.id,
            "date_traitement": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "message": f"Compte créé pour {inscription['prenom']} {inscription['nom']}",
        "user_id": user_data["id"],
        "email": inscription["email"]
    }

@api_router.put("/inscriptions/{inscription_id}/reject")
async def reject_inscription(
    inscription_id: str,
    commentaire: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Rejeter une demande d'inscription (Super-Admin uniquement)"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    inscription = await db.inscriptions.find_one({"id": inscription_id})
    if not inscription:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    if inscription["statut"] != "EN_ATTENTE":
        raise HTTPException(status_code=400, detail="Cette demande a déjà été traitée")
    
    await db.inscriptions.update_one(
        {"id": inscription_id},
        {"$set": {
            "statut": "REJETE",
            "traite_par": current_user.id,
            "date_traitement": datetime.now(timezone.utc),
            "commentaire_admin": commentaire
        }}
    )
    
    return {"message": "Demande d'inscription rejetée"}

# ===== MIGRATION DES DONNÉES EXISTANTES =====

@api_router.post("/admin/migrate-to-multicentre")
async def migrate_to_multicentre(current_user: User = Depends(get_current_user)):
    """Migration des données vers le système multi-centres (Super-Admin uniquement, à exécuter une seule fois)"""
    if current_user.role not in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Accès réservé au Super-Admin")
    
    # Vérifier si la migration a déjà été faite
    existing_centre = await db.centres.find_one({"nom": "Place de l'Étoile"})
    if existing_centre:
        return {"message": "Migration déjà effectuée", "centre_id": existing_centre["id"]}
    
    # Créer le centre par défaut
    default_centre = Centre(
        nom="Place de l'Étoile",
        adresse="Place de l'Étoile, Paris",
        cree_par=current_user.id
    )
    await db.centres.insert_one(default_centre.dict())
    
    centre_id = default_centre.id
    
    # Migrer tous les utilisateurs (sauf le Super-Admin actuel)
    result_users = await db.users.update_many(
        {"centre_id": {"$exists": False}},
        {"$set": {"centre_id": centre_id}}
    )
    
    # Le Super-Admin n'a pas de centre_id (il gère tous les centres)
    await db.users.update_one(
        {"id": current_user.id},
        {"$unset": {"centre_id": ""}, "$set": {"role": ROLES["SUPER_ADMIN"]}}
    )
    
    # Migrer le planning
    result_planning = await db.planning.update_many(
        {"centre_id": {"$exists": False}},
        {"$set": {"centre_id": centre_id}}
    )
    
    # Migrer les salles
    result_rooms = await db.rooms.update_many(
        {"centre_id": {"$exists": False}},
        {"$set": {"centre_id": centre_id}}
    )
    
    # Migrer les demandes de congés
    result_conges = await db.demandes_conges.update_many(
        {"centre_id": {"$exists": False}},
        {"$set": {"centre_id": centre_id}}
    )
    
    # Migrer les messages (groupes par centre)
    result_messages = await db.messages.update_many(
        {"centre_id": {"$exists": False}},
        {"$set": {"centre_id": centre_id}}
    )
    
    return {
        "message": "Migration effectuée avec succès",
        "centre": {"id": centre_id, "nom": "Place de l'Étoile"},
        "stats": {
            "users_migrated": result_users.modified_count,
            "planning_migrated": result_planning.modified_count,
            "rooms_migrated": result_rooms.modified_count,
            "conges_migrated": result_conges.modified_count,
            "messages_migrated": result_messages.modified_count
        }
    }

# User management routes
@api_router.get("/users", response_model=List[User])
async def get_users(
    current_user: User = Depends(get_current_user),
    all_centres: bool = False  # Paramètre pour permettre au Directeur de voir tous les centres
):
    """Tous les utilisateurs authentifiés peuvent voir la liste du personnel de leur(s) centre(s)
    
    Paramètres:
    - all_centres: Si True et utilisateur est Directeur/Super-Admin, retourne TOUS les employés de tous les centres
    """
    is_super_admin = current_user.role in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]
    
    # Construire la requête selon le rôle
    query = {"actif": True}
    
    if not is_super_admin:
        # Les employés voient les utilisateurs de leurs centres
        user_centres = current_user.centre_ids if hasattr(current_user, 'centre_ids') and current_user.centre_ids else []
        if current_user.centre_id and current_user.centre_id not in user_centres:
            user_centres.append(current_user.centre_id)
        
        if user_centres:
            # Voir tous les utilisateurs qui ont au moins un centre en commun
            query["$or"] = [
                {"centre_id": {"$in": user_centres}},
                {"centre_ids": {"$elemMatch": {"$in": user_centres}}}
            ]
    elif is_super_admin and all_centres:
        # Directeur demande TOUS les employés de tous les centres - pas de filtre par centre
        pass  # query reste {"actif": True} uniquement
    else:
        # Super-Admin avec centre actif sélectionné (comportement par défaut)
        centre_actif = getattr(current_user, 'centre_actif_id', None)
        if centre_actif:
            query["$or"] = [
                {"centre_id": centre_actif},
                {"centre_ids": centre_actif}
            ]
    
    # Optimisation sécurité: exclure password_hash et _id
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [User(**user) for user in users]

@api_router.get("/users/by-role/{role}", response_model=List[User])
async def get_users_by_role(
    role: str, 
    current_user: User = Depends(get_current_user)
):
    if role not in ROLES.values():
        raise HTTPException(status_code=400, detail="Rôle invalide")
    
    is_super_admin = current_user.role in [ROLES["SUPER_ADMIN"], ROLES["DIRECTEUR"]]
    
    # Construire la requête
    query = {"role": role, "actif": True}
    
    if not is_super_admin:
        user_centres = current_user.centre_ids if hasattr(current_user, 'centre_ids') and current_user.centre_ids else []
        if current_user.centre_id and current_user.centre_id not in user_centres:
            user_centres.append(current_user.centre_id)
        
        if user_centres:
            query["$or"] = [
                {"centre_id": {"$in": user_centres}},
                {"centre_ids": {"$elemMatch": {"$in": user_centres}}}
            ]
    else:
        centre_actif = getattr(current_user, 'centre_actif_id', None)
        if centre_actif:
            query["$or"] = [
                {"centre_id": centre_actif},
                {"centre_ids": centre_actif}
            ]
    
    # Optimisation sécurité: exclure password_hash et _id
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [User(**user) for user in users]

@api_router.get("/users/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/users/me/email")
async def update_my_email(
    email_data: Dict[str, str],
    current_user: User = Depends(get_current_user)
):
    """Permet à un utilisateur de changer son propre email"""
    new_email = email_data.get('email')
    
    if not new_email or '@' not in new_email:
        raise HTTPException(status_code=400, detail="Email invalide")
    
    # Vérifier si l'email existe déjà
    existing_user = await db.users.find_one({"email": new_email})
    if existing_user and existing_user['id'] != current_user.id:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    # Mettre à jour l'email
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"email": new_email}}
    )
    
    return {"message": "Email mis à jour avec succès", "email": new_email}

@api_router.put("/users/me/password")
async def update_my_password(
    password_data: Dict[str, str],
    current_user: User = Depends(get_current_user)
):
    """Permet à un utilisateur de changer son propre mot de passe"""
    current_password = password_data.get('current_password')
    new_password = password_data.get('new_password')
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Mot de passe actuel et nouveau requis")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    
    # Récupérer l'utilisateur avec son mot de passe
    user = await db.users.find_one({"id": current_user.id})
    
    # Vérifier le mot de passe actuel
    if not verify_password(current_password, user.get('password_hash')):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    
    # Hasher et mettre à jour le nouveau mot de passe
    new_password_hash = get_password_hash(new_password)
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    return {"message": "Mot de passe mis à jour avec succès"}

@api_router.put("/users/me/profile")
async def update_my_profile(
    profile_data: Dict[str, str],
    current_user: User = Depends(get_current_user)
):
    """Permet à un utilisateur de changer son nom et prénom"""
    prenom = profile_data.get('prenom', '').strip()
    nom = profile_data.get('nom', '').strip()
    
    if not prenom or not nom:
        raise HTTPException(status_code=400, detail="Le prénom et le nom sont requis")
    
    if len(prenom) < 2 or len(nom) < 2:
        raise HTTPException(status_code=400, detail="Le prénom et le nom doivent contenir au moins 2 caractères")
    
    # Mettre à jour le profil
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"prenom": prenom, "nom": nom}}
    )
    
    return {"message": "Profil mis à jour avec succès", "prenom": prenom, "nom": nom}


@api_router.put("/users/{user_id}", response_model=User)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    update_data = {k: v for k, v in user_update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    updated_user = await db.users.find_one({"id": user_id})
    return User(**updated_user)

# Assistant assignments
@api_router.post("/assignations", response_model=AssignationAssistant)
async def create_assignation(
    medecin_id: str,
    assistant_id: str,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Verify users exist and have correct roles
    medecin = await db.users.find_one({"id": medecin_id, "role": ROLES["MEDECIN"]})
    assistant = await db.users.find_one({"id": assistant_id, "role": ROLES["ASSISTANT"]})
    
    if not medecin or not assistant:
        raise HTTPException(status_code=404, detail="Médecin ou assistant non trouvé")
    
    assignation = AssignationAssistant(medecin_id=medecin_id, assistant_id=assistant_id)
    await db.assignations.insert_one(assignation.dict())
    return assignation

@api_router.get("/assignations", response_model=List[Dict[str, Any]])
async def get_assignations(current_user: User = Depends(get_current_user)):
    assignations = await db.assignations.find({"actif": True}).to_list(1000)
    
    # Optimisation: Batch fetch all users at once (évite N+1 queries)
    all_user_ids = set()
    for assignation in assignations:
        all_user_ids.add(assignation["medecin_id"])
        all_user_ids.add(assignation["assistant_id"])
    
    # Une seule requête pour tous les utilisateurs
    users = await db.users.find(
        {"id": {"$in": list(all_user_ids)}},
        {"_id": 0, "password_hash": 0}  # Exclure champs sensibles
    ).to_list(1000)
    
    # Créer un map pour accès rapide O(1)
    users_map = {user["id"]: User(**user) for user in users}
    
    # Enrich with user details
    enriched_assignations = []
    for assignation in assignations:
        assignation.pop('_id', None)
        
        medecin = users_map.get(assignation["medecin_id"])
        assistant = users_map.get(assignation["assistant_id"])
        
        enriched_assignations.append({
            **assignation,
            "medecin": medecin.dict() if medecin else None,
            "assistant": assistant.dict() if assistant else None
        })
    
    return enriched_assignations

# Leave management
@api_router.post("/conges", response_model=DemandeConge)
async def create_demande_conge(
    demande_data: DemandeCongeCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    # Si un utilisateur_id est fourni et que l'utilisateur actuel est Directeur, l'utiliser
    # Sinon, utiliser l'ID de l'utilisateur actuel
    utilisateur_id = current_user.id
    if hasattr(demande_data, 'utilisateur_id') and demande_data.utilisateur_id:
        if current_user.role == ROLES["DIRECTEUR"]:
            utilisateur_id = demande_data.utilisateur_id
    
    demande = DemandeConge(
        utilisateur_id=utilisateur_id,
        date_debut=demande_data.date_debut,
        date_fin=demande_data.date_fin,
        type_conge=demande_data.type_conge,
        creneau=demande_data.creneau if demande_data.creneau else "JOURNEE_COMPLETE",
        heures_conge=demande_data.heures_conge,  # Heures personnalisées par demi-journée
        motif=demande_data.motif if demande_data.motif else None
    )
    
    await db.demandes_conges.insert_one(demande.dict())
    
    # 📤 NOTIFICATION : Nouvelle demande de congé
    # 1. Notifier le directeur pour TOUTES les demandes (y compris médecins)
    if current_user.role != ROLES["DIRECTEUR"]:
        user_name = f"{current_user.prenom} {current_user.nom}"
        if current_user.role == ROLES["MEDECIN"]:
            user_name = f"Dr. {user_name}"
        
        dates = f"{demande.date_debut} au {demande.date_fin}"
        creneau_text = "Journée complète" if demande.creneau == "JOURNEE_COMPLETE" else demande.creneau.lower()
        details = f"{dates} ({creneau_text})"
        
        background_tasks.add_task(
            notify_director_new_request, 
            "demande de congé", 
            user_name, 
            details
        )
        
        # 2. Notifier les collègues qui travaillent pendant ces jours
        background_tasks.add_task(
            notify_colleagues_about_leave,
            user_name,
            demande.date_debut,
            demande.date_fin,
            demande.creneau,
            utilisateur_id
        )
    
    return demande

@api_router.post("/conges/direct")
async def create_conge_direct(
    demande_data: dict,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Créer un congé directement (déjà approuvé) - Directeur uniquement
    
    Body attendu:
    {
        "utilisateur_id": "uuid de l'utilisateur" (obligatoire),
        "date_debut": "2026-01-20",
        "date_fin": "2026-01-20",
        "type_conge": "CONGE_PAYE" | "RTT" | "MALADIE" | "REPOS" | "HEURES_A_RECUPERER" | "HEURES_RECUPEREES",
        "duree": "JOURNEE_COMPLETE" | "MATIN" | "APRES_MIDI",
        "heures_conge": 4.0 (optionnel - heures par demi-journée),
        "motif": "optionnel"
    }
    """
    utilisateur_id = demande_data.get('utilisateur_id')
    if not utilisateur_id:
        raise HTTPException(status_code=400, detail="utilisateur_id est requis")
    
    # Vérifier que l'utilisateur existe
    user = await db.users.find_one({"id": utilisateur_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Créer le congé avec statut APPROUVE directement
    demande = DemandeConge(
        utilisateur_id=utilisateur_id,
        date_debut=demande_data['date_debut'],
        date_fin=demande_data['date_fin'],
        type_conge=demande_data.get('type_conge', 'CONGE_PAYE'),
        creneau=demande_data.get('duree', 'JOURNEE_COMPLETE'),
        heures_conge=demande_data.get('heures_conge'),  # Heures personnalisées par demi-journée
        motif=demande_data.get('motif', 'Créé depuis le planning'),
        statut='APPROUVE'  # Directement approuvé
    )
    
    await db.demandes_conges.insert_one(demande.dict())
    
    return {"message": "Congé créé et approuvé", "id": demande.id}

@api_router.get("/conges", response_model=List[Dict[str, Any]])
async def get_demandes_conges(current_user: User = Depends(get_current_user)):
    if current_user.role == ROLES["DIRECTEUR"]:
        demandes = await db.demandes_conges.find().to_list(1000)
    else:
        demandes = await db.demandes_conges.find({"utilisateur_id": current_user.id}).to_list(1000)
    
    # Optimisation: Batch fetch all users at once (évite N+1 queries)
    all_user_ids = set(demande["utilisateur_id"] for demande in demandes if "utilisateur_id" in demande)
    
    # Une seule requête pour tous les utilisateurs
    users = await db.users.find(
        {"id": {"$in": list(all_user_ids)}},
        {"_id": 0, "password_hash": 0}  # Exclure champs sensibles
    ).to_list(1000)
    
    # Créer un map pour accès rapide O(1)
    users_map = {user["id"]: User(**user) for user in users}
    
    # Enrich with user details and clean data
    enriched_demandes = []
    for demande in demandes:
        demande.pop('_id', None)
        
        utilisateur = users_map.get(demande.get("utilisateur_id"))
            
        enriched_demandes.append({
            **demande,
            "utilisateur": utilisateur if utilisateur else None
        })
    
    return enriched_demandes

@api_router.put("/conges/{demande_id}/approuver")
async def approuver_demande_conge(
    demande_id: str,
    request: ApprobationRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Récupérer la demande pour avoir les infos utilisateur
    demande = await db.demandes_conges.find_one({"id": demande_id})
    if not demande:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    statut = "APPROUVE" if request.approuve else "REJETE"
    update_data = {
        "statut": statut,
        "approuve_par": current_user.id,
        "date_approbation": datetime.now(timezone.utc),
        "commentaire_approbation": request.commentaire
    }
    
    result = await db.demandes_conges.update_one({"id": demande_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    # 📤 NOTIFICATION : Statut de la demande de congé
    dates = f"{demande['date_debut']} au {demande['date_fin']}"
    
    # 1. Notifier l'employé du statut de sa demande
    background_tasks.add_task(
        notify_user_request_status,
        demande["utilisateur_id"],
        "Demande de congé",
        statut,
        dates
    )
    
    # 2. Si approuvé, notifier aussi les collègues qui travaillent pendant ces jours
    if request.approuve:
        # Récupérer l'utilisateur pour avoir son nom
        user = await db.users.find_one({"id": demande["utilisateur_id"]})
        if user:
            user_name = f"{user['prenom']} {user['nom']}"
            if user['role'] == ROLES["MEDECIN"]:
                user_name = f"Dr. {user_name}"
            
            background_tasks.add_task(
                notify_colleagues_about_leave,
                user_name,
                demande['date_debut'],
                demande['date_fin'],
                demande.get('creneau', 'JOURNEE_COMPLETE'),
                demande["utilisateur_id"]
            )
        
        # 3. NOUVEAU: Gérer les créneaux des assistants assignés au médecin en congé
        background_tasks.add_task(
            handle_assistant_slots_for_leave,
            demande["utilisateur_id"],
            demande['date_debut'],
            demande['date_fin'],
            demande.get('creneau', 'JOURNEE_COMPLETE'),
            True  # approve=True
        )
    
    return {"message": f"Demande {statut.lower()}e avec succès"}

@api_router.put("/conges/{demande_id}/annuler")
async def annuler_conge(
    demande_id: str,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Annuler un congé approuvé (Directeur uniquement)"""
    demande = await db.demandes_conges.find_one({"id": demande_id})
    if not demande:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    update_data = {
        "statut": "ANNULE",
        "annule_par": current_user.id,
        "date_annulation": datetime.now(timezone.utc)
    }
    
    result = await db.demandes_conges.update_one({"id": demande_id}, {"$set": update_data})
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Erreur lors de l'annulation")
    
    return {"message": "Congé annulé avec succès"}

@api_router.put("/conges/{demande_id}/modifier-type")
async def modifier_type_conge(
    demande_id: str,
    nouveau_type: str,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Modifier le type d'un congé (Directeur uniquement). 
    Types: CONGE_PAYE, RTT, MALADIE, ABSENT, REPOS, HEURES_A_RECUPERER, HEURES_RECUPEREES"""
    demande = await db.demandes_conges.find_one({"id": demande_id})
    if not demande:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    types_valides = ["CONGE_PAYE", "RTT", "MALADIE", "ABSENT", "REPOS", "AUTRE", "HEURES_A_RECUPERER", "HEURES_RECUPEREES"]
    if nouveau_type not in types_valides:
        raise HTTPException(status_code=400, detail=f"Type invalide. Types valides: {', '.join(types_valides)}")
    
    update_data = {
        "type_conge": nouveau_type,
        "modifie_par": current_user.id,
        "date_modification": datetime.now(timezone.utc)
    }
    
    result = await db.demandes_conges.update_one({"id": demande_id}, {"$set": update_data})
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Erreur lors de la modification")
    
    return {"message": f"Type de congé modifié en '{nouveau_type}'"}

# Room reservations
@api_router.post("/salles/reservation", response_model=SalleReservation)
async def create_reservation_salle(
    reservation: SalleReservation,
    current_user: User = Depends(get_current_user)
):
    reservation.utilisateur_id = current_user.id
    
    # Check if room is available
    existing = await db.reservations_salles.find_one({
        "salle": reservation.salle,
        "date": reservation.date,
        "creneau": reservation.creneau
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Salle déjà réservée pour ce créneau")
    
    await db.reservations_salles.insert_one(reservation.dict())
    return reservation

@api_router.get("/salles/reservations", response_model=List[Dict[str, Any]])
async def get_reservations_salles(
    date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if date:
        query["date"] = date
    
    reservations = await db.reservations_salles.find(query).to_list(1000)
    
    # Optimisation: Batch fetch all users at once (évite N+1 queries)
    all_user_ids = set(res["utilisateur_id"] for res in reservations if "utilisateur_id" in res)
    
    # Une seule requête pour tous les utilisateurs
    users = await db.users.find(
        {"id": {"$in": list(all_user_ids)}},
        {"_id": 0, "password_hash": 0}  # Exclure champs sensibles
    ).to_list(1000)
    
    # Créer un map pour accès rapide O(1)
    users_map = {user["id"]: User(**user) for user in users}
    
    # Enrich with user details
    enriched_reservations = []
    for reservation in reservations:
        utilisateur = users_map.get(reservation.get("utilisateur_id"))
        enriched_reservations.append({
            **reservation,
            "utilisateur": utilisateur if utilisateur else None
        })
    
    return enriched_reservations

# Planning endpoints
@api_router.post("/planning", response_model=CreneauPlanning)
async def create_creneau_planning(
    creneau_data: CreneauPlanningCreate,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Vérifier que l'employé existe
    employe = await db.users.find_one({"id": creneau_data.employe_id})
    if not employe:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    # Si JOURNEE_COMPLETE, créer 2 créneaux séparés (MATIN + APRES_MIDI)
    creneaux_a_creer = []
    if creneau_data.creneau == "JOURNEE_COMPLETE":
        creneaux_a_creer = ["MATIN", "APRES_MIDI"]
    else:
        creneaux_a_creer = [creneau_data.creneau]
    
    created_creneaux = []
    for creneau_type in creneaux_a_creer:
        # Vérifier les conflits de planning
        existing = await db.planning.find_one({
            "date": creneau_data.date,
            "creneau": creneau_type,
            "employe_id": creneau_data.employe_id
        })
        
        if existing:
            raise HTTPException(status_code=400, detail=f"L'employé a déjà un créneau programmé le {creneau_type.lower()}")
        
        # Vérifier les conflits de salle
        if creneau_data.salle_attribuee:
            salle_occupee = await db.planning.find_one({
                "date": creneau_data.date,
                "creneau": creneau_type,
                "salle_attribuee": creneau_data.salle_attribuee
            })
            
            if salle_occupee:
                raise HTTPException(status_code=400, detail=f"La salle est déjà occupée le {creneau_type.lower()}")
        
        # Créer le créneau
        creneau_dict = creneau_data.dict()
        creneau_dict['creneau'] = creneau_type  # Remplacer JOURNEE_COMPLETE par MATIN ou APRES_MIDI
        creneau_dict['id'] = str(uuid.uuid4())  # Générer un nouvel ID pour chaque créneau
        
        creneau = CreneauPlanning(
            **creneau_dict,
            employe_role=employe['role']
        )
        
        await db.planning.insert_one(creneau.dict())
        created_creneaux.append(creneau)
    
    # Retourner le premier créneau créé (pour compatibilité avec l'ancien code)
    return created_creneaux[0]

@api_router.get("/planning", response_model=List[Dict[str, Any]])
async def get_planning(
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    
    if date_debut and date_fin:
        query["date"] = {"$gte": date_debut, "$lte": date_fin}
    elif date_debut:
        query["date"] = {"$gte": date_debut}
    
    creneaux = await db.planning.find(query).sort("date", 1).to_list(1000)
    
    # Enrichir avec les données des employés
    enriched_creneaux = []
    for creneau in creneaux:
        if '_id' in creneau:
            del creneau['_id']
            
        employe = await db.users.find_one({"id": creneau["employe_id"]})
        if employe and '_id' in employe:
            del employe['_id']
            
        medecin_attribue = None
        if creneau.get("medecin_attribue_id"):
            medecin_attribue = await db.users.find_one({"id": creneau["medecin_attribue_id"]})
            if medecin_attribue and '_id' in medecin_attribue:
                del medecin_attribue['_id']
        
        enriched_creneaux.append({
            **creneau,
            "employe": User(**employe) if employe else None,
            "medecin_attribue": User(**medecin_attribue) if medecin_attribue else None
        })
    
    return enriched_creneaux

# Notes journalières du planning - DOIT être AVANT /planning/{date}
@api_router.get("/planning/notes")
async def get_notes_planning(
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Récupère les notes journalières du planning"""
    query = {}
    if date_debut and date_fin:
        query["date"] = {"$gte": date_debut, "$lte": date_fin}
    elif date_debut:
        query["date"] = date_debut
    
    notes = await db.notes_planning.find(query).to_list(100)
    # Supprimer _id pour JSON serialization
    for note in notes:
        if '_id' in note:
            del note['_id']
    return notes

@api_router.put("/planning/notes/{date}")
async def save_note_planning(
    date: str,
    note_data: NotePlanningJourCreate,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Sauvegarde ou met à jour la note pour une date donnée"""
    existing = await db.notes_planning.find_one({"date": date})
    
    if existing:
        # Mise à jour
        await db.notes_planning.update_one(
            {"date": date},
            {"$set": {
                "note": note_data.note,
                "date_modification": datetime.now(timezone.utc),
                "modifie_par": current_user.id
            }}
        )
        updated = await db.notes_planning.find_one({"date": date})
        if '_id' in updated:
            del updated['_id']
        return updated
    else:
        # Création
        note = NotePlanningJour(
            date=date,
            note=note_data.note,
            modifie_par=current_user.id
        )
        await db.notes_planning.insert_one(note.dict())
        return note.dict()

@api_router.get("/planning/{date}", response_model=List[Dict[str, Any]])
async def get_planning_by_date(
    date: str,
    current_user: User = Depends(get_current_user)
):
    creneaux = await db.planning.find({"date": date}).sort("creneau", 1).to_list(1000)
    
    enriched_creneaux = []
    for creneau in creneaux:
        if '_id' in creneau:
            del creneau['_id']
            
        employe = await db.users.find_one({"id": creneau["employe_id"]})
        if employe and '_id' in employe:
            del employe['_id']
            
        medecin_attribue = None
        if creneau.get("medecin_attribue_id"):
            medecin_attribue = await db.users.find_one({"id": creneau["medecin_attribue_id"]})
            if medecin_attribue and '_id' in medecin_attribue:
                del medecin_attribue['_id']
        
        enriched_creneaux.append({
            **creneau,
            "employe": User(**employe) if employe else None,
            "medecin_attribue": User(**medecin_attribue) if medecin_attribue else None
        })
    
    return enriched_creneaux

@api_router.put("/planning/{creneau_id}")
async def update_creneau_planning(
    creneau_id: str,
    creneau_data: CreneauPlanningUpdate,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Vérifier que le créneau existe
    existing_creneau = await db.planning.find_one({"id": creneau_id})
    if not existing_creneau:
        raise HTTPException(status_code=404, detail="Créneau non trouvé")
    
    # Préparer les données à mettre à jour (seulement les champs non-None)
    update_data = {}
    for field, value in creneau_data.dict().items():
        if value is not None:
            update_data[field] = value
    
    # Cas spécial pour medecin_ids qui peut être une liste vide (valide)
    if creneau_data.medecin_ids is not None:
        update_data["medecin_ids"] = creneau_data.medecin_ids
    
    if update_data:
        result = await db.planning.update_one({"id": creneau_id}, {"$set": update_data})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Créneau non trouvé")
    
    return {"message": "Créneau mis à jour avec succès"}

@api_router.delete("/planning/{creneau_id}")
async def delete_creneau_planning(
    creneau_id: str,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Récupérer le créneau avant suppression pour trouver la demande associée
    creneau = await db.planning.find_one({"id": creneau_id})
    if not creneau:
        raise HTTPException(status_code=404, detail="Créneau non trouvé")
    
    # Supprimer le créneau
    result = await db.planning.delete_one({"id": creneau_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Créneau non trouvé")
    
    # CORRECTION BUG #4: Mettre à jour la demande de travail associée
    # Chercher la demande de travail qui a créé ce créneau
    demande_travail = await db.demandes_travail.find_one({
        "utilisateur_id": creneau.get("utilisateur_id"),
        "date_demandee": creneau.get("date"),
        "statut": "APPROUVE"
    })
    
    if demande_travail:
        # Vérifier si tous les créneaux de cette demande ont été supprimés
        creneaux_restants = await db.planning.count_documents({
            "utilisateur_id": creneau.get("utilisateur_id"),
            "date": creneau.get("date")
        })
        
        if creneaux_restants == 0:
            # Tous les créneaux supprimés -> Marquer la demande comme ANNULE
            await db.demandes_travail.update_one(
                {"id": demande_travail["id"]},
                {"$set": {
                    "statut": "ANNULE",
                    "annule_par": current_user.id,
                    "raison_annulation": "Créneau(x) supprimé(s) manuellement du planning",
                    "date_annulation": datetime.now(timezone.utc)
                }}
            )
            
            # Notifier l'employé
            user = await db.users.find_one({"id": creneau.get("utilisateur_id")})
            if user:
                await send_notification_to_user(
                    user["id"],
                    "⚠️ Créneau supprimé",
                    f"Votre créneau du {creneau.get('date')} ({creneau.get('creneau')}) a été supprimé du planning par le Directeur.",
                    {"type": "creneau_supprime", "date": creneau.get("date")}
                )
    
    return {"message": "Créneau supprimé avec succès", "demande_mise_a_jour": demande_travail is not None}

# Groupes de chat endpoints
@api_router.post("/groupes-chat", response_model=GroupeChat)
async def create_groupe_chat(
    groupe_data: GroupeChatCreate,
    current_user: User = Depends(get_current_user)
):
    # Vérifier que tous les membres existent
    for membre_id in groupe_data.membres:
        membre = await db.users.find_one({"id": membre_id})
        if not membre:
            raise HTTPException(status_code=404, detail=f"Utilisateur {membre_id} non trouvé")
    
    # Ajouter le créateur aux membres s'il n'y est pas déjà
    if current_user.id not in groupe_data.membres:
        groupe_data.membres.append(current_user.id)
    
    groupe = GroupeChat(
        createur_id=current_user.id,
        **groupe_data.dict()
    )
    
    await db.groupes_chat.insert_one(groupe.dict())
    return groupe

@api_router.get("/groupes-chat", response_model=List[Dict[str, Any]])
async def get_groupes_chat(current_user: User = Depends(get_current_user)):
    # Récupérer tous les groupes où l'utilisateur est membre
    groupes = await db.groupes_chat.find({
        "actif": True,
        "membres": current_user.id
    }).sort("date_creation", -1).to_list(1000)
    
    # Enrichir avec les détails des membres
    enriched_groupes = []
    for groupe in groupes:
        if '_id' in groupe:
            del groupe['_id']
            
        # Récupérer les détails des membres
        membres_details = []
        for membre_id in groupe.get("membres", []):
            membre = await db.users.find_one({"id": membre_id})
            if membre and '_id' in membre:
                del membre['_id']
            if membre:
                membres_details.append(User(**membre))
        
        createur = await db.users.find_one({"id": groupe["createur_id"]})
        if createur and '_id' in createur:
            del createur['_id']
        
        enriched_groupes.append({
            **groupe,
            "membres_details": membres_details,
            "createur": User(**createur) if createur else None
        })
    
    return enriched_groupes

@api_router.put("/groupes-chat/{groupe_id}/membres")
async def update_membres_groupe(
    groupe_id: str,
    nouveaux_membres: List[str],
    current_user: User = Depends(get_current_user)
):
    # Vérifier que l'utilisateur est membre ou créateur du groupe
    groupe = await db.groupes_chat.find_one({"id": groupe_id})
    if not groupe:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")
    
    if current_user.id not in groupe.get("membres", []) and current_user.id != groupe.get("createur_id"):
        raise HTTPException(status_code=403, detail="Vous n'êtes pas membre de ce groupe")
    
    # Mettre à jour les membres
    result = await db.groupes_chat.update_one(
        {"id": groupe_id},
        {"$set": {"membres": nouveaux_membres}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Groupe non trouvé")
    
    return {"message": "Membres mis à jour avec succès"}

# Chat endpoints
@api_router.post("/messages", response_model=Message)
async def send_message(
    message_data: MessageCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    # Validation selon le type de message
    if message_data.type_message == "GROUPE":
        if not message_data.groupe_id:
            raise HTTPException(status_code=400, detail="ID du groupe requis")
        
        # Vérifier que l'utilisateur est membre du groupe
        groupe = await db.groupes_chat.find_one({"id": message_data.groupe_id})
        if not groupe or current_user.id not in groupe.get("membres", []):
            raise HTTPException(status_code=403, detail="Vous n'êtes pas membre de ce groupe")
    
    elif message_data.type_message == "PRIVE":
        if not message_data.destinataire_id:
            raise HTTPException(status_code=400, detail="Destinataire requis pour un message privé")
    
    message = Message(
        expediteur_id=current_user.id,
        destinataire_id=message_data.destinataire_id,
        groupe_id=message_data.groupe_id,
        contenu=message_data.contenu,
        type_message=message_data.type_message
    )
    
    await db.messages.insert_one(message.dict())
    
    # 📤 NOTIFICATION : Nouveau message
    sender_name = f"{current_user.prenom} {current_user.nom}"
    if current_user.role == ROLES["MEDECIN"]:
        sender_name = f"Dr. {sender_name}"
    
    # Tronquer le message si trop long
    preview = message_data.contenu[:100] + "..." if len(message_data.contenu) > 100 else message_data.contenu
    
    if message_data.type_message == "PRIVE":
        # Notification au destinataire uniquement
        background_tasks.add_task(
            send_notification_to_user,
            message_data.destinataire_id,
            f"💬 Message de {sender_name}",
            preview,
            {"type": "new_message", "message_type": "PRIVE", "sender_id": current_user.id}
        )
    
    elif message_data.type_message == "GROUPE":
        # Notification à tous les membres du groupe sauf l'expéditeur
        groupe = await db.groupes_chat.find_one({"id": message_data.groupe_id})
        if groupe:
            groupe_name = groupe.get("nom", "Groupe")
            for membre_id in groupe.get("membres", []):
                if membre_id != current_user.id:  # Ne pas notifier l'expéditeur
                    background_tasks.add_task(
                        send_notification_to_user,
                        membre_id,
                        f"💬 {sender_name} dans {groupe_name}",
                        preview,
                        {"type": "new_message", "message_type": "GROUPE", "groupe_id": message_data.groupe_id}
                    )
    
    elif message_data.type_message == "GENERAL":
        # Notification à tous les employés actifs sauf l'expéditeur
        all_users = await db.users.find({"actif": True, "id": {"$ne": current_user.id}}).to_list(1000)
        for user in all_users:
            background_tasks.add_task(
                send_notification_to_user,
                user["id"],
                f"📢 Message général de {sender_name}",
                preview,
                {"type": "new_message", "message_type": "GENERAL"}
            )
    
    return message

@api_router.get("/messages", response_model=List[Dict[str, Any]])
async def get_messages(
    type_message: str = "GENERAL",
    groupe_id: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    query = {"type_message": type_message}
    
    if type_message == "PRIVE":
        # Messages privés pour l'utilisateur courant
        query = {
            "$or": [
                {"expediteur_id": current_user.id, "type_message": "PRIVE"},
                {"destinataire_id": current_user.id, "type_message": "PRIVE"}
            ]
        }
    elif type_message == "GROUPE" and groupe_id:
        # Messages du groupe spécifique
        query = {
            "type_message": "GROUPE",
            "groupe_id": groupe_id
        }
        # Vérifier que l'utilisateur est membre du groupe
        groupe = await db.groupes_chat.find_one({"id": groupe_id})
        if not groupe or current_user.id not in groupe.get("membres", []):
            raise HTTPException(status_code=403, detail="Vous n'êtes pas membre de ce groupe")
    
    messages = await db.messages.find(query).sort("date_envoi", -1).limit(limit).to_list(limit)
    
    enriched_messages = []
    for message in messages:
        if '_id' in message:
            del message['_id']
            
        expediteur = await db.users.find_one({"id": message["expediteur_id"]})
        if expediteur and '_id' in expediteur:
            del expediteur['_id']
            
        destinataire = None
        if message.get("destinataire_id"):
            destinataire = await db.users.find_one({"id": message["destinataire_id"]})
            if destinataire and '_id' in destinataire:
                del destinataire['_id']
        
        enriched_messages.append({
            **message,
            "expediteur": User(**expediteur) if expediteur else None,
            "destinataire": User(**destinataire) if destinataire else None
        })
    
    return enriched_messages

@api_router.get("/messages/conversation/{user_id}", response_model=List[Dict[str, Any]])
async def get_conversation(
    user_id: str,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    query = {
        "$or": [
            {"expediteur_id": current_user.id, "destinataire_id": user_id},
            {"expediteur_id": user_id, "destinataire_id": current_user.id}
        ],
        "type_message": "PRIVE"
    }
    
    messages = await db.messages.find(query).sort("date_envoi", 1).limit(limit).to_list(limit)
    
    # Marquer les messages comme lus
    await db.messages.update_many(
        {"expediteur_id": user_id, "destinataire_id": current_user.id, "lu": False},
        {"$set": {"lu": True}}
    )
    
    enriched_messages = []
    for message in messages:
        if '_id' in message:
            del message['_id']
            
        expediteur = await db.users.find_one({"id": message["expediteur_id"]})
        if expediteur and '_id' in expediteur:
            del expediteur['_id']
            
        destinataire = await db.users.find_one({"id": message["destinataire_id"]})
        if destinataire and '_id' in destinataire:
            del destinataire['_id']
        
        enriched_messages.append({
            **message,
            "expediteur": User(**expediteur) if expediteur else None,
            "destinataire": User(**destinataire) if destinataire else None
        })
    
    return enriched_messages

# Notifications endpoints
@api_router.post("/notifications/generate/{date}")
async def generate_daily_notifications(
    date: str,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Générer les notifications pour tous les employés pour une date donnée
    creneaux = await db.planning.find({"date": date}).to_list(1000)
    
    notifications_created = 0
    
    for creneau in creneaux:
        employe = await db.users.find_one({"id": creneau["employe_id"]})
        if not employe:
            continue
        
        # Vérifier si une notification existe déjà
        existing_notif = await db.notifications.find_one({
            "employe_id": creneau["employe_id"],
            "date": date
        })
        
        if existing_notif:
            continue
        
        # Construire le contenu de la notification
        contenu_parts = [f"Bonjour {employe['prenom']} {employe['nom']},"]
        contenu_parts.append(f"Voici votre planning pour le {date} ({creneau['creneau']}) :")
        
        if creneau.get('salle_attribuee'):
            contenu_parts.append(f"📍 Salle assignée : {creneau['salle_attribuee']}")
        
        if creneau.get('salle_attente'):
            contenu_parts.append(f"🚪 Salle d'attente : {creneau['salle_attente']}")
        
        if creneau.get('medecin_attribue_id'):
            medecin = await db.users.find_one({"id": creneau['medecin_attribue_id']})
            if medecin:
                contenu_parts.append(f"👨‍⚕️ Travail avec : Dr. {medecin['prenom']} {medecin['nom']}")
        
        if creneau.get('horaire_debut') and creneau.get('horaire_fin'):
            contenu_parts.append(f"⏰ Horaires : {creneau['horaire_debut']} - {creneau['horaire_fin']}")
        
        if creneau.get('notes'):
            contenu_parts.append(f"📝 Notes : {creneau['notes']}")
        
        contenu_parts.append("Bonne journée !")
        
        notification = NotificationQuotidienne(
            employe_id=creneau["employe_id"],
            date=date,
            contenu="\n".join(contenu_parts)
        )
        
        await db.notifications.insert_one(notification.dict())
        notifications_created += 1
    
    return {"message": f"{notifications_created} notifications générées pour le {date}"}

@api_router.get("/notifications/{date}")
async def get_notifications_by_date(
    date: str,
    current_user: User = Depends(get_current_user)
):
    if current_user.role == ROLES["DIRECTEUR"]:
        # Le directeur voit toutes les notifications
        notifications = await db.notifications.find({"date": date}).to_list(1000)
    else:
        # Les autres voient seulement leurs notifications
        notifications = await db.notifications.find({
            "date": date,
            "employe_id": current_user.id
        }).to_list(1000)
    
    enriched_notifications = []
    for notif in notifications:
        if '_id' in notif:
            del notif['_id']
        
        employe = await db.users.find_one({"id": notif["employe_id"]})
        if employe and '_id' in employe:
            del employe['_id']
        
        enriched_notifications.append({
            **notif,
            "employe": User(**employe) if employe else None
        })
    
    return enriched_notifications

@api_router.get("/notifications/me/today")
async def get_my_today_notification(current_user: User = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    notification = await db.notifications.find_one({
        "employe_id": current_user.id,
        "date": today
    })
    
    if notification and '_id' in notification:
        del notification['_id']
    
    return notification

@api_router.post("/admin/send-notification")
async def send_custom_notification(
    request: dict,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Envoyer une notification personnalisée à un utilisateur"""
    user_id = request.get("user_id")
    message = request.get("message")
    
    if not user_id or not message:
        raise HTTPException(status_code=400, detail="user_id et message requis")
    
    # Vérifier que l'utilisateur existe
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Envoyer la notification
    title = f"📢 Message du directeur"
    await send_notification_to_user(user_id, title, message)
    
    return {"message": "Notification envoyée avec succès"}

# Gestion des salles
@api_router.post("/salles", response_model=Salle)
async def create_salle(
    salle_data: SalleCreate,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Vérifier si une salle avec ce nom existe déjà
    existing = await db.salles.find_one({"nom": salle_data.nom, "actif": True})
    if existing:
        raise HTTPException(status_code=400, detail="Une salle avec ce nom existe déjà")
    
    salle = Salle(**salle_data.dict())
    await db.salles.insert_one(salle.dict())
    return salle

@api_router.get("/salles", response_model=List[Salle])
async def get_salles(
    actif_seulement: bool = True,
    current_user: User = Depends(get_current_user)
):
    query = {"actif": True} if actif_seulement else {}
    salles = await db.salles.find(query).sort("nom", 1).to_list(1000)
    
    cleaned_salles = []
    for salle in salles:
        if '_id' in salle:
            del salle['_id']
        cleaned_salles.append(Salle(**salle))
    
    return cleaned_salles

@api_router.put("/salles/{salle_id}", response_model=Salle)
async def update_salle(
    salle_id: str,
    salle_data: SalleUpdate,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    update_data = {k: v for k, v in salle_data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    
    result = await db.salles.update_one({"id": salle_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Salle non trouvée")
    
    updated_salle = await db.salles.find_one({"id": salle_id})
    if '_id' in updated_salle:
        del updated_salle['_id']
    return Salle(**updated_salle)

@api_router.delete("/salles/{salle_id}")
async def delete_salle(
    salle_id: str,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Soft delete - marquer comme inactif
    result = await db.salles.update_one({"id": salle_id}, {"$set": {"actif": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Salle non trouvée")
    
    return {"message": "Salle supprimée avec succès"}

# Configuration du cabinet
@api_router.get("/configuration", response_model=ConfigurationCabinet)
async def get_configuration(current_user: User = Depends(get_current_user)):
    config = await db.configuration.find_one()
    
    if not config:
        # Créer une configuration par défaut
        default_config = ConfigurationCabinet()
        await db.configuration.insert_one(default_config.dict())
        return default_config
    
    if '_id' in config:
        del config['_id']
    return ConfigurationCabinet(**config)

@api_router.put("/configuration", response_model=ConfigurationCabinet)
async def update_configuration(
    config_data: ConfigurationCabinetUpdate,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    update_data = {k: v for k, v in config_data.dict().items() if v is not None}
    update_data['date_modification'] = datetime.now(timezone.utc)
    
    existing_config = await db.configuration.find_one()
    
    if existing_config:
        result = await db.configuration.update_one({"id": existing_config["id"]}, {"$set": update_data})
        updated_config = await db.configuration.find_one({"id": existing_config["id"]})
    else:
        # Créer nouvelle configuration
        new_config = ConfigurationCabinet(**update_data)
        await db.configuration.insert_one(new_config.dict())
        updated_config = new_config.dict()
    
    if '_id' in updated_config:
        del updated_config['_id']
    return ConfigurationCabinet(**updated_config)

# Gestion des semaines types
@api_router.post("/semaines-types", response_model=SemaineType)
async def create_semaine_type(
    semaine_data: SemaineTypeCreate,
    current_user: User = Depends(get_current_user)
):
    semaine = SemaineType(**semaine_data.dict())
    
    # Si c'est un médecin, assigner automatiquement sa semaine type à lui seul
    if current_user.role == ROLES["MEDECIN"]:
        semaine.medecin_id = current_user.id
    # Si c'est le directeur, il peut créer des semaines globales (medecin_id = None par défaut)
    
    await db.semaines_types.insert_one(semaine.dict())
    return semaine

@api_router.get("/semaines-types", response_model=List[SemaineType])
async def get_semaines_types(current_user: User = Depends(get_current_user)):
    # Filtrer selon le rôle
    if current_user.role == ROLES["MEDECIN"]:
        # Les médecins ne voient QUE leurs propres semaines types (pas les globales)
        query = {
            "actif": True,
            "medecin_id": current_user.id
        }
    elif current_user.role == ROLES["DIRECTEUR"]:
        # Le directeur voit toutes les semaines types
        query = {"actif": True}
    else:
        # Les autres rôles voient uniquement leurs propres semaines
        query = {
            "actif": True,
            "medecin_id": current_user.id
        }
    
    semaines = await db.semaines_types.find(query).sort("nom", 1).to_list(1000)
    
    cleaned_semaines = []
    for semaine in semaines:
        if '_id' in semaine:
            del semaine['_id']
        cleaned_semaines.append(SemaineType(**semaine))
    
    return cleaned_semaines

@api_router.post("/semaines-types/init")
async def init_semaines_types(
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Vérifier si des semaines types existent déjà
    existing = await db.semaines_types.count_documents({"actif": True})
    if existing > 0:
        return {"message": f"Semaines types déjà initialisées ({existing} semaines)"}
    
    # Créer des semaines types par défaut
    semaines_par_defaut = [
        {
            "nom": "Temps plein",
            "description": "Travail du lundi au vendredi - journées complètes",
            "lundi": "JOURNEE_COMPLETE",
            "mardi": "JOURNEE_COMPLETE",
            "mercredi": "JOURNEE_COMPLETE",
            "jeudi": "JOURNEE_COMPLETE",
            "vendredi": "JOURNEE_COMPLETE",
            "samedi": "REPOS",
            "dimanche": "REPOS"
        },
        {
            "nom": "Temps partiel matin",
            "description": "Travail du lundi au vendredi - matins uniquement",
            "lundi": "MATIN",
            "mardi": "MATIN",
            "mercredi": "MATIN",
            "jeudi": "MATIN",
            "vendredi": "MATIN",
            "samedi": "REPOS",
            "dimanche": "REPOS"
        },
        {
            "nom": "Temps partiel après-midi",
            "description": "Travail du lundi au vendredi - après-midis uniquement",
            "lundi": "APRES_MIDI",
            "mardi": "APRES_MIDI",
            "mercredi": "APRES_MIDI",
            "jeudi": "APRES_MIDI",
            "vendredi": "APRES_MIDI",
            "samedi": "REPOS",
            "dimanche": "REPOS"
        },
        {
            "nom": "Week-end",
            "description": "Travail week-end uniquement",
            "lundi": "REPOS",
            "mardi": "REPOS",
            "mercredi": "REPOS",
            "jeudi": "REPOS",
            "vendredi": "REPOS",
            "samedi": "JOURNEE_COMPLETE",
            "dimanche": "JOURNEE_COMPLETE"
        }
    ]
    
    semaines_creees = 0
    for semaine_data in semaines_par_defaut:
        semaine = SemaineType(**semaine_data)
        await db.semaines_types.insert_one(semaine.dict())
        semaines_creees += 1
    
    return {"message": f"{semaines_creees} semaines types créées"}

# Demandes de jours de travail
@api_router.post("/demandes-travail", response_model=List[DemandeJourTravail])
async def create_demande_jour_travail(
    demande_data: DemandeJourTravailCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    # Vérifier que l'utilisateur est médecin ou directeur
    if current_user.role not in [ROLES["MEDECIN"], ROLES["DIRECTEUR"]]:
        raise HTTPException(status_code=403, detail="Seuls les médecins peuvent faire des demandes de jours de travail")
    
    # Déterminer l'ID du médecin concerné
    medecin_id = demande_data.medecin_id if demande_data.medecin_id and current_user.role == ROLES["DIRECTEUR"] else current_user.id
    
    demandes_creees = []
    
    if demande_data.semaine_type_id:
        # Demande de semaine type
        semaine_type = await db.semaines_types.find_one({"id": demande_data.semaine_type_id})
        if not semaine_type:
            raise HTTPException(status_code=404, detail="Semaine type non trouvée")
        
        # Calculer les dates de la semaine
        from datetime import datetime, timedelta
        date_debut = datetime.strptime(demande_data.date_debut_semaine, '%Y-%m-%d')
        
        jours_semaine = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
        
        for i, jour in enumerate(jours_semaine):
            creneau = semaine_type.get(jour)
            if creneau and creneau != 'REPOS':
                date_jour = (date_debut + timedelta(days=i)).strftime('%Y-%m-%d')
                
                # Vérification intelligente des conflits (même logique que demande individuelle)
                demandes_existantes = await db.demandes_travail.find({
                    "medecin_id": medecin_id,
                    "date_demandee": date_jour,
                    "statut": {"$nin": ["REJETE", "ANNULE"]}
                }).to_list(length=None)
                
                conflit = False
                for demande_existante in demandes_existantes:
                    creneau_existant = demande_existante["creneau"]
                    
                    # Doublon strict
                    if creneau == creneau_existant:
                        conflit = True
                        break
                    
                    # JOURNEE_COMPLETE vs MATIN/APRES_MIDI
                    if creneau == "JOURNEE_COMPLETE" and creneau_existant in ["MATIN", "APRES_MIDI"]:
                        conflit = True
                        break
                    
                    # MATIN/APRES_MIDI vs JOURNEE_COMPLETE
                    if creneau in ["MATIN", "APRES_MIDI"] and creneau_existant == "JOURNEE_COMPLETE":
                        conflit = True
                        break
                    
                    # MATIN + APRES_MIDI = OK (pas de conflit)
                
                if not conflit:
                    demande = DemandeJourTravail(
                        medecin_id=medecin_id,
                        date_demandee=date_jour,
                        creneau=creneau,
                        motif=f"Semaine type: {semaine_type['nom']}"
                    )
                    await db.demandes_travail.insert_one(demande.dict())
                    demandes_creees.append(demande)
        
        # 📤 NOTIFICATION : Nouvelle demande de semaine type (si créé par médecin)
        if current_user.role == ROLES["MEDECIN"] and demandes_creees:
            user_name = f"Dr. {current_user.prenom} {current_user.nom}"
            details = f"Semaine type '{semaine_type['nom']}' du {demande_data.date_debut_semaine}"
            background_tasks.add_task(
                notify_director_new_request,
                "demande de semaine type",
                user_name,
                details
            )
            
    else:
        # Demande individuelle
        if not demande_data.date_demandee or not demande_data.creneau:
            raise HTTPException(status_code=400, detail="Date et créneau requis pour une demande individuelle")
        
        # Vérification intelligente des conflits de créneaux
        # On doit vérifier s'il y a un conflit RÉEL entre les créneaux
        
        # Récupérer toutes les demandes actives pour ce médecin à cette date
        demandes_existantes = await db.demandes_travail.find({
            "medecin_id": medecin_id,
            "date_demandee": demande_data.date_demandee,
            "statut": {"$nin": ["REJETE", "ANNULE"]}
        }).to_list(length=None)
        
        # Analyser les conflits
        creneau_demande = demande_data.creneau
        
        for demande_existante in demandes_existantes:
            creneau_existant = demande_existante["creneau"]
            
            # Cas 1 : Demande identique (doublon strict)
            if creneau_demande == creneau_existant:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Une demande {creneau_existant} existe déjà pour cette date"
                )
            
            # Cas 2 : JOURNEE_COMPLETE en conflit avec MATIN ou APRES_MIDI
            if creneau_demande == "JOURNEE_COMPLETE" and creneau_existant in ["MATIN", "APRES_MIDI"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Impossible de demander une journée complète : vous avez déjà une demande pour l'{creneau_existant}. Annulez-la d'abord ou demandez seulement le créneau manquant."
                )
            
            # Cas 3 : MATIN ou APRES_MIDI en conflit avec JOURNEE_COMPLETE existante
            if creneau_demande in ["MATIN", "APRES_MIDI"] and creneau_existant == "JOURNEE_COMPLETE":
                raise HTTPException(
                    status_code=400,
                    detail=f"Impossible de demander {creneau_demande} : vous avez déjà une demande pour la JOURNEE_COMPLETE. Annulez-la d'abord ou gardez la journée complète."
                )
            
            # Cas 4 : MATIN + APRES_MIDI séparés = OK (pas de conflit)
            # Si creneau_demande = MATIN et creneau_existant = APRES_MIDI → OK
            # Si creneau_demande = APRES_MIDI et creneau_existant = MATIN → OK
            # Aucune exception levée dans ce cas
        
        demande = DemandeJourTravail(
            medecin_id=medecin_id,
            date_demandee=demande_data.date_demandee,
            creneau=demande_data.creneau,
            motif=demande_data.motif
        )
        
        await db.demandes_travail.insert_one(demande.dict())
        demandes_creees.append(demande)
        
        # 📤 NOTIFICATION : Nouvelle demande individuelle (si créé par médecin) 
        if current_user.role == ROLES["MEDECIN"]:
            user_name = f"Dr. {current_user.prenom} {current_user.nom}"
            creneau_text = "Journée complète" if demande.creneau == "JOURNEE_COMPLETE" else demande.creneau.lower()
            details = f"{demande.date_demandee} ({creneau_text})"
            background_tasks.add_task(
                notify_director_new_request,
                "demande de jour de travail",
                user_name,
                details
            )
    
    return demandes_creees

@api_router.get("/demandes-travail", response_model=List[Dict[str, Any]])
async def get_demandes_jour_travail(
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    
    if current_user.role == ROLES["DIRECTEUR"]:
        # Le directeur voit toutes les demandes
        pass
    else:
        # Les médecins voient seulement leurs demandes
        query["medecin_id"] = current_user.id
    
    if date_debut and date_fin:
        query["date_demandee"] = {"$gte": date_debut, "$lte": date_fin}
    elif date_debut:
        query["date_demandee"] = {"$gte": date_debut}
    
    demandes = await db.demandes_travail.find(query).sort("date_demandee", 1).to_list(1000)
    
    # Enrichir avec les données des médecins
    enriched_demandes = []
    for demande in demandes:
        if '_id' in demande:
            del demande['_id']
            
        medecin = await db.users.find_one({"id": demande["medecin_id"]})
        if medecin and '_id' in medecin:
            del medecin['_id']
        
        enriched_demandes.append({
            **demande,
            "medecin": User(**medecin) if medecin else None
        })
    
    return enriched_demandes


@api_router.post("/demandes-travail/mensuelle", response_model=dict)
async def create_demande_mensuelle(
    demande_data: DemandeMensuelleCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Créer des demandes de travail pour un mois entier"""
    from datetime import datetime, timedelta
    from calendar import monthrange
    
    # Déterminer le médecin concerné
    if current_user.role == ROLES["DIRECTEUR"]:
        # Le directeur doit spécifier pour quel médecin
        if not demande_data.medecin_id:
            raise HTTPException(status_code=400, detail="Le médecin doit être spécifié")
        medecin_id = demande_data.medecin_id
        # Vérifier que le médecin existe
        medecin = await db.users.find_one({"id": medecin_id, "role": ROLES["MEDECIN"]})
        if not medecin:
            raise HTTPException(status_code=404, detail="Médecin non trouvé")
    elif current_user.role == ROLES["MEDECIN"]:
        # Le médecin fait la demande pour lui-même
        medecin_id = current_user.id
        medecin = current_user
    else:
        raise HTTPException(status_code=403, detail="Vous n'avez pas l'autorisation")
    
    try:
        # Parser la date de début
        date_debut = datetime.strptime(demande_data.date_debut, '%Y-%m-%d')
        
        # Calculer le dernier jour du mois
        year = date_debut.year
        month = date_debut.month
        dernier_jour = monthrange(year, month)[1]
        date_fin = datetime(year, month, dernier_jour)
        
        # Si une semaine type est fournie, la récupérer
        semaine_type = None
        if demande_data.semaine_type_id:
            semaine_type = await db.semaines_types.find_one({"id": demande_data.semaine_type_id})
            if not semaine_type:
                raise HTTPException(status_code=404, detail="Semaine type non trouvée")
        
        # Créer les demandes jour par jour
        demandes_creees = []
        
        # Si jours_avec_creneaux est fourni, utiliser cette liste directement
        if demande_data.jours_avec_creneaux:
            for jour_data in demande_data.jours_avec_creneaux:
                date_str = jour_data.get('date')
                creneau = jour_data.get('creneau')
                
                if not date_str or not creneau:
                    continue
                
                # Vérifier qu'il n'y a pas déjà une demande pour ce jour
                existing = await db.demandes_travail.find_one({
                    "medecin_id": medecin_id,
                    "date_demandee": date_str,
                    "statut": {"$in": ["EN_ATTENTE", "APPROUVE"]}
                })
                
                if not existing:
                    demande = DemandeJourTravail(
                        medecin_id=medecin_id,
                        date_demandee=date_str,
                        creneau=creneau,
                        motif=demande_data.motif or f"Demande mensuelle {date_debut.strftime('%B %Y')}"
                    )
                    await db.demandes_travail.insert_one(demande.dict())
                    demandes_creees.append(date_str)
        else:
            # Mode legacy : utiliser semaine type ou défaut (rétrocompatibilité)
            current_date = date_debut
            jours_semaine = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
            
            while current_date <= date_fin:
                date_str = current_date.strftime('%Y-%m-%d')
                
                # Vérifier si ce jour est exclu
                if date_str in demande_data.jours_exclus:
                    current_date += timedelta(days=1)
                    continue
                
                # Déterminer le créneau selon la semaine type ou défaut
                creneau = None
                if semaine_type:
                    jour_semaine = jours_semaine[current_date.weekday()]
                    creneau = semaine_type.get(jour_semaine, 'REPOS')
                else:
                    # Par défaut, demander la journée complète pour les jours ouvrables
                    if current_date.weekday() < 6:  # Lundi à Samedi
                        creneau = 'JOURNEE_COMPLETE'
                    else:
                        creneau = 'REPOS'
                
                # Ne créer une demande que si ce n'est pas un jour de repos
                if creneau and creneau != 'REPOS':
                    # Vérifier qu'il n'y a pas déjà une demande pour ce jour
                    existing = await db.demandes_travail.find_one({
                        "medecin_id": medecin_id,
                        "date_demandee": date_str,
                        "statut": {"$in": ["EN_ATTENTE", "APPROUVE"]}
                    })
                    
                    if not existing:
                        demande = DemandeJourTravail(
                            medecin_id=medecin_id,
                            date_demandee=date_str,
                            creneau=creneau,
                            motif=demande_data.motif or f"Demande mensuelle {date_debut.strftime('%B %Y')}"
                        )
                        await db.demandes_travail.insert_one(demande.dict())
                        demandes_creees.append(date_str)
                
                current_date += timedelta(days=1)
        
        # 📤 NOTIFICATION : Notifier le directeur (seulement si c'est le médecin qui fait la demande)
        if demandes_creees and current_user.role == ROLES["MEDECIN"]:
            user_name = f"Dr. {current_user.prenom} {current_user.nom}"
            details = f"{len(demandes_creees)} demandes pour {date_debut.strftime('%B %Y')}"
            
            background_tasks.add_task(
                notify_director_new_request,
                "demandes de travail mensuelles",
                user_name,
                details
            )
        
        return {
            "message": f"{len(demandes_creees)} demandes créées avec succès",
            "demandes_creees": len(demandes_creees),
            "dates": demandes_creees
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/demandes-travail/{demande_id}/approuver")
async def approuver_demande_jour_travail(
    demande_id: str,
    request: ApprobationJourTravailRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Récupérer la demande
    demande = await db.demandes_travail.find_one({"id": demande_id})
    if not demande:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    if request.approuve:
        # Vérifier la capacité du cabinet
        config = await get_configuration(current_user)
        
        # Compter les médecins déjà validés pour cette date/créneau
        date_demandee = demande["date_demandee"]
        creneau = demande["creneau"]
        
        if creneau == "JOURNEE_COMPLETE":
            # Vérifier matin et après-midi
            demandes_matin = await db.demandes_travail.count_documents({
                "date_demandee": date_demandee,
                "creneau": {"$in": ["MATIN", "JOURNEE_COMPLETE"]},
                "statut": "APPROUVE"
            })
            demandes_apres_midi = await db.demandes_travail.count_documents({
                "date_demandee": date_demandee,
                "creneau": {"$in": ["APRES_MIDI", "JOURNEE_COMPLETE"]},
                "statut": "APPROUVE"
            })
            
            if demandes_matin >= config.max_medecins_par_jour or demandes_apres_midi >= config.max_medecins_par_jour:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cabinet complet pour cette journée. Maximum : {config.max_medecins_par_jour} médecins par créneau"
                )
        else:
            # Vérifier le créneau spécifique
            demandes_existantes = await db.demandes_travail.count_documents({
                "date_demandee": date_demandee,
                "creneau": {"$in": [creneau, "JOURNEE_COMPLETE"]},
                "statut": "APPROUVE"
            })
            
            if demandes_existantes >= config.max_medecins_par_jour:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cabinet complet pour ce créneau. Maximum : {config.max_medecins_par_jour} médecins"
                )
    
    # Avant d'approuver, vérifier les conflits avec demandes déjà APPROUVÉES
    if request.approuve:
        demandes_approuvees = await db.demandes_travail.find({
            "medecin_id": demande["medecin_id"],
            "date_demandee": demande["date_demandee"],
            "statut": "APPROUVE",
            "id": {"$ne": demande_id}
        }).to_list(length=None)
        
        for demande_approuvee in demandes_approuvees:
            creneau_approuve = demande_approuvee["creneau"]
            creneau_a_approuver = demande["creneau"]
            
            # Conflit : même créneau
            if creneau_a_approuver == creneau_approuve:
                raise HTTPException(
                    status_code=400,
                    detail=f"Impossible d'approuver : ce médecin a déjà une demande approuvée pour {creneau_approuve}"
                )
            
            # Conflit : JOURNEE vs MATIN/APRES_MIDI
            if creneau_a_approuver == "JOURNEE_COMPLETE" and creneau_approuve in ["MATIN", "APRES_MIDI"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Impossible d'approuver JOURNEE_COMPLETE : ce médecin a déjà {creneau_approuve} approuvé. Refusez d'abord l'autre demande ou approuvez seulement le créneau manquant."
                )
            
            # Conflit : MATIN/APRES_MIDI vs JOURNEE
            if creneau_a_approuver in ["MATIN", "APRES_MIDI"] and creneau_approuve == "JOURNEE_COMPLETE":
                raise HTTPException(
                    status_code=400,
                    detail=f"Impossible d'approuver {creneau_a_approuver} : ce médecin a déjà JOURNEE_COMPLETE approuvée. Refusez d'abord l'autre demande."
                )
    
    # Gestion de l'approbation/refus partiel pour JOURNEE_COMPLETE
    if request.creneau_partiel and demande["creneau"] == "JOURNEE_COMPLETE":
        # Approbation ou refus partiel d'une JOURNEE_COMPLETE
        if request.approuve:
            # Approuver seulement le créneau partiel spécifié, créer une nouvelle demande pour l'autre
            creneau_restant = "APRES_MIDI" if request.creneau_partiel == "MATIN" else "MATIN"
            
            statut = "APPROUVE"  # Définir la variable statut pour éviter UnboundLocalError
            
            # Marquer la demande originale comme approuvée pour ce créneau uniquement
            update_data = {
                "creneau": request.creneau_partiel,  # La demande originale représente maintenant le créneau approuvé
                "statut": statut,
                "approuve_par": current_user.id,
                "date_approbation": datetime.now(timezone.utc),
                "commentaire_approbation": request.commentaire or f"Approuvé partiellement : {request.creneau_partiel} uniquement"
            }
            
            # Créer une nouvelle demande pour le créneau restant (EN_ATTENTE)
            nouvelle_demande = DemandeJourTravail(
                id=str(uuid.uuid4()),
                medecin_id=demande["medecin_id"],
                date_demandee=demande["date_demandee"],
                creneau=creneau_restant,
                statut="EN_ATTENTE",
                date_demande=datetime.now(timezone.utc),
                motif=f"Créneau restant après approbation partielle de {request.creneau_partiel}"
            )
            await db.demandes_travail.insert_one(nouvelle_demande.dict())
        else:
            # Refuser seulement le créneau partiel, créer une nouvelle demande pour l'autre
            creneau_restant = "APRES_MIDI" if request.creneau_partiel == "MATIN" else "MATIN"
            
            statut = "REJETE"  # Définir la variable statut pour éviter UnboundLocalError
            
            # Marquer la demande originale comme partiellement refusée
            update_data = {
                "creneau": request.creneau_partiel,  # La demande originale représente maintenant le créneau refusé
                "statut": statut,
                "approuve_par": current_user.id,
                "date_approbation": datetime.now(timezone.utc),
                "commentaire_approbation": request.commentaire or f"Refusé partiellement : {request.creneau_partiel} refusé"
            }
            
            # Créer une nouvelle demande pour le créneau restant (EN_ATTENTE)
            nouvelle_demande = DemandeJourTravail(
                id=str(uuid.uuid4()),
                medecin_id=demande["medecin_id"],
                date_demandee=demande["date_demandee"],
                creneau=creneau_restant,
                statut="EN_ATTENTE",
                date_demande=datetime.now(timezone.utc),
                motif=f"Créneau restant après refus partiel de {request.creneau_partiel}"
            )
            await db.demandes_travail.insert_one(nouvelle_demande.dict())
    else:
        # Approbation ou refus standard (total)
        statut = "APPROUVE" if request.approuve else "REJETE"
        update_data = {
            "statut": statut,
            "approuve_par": current_user.id,
            "date_approbation": datetime.now(timezone.utc),
            "commentaire_approbation": request.commentaire
        }
    
    result = await db.demandes_travail.update_one({"id": demande_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    # 📤 NOTIFICATION : Statut de la demande de travail
    creneau_text = "Journée complète" if demande["creneau"] == "JOURNEE_COMPLETE" else demande["creneau"].lower()
    details = f"{demande['date_demandee']} ({creneau_text})"
    background_tasks.add_task(
        notify_user_request_status,
        demande["medecin_id"],
        "Demande de jour de travail",
        update_data.get("statut", "MODIFIE"),
        details
    )
    
    # Si la demande est approuvée (totalement ou partiellement), créer automatiquement un créneau dans le planning
    if request.approuve:
        # Récupérer les informations de l'employé (médecin, assistant, secrétaire)
        employe = await db.users.find_one({"id": demande["medecin_id"]})
        if not employe:
            raise HTTPException(status_code=404, detail="Employé non trouvé")
        
        # Créer le(s) créneau(x) selon le type
        creneaux_a_creer = []
        if request.creneau_partiel:
            # Approbation partielle : créer seulement le créneau spécifié
            creneaux_a_creer = [request.creneau_partiel]
        elif demande["creneau"] == "JOURNEE_COMPLETE":
            # Approbation totale d'une JOURNEE_COMPLETE
            creneaux_a_creer = ["MATIN", "APRES_MIDI"]
        else:
            # Approbation d'un créneau simple
            creneaux_a_creer = [demande["creneau"]]
        
        for creneau_type in creneaux_a_creer:
            # Vérifier si un créneau n'existe pas déjà pour cet employé à cette date/heure
            existing_creneau = await db.planning.find_one({
                "date": demande["date_demandee"],
                "creneau": creneau_type,
                "employe_id": demande["medecin_id"]
            })
            
            if not existing_creneau:
                # Déterminer les horaires selon le rôle et le créneau
                horaire_debut = None
                horaire_fin = None
                horaire_pause_debut = None
                horaire_pause_fin = None
                
                if employe["role"] == "Secrétaire":
                    if creneau_type == "MATIN":
                        horaire_debut = employe.get("horaire_matin_debut")
                        horaire_fin = employe.get("horaire_matin_fin")
                    else:  # APRES_MIDI
                        horaire_debut = employe.get("horaire_apres_midi_debut")
                        horaire_fin = employe.get("horaire_apres_midi_fin")
                
                # Créer le créneau avec les horaires
                creneau_planning = CreneauPlanning(
                    date=demande["date_demandee"],
                    creneau=creneau_type,
                    employe_id=demande["medecin_id"],
                    employe_role=employe["role"],
                    horaire_debut=horaire_debut,
                    horaire_fin=horaire_fin,
                    horaire_pause_debut=horaire_pause_debut,
                    horaire_pause_fin=horaire_pause_fin,
                    salle_attribuee=None,
                    salle_attente=None,
                    notes=None
                )
                await db.planning.insert_one(creneau_planning.dict())
    
    return {"message": f"Demande {statut.lower()}e avec succès" + (" et créneau(x) créé(s) dans le planning" if request.approuve else "")}

@api_router.post("/demandes-travail/{demande_id}/demander-annulation")
async def demander_annulation_demande_travail(
    demande_id: str,
    request: DemandeAnnulationRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Médecin demande l'annulation d'une demande de créneau approuvée"""
    # Récupérer la demande
    demande = await db.demandes_travail.find_one({"id": demande_id})
    if not demande:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    # Vérifier que c'est le médecin concerné
    if current_user.role == ROLES["MEDECIN"] and demande["medecin_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez demander l'annulation que de vos propres demandes")
    
    # Vérifier que la demande est approuvée
    if demande["statut"] != "APPROUVE":
        raise HTTPException(status_code=400, detail="Seules les demandes approuvées peuvent être annulées")
    
    # Vérifier qu'il n'y a pas déjà une demande d'annulation en cours
    if demande.get("demande_annulation", False):
        raise HTTPException(status_code=400, detail="Une demande d'annulation est déjà en cours")
    
    # Mettre à jour la demande
    await db.demandes_travail.update_one(
        {"id": demande_id},
        {"$set": {
            "demande_annulation": True,
            "raison_demande_annulation": request.raison,
            "date_demande_annulation": datetime.now(timezone.utc)
        }}
    )
    
    # 📤 NOTIFICATION : Notifier le directeur de la demande d'annulation
    medecin_name = f"{current_user.prenom} {current_user.nom}"
    if current_user.role == ROLES["MEDECIN"]:
        medecin_name = f"Dr. {medecin_name}"
    
    date_str = demande["date_demandee"]
    creneau_text = "Journée complète" if demande["creneau"] == "JOURNEE_COMPLETE" else demande["creneau"].lower()
    details = f"{date_str} ({creneau_text})"
    
    background_tasks.add_task(
        notify_director_new_request,
        "demande d'annulation de créneau",
        medecin_name,
        details
    )
    
    return {"message": "Demande d'annulation envoyée avec succès"}

@api_router.put("/demandes-travail/{demande_id}/approuver-annulation")
async def approuver_annulation_demande_travail(
    demande_id: str,
    request: ApprobationJourTravailRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Directeur approuve ou rejette une demande d'annulation"""
    # Récupérer la demande
    demande = await db.demandes_travail.find_one({"id": demande_id})
    if not demande:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    # Vérifier qu'il y a une demande d'annulation en cours
    if not demande.get("demande_annulation", False):
        raise HTTPException(status_code=400, detail="Aucune demande d'annulation en cours")
    
    if request.approuve:
        # Approuver l'annulation
        await db.demandes_travail.update_one(
            {"id": demande_id},
            {"$set": {
                "statut": "ANNULE",
                "annule_par": current_user.id,
                "raison_annulation": demande.get("raison_demande_annulation", ""),
                "date_annulation": datetime.now(timezone.utc),
                "demande_annulation": False,
                "commentaire_approbation": request.commentaire
            }}
        )
        
        # Supprimer les créneaux du planning
        creneaux_a_supprimer = []
        if demande["creneau"] == "JOURNEE_COMPLETE":
            creneaux_a_supprimer = ["MATIN", "APRES_MIDI"]
        else:
            creneaux_a_supprimer = [demande["creneau"]]
        
        for creneau_type in creneaux_a_supprimer:
            await db.planning.delete_one({
                "date": demande["date_demandee"],
                "creneau": creneau_type,
                "employe_id": demande["medecin_id"]
            })
        
        statut_message = "approuvée"
    else:
        # Rejeter la demande d'annulation
        await db.demandes_travail.update_one(
            {"id": demande_id},
            {"$set": {
                "demande_annulation": False,
                "commentaire_approbation": request.commentaire
            }}
        )
        statut_message = "rejetée"
    
    # 📤 NOTIFICATION : Notifier le médecin du statut de sa demande d'annulation
    date_str = demande["date_demandee"]
    creneau_text = "Journée complète" if demande["creneau"] == "JOURNEE_COMPLETE" else demande["creneau"].lower()
    details = f"{date_str} ({creneau_text})"
    
    background_tasks.add_task(
        notify_user_request_status,
        demande["medecin_id"],
        "Demande d'annulation de créneau",
        "APPROUVE" if request.approuve else "REJETE",
        details
    )
    
    return {"message": f"Demande d'annulation {statut_message} avec succès"}

@api_router.post("/demandes-travail/{demande_id}/annuler-directement")
async def annuler_directement_demande_travail(
    demande_id: str,
    request: AnnulationDirecteRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Directeur annule directement une demande de créneau approuvée"""
    # Récupérer la demande
    demande = await db.demandes_travail.find_one({"id": demande_id})
    if not demande:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    # Vérifier que la demande est approuvée
    if demande["statut"] != "APPROUVE":
        raise HTTPException(status_code=400, detail="Seules les demandes approuvées peuvent être annulées")
    
    # Supprimer les créneaux du planning
    creneaux_a_supprimer = []
    
    # Si un créneau spécifique est précisé, supprimer uniquement celui-ci
    if request.creneau_specifique:
        creneaux_a_supprimer = [request.creneau_specifique]
    elif demande["creneau"] == "JOURNEE_COMPLETE":
        creneaux_a_supprimer = ["MATIN", "APRES_MIDI"]
    else:
        creneaux_a_supprimer = [demande["creneau"]]
    
    for creneau_type in creneaux_a_supprimer:
        # IMPORTANT : Vérifier s'il y a d'autres demandes APPROUVEES pour ce même créneau
        # Si oui, ne PAS supprimer le créneau du planning
        autres_demandes = await db.demandes_travail.count_documents({
            "medecin_id": demande["medecin_id"],
            "date_demandee": demande["date_demandee"],
            "$or": [
                {"creneau": creneau_type},
                {"creneau": "JOURNEE_COMPLETE"}  # JOURNEE_COMPLETE couvre aussi ce créneau
            ],
            "statut": "APPROUVE",
            "id": {"$ne": demande_id}  # Exclure la demande actuelle
        })
        
        # Ne supprimer le créneau que s'il n'y a pas d'autre demande approuvée
        if autres_demandes == 0:
            await db.planning.delete_one({
                "date": demande["date_demandee"],
                "creneau": creneau_type,
                "employe_id": demande["medecin_id"]
            })
        else:
            print(f"Créneau {creneau_type} du {demande['date_demandee']} conservé car {autres_demandes} autre(s) demande(s) approuvée(s)")
    
    # Gérer le statut de la demande
    if request.creneau_specifique and demande["creneau"] == "JOURNEE_COMPLETE":
        # Si on annule seulement MATIN ou APRES_MIDI d'une JOURNEE_COMPLETE
        # Mettre à jour le créneau de la demande pour refléter ce qui reste
        creneau_restant = "APRES_MIDI" if request.creneau_specifique == "MATIN" else "MATIN"
        await db.demandes_travail.update_one(
            {"id": demande_id},
            {"$set": {
                "creneau": creneau_restant,
                "commentaire_modification": f"Créneau {request.creneau_specifique} annulé par le Directeur. Raison: {request.raison}"
            }}
        )
    else:
        # Annuler complètement la demande
        await db.demandes_travail.update_one(
            {"id": demande_id},
            {"$set": {
                "statut": "ANNULE",
                "annule_par": current_user.id,
                "raison_annulation": request.raison,
                "date_annulation": datetime.now(timezone.utc)
            }}
        )
    
    # 📤 NOTIFICATION : Notifier le médecin de l'annulation
    date_str = demande["date_demandee"]
    creneau_text = "Journée complète" if demande["creneau"] == "JOURNEE_COMPLETE" else demande["creneau"].lower()
    
    await send_notification_to_user(
        demande["medecin_id"],
        "❌ Créneau annulé par le Directeur",
        f"Votre créneau du {date_str} ({creneau_text}) a été annulé. Raison: {request.raison}",
        {"type": "creneau_annule", "date": date_str, "creneau": demande["creneau"]}
    )
    
    return {"message": "Demande annulée avec succès"}

# Planning semaine
@api_router.get("/planning/semaine/{date_debut}")
async def get_planning_semaine(
    date_debut: str,  # Date du lundi (YYYY-MM-DD)
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime, timedelta
    
    # Calculer les 7 jours de la semaine
    date_start = datetime.strptime(date_debut, '%Y-%m-%d')
    dates_semaine = [(date_start + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(7)]
    
    # Récupérer le planning pour toute la semaine
    planning = await db.planning.find({"date": {"$in": dates_semaine}}).sort("date", 1).to_list(1000)
    
    # Organiser par jour
    planning_par_jour = {date: {"MATIN": [], "APRES_MIDI": []} for date in dates_semaine}
    
    for creneau in planning:
        if '_id' in creneau:
            del creneau['_id']
            
        employe = await db.users.find_one({"id": creneau["employe_id"]})
        if employe and '_id' in employe:
            del employe['_id']
            
        medecin_attribue = None
        if creneau.get("medecin_attribue_id"):
            medecin_attribue = await db.users.find_one({"id": creneau["medecin_attribue_id"]})
            if medecin_attribue and '_id' in medecin_attribue:
                del medecin_attribue['_id']
        
        enriched_creneau = {
            **creneau,
            "employe": User(**employe) if employe else None,
            "medecin_attribue": User(**medecin_attribue) if medecin_attribue else None
        }
        
        if creneau["date"] in planning_par_jour:
            # Les créneaux JOURNEE_COMPLETE sont déjà séparés en MATIN et APRES_MIDI lors de la création
            # Donc on ajoute simplement chaque créneau dans sa période correspondante
            if creneau["creneau"] in planning_par_jour[creneau["date"]]:
                planning_par_jour[creneau["date"]][creneau["creneau"]].append(enriched_creneau)
    
    return {
        "dates": dates_semaine,
        "planning": planning_par_jour
    }

# Planning du mois entier (optimisé pour éviter les requêtes multiples)
@api_router.get("/planning/mois/{mois}")
async def get_planning_mois(
    mois: str,  # Format YYYY-MM
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime
    import calendar
    
    # Parser le mois
    year, month = map(int, mois.split('-'))
    last_day = calendar.monthrange(year, month)[1]
    
    # Générer toutes les dates du mois
    dates_mois = [f"{year}-{str(month).zfill(2)}-{str(day).zfill(2)}" for day in range(1, last_day + 1)]
    
    # Récupérer tout le planning du mois en une seule requête
    planning = await db.planning.find({"date": {"$in": dates_mois}}).sort("date", 1).to_list(5000)
    
    # Supprimer _id et enrichir avec le rôle de l'employé
    result = []
    for creneau in planning:
        if '_id' in creneau:
            del creneau['_id']
        
        # Récupérer le rôle de l'employé
        employe = await db.users.find_one({"id": creneau["employe_id"]})
        creneau["employe_role"] = employe.get("role") if employe else None
        result.append(creneau)
    
    return result

# Plan du cabinet
@api_router.get("/cabinet/plan/{date}")
async def get_plan_cabinet(
    date: str,
    creneau: str = "MATIN",  # ou "APRES_MIDI"
    current_user: User = Depends(get_current_user)
):
    # Récupérer toutes les salles
    salles = await db.salles.find({"actif": True}).to_list(1000)
    
    # Récupérer le planning pour cette date/créneau
    planning = await db.planning.find({"date": date, "creneau": creneau}).to_list(1000)
    
    # Créer un mapping salle -> employé
    occupation_salles = {}
    for creneau_planning in planning:
        employe = await db.users.find_one({"id": creneau_planning["employe_id"]})
        if employe and '_id' in employe:
            del employe['_id']
            
        medecin_attribue = None
        if creneau_planning.get("medecin_attribue_id"):
            medecin_attribue = await db.users.find_one({"id": creneau_planning["medecin_attribue_id"]})
            if medecin_attribue and '_id' in medecin_attribue:
                del medecin_attribue['_id']
        
        occupation_data = {
            "employe": User(**employe) if employe else None,
            "medecin_attribue": User(**medecin_attribue) if medecin_attribue else None,
            "notes": creneau_planning.get("notes")
        }
        
        # Ajouter l'occupation de la salle de travail
        if creneau_planning.get("salle_attribuee"):
            occupation_salles[creneau_planning["salle_attribuee"]] = occupation_data
        
        # Ajouter l'occupation de la salle d'attente
        if creneau_planning.get("salle_attente"):
            occupation_salles[creneau_planning["salle_attente"]] = occupation_data
    
    # Nettoyer les salles
    salles_clean = []
    for salle in salles:
        if '_id' in salle:
            del salle['_id']
        salle_data = Salle(**salle).dict()
        salle_data["occupation"] = occupation_salles.get(salle["nom"])
        salles_clean.append(salle_data)
    
    return {
        "salles": salles_clean,
        "date": date,
        "creneau": creneau
    }

# General notes
@api_router.post("/notes", response_model=NoteGenerale)
async def create_note_generale(
    note: NoteGenerale,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    note.auteur_id = current_user.id
    await db.notes_generales.insert_one(note.dict())
    return note

@api_router.get("/notes", response_model=List[Dict[str, Any]])
async def get_notes_generales(current_user: User = Depends(get_current_user)):
    notes = await db.notes_generales.find({"visible": True}).sort("date_creation", -1).to_list(100)
    
    # Enrich with author details
    enriched_notes = []
    for note in notes:
        if '_id' in note:
            del note['_id']
        auteur = await db.users.find_one({"id": note["auteur_id"]})
        if auteur and '_id' in auteur:
            del auteur['_id']
        enriched_notes.append({
            **note,
            "auteur": User(**auteur) if auteur else None
        })
    
    return enriched_notes

# Gestion des quotas employés
@api_router.post("/quotas", response_model=QuotaEmploye)
async def create_quota_employe(
    quota_data: QuotaEmployeCreate,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Vérifier si un quota existe déjà pour cette semaine
    existing = await db.quotas_employes.find_one({
        "employe_id": quota_data.employe_id,
        "semaine_debut": quota_data.semaine_debut
    })
    
    if existing:
        # Mettre à jour le quota existant
        result = await db.quotas_employes.update_one(
            {"id": existing["id"]},
            {"$set": quota_data.dict()}
        )
        updated_quota = await db.quotas_employes.find_one({"id": existing["id"]})
        if '_id' in updated_quota:
            del updated_quota['_id']
        return QuotaEmploye(**updated_quota)
    else:
        # Créer nouveau quota
        quota = QuotaEmploye(**quota_data.dict())
        await db.quotas_employes.insert_one(quota.dict())
        return quota

@api_router.get("/quotas/{semaine_debut}", response_model=List[Dict[str, Any]])
async def get_quotas_semaine(
    semaine_debut: str,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    quotas = await db.quotas_employes.find({"semaine_debut": semaine_debut}).to_list(1000)
    
    # Enrichir avec les données des employés
    enriched_quotas = []
    for quota in quotas:
        if '_id' in quota:
            del quota['_id']
            
        employe = await db.users.find_one({"id": quota["employe_id"]})
        if employe and '_id' in employe:
            del employe['_id']
        
        enriched_quotas.append({
            **quota,
            "employe": User(**employe) if employe else None
        })
    
    return enriched_quotas

@api_router.put("/quotas/{quota_id}/increment")
async def increment_attribution(
    quota_id: str,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    quota = await db.quotas_employes.find_one({"id": quota_id})
    if not quota:
        raise HTTPException(status_code=404, detail="Quota non trouvé")
    
    nouvelle_attribution = quota["demi_journees_attribuees"] + 1
    if nouvelle_attribution > quota["demi_journees_requises"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Quota dépassé : {nouvelle_attribution}/{quota['demi_journees_requises']}"
        )
    
    await db.quotas_employes.update_one(
        {"id": quota_id},
        {"$set": {"demi_journees_attribuees": nouvelle_attribution}}
    )
    
    return {"message": f"Attribution mise à jour : {nouvelle_attribution}/{quota['demi_journees_requises']}"}

@api_router.put("/quotas/{quota_id}/decrement")
async def decrement_attribution(
    quota_id: str,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    quota = await db.quotas_employes.find_one({"id": quota_id})
    if not quota:
        raise HTTPException(status_code=404, detail="Quota non trouvé")
    
    nouvelle_attribution = max(0, quota["demi_journees_attribuees"] - 1)
    
    await db.quotas_employes.update_one(
        {"id": quota_id},
        {"$set": {"demi_journees_attribuees": nouvelle_attribution}}
    )
    
    return {"message": f"Attribution mise à jour : {nouvelle_attribution}/{quota['demi_journees_requises']}"}

# Attribution Planning Directeur
@api_router.post("/attributions")
async def create_attribution_complete(
    employe_id: str,
    date: str,
    creneau: str,
    salle_attribuee: str,
    medecin_ids: List[str] = [],
    notes: str = "",
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Vérifier les conflits
    existing = await db.planning.find_one({
        "employe_id": employe_id,
        "date": date,
        "creneau": creneau
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Employé déjà attribué à ce créneau")
    
    salle_occupee = await db.planning.find_one({
        "salle_attribuee": salle_attribuee,
        "date": date,
        "creneau": creneau
    })
    
    if salle_occupee:
        raise HTTPException(status_code=400, detail="Salle déjà occupée")
    
    # Récupérer l'employé pour son rôle
    employe = await db.users.find_one({"id": employe_id})
    if not employe:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    # Créer l'attribution
    attribution_data = {
        "date": date,
        "creneau": creneau,
        "employe_id": employe_id,
        "salle_attribuee": salle_attribuee,
        "notes": notes,
        "employe_role": employe["role"]
    }
    
    # Si c'est un assistant, associer aux médecins
    if employe["role"] == "Assistant" and medecin_ids:
        attribution_data["medecin_attribue_id"] = medecin_ids[0]  # Premier médecin principal
    
    creneau_planning = CreneauPlanning(**attribution_data)
    await db.planning.insert_one(creneau_planning.dict())
    
    # Mettre à jour le quota
    semaine_debut = get_monday_of_week(date)
    quota = await db.quotas_employes.find_one({
        "employe_id": employe_id,
        "semaine_debut": semaine_debut
    })
    
    if quota:
        nouvelle_attribution = quota["demi_journees_attribuees"] + 1
        await db.quotas_employes.update_one(
            {"id": quota["id"]},
            {"$set": {"demi_journees_attribuees": nouvelle_attribution}}
        )
    
    return {"message": "Attribution créée avec succès", "attribution": creneau_planning}

def get_monday_of_week(date_str):
    from datetime import datetime, timedelta
    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
    days_since_monday = date_obj.weekday()
    monday = date_obj - timedelta(days=days_since_monday)
    return monday.strftime('%Y-%m-%d')

# Permissions coffre-fort
@api_router.post("/documents/permissions", response_model=PermissionDocument)
async def create_permission_document(
    permission_data: PermissionDocumentCreate,
    current_user: User = Depends(get_current_user)
):
    # Vérifier les permissions pour créer une permission
    if current_user.role != ROLES["DIRECTEUR"] and current_user.id != permission_data.proprietaire_id:
        raise HTTPException(status_code=403, detail="Permission insuffisante")
    
    # Vérifier si la permission existe déjà
    existing = await db.permissions_documents.find_one({
        "proprietaire_id": permission_data.proprietaire_id,
        "utilisateur_autorise_id": permission_data.utilisateur_autorise_id,
        "actif": True
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Permission déjà accordée")
    
    permission = PermissionDocument(
        accorde_par=current_user.id,
        **permission_data.dict()
    )
    
    await db.permissions_documents.insert_one(permission.dict())
    return permission

@api_router.get("/documents/permissions/{proprietaire_id}", response_model=List[Dict[str, Any]])
async def get_permissions_document(
    proprietaire_id: str,
    current_user: User = Depends(get_current_user)
):
    # Vérifier les permissions
    if current_user.role != ROLES["DIRECTEUR"] and current_user.id != proprietaire_id:
        raise HTTPException(status_code=403, detail="Permission insuffisante")
    
    permissions = await db.permissions_documents.find({
        "proprietaire_id": proprietaire_id,
        "actif": True
    }).to_list(1000)
    
    enriched_permissions = []
    for perm in permissions:
        if '_id' in perm:
            del perm['_id']
            
        utilisateur = await db.users.find_one({"id": perm["utilisateur_autorise_id"]})
        if utilisateur and '_id' in utilisateur:
            del utilisateur['_id']
        
        enriched_permissions.append({
            **perm,
            "utilisateur_autorise": User(**utilisateur) if utilisateur else None
        })
    
    return enriched_permissions

# Coffre-fort documents personnels
@api_router.post("/documents", response_model=DocumentPersonnel)
async def upload_document_personnel(
    document_data: DocumentPersonnelCreate,
    current_user: User = Depends(get_current_user)
):
    document = DocumentPersonnel(
        proprietaire_id=current_user.id,
        **document_data.dict()
    )
    
    await db.documents_personnels.insert_one(document.dict())
    return document

@api_router.get("/documents", response_model=List[Dict[str, Any]])
async def get_documents_personnels(
    proprietaire_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    documents = []
    
    if current_user.role == ROLES["DIRECTEUR"]:
        # Le directeur peut voir tous les documents
        if proprietaire_id:
            # Voir documents d'un employé spécifique
            documents = await db.documents_personnels.find({
                "proprietaire_id": proprietaire_id,
                "actif": True
            }).sort("date_upload", -1).to_list(1000)
        else:
            # Voir tous les documents
            documents = await db.documents_personnels.find({"actif": True}).sort("date_upload", -1).to_list(1000)
    else:
        # Voir ses propres documents
        own_docs = await db.documents_personnels.find({
            "proprietaire_id": current_user.id,
            "actif": True
        }).sort("date_upload", -1).to_list(1000)
        documents.extend(own_docs)
        
        # Voir les documents où on a des permissions
        permissions = await db.permissions_documents.find({
            "utilisateur_autorise_id": current_user.id,
            "actif": True
        }).to_list(1000)
        
        for perm in permissions:
            shared_docs = await db.documents_personnels.find({
                "proprietaire_id": perm["proprietaire_id"],
                "actif": True
            }).sort("date_upload", -1).to_list(1000)
            documents.extend(shared_docs)
    
    # Enrichir avec les données des propriétaires
    enriched_documents = []
    for doc in documents:
        if '_id' in doc:
            del doc['_id']
            
        proprietaire = await db.users.find_one({"id": doc["proprietaire_id"]})
        if proprietaire and '_id' in proprietaire:
            del proprietaire['_id']
        
        enriched_documents.append({
            **doc,
            "proprietaire": User(**proprietaire) if proprietaire else None,
            "est_proprietaire": doc["proprietaire_id"] == current_user.id
        })
    
    return enriched_documents

@api_router.get("/documents/{document_id}")
async def download_document_personnel(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    document = await db.documents_personnels.find_one({"id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    
    # Vérifier les permissions
    if document["proprietaire_id"] != current_user.id and current_user.role != ROLES["DIRECTEUR"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé à ce document")
    
    # Dans un vrai système, on retournerait le fichier
    # Ici on retourne juste les informations
    if '_id' in document:
        del document['_id']
    return DocumentPersonnel(**document)

@api_router.delete("/documents/{document_id}")
async def delete_document_personnel(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    document = await db.documents_personnels.find_one({"id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    
    # Vérifier les permissions
    if document["proprietaire_id"] != current_user.id and current_user.role != ROLES["DIRECTEUR"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé à ce document")
    
    # Soft delete
    result = await db.documents_personnels.update_one(
        {"id": document_id},
        {"$set": {"actif": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    
    return {"message": "Document supprimé avec succès"}

# Initialisation du cabinet
@api_router.post("/cabinet/initialiser")
async def initialiser_cabinet(
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Vérifier si des salles existent déjà
    existing_salles = await db.salles.count_documents({"actif": True})
    if existing_salles > 0:
        return {"message": f"Cabinet déjà initialisé avec {existing_salles} salles"}
    
    # Définir les salles selon la description : carré avec disposition spécifique
    salles_par_defaut = [
        # Salles côté gauche (3 salles)
        {"nom": "Salle G1", "type_salle": "MEDECIN", "position_x": 1, "position_y": 2, "couleur": "#3B82F6"},
        {"nom": "Salle G2", "type_salle": "MEDECIN", "position_x": 1, "position_y": 3, "couleur": "#3B82F6"},
        {"nom": "Salle G3", "type_salle": "MEDECIN", "position_x": 1, "position_y": 4, "couleur": "#3B82F6"},
        
        # Salles côté droit (3 salles)
        {"nom": "Salle D1", "type_salle": "MEDECIN", "position_x": 5, "position_y": 2, "couleur": "#3B82F6"},
        {"nom": "Salle D2", "type_salle": "MEDECIN", "position_x": 5, "position_y": 3, "couleur": "#3B82F6"},
        {"nom": "Salle D3", "type_salle": "MEDECIN", "position_x": 5, "position_y": 4, "couleur": "#3B82F6"},
        
        # Salle en bas
        {"nom": "Salle Sud", "type_salle": "MEDECIN", "position_x": 3, "position_y": 5, "couleur": "#3B82F6"},
        
        # Salles en haut (2 salles)
        {"nom": "Salle N1", "type_salle": "MEDECIN", "position_x": 2, "position_y": 1, "couleur": "#3B82F6"},
        {"nom": "Salle N2", "type_salle": "MEDECIN", "position_x": 4, "position_y": 1, "couleur": "#3B82F6"},
        
        # Salles au centre en triangle (3 salles)
        {"nom": "Salle C1", "type_salle": "ASSISTANT", "position_x": 3, "position_y": 2, "couleur": "#10B981"},
        {"nom": "Salle C2", "type_salle": "ASSISTANT", "position_x": 2, "position_y": 3, "couleur": "#10B981"},
        {"nom": "Salle C3", "type_salle": "ASSISTANT", "position_x": 4, "position_y": 3, "couleur": "#10B981"},
        
        # Salles d'attente
        {"nom": "Attente Principale", "type_salle": "ATTENTE", "position_x": 3, "position_y": 0, "couleur": "#F59E0B"},
        {"nom": "Attente Secondaire", "type_salle": "ATTENTE", "position_x": 0, "position_y": 3, "couleur": "#F59E0B"},
        {"nom": "Attente Urgences", "type_salle": "ATTENTE", "position_x": 6, "position_y": 3, "couleur": "#EF4444"},
    ]
    
    # Créer toutes les salles
    salles_creees = 0
    for salle_data in salles_par_defaut:
        salle = Salle(**salle_data)
        await db.salles.insert_one(salle.dict())
        salles_creees += 1
    
    # Créer configuration par défaut
    config_existe = await db.configuration.count_documents({})
    if config_existe == 0:
        config_defaut = ConfigurationCabinet(
            max_medecins_par_jour=6,  # Selon le nombre de salles médecins
            max_assistants_par_jour=3  # Selon le nombre de salles assistants
        )
        await db.configuration.insert_one(config_defaut.dict())
    
    return {
        "message": f"Cabinet initialisé avec succès",
        "salles_creees": salles_creees,
        "configuration": "Configuration par défaut créée"
    }

# Stock Management Endpoints
@api_router.get("/stocks/categories", response_model=List[CategorieStock])
async def get_categories_stock(current_user: User = Depends(get_current_user)):
    # Vérifier les permissions
    if current_user.role != 'Directeur':
        permission = await db.permissions_stock.find_one({"utilisateur_id": current_user.id})
        if not permission or not permission.get('peut_voir', False):
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    categories = await db.categories_stock.find({}).to_list(length=None)
    return [CategorieStock(**cat) for cat in categories]

@api_router.post("/stocks/categories", response_model=CategorieStock)
async def create_categorie_stock(
    categorie: CategorieStockCreate,
    current_user: User = Depends(get_current_user)
):
    # Vérifier les permissions  
    if current_user.role != 'Directeur':
        permission = await db.permissions_stock.find_one({"utilisateur_id": current_user.id})
        if not permission or not permission.get('peut_ajouter', False):
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    categorie_dict = categorie.dict()
    categorie_dict['id'] = str(uuid.uuid4())
    categorie_dict['date_creation'] = datetime.now(timezone.utc)
    
    await db.categories_stock.insert_one(categorie_dict)
    return CategorieStock(**categorie_dict)

@api_router.get("/stocks/articles", response_model=List[Dict])
async def get_articles_stock(current_user: User = Depends(get_current_user)):
    # Vérifier les permissions
    if current_user.role != 'Directeur':
        permission = await db.permissions_stock.find_one({"utilisateur_id": current_user.id})
        if not permission or not permission.get('peut_voir', False):
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    # Récupérer articles avec informations de catégorie
    pipeline = [
        {
            "$lookup": {
                "from": "categories_stock",
                "localField": "categorie_id",
                "foreignField": "id",
                "as": "categorie"
            }
        },
        {
            "$unwind": {
                "path": "$categorie",
                "preserveNullAndEmptyArrays": True
            }
        },
        {
            "$addFields": {
                "nombre_a_commander": {
                    "$subtract": ["$nombre_souhaite", "$nombre_en_stock"]
                }
            }
        }
    ]
    
    articles = await db.articles_stock.aggregate(pipeline).to_list(length=None)
    for article in articles:
        if '_id' in article:
            del article['_id']
        if 'categorie' in article and '_id' in article['categorie']:
            del article['categorie']['_id']
    
    return articles

@api_router.post("/stocks/articles", response_model=ArticleStock)
async def create_article_stock(
    article: ArticleStockCreate,
    current_user: User = Depends(get_current_user)
):
    # Vérifier les permissions
    if current_user.role != 'Directeur':
        permission = await db.permissions_stock.find_one({"utilisateur_id": current_user.id})
        if not permission or not permission.get('peut_ajouter', False):
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    article_dict = article.dict()
    article_dict['id'] = str(uuid.uuid4())
    article_dict['date_creation'] = datetime.now(timezone.utc)
    article_dict['date_modification'] = datetime.now(timezone.utc)
    
    await db.articles_stock.insert_one(article_dict)
    return ArticleStock(**article_dict)

@api_router.put("/stocks/articles/{article_id}", response_model=ArticleStock)
async def update_article_stock(
    article_id: str,
    article_update: ArticleStockUpdate,
    current_user: User = Depends(get_current_user)
):
    # Vérifier les permissions
    if current_user.role != 'Directeur':
        permission = await db.permissions_stock.find_one({"utilisateur_id": current_user.id})
        if not permission or not permission.get('peut_modifier', False):
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    update_data = {k: v for k, v in article_update.dict().items() if v is not None}
    update_data['date_modification'] = datetime.now(timezone.utc)
    
    result = await db.articles_stock.update_one({"id": article_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Article non trouvé")
    
    updated_article = await db.articles_stock.find_one({"id": article_id})
    if '_id' in updated_article:
        del updated_article['_id']
    return ArticleStock(**updated_article)

@api_router.delete("/stocks/articles/{article_id}")
async def delete_article_stock(
    article_id: str,
    current_user: User = Depends(get_current_user)
):
    # Vérifier les permissions
    if current_user.role != 'Directeur':
        permission = await db.permissions_stock.find_one({"utilisateur_id": current_user.id})
        if not permission or not permission.get('peut_supprimer', False):
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    result = await db.articles_stock.delete_one({"id": article_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Article non trouvé")
    
    return {"message": "Article supprimé avec succès"}

# Administration des comptes (Directeur uniquement)
@api_router.get("/admin/users", response_model=List[Dict])
async def get_all_users_for_admin(current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))):
    users = await db.users.find({}).to_list(length=None)
    for user in users:
        if '_id' in user:
            del user['_id']
        # Ne pas exposer le mot de passe hashé
        if 'password' in user:
            del user['password']
    return users

@api_router.post("/admin/impersonate/{user_id}")
async def impersonate_user(user_id: str, current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))):
    # Vérifier que l'utilisateur cible existe
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    if '_id' in target_user:
        del target_user['_id']
    
    # Créer un token pour l'utilisateur cible
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": target_user["id"]}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": User(**target_user)
    }

@api_router.put("/admin/users/{user_id}/password")
async def reset_user_password(
    user_id: str,
    new_password: Dict[str, str],
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    if "password" not in new_password:
        raise HTTPException(status_code=400, detail="Mot de passe requis")
    
    hashed_password = get_password_hash(new_password["password"])
    
    result = await db.users.update_one(
        {"id": user_id}, 
        {"$set": {"password_hash": hashed_password}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    return {"message": "Mot de passe modifié avec succès"}

@api_router.put("/admin/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Protection: Empêcher la désactivation du compte super admin
    if user.get('is_protected', False):
        raise HTTPException(status_code=403, detail="Ce compte est protégé et ne peut pas être désactivé")
    
    new_status = not user.get('actif', True)
    
    result = await db.users.update_one(
        {"id": user_id}, 
        {"$set": {"actif": new_status}}
    )
    
    return {"message": "Statut mis à jour", "actif": new_status}

@api_router.put("/admin/users/{user_id}/toggle-vue-planning")
async def toggle_vue_planning_complete(
    user_id: str,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Toggle l'accès à la vue planning complète (lecture seule) pour un utilisateur"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Un directeur ne peut pas modifier ses propres droits de vue planning
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas modifier vos propres droits de vue planning")
    
    new_status = not user.get('vue_planning_complete', False)
    
    result = await db.users.update_one(
        {"id": user_id}, 
        {"$set": {"vue_planning_complete": new_status}}
    )
    
    return {
        "message": f"Vue planning {'activée' if new_status else 'désactivée'}", 
        "vue_planning_complete": new_status,
        "user_id": user_id,
        "user_nom": f"{user.get('prenom', '')} {user.get('nom', '')}"
    }

@api_router.put("/admin/users/{user_id}/toggle-modifier-planning")
async def toggle_modifier_planning(
    user_id: str,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Toggle la permission de modifier le planning pour un utilisateur"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Un directeur ne peut pas modifier ses propres droits
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas modifier vos propres droits")
    
    new_status = not user.get('peut_modifier_planning', False)
    
    result = await db.users.update_one(
        {"id": user_id}, 
        {"$set": {"peut_modifier_planning": new_status}}
    )
    
    return {
        "message": f"Modification planning {'activée' if new_status else 'désactivée'}", 
        "peut_modifier_planning": new_status,
        "user_id": user_id,
        "user_nom": f"{user.get('prenom', '')} {user.get('nom', '')}"
    }

# ============================================================
# ENDPOINTS D'EXPORT DE DONNÉES
# ============================================================

@api_router.get("/export/all")
async def export_all_data(
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Exporter toutes les données de la base (Directeur uniquement)"""
    from bson import json_util
    import json
    
    export_data = {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "exported_by": f"{current_user.prenom} {current_user.nom}",
        "collections": {}
    }
    
    # Exporter toutes les collections
    collections_to_export = ['users', 'planning', 'demandes_conges', 'demandes_travail', 
                             'salles', 'semaines_types', 'configuration', 'notifications',
                             'assignations_medecin_assistant']
    
    for col_name in collections_to_export:
        try:
            documents = await db[col_name].find({}).to_list(length=None)
            # Convertir les ObjectId en strings et nettoyer les données
            cleaned_docs = []
            for doc in documents:
                # Supprimer _id MongoDB et convertir les dates
                if '_id' in doc:
                    del doc['_id']
                cleaned_docs.append(doc)
            export_data["collections"][col_name] = cleaned_docs
        except Exception as e:
            export_data["collections"][col_name] = {"error": str(e)}
    
    return export_data

@api_router.get("/export/users")
async def export_users(
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Exporter tous les utilisateurs (sans les mots de passe)"""
    users = await db.users.find({}).to_list(length=None)
    
    # Nettoyer les données (supprimer les mots de passe et _id)
    cleaned_users = []
    for user in users:
        user_data = {k: v for k, v in user.items() if k not in ['_id', 'password_hash']}
        cleaned_users.append(user_data)
    
    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "count": len(cleaned_users),
        "users": cleaned_users
    }

@api_router.get("/export/planning")
async def export_planning(
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Exporter le planning (optionnellement filtré par dates)"""
    query = {}
    if date_debut:
        query["date"] = {"$gte": date_debut}
    if date_fin:
        if "date" in query:
            query["date"]["$lte"] = date_fin
        else:
            query["date"] = {"$lte": date_fin}
    
    planning = await db.planning.find(query).to_list(length=None)
    
    # Enrichir avec les noms des employés
    enriched_planning = []
    for p in planning:
        if '_id' in p:
            del p['_id']
        # Ajouter le nom de l'employé
        user = await db.users.find_one({"id": p.get("employe_id")})
        if user:
            p["employe_nom"] = f"{user.get('prenom', '')} {user.get('nom', '')}"
            p["employe_email"] = user.get('email', '')
        enriched_planning.append(p)
    
    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "count": len(enriched_planning),
        "planning": enriched_planning
    }

@api_router.get("/export/conges")
async def export_conges(
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Exporter tous les congés"""
    conges = await db.demandes_conges.find({}).to_list(length=None)
    
    enriched_conges = []
    for c in conges:
        if '_id' in c:
            del c['_id']
        user = await db.users.find_one({"id": c.get("utilisateur_id")})
        if user:
            c["utilisateur_nom"] = f"{user.get('prenom', '')} {user.get('nom', '')}"
        enriched_conges.append(c)
    
    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "count": len(enriched_conges),
        "conges": enriched_conges
    }

@api_router.put("/admin/users/{user_id}/email")
async def update_user_email(
    user_id: str,
    email_data: Dict[str, str],
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    if "email" not in email_data:
        raise HTTPException(status_code=400, detail="Email requis")
    
    new_email = email_data["email"].strip().lower()
    
    # Vérifier que l'email est valide
    import re
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, new_email):
        raise HTTPException(status_code=400, detail="Format d'email invalide")
    
    # Vérifier que l'email n'est pas déjà utilisé
    existing_user = await db.users.find_one({"email": new_email})
    if existing_user and existing_user["id"] != user_id:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé par un autre utilisateur")
    
    # Vérifier que l'utilisateur existe
    user_to_update = await db.users.find_one({"id": user_id})
    if not user_to_update:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Mettre à jour l'email
    result = await db.users.update_one(
        {"id": user_id}, 
        {"$set": {"email": new_email}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    return {
        "message": "Email modifié avec succès",
        "old_email": user_to_update.get("email", ""),
        "new_email": new_email,
        "user_name": f"{user_to_update.get('prenom', '')} {user_to_update.get('nom', '')}"
    }
@api_router.delete("/admin/users/{user_id}/delete-permanently")
async def delete_user_permanently(
    user_id: str,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Vérifier que l'utilisateur cible existe
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Protection: Empêcher la suppression du compte super admin
    if target_user.get('is_protected', False):
        raise HTTPException(status_code=403, detail="Ce compte administrateur est protégé et ne peut jamais être supprimé")
    
    # Empêcher la suppression du Directeur actuel
    if target_user.get("role") == "Directeur" and target_user["id"] == current_user.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas supprimer votre propre compte")
    
    # Supprimer toutes les données liées à l'utilisateur
    try:
        # Supprimer l'utilisateur principal
        await db.users.delete_one({"id": user_id})
        
        # Supprimer les données associées
        await db.assignations.delete_many({"medecin_id": user_id})
        await db.assignations.delete_many({"assistant_id": user_id})
        await db.demandes_conges.delete_many({"utilisateur_id": user_id})
        await db.planning.delete_many({"employe_id": user_id})
        await db.quotas_employes.delete_many({"employe_id": user_id})
        await db.messages.delete_many({"expediteur_id": user_id})
        await db.messages.delete_many({"destinataire_id": user_id})
        await db.documents_personnels.delete_many({"proprietaire_id": user_id})
        await db.permissions_documents.delete_many({"utilisateur_id": user_id})
        await db.permissions_stock.delete_many({"utilisateur_id": user_id})
        await db.demandes_travail.delete_many({"medecin_id": user_id})
        await db.semaines_type.delete_many({"medecin_id": user_id})
        
        return {
            "message": f"Utilisateur {target_user.get('prenom', '')} {target_user.get('nom', '')} supprimé définitivement",
            "deleted_user": {
                "id": target_user["id"],
                "nom": target_user.get("nom", ""),
                "prenom": target_user.get("prenom", ""),
                "email": target_user.get("email", "")
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression: {str(e)}")

@api_router.post("/admin/init-bulk-accounts")
async def init_bulk_accounts(
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """
    Créer tous les comptes utilisateurs en masse (uniquement pour le Directeur)
    """
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
        {"nom": "Ferreira de Sousa", "prenom": "Patrick", "role": "Secrétaire", "email": "patricksousa1992@hotmail.fr"},
        {"nom": "Jacinto", "prenom": "Mélanie", "role": "Secrétaire", "email": "jacinto.melanie@hotmail.com"},
        {"nom": "Heftrich", "prenom": "Juliette", "role": "Secrétaire", "email": "julieheftrich@yahoo.com"},
    ]
    
    # Mot de passe pour tous les comptes
    password = "azerty"
    hashed_password = pwd_context.hash(password)
    
    created_count = 0
    skipped_count = 0
    errors = []
    
    for account in accounts:
        email = account['email']
        
        # Vérifier si l'utilisateur existe déjà
        existing_user = await db.users.find_one({"email": email})
        
        if existing_user:
            skipped_count += 1
            continue
        
        try:
            # Créer l'utilisateur
            user_data = {
                "id": str(uuid.uuid4()),
                "email": email,
                "password_hash": hashed_password,
                "nom": account['nom'],
                "prenom": account['prenom'],
                "role": account['role'],
                "actif": True,
                "telephone": "",
                "date_creation": datetime.now(timezone.utc),
                "is_protected": False
            }
            
            await db.users.insert_one(user_data)
            created_count += 1
        except Exception as e:
            errors.append(f"{account['prenom']} {account['nom']}: {str(e)}")
    
    return {
        "message": "Importation des comptes terminée",
        "created": created_count,
        "skipped": skipped_count,
        "total": len(accounts),
        "password": "azerty",
        "errors": errors if errors else None
    }

@api_router.get("/stocks/permissions", response_model=List[Dict])
async def get_permissions_stock(current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))):
    # Récupérer permissions avec informations utilisateur
    pipeline = [
        {
            "$lookup": {
                "from": "users",
                "localField": "utilisateur_id", 
                "foreignField": "id",
                "as": "utilisateur"
            }
        },
        {
            "$unwind": {
                "path": "$utilisateur",
                "preserveNullAndEmptyArrays": True
            }
        }
    ]
    
    permissions = await db.permissions_stock.aggregate(pipeline).to_list(length=None)
    for perm in permissions:
        if '_id' in perm:
            del perm['_id']
        if 'utilisateur' in perm and '_id' in perm['utilisateur']:
            del perm['utilisateur']['_id']
    
    return permissions

@api_router.post("/stocks/permissions", response_model=PermissionStock)
async def create_permission_stock(
    permission: PermissionStockCreate,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    permission_dict = permission.dict()
    permission_dict['id'] = str(uuid.uuid4())
    permission_dict['date_attribution'] = datetime.now(timezone.utc)
    
    # Supprimer ancienne permission si elle existe
    await db.permissions_stock.delete_one({"utilisateur_id": permission.utilisateur_id})
    
    await db.permissions_stock.insert_one(permission_dict)
    return PermissionStock(**permission_dict)


# ==================== ENDPOINT D'INITIALISATION ====================
# Endpoint spécial pour initialiser la base de données en production
class InitDatabaseRequest(BaseModel):
    secret_token: str

@api_router.post("/init-database")
async def initialize_database(request: InitDatabaseRequest):
    """
    Endpoint pour initialiser la base de données en production.
    Peut être appelé une seule fois. Nécessite un token secret.
    
    Usage: POST /api/init-database avec {"secret_token": "votre-token-secret"}
    """
    secret_token = request.secret_token
    # Vérifier le token secret
    expected_token = os.environ.get('INIT_SECRET_TOKEN', 'init-medical-cabinet-2025')
    if secret_token != expected_token:
        raise HTTPException(status_code=403, detail="Token d'initialisation invalide")
    
    # Vérifier si la base est déjà initialisée
    existing_users = await db.users.count_documents({})
    if existing_users > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"La base de données contient déjà {existing_users} utilisateurs. Initialisation refusée pour éviter la perte de données."
        )
    
    try:
        # Créer les utilisateurs
        users = [
            # COMPTE ADMINISTRATEUR DE SECOURS - NE JAMAIS SUPPRIMER
            {
                "id": "super-admin-root",
                "email": "admin@cabinet.fr",
                "password_hash": get_password_hash("SuperAdmin2025!"),
                "prenom": "Administrateur",
                "nom": "Système",
                "role": "Directeur",
                "telephone": "0000000000",
                "actif": True,
                "is_protected": True,
                "date_creation": datetime.now(timezone.utc),
                "derniere_connexion": None
            },
            {
                "id": "user-directeur-001",
                "email": "directeur@cabinet.fr",
                "password_hash": get_password_hash("admin123"),
                "prenom": "Pierre",
                "nom": "Martin",
                "role": "Directeur",
                "telephone": "0601020304",
                "actif": True,
                "date_creation": datetime.now(timezone.utc),
                "derniere_connexion": None
            },
            {
                "id": "user-medecin-001",
                "email": "dr.dupont@cabinet.fr",
                "password_hash": get_password_hash("medecin123"),
                "prenom": "Marie",
                "nom": "Dupont",
                "role": "Médecin",
                "telephone": "0612345678",
                "specialite": "Médecine générale",
                "actif": True,
                "date_creation": datetime.now(timezone.utc),
                "derniere_connexion": None
            },
            {
                "id": "user-medecin-002",
                "email": "dr.bernard@cabinet.fr",
                "password_hash": get_password_hash("medecin123"),
                "prenom": "Jean",
                "nom": "Bernard",
                "role": "Médecin",
                "telephone": "0623456789",
                "specialite": "Pédiatrie",
                "actif": True,
                "date_creation": datetime.now(timezone.utc),
                "derniere_connexion": None
            },
            {
                "id": "user-assistant-001",
                "email": "julie.moreau@cabinet.fr",
                "password_hash": get_password_hash("assistant123"),
                "prenom": "Julie",
                "nom": "Moreau",
                "role": "Assistant",
                "telephone": "0634567890",
                "actif": True,
                "date_creation": datetime.now(timezone.utc),
                "derniere_connexion": None
            },
            {
                "id": "user-assistant-002",
                "email": "sophie.petit@cabinet.fr",
                "password_hash": get_password_hash("assistant123"),
                "prenom": "Sophie",
                "nom": "Petit",
                "role": "Assistant",
                "telephone": "0645678901",
                "actif": True,
                "date_creation": datetime.now(timezone.utc),
                "derniere_connexion": None
            },
            {
                "id": "user-secretaire-001",
                "email": "emma.leroy@cabinet.fr",
                "password_hash": get_password_hash("secretaire123"),
                "prenom": "Emma",
                "nom": "Leroy",
                "role": "Secrétaire",
                "telephone": "0656789012",
                "actif": True,
                "date_creation": datetime.now(timezone.utc),
                "derniere_connexion": None
            }
        ]
        
        await db.users.insert_many(users)
        
        # Créer les salles
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
        
        await db.salles.insert_many(salles)
        
        # Créer la configuration
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
        
        # Compter les éléments créés
        user_count = await db.users.count_documents({})
        salle_count = await db.salles.count_documents({})
        config_count = await db.configuration.count_documents({})
        
        return {
            "message": "Base de données initialisée avec succès !",
            "utilisateurs_crees": user_count,
            "salles_creees": salle_count,
            "configuration_creee": config_count,
            "identifiants": {
                "super_admin": {
                    "email": "admin@cabinet.fr",
                    "password": "SuperAdmin2025!",
                    "note": "Compte protégé - Ne peut jamais être supprimé"
                },
                "directeur": {
                    "email": "directeur@cabinet.fr",
                    "password": "admin123"
                },
                "medecin": {
                    "email": "dr.dupont@cabinet.fr",
                    "password": "medecin123"
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'initialisation: {str(e)}")


@api_router.get("/database-status")
async def get_database_status():
    """
    Endpoint pour vérifier l'état de la base de données.
    Retourne le nombre d'éléments dans chaque collection.
    Public - Aucune authentification requise.
    """
    try:
        user_count = await db.users.count_documents({})
        salle_count = await db.salles.count_documents({})
        config_count = await db.configuration.count_documents({})
        
        # Liste les emails des utilisateurs existants (sans mots de passe)
        users = await db.users.find({}, {"email": 1, "prenom": 1, "nom": 1, "role": 1, "actif": 1, "_id": 0}).to_list(100)
        
        return {
            "database_initialized": user_count > 0,
            "counts": {
                "users": user_count,
                "salles": salle_count,
                "configuration": config_count
            },
            "existing_users": users,
            "message": "Base de données déjà initialisée" if user_count > 0 else "Base de données vide - prête pour l'initialisation"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")



@api_router.post("/add-super-admin")
async def add_super_admin(request: InitDatabaseRequest):
    """
    Ajoute uniquement le compte super admin protégé sans toucher aux utilisateurs existants.
    Idéal quand des utilisateurs existent déjà et qu'on veut juste ajouter le compte de secours.
    """
    # Vérifier le token
    if request.secret_token != "add-super-admin-2025":
        raise HTTPException(status_code=403, detail="Token invalide")
    
    try:
        # Vérifier si le super admin existe déjà
        existing_admin = await db.users.find_one({"email": "admin@cabinet.fr"})
        if existing_admin:
            return {
                "message": "Le compte super admin existe déjà",
                "email": "admin@cabinet.fr"
            }
        
        # Créer uniquement le super admin
        super_admin = {
            "id": "super-admin-root",
            "email": "admin@cabinet.fr",
            "password_hash": get_password_hash("SuperAdmin2025!"),
            "prenom": "Administrateur",
            "nom": "Système",
            "role": "Directeur",
            "telephone": "0000000000",
            "actif": True,
            "is_protected": True,
            "date_creation": datetime.now(timezone.utc),
            "derniere_connexion": None
        }
        
        await db.users.insert_one(super_admin)
        
        # Créer aussi les salles si elles n'existent pas
        salle_count = await db.salles.count_documents({})
        if salle_count == 0:
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
            await db.salles.insert_many(salles)
        
        # Créer la configuration si elle n'existe pas
        config_count = await db.configuration.count_documents({})
        if config_count == 0:
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
        
        return {
            "message": "✅ Super admin ajouté avec succès ! Utilisateurs existants préservés.",
            "super_admin": {
                "email": "admin@cabinet.fr",
                "password": "SuperAdmin2025!",
                "note": "Compte protégé - Ne peut jamais être supprimé"
            },
            "salles_creees": salle_count == 0,
            "configuration_creee": config_count == 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")


@api_router.post("/reset-user-password")
async def reset_user_password_with_token(request: dict):
    """
    Réinitialise le mot de passe d'un utilisateur spécifique.
    Nécessite un token de sécurité.
    """
    email = request.get("email")
    new_password = request.get("new_password")
    secret_token = request.get("secret_token")
    
    if secret_token != "reset-password-2025-secure":
        raise HTTPException(status_code=403, detail="Token invalide")
    
    if not email or not new_password:
        raise HTTPException(status_code=400, detail="Email et nouveau mot de passe requis")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    
    try:
        # Trouver l'utilisateur
        user = await db.users.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=404, detail=f"Utilisateur {email} non trouvé")
        
        # Mettre à jour le mot de passe
        new_hash = get_password_hash(new_password)
        result = await db.users.update_one(
            {"email": email},
            {"$set": {"password_hash": new_hash}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Échec de la mise à jour")
        
        return {
            "message": f"✅ Mot de passe réinitialisé avec succès pour {email}",
            "email": email,
            "new_password": new_password,
            "nom": user.get("nom"),
            "prenom": user.get("prenom")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")


@api_router.post("/force-init-database")
async def force_initialize_database(request: InitDatabaseRequest):
    """
    Force la réinitialisation complète de la base de données.
    ⚠️ ATTENTION : Supprime TOUTES les données existantes !
    Nécessite un token spécial différent du token d'initialisation normale.
    
    Usage: POST /api/force-init-database avec {"secret_token": "force-init-2025-danger"}
    """
    # Code de la fonction devrait être ici mais semble manquant
    raise HTTPException(status_code=501, detail="Fonction non implémentée")


# ==================== NOTIFICATIONS PUSH ====================

@api_router.post("/users/me/fcm-token")
async def save_fcm_token(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    """Enregistre le token FCM de l'utilisateur pour les notifications push"""
    fcm_token = request.get("token")
    
    if not fcm_token:
        raise HTTPException(status_code=400, detail="Token FCM requis")
    
    try:
        # Mettre à jour le token FCM de l'utilisateur
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"fcm_token": fcm_token}}
        )
        
        return {"message": "Token FCM enregistré avec succès"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@api_router.delete("/users/me/fcm-token")
async def delete_fcm_token(current_user: User = Depends(get_current_user)):
    """Supprime le token FCM de l'utilisateur (désactivation des notifications)"""
    try:
        await db.users.update_one(
            {"id": current_user.id},
            {"$unset": {"fcm_token": "", "device_info": ""}}
        )
        
        return {"message": "Token FCM et appareil supprimés avec succès"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@api_router.get("/users/me/device-info")
async def get_device_info(current_user: User = Depends(get_current_user)):
    """Récupère les informations de l'appareil relié pour les notifications push"""
    try:
        user = await db.users.find_one({"id": current_user.id}, {"fcm_token": 1, "device_info": 1, "fcm_updated_at": 1})
        
        if not user or not user.get("fcm_token"):
            return {
                "has_device": False,
                "message": "Aucun appareil relié pour les notifications push"
            }
        
        device_info = user.get("device_info", {})
        return {
            "has_device": True,
            "device_name": device_info.get("device_name", "Appareil inconnu"),
            "browser": device_info.get("browser", "Inconnu"),
            "platform": device_info.get("platform", "Inconnu"),
            "os": device_info.get("os", "Inconnu"),
            "registered_at": device_info.get("registered_at") or user.get("fcm_updated_at"),
            "fcm_token_preview": user.get("fcm_token", "")[:20] + "..." if user.get("fcm_token") else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@api_router.get("/notifications/firebase-status")
async def get_firebase_status_endpoint(current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))):
    """Vérifie le statut de Firebase pour les notifications push (Directeur uniquement)"""
    try:
        from push_notifications import get_firebase_status
        status = get_firebase_status()
        
        # Compter les utilisateurs avec token FCM
        users_with_fcm = await db.users.count_documents({"fcm_token": {"$exists": True, "$ne": ""}})
        status["users_with_fcm_token"] = users_with_fcm
        
        return status
    except Exception as e:
        return {
            "initialized": False,
            "status": "error",
            "message": f"Erreur: {str(e)}"
        }

# ==================== ACTUALITÉS ====================

@api_router.get("/actualites")
async def get_actualites(current_user: User = Depends(get_current_user)):
    """Récupérer toutes les actualités actives"""
    actualites = await db.actualites.find({"actif": True}).sort("priorite", -1).to_list(100)
    
    # Enrichir avec les informations de l'auteur
    for actu in actualites:
        if '_id' in actu:
            del actu['_id']
        auteur = await db.users.find_one({"id": actu.get("auteur_id")})
        if auteur:
            actu['auteur'] = {
                "id": auteur.get("id"),
                "nom": auteur.get("nom"),
                "prenom": auteur.get("prenom"),
                "role": auteur.get("role")
            }
    
    return actualites

@api_router.post("/actualites")
async def create_actualite(actualite: ActualiteCreate, current_user: User = Depends(get_current_user)):
    """Créer une nouvelle actualité (Directeur uniquement)"""
    if current_user.role != "Directeur":
        raise HTTPException(status_code=403, detail="Seul le directeur peut créer des actualités")
    
    nouvelle_actualite = Actualite(
        titre=actualite.titre,
        contenu=actualite.contenu,
        type_contenu=actualite.type_contenu,
        fichier_url=actualite.fichier_url,
        fichier_nom=actualite.fichier_nom,
        groupe_cible=actualite.groupe_cible,
        auteur_id=current_user.id,
        priorite=actualite.priorite
    )
    
    await db.actualites.insert_one(nouvelle_actualite.model_dump())
    return nouvelle_actualite

@api_router.put("/actualites/{actualite_id}")
async def update_actualite(actualite_id: str, actualite: ActualiteUpdate, current_user: User = Depends(get_current_user)):
    """Modifier une actualité (Directeur uniquement)"""
    if current_user.role != "Directeur":
        raise HTTPException(status_code=403, detail="Seul le directeur peut modifier des actualités")
    
    update_data = {k: v for k, v in actualite.model_dump().items() if v is not None}
    update_data["date_modification"] = datetime.now(timezone.utc)
    
    result = await db.actualites.update_one(
        {"id": actualite_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Actualité non trouvée")
    
    return {"message": "Actualité mise à jour"}

@api_router.delete("/actualites/{actualite_id}")
async def delete_actualite(actualite_id: str, current_user: User = Depends(get_current_user)):
    """Supprimer une actualité (Directeur uniquement)"""
    if current_user.role != "Directeur":
        raise HTTPException(status_code=403, detail="Seul le directeur peut supprimer des actualités")
    
    result = await db.actualites.update_one(
        {"id": actualite_id},
        {"$set": {"actif": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Actualité non trouvée")
    
    return {"message": "Actualité supprimée"}

@api_router.get("/anniversaires")
async def get_anniversaires(current_user: User = Depends(get_current_user)):
    """Récupérer les prochains anniversaires des employés"""
    users = await db.users.find({"actif": True, "date_naissance": {"$ne": None}}).to_list(1000)
    
    today = datetime.now()
    anniversaires = []
    
    for user in users:
        if '_id' in user:
            del user['_id']
        
        date_naissance = user.get("date_naissance")
        if not date_naissance:
            continue
        
        try:
            # Parser la date de naissance
            dn = datetime.strptime(date_naissance, "%Y-%m-%d")
            
            # Calculer le prochain anniversaire
            anniv_cette_annee = dn.replace(year=today.year)
            if anniv_cette_annee < today:
                # L'anniversaire est passé cette année, prendre celui de l'année prochaine
                anniv = dn.replace(year=today.year + 1)
            else:
                anniv = anniv_cette_annee
            
            # Calculer le nombre de jours restants
            jours_restants = (anniv - today).days
            
            # Calculer l'âge qu'il/elle aura
            age = anniv.year - dn.year
            
            anniversaires.append({
                "id": user.get("id"),
                "nom": user.get("nom"),
                "prenom": user.get("prenom"),
                "role": user.get("role"),
                "photo_url": user.get("photo_url"),
                "date_naissance": date_naissance,
                "prochain_anniversaire": anniv.strftime("%Y-%m-%d"),
                "jours_restants": jours_restants,
                "age": age
            })
        except:
            continue
    
    # Trier par jours restants
    anniversaires.sort(key=lambda x: x["jours_restants"])
    
    return anniversaires[:10]  # Retourner les 10 prochains

# --- NOUVEAU BLOC FIREBASE SANS ERREUR DE PERMISSION ---
import os
import uuid

# Configuration automatique via tes variables Render
firebase_config = {
    "apiKey": os.getenv("REACT_APP_FIREBASE_API_KEY"),
    "authDomain": os.getenv("REACT_APP_FIREBASE_AUTH_DOMAIN"),
    "projectId": os.getenv("REACT_APP_FIREBASE_PROJECT_ID"),
    "storageBucket": os.getenv("REACT_APP_FIREBASE_STORAGE_BUCKET")
}

@api_router.post("/upload/photo")
async def upload_photo(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    try:
        # Créer le dossier uploads s'il n'existe pas
        upload_dir = ROOT_DIR / "uploads" / "photos"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # On définit le nom du fichier
        file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'jpg'
        file_name = f"{current_user.id}_{uuid.uuid4().hex[:8]}.{file_ext}"
        file_path = upload_dir / file_name
        
        # Sauvegarder le fichier
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Retourner l'URL relative
        photo_url = f"/api/uploads/photos/{file_name}"
        
        return {"url": photo_url, "filename": file_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur upload photo: {str(e)}")

# Activation du routeur et des sécurités
app.include_router(api_router)

# Servir les fichiers uploadés (photos de profil)
uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Fermeture propre de la base de données
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
