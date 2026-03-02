"""Service de gestion des tâches planifiées (scheduler)"""
from datetime import datetime, timezone

# Scheduler - import lazy pour éviter de ralentir le démarrage
_scheduler = None
_AsyncIOScheduler = None
_CronTrigger = None


def get_scheduler():
    """Lazy load du scheduler"""
    global _scheduler, _AsyncIOScheduler, _CronTrigger
    if _scheduler is None:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
        _AsyncIOScheduler = AsyncIOScheduler
        _CronTrigger = CronTrigger
        _scheduler = AsyncIOScheduler(timezone="Europe/Paris")
    return _scheduler


def get_cron_trigger():
    """Récupère le CronTrigger (charge le scheduler si nécessaire)"""
    global _CronTrigger
    if _CronTrigger is None:
        get_scheduler()  # Charge le module
    return _CronTrigger


async def send_morning_planning_notifications():
    """Envoie les notifications de planning à 7h du matin"""
    from push_notifications import send_push_notification
    from database import db

    try:
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        print(f"🔔 [CRON 7h] Envoi des notifications de planning pour {today}")

        # Récupérer tous les créneaux du jour
        creneaux = await db.planning.find({"date": today, "est_repos": {"$ne": True}}).to_list(1000)

        # Grouper par employé
        employees_planning = {}
        for creneau in creneaux:
            emp_id = creneau.get("employe_id")
            if emp_id not in employees_planning:
                employees_planning[emp_id] = []
            employees_planning[emp_id].append(creneau)

        notifications_sent = 0

        for emp_id, emp_creneaux in employees_planning.items():
            # Récupérer l'utilisateur
            user = await db.users.find_one({"id": emp_id, "actif": True})
            if not user:
                continue

            # Construire le message
            creneaux_text = []
            for c in emp_creneaux:
                salle = c.get("salle_nom") or c.get("salle_id") or "Non assigné"
                creneau_type = "Matin" if c.get("creneau") == "MATIN" else "Après-midi"
                creneaux_text.append(f"{creneau_type}: Salle {salle}")

            # Récupérer le centre
            centre_id = user.get("centre_id") or (user.get("centre_ids", [None])[0])
            centre = await db.centres.find_one({"id": centre_id}) if centre_id else None
            centre_nom = centre.get("nom", "") if centre else ""

            message = f"Votre planning du jour:\n" + "\n".join(creneaux_text)
            if centre_nom:
                message = f"📍 {centre_nom}\n" + message

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

        print(f"✅ [CRON 7h] {notifications_sent} notifications envoyées à {len(employees_planning)} employés")

    except Exception as e:
        print(f"❌ [CRON 7h] Erreur: {e}")


def setup_scheduled_jobs():
    """Configure les jobs planifiés"""
    scheduler = get_scheduler()
    CronTrigger = get_cron_trigger()

    # Notification de planning quotidien à 7h00
    scheduler.add_job(
        send_morning_planning_notifications,
        CronTrigger(hour=7, minute=0, timezone="Europe/Paris"),
        id="daily_planning_notification",
        replace_existing=True
    )

    print("✅ [SCHEDULER] Jobs planifiés configurés")
    return scheduler


def start_scheduler():
    """Démarre le scheduler"""
    scheduler = setup_scheduled_jobs()
    if not scheduler.running:
        scheduler.start()
        print("✅ [SCHEDULER] Démarré")
    return scheduler


def stop_scheduler():
    """Arrête le scheduler"""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        print("🛑 [SCHEDULER] Arrêté")
