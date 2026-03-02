"""Modèles liés aux utilisateurs"""
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


class ManagerPermissions(BaseModel):
    """Permissions détaillées pour les managers"""
    rubriques_visibles: List[str] = ["dashboard", "planning", "conges", "personnel", "chat", "cabinet"]
    peut_modifier_planning: bool = True
    peut_approuver_conges: bool = True
    peut_gerer_personnel: bool = False
    peut_voir_statistiques: bool = True
    peut_envoyer_notifications: bool = True
    peut_gerer_salles: bool = False
    peut_gerer_stocks: bool = False


class EmployeeVisibility(BaseModel):
    """Définit ce qu'un employé peut voir"""
    peut_voir_tous_employes: bool = True
    peut_voir_planning_complet: bool = False
    employes_visibles: Optional[List[str]] = None


class UserBase(BaseModel):
    email: EmailStr
    nom: str
    prenom: str
    role: str
    centre_ids: Optional[List[str]] = []
    centre_id: Optional[str] = None
    centre_actif_id: Optional[str] = None
    centre_favori_id: Optional[str] = None
    telephone: Optional[str] = None
    date_naissance: Optional[str] = None
    photo_url: Optional[str] = None
    photo_storage_path: Optional[str] = None
    actif: bool = True
    couleur: Optional[str] = None
    horaires_personnalises: Optional[Dict[str, Any]] = None
    jours_travail: Optional[List[str]] = None
    is_protected: bool = False
    vue_planning_complete: bool = False
    peut_modifier_planning: bool = False
    manager_permissions: Optional[ManagerPermissions] = None
    visibility_config: Optional[EmployeeVisibility] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    nom: Optional[str] = None
    prenom: Optional[str] = None
    role: Optional[str] = None
    telephone: Optional[str] = None
    date_naissance: Optional[str] = None
    photo_url: Optional[str] = None
    actif: Optional[bool] = None
    couleur: Optional[str] = None
    horaires_personnalises: Optional[Dict[str, Any]] = None
    jours_travail: Optional[List[str]] = None
    fcm_token: Optional[str] = None
    centre_ids: Optional[List[str]] = None
    centre_id: Optional[str] = None
    centre_actif_id: Optional[str] = None
    centre_favori_id: Optional[str] = None
    vue_planning_complete: Optional[bool] = None
    peut_modifier_planning: Optional[bool] = None
    manager_permissions: Optional[ManagerPermissions] = None
    visibility_config: Optional[EmployeeVisibility] = None


class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: User
