"""Modèles liés aux messages et chat"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import uuid


class GroupeChat(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom: str
    description: Optional[str] = None
    membres: List[str] = []
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cree_par: str
    centre_id: Optional[str] = None


class GroupeChatCreate(BaseModel):
    nom: str
    description: Optional[str] = None
    membres: List[str] = []
    centre_id: Optional[str] = None


class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    expediteur_id: str
    destinataire_id: Optional[str] = None
    groupe_id: Optional[str] = None
    contenu: str
    type_message: str = "GENERAL"
    date_envoi: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    lu: bool = False


class MessageCreate(BaseModel):
    destinataire_id: Optional[str] = None
    groupe_id: Optional[str] = None
    contenu: str
    type_message: str = "GENERAL"
