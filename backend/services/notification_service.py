"""Service de gestion des notifications"""
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, List

from database import db
from config import ROLES


async def send_notification_to_user(user_id: str, title: str, body: str, data: Optional[Dict] = None):
    """Envoie une notification à un utilisateur spécifique (in-app + push)"""
    try:
        # 1. Préparer la notification
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": title,
            "body": body,
            "data": data or {},
            "sent_at": datetime.now(timezone.utc),
            "read": False,
            "push_status": "pending"
        }

        # 2. Envoyer notification push si l'utilisateur a un token FCM
        push_sent = False
        user = await db.users.find_one({"id": user_id}, {"fcm_token": 1, "fcm_devices": 1, "device_info": 1})

        # Récupérer tous les tokens FCM de l'utilisateur
        fcm_tokens = []

        if user:
            # Nouveau format: tableau de devices
            if user.get("fcm_devices"):
                for device in user["fcm_devices"]:
                    token = device.get("fcm_token")
                    if token and not token.startswith("local_"):
                        fcm_tokens.append(token)

            # Ancien format: un seul token
            elif user.get("fcm_token") and not user["fcm_token"].startswith("local_"):
                fcm_tokens.append(user["fcm_token"])

        if fcm_tokens:
            try:
                from push_notifications import send_push_notification

                # Envoyer à tous les appareils de l'utilisateur
                for fcm_token in fcm_tokens:
                    print(f"📱 [PUSH] Tentative d'envoi à token: {fcm_token[:40]}...")
                    push_result = await send_push_notification(
                        fcm_token=fcm_token,
                        title=title,
                        body=body,
                        data=data or {}
                    )
                    if push_result:
                        push_sent = True
                        print(f"✅ [PUSH] Notification envoyée avec succès à {user_id}")

                if push_sent:
                    notification["push_status"] = "sent"
                    notification["push_sent_at"] = datetime.now(timezone.utc)
                else:
                    notification["push_status"] = "failed"
                    notification["push_error"] = "Tous les envois ont échoué"
                    print(f"⚠️ [PUSH] Tous les envois ont échoué pour {user_id}")

            except Exception as push_error:
                notification["push_status"] = "failed"
                notification["push_error"] = str(push_error)
                print(f"❌ [PUSH] Erreur pour {user_id}: {push_error}")
        else:
            notification["push_status"] = "no_token"
            print(f"⚠️ [PUSH] Aucun token FCM valide pour {user_id}")

        # 3. Sauvegarder en base pour la notification in-app
        await db.notifications.insert_one(notification)
        print(f"📤 Notification in-app enregistrée pour {user_id}: {title} (push_status: {notification['push_status']})")

        return push_sent

    except Exception as e:
        print(f"❌ Erreur notification: {e}")
        return False


async def notify_director_new_request(type_request: str, user_name: str, details: str):
    """Notifie le directeur d'une nouvelle demande"""
    director = await db.users.find_one({"role": ROLES["DIRECTEUR"], "actif": True})
    if director:
        title = f"🆕 Nouvelle {type_request}"
        body = f"{user_name} a fait une {type_request.lower()}: {details}"
        await send_notification_to_user(
            director["id"],
            title,
            body,
            {"type": f"new_{type_request.lower().replace(' ', '_')}"}
        )


async def notify_user_request_status(user_id: str, type_request: str, status: str, details: str):
    """Notifie un utilisateur du statut de sa demande"""
    emoji = "✅" if status == "APPROUVE" else "❌"
    title = f"{emoji} {type_request} {status.lower()}"
    body = details
    await send_notification_to_user(
        user_id,
        title,
        body,
        {"type": f"{type_request.lower().replace(' ', '_')}_status", "status": status}
    )


async def notify_colleagues_about_leave(user_name: str, date_debut: str, date_fin: str, creneau: str, user_id: str):
    """Notifie les collègues d'un congé approuvé"""
    # Trouver les créneaux de planning pendant les dates de congé
    planning_slots = await db.planning.find({
        "date": {"$gte": date_debut, "$lte": date_fin},
        "employe_id": {"$ne": user_id}
    }).to_list(1000)

    # Grouper par employé
    employees_to_notify = set()
    for slot in planning_slots:
        employees_to_notify.add(slot["employe_id"])

    # Envoyer les notifications
    for emp_id in employees_to_notify:
        creneau_text = "matin" if creneau == "MATIN" else ("après-midi" if creneau == "APRES_MIDI" else "la journée")
        await send_notification_to_user(
            emp_id,
            f"🏖️ Absence d'un collègue",
            f"{user_name} sera absent(e) du {date_debut} au {date_fin} ({creneau_text})",
            {"type": "colleague_leave", "user_id": user_id}
        )


async def send_daily_planning_notifications():
    """Envoie les notifications de planning quotidien à tous les employés"""
    from push_notifications import send_push_notification

    try:
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        print(f"🔔 [DAILY] Envoi des notifications de planning pour {today}")

        # Récupérer tous les créneaux du jour
        planning_slots = await db.planning.find({"date": today, "est_repos": {"$ne": True}}).to_list(1000)

        # Grouper par employé
        employees_planning = {}
        for slot in planning_slots:
            emp_id = slot.get("employe_id")
            if emp_id not in employees_planning:
                employees_planning[emp_id] = []
            employees_planning[emp_id].append(slot)

        notifications_sent = 0

        for emp_id, emp_slots in employees_planning.items():
            user = await db.users.find_one({"id": emp_id, "actif": True})
            if not user:
                continue

            # Construire le message
            message = await build_daily_planning_message(user, emp_slots, today)

            # Envoyer la notification
            fcm_token = user.get("fcm_token")
            fcm_devices = user.get("fcm_devices", [])

            if fcm_token:
                await send_push_notification(fcm_token, "📅 Votre planning du jour", message, {"type": "daily_planning"})
                notifications_sent += 1

            for device in fcm_devices:
                if device.get("token"):
                    await send_push_notification(device["token"], "📅 Votre planning du jour", message, {"type": "daily_planning"})
                    notifications_sent += 1

            # Sauvegarder aussi en in-app
            await send_notification_to_user(
                emp_id,
                "📅 Votre planning du jour",
                message,
                {"type": "daily_planning", "date": today}
            )

        print(f"✅ [DAILY] {notifications_sent} notifications envoyées à {len(employees_planning)} employés")

    except Exception as e:
        print(f"❌ [DAILY] Erreur: {e}")


async def build_daily_planning_message(user, planning_slots, date: str) -> str:
    """Construit le message de planning quotidien pour un utilisateur"""
    lines = []

    for slot in planning_slots:
        creneau = "Matin" if slot.get("creneau") == "MATIN" else "Après-midi"
        salle = slot.get("salle_nom") or slot.get("salle_id") or "Non assignée"

        # Si c'est un assistant, afficher le médecin
        if user.get("role") == ROLES["ASSISTANT"] and slot.get("medecin_nom"):
            lines.append(f"{creneau}: Salle {salle} avec Dr. {slot['medecin_nom']}")
        else:
            lines.append(f"{creneau}: Salle {salle}")

    if not lines:
        return "Pas de créneau prévu aujourd'hui"

    return "\n".join(lines)
