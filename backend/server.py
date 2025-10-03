from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
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
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-this')
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
    medecin_attribue_id: Optional[str] = None  # Pour les assistants : avec quel médecin
    salle_attribuee: Optional[str] = None  # Salle de travail
    salle_attente: Optional[str] = None  # Salle d'attente associée
    horaire_debut: Optional[str] = None  # Pour secrétaires : "08:00"
    horaire_fin: Optional[str] = None  # Pour secrétaires : "17:00"
    notes: Optional[str] = None
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CreneauPlanningCreate(BaseModel):
    date: str
    creneau: str
    employe_id: str
    medecin_attribue_id: Optional[str] = None
    salle_attribuee: Optional[str] = None
    salle_attente: Optional[str] = None
    horaire_debut: Optional[str] = None
    horaire_fin: Optional[str] = None
    notes: Optional[str] = None

# Chat Models
class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    expediteur_id: str
    destinataire_id: Optional[str] = None  # None = message général
    contenu: str
    type_message: str = "GENERAL"  # "GENERAL" ou "PRIVE"
    date_envoi: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    lu: bool = False

class MessageCreate(BaseModel):
    destinataire_id: Optional[str] = None
    contenu: str
    type_message: str = "GENERAL"

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
    date_demandee: str
    creneau: str
    motif: Optional[str] = None

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
    date_debut: str  # YYYY-MM-DD
    date_fin: str  # YYYY-MM-DD
    type_conge: str  # "CONGE_PAYE", "RTT", "MALADIE", etc.
    motif: Optional[str] = ""

class DemandeConge(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    utilisateur_id: str
    date_debut: str  # YYYY-MM-DD
    date_fin: str  # YYYY-MM-DD
    type_conge: str  # "CONGE_PAYE", "RTT", "MALADIE", etc.
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
async def get_users(current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))):
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
        medecin = await db.users.find_one({"id": assignation["medecin_id"]})
        assistant = await db.users.find_one({"id": assignation["assistant_id"]})
        
        enriched_assignations.append({
            **assignation,
            "medecin": User(**medecin) if medecin else None,
            "assistant": User(**assistant) if assistant else None
        })
    
    return enriched_assignations

# Leave management
@api_router.post("/conges", response_model=DemandeConge)
async def create_demande_conge(
    demande_data: DemandeCongeCreate,
    current_user: User = Depends(get_current_user)
):
    demande = DemandeConge(
        utilisateur_id=current_user.id,
        date_debut=demande_data.date_debut,
        date_fin=demande_data.date_fin,
        type_conge=demande_data.type_conge,
        motif=demande_data.motif if demande_data.motif else None
    )
    await db.demandes_conges.insert_one(demande.dict())
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
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
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

# Chat endpoints
@api_router.post("/messages", response_model=Message)
async def send_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user)
):
    message = Message(
        expediteur_id=current_user.id,
        destinataire_id=message_data.destinataire_id,
        contenu=message_data.contenu,
        type_message=message_data.type_message
    )
    
    await db.messages.insert_one(message.dict())
    return message

@api_router.get("/messages", response_model=List[Dict[str, Any]])
async def get_messages(
    type_message: str = "GENERAL",
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