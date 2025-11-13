from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, BackgroundTasks
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ['SECRET_KEY']  # Fail fast si non défini
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI(title="Gestion Personnel Médical")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums and Constants
ROLES = {
    "DIRECTEUR": "Directeur",
    "MEDECIN": "Médecin", 
    "ASSISTANT": "Assistant",
    "SECRETAIRE": "Secrétaire"
}

SALLES_MEDECINS = ["1", "2", "3", "4", "5", "6"]
SALLES_ASSISTANTS = ["A", "B", "C", "D", "O", "Blue"]

CRENEAU_TYPES = ["MATIN", "APRES_MIDI"]

# Models
class UserBase(BaseModel):
    email: EmailStr
    nom: str
    prenom: str
    role: str
    telephone: Optional[str] = None
    actif: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    telephone: Optional[str] = None
    actif: Optional[bool] = None

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    derniere_connexion: Optional[datetime] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
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
    medecin_attribue_id: Optional[str] = None  # Pour les assistants : avec quel médecin (ancien champ, gardé pour compatibilité)
    medecin_ids: List[str] = []  # Pour les assistants : plusieurs médecins possibles
    salle_attribuee: Optional[str] = None  # Salle de travail
    salle_attente: Optional[str] = None  # Salle d'attente associée
    horaire_debut: Optional[str] = None  # Pour secrétaires : "08:00"
    horaire_fin: Optional[str] = None  # Pour secrétaires : "17:00"
    horaire_pause_debut: Optional[str] = None  # Pour secrétaires : heure de fin du matin "12:00"
    horaire_pause_fin: Optional[str] = None  # Pour secrétaires : heure de reprise après-midi "14:00"
    notes: Optional[str] = None
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CreneauPlanningCreate(BaseModel):
    date: str
    creneau: str
    employe_id: str
    medecin_attribue_id: Optional[str] = None
    medecin_ids: List[str] = []
    salle_attribuee: Optional[str] = None
    salle_attente: Optional[str] = None
    horaire_debut: Optional[str] = None
    horaire_fin: Optional[str] = None
    horaire_pause_debut: Optional[str] = None
    horaire_pause_fin: Optional[str] = None
    notes: Optional[str] = None

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
    heures_ouverture_matin_debut: str = "08:00"
    heures_ouverture_matin_fin: str = "12:00"
    heures_ouverture_apres_midi_debut: str = "14:00"
    heures_ouverture_apres_midi_fin: str = "18:00"
    date_modification: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ConfigurationCabinetUpdate(BaseModel):
    max_medecins_par_jour: Optional[int] = None
    max_assistants_par_jour: Optional[int] = None
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
# Semaine Type Models
class SemaineType(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom: str
    description: Optional[str] = None
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
    date_demandee: str  # YYYY-MM-DD
    creneau: str  # "MATIN", "APRES_MIDI", "JOURNEE_COMPLETE"
    motif: Optional[str] = None
    statut: str = "EN_ATTENTE"  # "EN_ATTENTE", "APPROUVE", "REJETE"
    date_demande: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approuve_par: Optional[str] = None
    date_approbation: Optional[datetime] = None
    commentaire_approbation: Optional[str] = None

class DemandeJourTravailCreate(BaseModel):
    date_demandee: Optional[str] = None  # Optionnel si semaine_type_id fourni
    creneau: Optional[str] = None
    motif: Optional[str] = None
    semaine_type_id: Optional[str] = None  # Pour demande de semaine type
    date_debut_semaine: Optional[str] = None  # YYYY-MM-DD du lundi
    medecin_id: Optional[str] = None  # Pour que le directeur puisse faire une demande pour un médecin

class ApprobationJourTravailRequest(BaseModel):
    approuve: bool
    commentaire: str = ""

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
    type_conge: str  # "CONGE_PAYE", "RTT", "MALADIE", etc.
    creneau: Optional[str] = "JOURNEE_COMPLETE"  # "MATIN", "APRES_MIDI", "JOURNEE_COMPLETE"
    motif: Optional[str] = ""

class DemandeConge(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    utilisateur_id: str
    date_debut: str  # YYYY-MM-DD
    date_fin: str  # YYYY-MM-DD
    type_conge: str  # "CONGE_PAYE", "RTT", "MALADIE", etc.
    creneau: Optional[str] = "JOURNEE_COMPLETE"  # "MATIN", "APRES_MIDI", "JOURNEE_COMPLETE"
    motif: Optional[str] = None
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
    """Envoie une notification à un utilisateur spécifique"""
    try:
        # Pour l'instant, on stocke les notifications en base
        # Plus tard, on intégrera Firebase Cloud Messaging
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": title,
            "body": body,
            "data": data or {},
            "sent_at": datetime.now(timezone.utc),
            "read": False
        }
        
        await db.notifications.insert_one(notification)
        print(f"📤 Notification envoyée à {user_id}: {title}")
        
    except Exception as e:
        print(f"❌ Erreur notification: {e}")

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
            colleague_names = []
            for colleague_slot in colleagues:
                colleague = await db.users.find_one({"id": colleague_slot["employe_id"]})
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

@api_router.post("/notifications/send-daily-planning")
async def trigger_daily_planning(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    """Déclenche manuellement l'envoi du planning quotidien (TEST)"""
    background_tasks.add_task(send_daily_planning_notifications)
    return {"message": "Envoi du planning quotidien programmé"}

@api_router.post("/notifications/subscribe")
async def subscribe_to_notifications(
    subscription_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Enregistre le token FCM d'un utilisateur"""
    try:
        # Supprimer l'ancien token s'il existe
        await db.notification_tokens.delete_many({"user_id": current_user.id})
        
        # Enregistrer le nouveau token
        token_doc = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "token": subscription_data.get("token"),
            "created_at": datetime.now(timezone.utc),
            "active": True
        }
        
        await db.notification_tokens.insert_one(token_doc)
        
        return {"message": "Token FCM enregistré avec succès"}
        
    except Exception as e:
        print(f"Erreur lors de l'enregistrement du token: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'enregistrement")

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
        users = await db.users.find({}, {"mot_de_passe": 0}).to_list(100)
        
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
            "mot_de_passe": bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
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
            "mot_de_passe": bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
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
    
    # Update last login
    await db.users.update_one(
        {"id": user['id']}, 
        {"$set": {"derniere_connexion": datetime.now(timezone.utc)}}
    )
    
    access_token = create_access_token(data={"sub": user['id']})
    user_obj = User(**user)
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

# User management routes
@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    """Tous les utilisateurs authentifiés peuvent voir la liste du personnel"""
    users = await db.users.find().to_list(1000)
    return [User(**user) for user in users]

@api_router.get("/users/by-role/{role}", response_model=List[User])
async def get_users_by_role(
    role: str, 
    current_user: User = Depends(get_current_user)
):
    if role not in ROLES.values():
        raise HTTPException(status_code=400, detail="Rôle invalide")
    
    users = await db.users.find({"role": role, "actif": True}).to_list(1000)
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
    
    # Enrich with user details
    enriched_assignations = []
    for assignation in assignations:
        # Remove MongoDB _id field to avoid serialization error
        assignation.pop('_id', None)
        
        medecin = await db.users.find_one({"id": assignation["medecin_id"]})
        assistant = await db.users.find_one({"id": assignation["assistant_id"]})
        
        enriched_assignations.append({
            **assignation,
            "medecin": User(**medecin).dict() if medecin else None,
            "assistant": User(**assistant).dict() if assistant else None
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
        motif=demande_data.motif if demande_data.motif else None
    )
    
    await db.demandes_conges.insert_one(demande.dict())
    
    # 📤 NOTIFICATION : Nouvelle demande de congé
    # Notifier le directeur SEULEMENT pour les demandes des Assistants et Secrétaires
    if (current_user.role != ROLES["DIRECTEUR"] and 
        current_user.role in [ROLES["ASSISTANT"], ROLES["SECRETAIRE"]]):
        user_name = f"{current_user.prenom} {current_user.nom}"
        dates = f"{demande.date_debut} au {demande.date_fin}"
        creneau_text = "Journée complète" if demande.creneau == "JOURNEE_COMPLETE" else demande.creneau.lower()
        details = f"{dates} ({creneau_text})"
        
        background_tasks.add_task(
            notify_director_new_request, 
            "demande de congé", 
            user_name, 
            details
        )
    
    return demande

@api_router.get("/conges", response_model=List[Dict[str, Any]])
async def get_demandes_conges(current_user: User = Depends(get_current_user)):
    if current_user.role == ROLES["DIRECTEUR"]:
        demandes = await db.demandes_conges.find().to_list(1000)
    else:
        demandes = await db.demandes_conges.find({"utilisateur_id": current_user.id}).to_list(1000)
    
    # Enrich with user details and clean data
    enriched_demandes = []
    for demande in demandes:
        # Remove MongoDB _id field that causes serialization issues
        if '_id' in demande:
            del demande['_id']
            
        utilisateur = await db.users.find_one({"id": demande["utilisateur_id"]})
        if utilisateur and '_id' in utilisateur:
            del utilisateur['_id']
            
        enriched_demandes.append({
            **demande,
            "utilisateur": User(**utilisateur) if utilisateur else None
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
    background_tasks.add_task(
        notify_user_request_status,
        demande["utilisateur_id"],
        "Demande de congé",
        statut,
        dates
    )
    
    return {"message": f"Demande {statut.lower()}e avec succès"}

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
    
    # Enrich with user details
    enriched_reservations = []
    for reservation in reservations:
        utilisateur = await db.users.find_one({"id": reservation["utilisateur_id"]})
        enriched_reservations.append({
            **reservation,
            "utilisateur": User(**utilisateur) if utilisateur else None
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
    
    # Vérifier les conflits de planning
    existing = await db.planning.find_one({
        "date": creneau_data.date,
        "creneau": creneau_data.creneau,
        "employe_id": creneau_data.employe_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="L'employé a déjà un créneau programmé à cette date/heure")
    
    # Vérifier les conflits de salle
    if creneau_data.salle_attribuee:
        salle_occupee = await db.planning.find_one({
            "date": creneau_data.date,
            "creneau": creneau_data.creneau,
            "salle_attribuee": creneau_data.salle_attribuee
        })
        
        if salle_occupee:
            raise HTTPException(status_code=400, detail="La salle est déjà occupée à ce créneau")
    
    creneau = CreneauPlanning(
        **creneau_data.dict(),
        employe_role=employe['role']
    )
    
    await db.planning.insert_one(creneau.dict())
    return creneau

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
    creneau_data: CreneauPlanningCreate,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    # Vérifier les conflits avant mise à jour
    existing = await db.planning.find_one({
        "date": creneau_data.date,
        "creneau": creneau_data.creneau,
        "employe_id": creneau_data.employe_id,
        "id": {"$ne": creneau_id}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Conflit de planning détecté")
    
    result = await db.planning.update_one({"id": creneau_id}, {"$set": creneau_data.dict()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Créneau non trouvé")
    
    return {"message": "Créneau mis à jour avec succès"}

@api_router.delete("/planning/{creneau_id}")
async def delete_creneau_planning(
    creneau_id: str,
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    result = await db.planning.delete_one({"id": creneau_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Créneau non trouvé")
    
    return {"message": "Créneau supprimé avec succès"}

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
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    semaine = SemaineType(**semaine_data.dict())
    await db.semaines_types.insert_one(semaine.dict())
    return semaine

@api_router.get("/semaines-types", response_model=List[SemaineType])
async def get_semaines_types(current_user: User = Depends(get_current_user)):
    semaines = await db.semaines_types.find({"actif": True}).sort("nom", 1).to_list(1000)
    
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
                
                # Vérifier si une demande existe déjà
                existing = await db.demandes_travail.find_one({
                    "medecin_id": medecin_id,
                    "date_demandee": date_jour,
                    "creneau": creneau,
                    "statut": {"$ne": "REJETE"}
                })
                
                if not existing:
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
        
        existing = await db.demandes_travail.find_one({
            "medecin_id": medecin_id,
            "date_demandee": demande_data.date_demandee,
            "creneau": demande_data.creneau,
            "statut": {"$ne": "REJETE"}
        })
        
        if existing:
            raise HTTPException(status_code=400, detail="Une demande existe déjà pour cette date/créneau")
        
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
        statut,
        details
    )
    
    # Si la demande est approuvée, créer automatiquement un créneau dans le planning
    if request.approuve:
        # Récupérer les informations du médecin
        medecin = await db.users.find_one({"id": demande["medecin_id"]})
        if not medecin:
            raise HTTPException(status_code=404, detail="Médecin non trouvé")
        
        # Créer le(s) créneau(x) selon le type
        creneaux_a_creer = []
        if demande["creneau"] == "JOURNEE_COMPLETE":
            creneaux_a_creer = ["MATIN", "APRES_MIDI"]
        else:
            creneaux_a_creer = [demande["creneau"]]
        
        for creneau_type in creneaux_a_creer:
            # Vérifier si un créneau n'existe pas déjà pour ce médecin à cette date/heure
            existing_creneau = await db.planning.find_one({
                "date": demande["date_demandee"],
                "creneau": creneau_type,
                "employe_id": demande["medecin_id"]
            })
            
            if not existing_creneau:
                # Créer le créneau
                creneau_planning = CreneauPlanning(
                    date=demande["date_demandee"],
                    creneau=creneau_type,
                    employe_id=demande["medecin_id"],
                    employe_role=medecin["role"],
                    salle_attribuee=None,
                    salle_attente=None,
                    notes=None
                )
                await db.planning.insert_one(creneau_planning.dict())
    
    return {"message": f"Demande {statut.lower()}e avec succès" + (" et créneau(x) créé(s) dans le planning" if request.approuve else "")}

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
            planning_par_jour[creneau["date"]][creneau["creneau"]].append(enriched_creneau)
    
    return {
        "dates": dates_semaine,
        "planning": planning_par_jour
    }

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
    
    return {"message": f"Utilisateur {'activé' if new_status else 'désactivé'} avec succès", "actif": new_status}

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

@api_router.post("/force-init-database")
async def force_initialize_database(request: InitDatabaseRequest):
    """
    Force la réinitialisation complète de la base de données.
    ⚠️ ATTENTION : Supprime TOUTES les données existantes !
    Nécessite un token spécial différent du token d'initialisation normale.
    
    Usage: POST /api/force-init-database avec {"secret_token": "force-init-2025-danger"}
    """
    # Vérifier le token secret spécial
    expected_token = "force-init-2025-danger"
    if request.secret_token != expected_token:
        raise HTTPException(status_code=403, detail="Token de forçage invalide")
    
    try:
        # Supprimer toutes les collections
        await db.users.delete_many({})
        await db.salles.delete_many({})
        await db.configuration.delete_many({})
        
        # Créer les utilisateurs (même code que l'endpoint normal)
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
            "message": "⚠️ Base de données RÉINITIALISÉE avec succès ! Toutes les anciennes données ont été supprimées.",
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
        raise HTTPException(status_code=500, detail=f"Erreur lors de la réinitialisation: {str(e)}")


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()