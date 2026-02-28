# Architecture Technique - OphtaGestion

## Vue d'ensemble

OphtaGestion est une application full-stack React/FastAPI/MongoDB pour la gestion de cabinets médicaux multi-centres.

## Stack Technologique

### Frontend
- **React 18** avec hooks
- **Tailwind CSS** pour le styling
- **Shadcn/UI** composants (dans `/components/ui/`)
- **Lucide React** pour les icônes
- **Sonner** pour les toasts/notifications
- **Axios** pour les appels API

### Backend
- **FastAPI** framework Python
- **Motor** driver MongoDB async
- **Pydantic** validation des données
- **APScheduler** tâches planifiées (cron)
- **Firebase Admin** notifications push

### Base de données
- **MongoDB** base NoSQL
- Collections principales : `users`, `centres`, `planning`, `conges`, `messages`, `stocks`

---

## Structure des fichiers

```
/app/
├── backend/
│   ├── server.py           # API FastAPI (~6600 lignes)
│   ├── requirements.txt    # Dépendances Python
│   └── .env               # Variables d'environnement
│
├── frontend/
│   ├── public/
│   │   ├── firebase-messaging-sw.js  # Service Worker notifications
│   │   ├── manifest.json             # PWA manifest
│   │   └── index.html
│   │
│   ├── src/
│   │   ├── App.js              # Composant principal (~20800 lignes)
│   │   ├── App.css             # Styles globaux
│   │   ├── exports.js          # Index centralisé des exports
│   │   │
│   │   ├── components/
│   │   │   ├── ui/             # Shadcn/UI (button, card, dialog, etc.)
│   │   │   ├── common/         # Composants réutilisables
│   │   │   │   ├── PhotoWithFallback.jsx
│   │   │   │   ├── ProtectedRoute.jsx
│   │   │   │   ├── LoadingSpinner.jsx
│   │   │   │   └── Skeletons.jsx
│   │   │   ├── conges/
│   │   │   │   └── CongeManager.jsx
│   │   │   ├── chat/
│   │   │   │   └── ChatManager.jsx
│   │   │   └── dashboard/
│   │   │       └── ActualitesManager.jsx
│   │   │
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx     # Authentification
│   │   │   └── PlanningContext.jsx # État du planning
│   │   │
│   │   ├── hooks/
│   │   │   └── useOptimized.js     # Hooks de performance
│   │   │
│   │   ├── pages/
│   │   │   └── LoginPage.jsx
│   │   │
│   │   └── utils/
│   │       ├── api.js              # Configuration axios
│   │       └── helpers.js          # Fonctions utilitaires
│   │
│   └── package.json
│
└── memory/
    └── PRD.md                      # Documentation produit
```

---

## Composants principaux (dans App.js)

| Composant | Lignes | Description |
|-----------|--------|-------------|
| `AuthProvider` | 606-790 | Contexte d'authentification |
| `PushNotificationManager` | 1353-2173 | Gestion notifications push |
| `ActualitesManager` | 2174-2663 | Affichage actualités |
| `PersonnelManager` | 2664-3158 | Gestion du personnel |
| `CongeManager` | 3159-3719 | Gestion des congés |
| `SallesManager` | 3720-4669 | Gestion des salles |
| `PlanningManager` | 4670-14049 | Planning interactif (~9400 lignes) |
| `DemandesTravailManager` | 14050-16310 | Demandes de créneaux |
| `AdminManager` | 16489-17398 | Administration |
| `CentresManager` | 17399-18160 | Multi-centres |
| `StocksManager` | 18161-18885 | Gestion stocks |
| `CoffreFortManager` | 18886-19131 | Documents |
| `ChatManager` | 19699-20122 | Messagerie |
| `MonProfilManager` | 20123-20520 | Profil utilisateur |

---

## API Endpoints

### Authentification
```
POST /api/auth/login          # Connexion
GET  /api/users/me            # Utilisateur courant
POST /api/inscriptions        # Demande d'inscription
```

### Centres
```
GET  /api/centres/public      # Liste publique
GET  /api/centres             # Liste (auth)
POST /api/centres             # Créer centre
POST /api/centres/{id}/switch # Changer centre actif
```

