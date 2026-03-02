"""Modèles liés aux salles et configuration du cabinet"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid


class Salle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom: str
    type_salle: str = "medecin"
    position_x: float = 0
    position_y: float = 0
    capacite: int = 1
    actif: bool = True
    centre_id: Optional[str] = None


class SalleCreate(BaseModel):
    nom: str
    type_salle: str = "medecin"
    position_x: float = 0
    position_y: float = 0
    centre_id: Optional[str] = None


class SalleUpdate(BaseModel):
    nom: Optional[str] = None
    type_salle: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    capacite: Optional[int] = None
    actif: Optional[bool] = None


class SalleReservation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    salle_id: str
    date: str
    creneau: str
    employe_id: str
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ConfigurationCabinet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    max_medecins: int = 6
    max_assistants: int = 8
    horaires_matin: Dict[str, str] = {"debut": "08:00", "fin": "12:00"}
    horaires_apres_midi: Dict[str, str] = {"debut": "14:00", "fin": "18:00"}
    jours_ouverture: list = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]
    centre_id: Optional[str] = None


class ConfigurationCabinetUpdate(BaseModel):
    max_medecins: Optional[int] = None
    max_assistants: Optional[int] = None
    horaires_matin: Optional[Dict[str, str]] = None
    horaires_apres_midi: Optional[Dict[str, str]] = None
    jours_ouverture: Optional[list] = None
