"""Gestion de la connexion MongoDB avec lazy loading"""
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import HTTPException
from datetime import datetime, timezone

from config import MONGO_URL, DB_NAME

# État de connexion lazy
_mongo_client = None
_db = None
_mongo_connected = False
_startup_time = datetime.now(timezone.utc)


def get_mongo_client():
    """Lazy initialization du client MongoDB"""
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(
            MONGO_URL,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=10000
        )
    return _mongo_client


def get_db():
    """Lazy initialization de la base de données"""
    global _db
    if _db is None:
        _db = get_mongo_client()[DB_NAME]
    return _db


class LazyDB:
    """Proxy lazy pour la base de données MongoDB"""
    def __getattr__(self, name):
        return getattr(get_db(), name)

    def __getitem__(self, name):
        return get_db()[name]


db = LazyDB()


async def ensure_mongo_connected():
    """Vérifie et établit la connexion MongoDB si nécessaire"""
    global _mongo_connected
    if not _mongo_connected:
        try:
            await get_mongo_client().admin.command('ping')
            _mongo_connected = True
            print("✅ MongoDB connecté (lazy)")
        except Exception as e:
            print(f"⚠️ MongoDB non disponible: {e}")
            raise HTTPException(status_code=503, detail="Base de données temporairement indisponible")


def get_startup_time():
    """Retourne le temps de démarrage"""
    return _startup_time


def is_mongo_connected():
    """Vérifie si MongoDB est connecté"""
    return _mongo_connected