### Planning
```
GET  /api/planning/{date}           # Planning jour
GET  /api/planning/semaine/{date}   # Planning semaine
GET  /api/planning/mois/{mois}      # Planning mois
POST /api/planning                  # Créer créneau
PUT  /api/planning/{id}             # Modifier créneau
DELETE /api/planning/{id}           # Supprimer créneau
```

### Congés
```
GET  /api/conges                    # Liste congés
POST /api/conges                    # Nouvelle demande
PUT  /api/conges/{id}/approuver     # Approuver/Refuser
PUT  /api/conges/{id}/annuler       # Annuler
```

### Messages
```
GET  /api/messages                  # Liste messages
POST /api/messages                  # Envoyer message
GET  /api/messages/conversation/{id}# Conversation privée
GET  /api/groupes-chat              # Liste groupes
POST /api/groupes-chat              # Créer groupe
```

### Notifications
```
POST /api/notifications/test        # Notification test
POST /api/notifications/quick-reply # Réponse rapide
GET  /api/notifications/employees   # Employés pour notif
```

### Stocks
```
GET  /api/stocks/categories         # Catégories
POST /api/stocks/categories         # Créer catégorie
GET  /api/stocks/articles           # Articles
POST /api/stocks/articles           # Créer article
PUT  /api/stocks/articles/{id}      # Modifier article
DELETE /api/stocks/articles/{id}    # Supprimer article
```

---

## Schéma de données

### Users
```javascript
{
  id: String,
  email: String,
  nom: String,
  prenom: String,
  role: "Super-Admin" | "Directeur" | "Médecin" | "Assistant" | "Secrétaire",
  centre_ids: [ObjectId],      // Centres assignés
  centre_actif_id: ObjectId,   // Centre actif
  actif: Boolean,
  heures_supplementaires: Number,
  photo_url: String
}
```

### Centres
```javascript
{
  id: String,
  nom: String,
  visible_sections: [String],
  manager_permissions: {
    can_edit_planning: Boolean,
    can_manage_conges: Boolean
  }
}
```

### Planning (créneaux)
```javascript
{
  id: String,
  employe_id: String,
  date: String,              // YYYY-MM-DD
  creneau: "MATIN" | "APRES_MIDI",
  salle_id: String,
  centre_id: ObjectId
}
```

### Congés
```javascript
{
  id: String,
  utilisateur_id: String,
  date_debut: String,
  date_fin: String,
  type_conge: String,
  statut: "EN_ATTENTE" | "APPROUVE" | "REJETE" | "ANNULE",
  motif: String,
  centre_id: ObjectId
}
```

---

## Optimisations de performance

### Polling intelligent
Les polling intervals sont optimisés et s'arrêtent quand l'onglet est en arrière-plan :

```javascript
// Dans useOptimized.js
const interval = setInterval(() => {
  if (document.visibilityState === 'visible') {
    callback();
  }
}, intervalMs);
```

### Intervalles configurés
- Actualités : 60s
- Messages : 10s
- Notifications : 45s
- Messages non lus : 15s

### CSS Transitions
Variables CSS pour transitions fluides :
- `--transition-fast`: 150ms
- `--transition-normal`: 200ms
- `--transition-spring`: ease-out curves

---

## Service Worker

Le fichier `firebase-messaging-sw.js` gère :
1. Réception notifications push en arrière-plan
2. Affichage notifications avec actions
3. Réponses rapides via IndexedDB
4. Navigation vers l'app au clic

---

## Variables d'environnement

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://...
REACT_APP_VAPID_KEY=...
```

### Backend (.env)
```
MONGO_URL=mongodb://...
DB_NAME=cabinet_medical
FIREBASE_CREDENTIALS=...
```

---

## Déploiement

L'application utilise Supervisor pour gérer les processus :
- Frontend : port 3000 (hot reload)
- Backend : port 8001 (uvicorn)

Les routes `/api/*` sont automatiquement redirigées vers le backend.

---

## Maintenance

### Logs
```bash
# Frontend
tail -f /var/log/supervisor/frontend.err.log

# Backend
tail -f /var/log/supervisor/backend.err.log
```

### Redémarrage
```bash
sudo supervisorctl restart frontend
sudo supervisorctl restart backend
```

---

*Documentation technique v2.0 - Février 2026*
