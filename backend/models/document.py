"""Modèles liés aux documents et actualités"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid


class DocumentPersonnel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    nom: str
    type_document: str
    url: str
    date_upload: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    centre_id: Optional[str] = None


class DocumentPersonnelCreate(BaseModel):
    nom: str
    type_document: str
    url: str
    centre_id: Optional[str] = None


class Actualite(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    titre: str
    contenu: str
    image_url: Optional[str] = None
    image_storage_path: Optional[str] = None
    fichier_url: Optional[str] = None
    fichier_storage_path: Optional[str] = None
    fichier_nom: Optional[str] = None
    auteur_id: str
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    date_modification: Optional[datetime] = None
    publie: bool = True
    epingle: bool = False
    centre_id: Optional[str] = None


class ActualiteCreate(BaseModel):
    titre: str
    contenu: str
    image_url: Optional[str] = None
    image_storage_path: Optional[str] = None
    fichier_url: Optional[str] = None
    fichier_storage_path: Optional[str] = None
    fichier_nom: Optional[str] = None
    publie: bool = True
    epingle: bool = False
    centre_id: Optional[str] = None


class ActualiteUpdate(BaseModel):
    titre: Optional[str] = None
    contenu: Optional[str] = None
    image_url: Optional[str] = None
    image_storage_path: Optional[str] = None
    fichier_url: Optional[str] = None
    fichier_storage_path: Optional[str] = None
    fichier_nom: Optional[str] = None
    publie: Optional[bool] = None
    epingle: Optional[bool] = None


class PermissionDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    peut_upload: bool = False
    peut_voir_tous: bool = False
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    centre_id: Optional[str] = None


class PermissionDocumentCreate(BaseModel):
    user_id: str
    peut_upload: bool = False
    peut_voir_tous: bool = False
    centre_id: Optional[str] = None


class QuotaEmploye(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    annee: int
    cp_total: int = 25
    cp_pris: int = 0
    rtt_total: int = 10
    rtt_pris: int = 0
    centre_id: Optional[str] = None


class QuotaEmployeCreate(BaseModel):
    user_id: str
    annee: int
    cp_total: int = 25
    rtt_total: int = 10
    centre_id: Optional[str] = None


class NoteGenerale(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contenu: str
    auteur_id: str
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    date_modification: Optional[datetime] = None
    centre_id: Optional[str] = None
