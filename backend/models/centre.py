"""Modèles liés aux centres"""
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone
import uuid


class CentreConfig(BaseModel):
    """Configuration des rubriques visibles pour un centre"""
    rubriques_actives: List[str] = ["dashboard", "planning", "conges", "personnel", "chat", "cabinet"]


class CentreBase(BaseModel):
    nom: str
    adresse: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    couleur_primaire: Optional[str] = "#0091B9"
    actif: bool = True
    config: Optional[CentreConfig] = None


class CentreCreate(CentreBase):
    pass


class Centre(CentreBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cree_par: Optional[str] = None


class CentreUpdate(BaseModel):
    nom: Optional[str] = None
    adresse: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    couleur_primaire: Optional[str] = None
    actif: Optional[bool] = None
    config: Optional[CentreConfig] = None


class InscriptionRequest(BaseModel):
    email: EmailStr
    nom: str
    prenom: str
    telephone: Optional[str] = None
    centre_id: str
    role_souhaite: str
    message: Optional[str] = None


class Inscription(InscriptionRequest):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date_demande: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    statut: str = "EN_ATTENTE"
    traite_par: Optional[str] = None
    date_traitement: Optional[datetime] = None
    commentaire_admin: Optional[str] = None
