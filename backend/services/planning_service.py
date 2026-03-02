"""Service de gestion du planning"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import uuid

from database import db
from config import ROLES


async def handle_assistant_slots_for_leave(user_id: str, date_debut: str, date_fin: str, creneau: str, approve: bool):
    """
    Gère les créneaux des assistants quand un congé est approuvé/refusé.
    Si approuvé: supprime les créneaux de l'assistant pendant le congé.
    """
    if not approve:
        return

    # Récupérer l'utilisateur
    user = await db.users.find_one({"id": user_id})
    if not user:
        return

    # Ne traiter que les assistants et secrétaires
    if user.get("role") not in [ROLES["ASSISTANT"], ROLES["SECRETAIRE"]]:
        return

    # Construire la requête pour supprimer les créneaux
    query = {
        "employe_id": user_id,
        "date": {"$gte": date_debut, "$lte": date_fin}
    }

    # Si créneau spécifique (pas journée complète)
    if creneau in ["MATIN", "APRES_MIDI"]:
        query["creneau"] = creneau

    # Supprimer les créneaux
    result = await db.planning.delete_many(query)
    print(f"📅 [CONGE] {result.deleted_count} créneaux supprimés pour {user.get('prenom')} {user.get('nom')} ({date_debut} - {date_fin})")


async def get_planning_for_date(date: str, centre_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Récupère le planning pour une date donnée"""
    query = {"date": date}
    if centre_id:
        query["centre_id"] = centre_id

    planning = await db.planning.find(query).to_list(1000)

    # Enrichir avec les informations des employés
    enriched = []
    for slot in planning:
        if '_id' in slot:
            del slot['_id']

        # Ajouter les infos de l'employé
        user = await db.users.find_one({"id": slot.get("employe_id")})
        if user:
            slot["employe_nom"] = f"{user.get('prenom', '')} {user.get('nom', '')}"
            slot["employe_role"] = user.get("role")
            slot["employe_couleur"] = user.get("couleur")

        enriched.append(slot)

    return enriched


async def create_planning_slot(
    employe_id: str,
    date: str,
    creneau: str,
    salle_id: Optional[str] = None,
    salle_nom: Optional[str] = None,
    medecin_id: Optional[str] = None,
    medecin_nom: Optional[str] = None,
    centre_id: Optional[str] = None,
    cree_par: Optional[str] = None
) -> Dict[str, Any]:
    """Crée un nouveau créneau de planning"""
    slot = {
        "id": str(uuid.uuid4()),
        "employe_id": employe_id,
        "date": date,
        "creneau": creneau,
        "salle_id": salle_id,
        "salle_nom": salle_nom,
        "medecin_id": medecin_id,
        "medecin_nom": medecin_nom,
        "centre_id": centre_id,
        "est_repos": False,
        "date_creation": datetime.now(timezone.utc),
        "cree_par": cree_par
    }

    await db.planning.insert_one(slot)
    return slot


async def delete_planning_slots(employe_id: str, date: str, creneau: Optional[str] = None) -> int:
    """Supprime les créneaux de planning pour un employé"""
    query = {
        "employe_id": employe_id,
        "date": date
    }
    if creneau:
        query["creneau"] = creneau

    result = await db.planning.delete_many(query)
    return result.deleted_count


async def check_slot_conflict(employe_id: str, date: str, creneau: str, exclude_id: Optional[str] = None) -> bool:
    """Vérifie s'il y a un conflit de créneau"""
    query = {
        "employe_id": employe_id,
        "date": date,
        "creneau": creneau
    }
    if exclude_id:
        query["id"] = {"$ne": exclude_id}

    existing = await db.planning.find_one(query)
    return existing is not None


async def check_room_conflict(salle_id: str, date: str, creneau: str, exclude_id: Optional[str] = None) -> bool:
    """Vérifie s'il y a un conflit de salle"""
    query = {
        "salle_id": salle_id,
        "date": date,
        "creneau": creneau
    }
    if exclude_id:
        query["id"] = {"$ne": exclude_id}

    existing = await db.planning.find_one(query)
    return existing is not None
