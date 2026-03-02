"""Modèles liés aux congés"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid


class DemandeCongeCreate(BaseModel):
    type_conge: str
    date_debut: str
    date_fin: str
    creneau: str = "JOURNEE_COMPLETE"
    motif: Optional[str] = None
    centre_id: Optional[str] = None


class DemandeConge(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    utilisateur_id: str
    type_conge: str
    date_debut: str
    date_fin: str
    creneau: str = "JOURNEE_COMPLETE"
    motif: Optional[str] = None
    statut: str = "EN_ATTENTE"
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    traite_par: Optional[str] = None
    date_traitement: Optional[datetime] = None
    commentaire_reponse: Optional[str] = None
    centre_id: Optional[str] = None


class ApprobationRequest(BaseModel):
    commentaire: Optional[str] = None
    type_conge: Optional[str] = None
