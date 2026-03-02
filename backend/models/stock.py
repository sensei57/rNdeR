"""Modèles liés aux stocks"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid


class CategorieStock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom: str
    description: Optional[str] = None
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    centre_id: Optional[str] = None


class CategorieStockCreate(BaseModel):
    nom: str
    description: Optional[str] = None
    centre_id: Optional[str] = None


class ArticleStock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom: str
    categorie_id: str
    quantite_actuelle: int = 0
    quantite_minimale: int = 0
    quantite_optimale: int = 0
    unite: str = "unité"
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    derniere_modification: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    centre_id: Optional[str] = None


class ArticleStockCreate(BaseModel):
    nom: str
    categorie_id: str
    quantite_actuelle: int = 0
    quantite_minimale: int = 0
    quantite_optimale: int = 0
    unite: str = "unité"
    centre_id: Optional[str] = None


class ArticleStockUpdate(BaseModel):
    nom: Optional[str] = None
    categorie_id: Optional[str] = None
    quantite_actuelle: Optional[int] = None
    quantite_minimale: Optional[int] = None
    quantite_optimale: Optional[int] = None
    unite: Optional[str] = None


class PermissionStock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    peut_voir: bool = True
    peut_modifier: bool = False
    date_creation: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    centre_id: Optional[str] = None


class PermissionStockCreate(BaseModel):
    user_id: str
    peut_voir: bool = True
    peut_modifier: bool = False
    centre_id: Optional[str] = None
