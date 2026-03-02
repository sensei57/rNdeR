"""Modèles liés au planning et demandes de travail"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


class AssignationAssistant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    medecin_id: str
    assistant_id: str
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CreneauPlanning(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employe_id: str
    date: str
    creneau: str
    salle_id: Optional[str] = None
    salle_nom: Optional[str] = None
    medecin_id: Optional[str] = None
    medecin_nom: Optional[str] = None
    centre_id: Optional[str] = None
    est_repos: bool = False
    commentaire: Optional[str] = None
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cree_par: Optional[str] = None


class CreneauPlanningCreate(BaseModel):
    employe_id: str
    date: str
    creneau: str
    salle_id: Optional[str] = None
    salle_nom: Optional[str] = None
    medecin_id: Optional[str] = None
    medecin_nom: Optional[str] = None
    centre_id: Optional[str] = None
    est_repos: bool = False
    commentaire: Optional[str] = None


class CreneauPlanningUpdate(BaseModel):
    salle_id: Optional[str] = None
    salle_nom: Optional[str] = None
    medecin_id: Optional[str] = None
    medecin_nom: Optional[str] = None
    est_repos: Optional[bool] = None
    commentaire: Optional[str] = None
    employe_id: Optional[str] = None
    creneau: Optional[str] = None


class NotePlanningJour(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    contenu: str
    auteur_id: str
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NotePlanningJourCreate(BaseModel):
    date: str
    contenu: str


class SemaineType(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom: str
    description: Optional[str] = None
    medecin_id: Optional[str] = None
    jours: Dict[str, Any] = {}
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    actif: bool = True
    centre_id: Optional[str] = None


class SemaineTypeCreate(BaseModel):
    nom: str
    description: Optional[str] = None
    medecin_id: Optional[str] = None
    jours: Dict[str, Any] = {}
    centre_id: Optional[str] = None


class DemandeJourTravail(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    medecin_id: str
    date_demandee: str
    creneau: str
    motif: Optional[str] = None
    statut: str = "EN_ATTENTE"
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    traite_par: Optional[str] = None
    date_traitement: Optional[datetime] = None
    commentaire_reponse: Optional[str] = None
    centre_id: Optional[str] = None
    demande_annulation: bool = False
    raison_demande_annulation: Optional[str] = None
    date_demande_annulation: Optional[datetime] = None
    annule_par: Optional[str] = None
    raison_annulation: Optional[str] = None
    date_annulation: Optional[datetime] = None


class DemandeJourTravailCreate(BaseModel):
    date_demandee: str
    creneau: str
    motif: Optional[str] = None
    centre_id: Optional[str] = None


class DemandeMensuelleCreate(BaseModel):
    dates: List[str]
    semaine_type_id: Optional[str] = None
    motif: Optional[str] = None
    centre_id: Optional[str] = None


class ApprobationJourTravailRequest(BaseModel):
    commentaire: Optional[str] = None
    salle_id: Optional[str] = None


class DemandeAnnulationRequest(BaseModel):
    raison: str


class AnnulationDirecteRequest(BaseModel):
    raison: str
    notifier_medecin: bool = True
