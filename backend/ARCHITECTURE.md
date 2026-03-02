# Architecture du Backend

Ce document décrit la nouvelle architecture modulaire du backend.

## Structure des dossiers

```
/app/backend/
├── server.py           # Point d'entrée principal (routes API)
├── config.py           # Configuration et constantes
├── database.py         # Connexion MongoDB (lazy loading)
├── auth.py             # Authentification JWT
├── push_notifications.py # Notifications Firebase
├── requirements.txt    # Dépendances Python
├── models/             # Modèles Pydantic
│   ├── __init__.py     # Exports centralisés
│   ├── user.py         # User, UserCreate, Token, etc.
│   ├── centre.py       # Centre, Inscription
│   ├── planning.py     # CreneauPlanning, SemaineType, DemandeJourTravail
│   ├── conges.py       # DemandeConge
│   ├── salle.py        # Salle, ConfigurationCabinet
│   ├── message.py      # Message, GroupeChat
│   ├── notification.py # NotificationSubscription
│   ├── stock.py        # ArticleStock, CategorieStock
│   └── document.py     # DocumentPersonnel, Actualite
├── services/           # Logique métier
│   ├── __init__.py     # Exports centralisés
│   ├── notification_service.py  # Envoi notifications
│   ├── planning_service.py      # Gestion planning
│   └── scheduler_service.py     # Tâches planifiées
└── routes/             # Documentation des routes
    └── __init__.py     # Index des endpoints
```

## Modules

### config.py
Contient toutes les constantes et la configuration:
- Variables d'environnement (MONGO_URL, SECRET_KEY, etc.)
- Rôles utilisateur (ROLES)
- Configuration des salles
- Rubriques disponibles

### database.py
Gestion de la connexion MongoDB avec lazy loading:
- `get_db()` - Obtenir l'instance de la base
- `LazyDB` - Proxy pour accès lazy
- `ensure_mongo_connected()` - Vérifier la connexion

### auth.py
Authentification JWT:
- `verify_password()` - Vérifier mot de passe
- `get_password_hash()` - Hasher mot de passe
- `create_access_token()` - Créer token JWT
- `get_current_user()` - Dépendance FastAPI
- `require_role()` - Décorateur de vérification de rôle

### services/notification_service.py
Gestion des notifications:
- `send_notification_to_user()` - Envoyer notification (in-app + push)
- `notify_director_new_request()` - Notifier le directeur
- `notify_user_request_status()` - Notifier statut demande
- `notify_colleagues_about_leave()` - Notifier collègues (congés)

### services/planning_service.py
Gestion du planning:
- `get_planning_for_date()` - Récupérer planning d'une date
- `create_planning_slot()` - Créer un créneau
- `check_slot_conflict()` - Vérifier conflit de créneau
- `check_room_conflict()` - Vérifier conflit de salle

### services/scheduler_service.py
Tâches planifiées:
- `get_scheduler()` - Obtenir l'instance du scheduler
- `setup_scheduled_jobs()` - Configurer les jobs
- `send_morning_planning_notifications()` - Notifications du matin

## Utilisation

### Importer les modèles
```python
from models import User, UserCreate, DemandeConge
from models.planning import CreneauPlanning
```

### Importer les services
```python
from services import send_notification_to_user
from services.planning_service import get_planning_for_date
```

### Importer la configuration
```python
from config import ROLES, SECRET_KEY
from database import db
from auth import get_current_user, require_role
```

## Notes de migration

Le fichier `server.py` reste le point d'entrée principal car FastAPI
fonctionne mieux avec un routeur unique. Les modèles et services
ont été extraits pour faciliter la maintenance et les tests.

Pour ajouter de nouvelles fonctionnalités:
1. Ajouter le modèle dans `models/`
2. Ajouter la logique métier dans `services/`
3. Ajouter les endpoints dans `server.py`
