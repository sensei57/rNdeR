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

class SalleReservation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    salle: str
    type_salle: str  # "MEDECIN" ou "ASSISTANT"
    utilisateur_id: str
    date: str  # YYYY-MM-DD
    creneau: str  # "MATIN" ou "APRES_MIDI"
    notes: Optional[str] = None

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
    date_debut: str,
    date_fin: str,
    type_conge: str,
    motif: str = "",
    current_user: User = Depends(get_current_user)
):
    demande = DemandeConge(
        utilisateur_id=current_user.id,
        date_debut=date_debut,
        date_fin=date_fin,
        type_conge=type_conge,
        motif=motif if motif else None
    )
    await db.demandes_conges.insert_one(demande.dict())
    return demande

@api_router.get("/conges", response_model=List[Dict[str, Any]])
async def get_demandes_conges(current_user: User = Depends(get_current_user)):
    if current_user.role == ROLES["DIRECTEUR"]:
        demandes = await db.demandes_conges.find().to_list(1000)
    else:
        demandes = await db.demandes_conges.find({"utilisateur_id": current_user.id}).to_list(1000)
    
    # Enrich with user details
    enriched_demandes = []
    for demande in demandes:
        utilisateur = await db.users.find_one({"id": demande["utilisateur_id"]})
        enriched_demandes.append({
            **demande,
            "utilisateur": User(**utilisateur) if utilisateur else None
        })
    
    return enriched_demandes

@api_router.put("/conges/{demande_id}/approuver")
async def approuver_demande_conge(
    demande_id: str,
    approuve: bool,
    commentaire: str = "",
    current_user: User = Depends(require_role([ROLES["DIRECTEUR"]]))
):
    statut = "APPROUVE" if approuve else "REJETE"
    update_data = {
        "statut": statut,
        "approuve_par": current_user.id,
        "date_approbation": datetime.now(timezone.utc),
        "commentaire_approbation": commentaire
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
        auteur = await db.users.find_one({"id": note["auteur_id"]})
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