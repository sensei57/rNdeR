# PRD - OphtaGestion Multi-Centres

## 1. Vue d'ensemble
Application web full-stack de gestion de cabinet médical multi-centres permettant la gestion du personnel, du planning, des congés, de la messagerie interne et des notifications.

## 2. Architecture Technique

### Stack Technologique
- **Frontend:** React 18, Tailwind CSS, Shadcn/UI, Lucide-react
- **Backend:** FastAPI, Motor (MongoDB async), Pydantic
- **Base de données:** MongoDB
- **Planification:** APScheduler pour les tâches cron

### Structure des fichiers (En cours de refactorisation)
```
frontend/src/
├── App.js                 # Fichier principal (~20750 lignes - en cours de découpage)
├── App.css                # Styles globaux
│
├── components/
│   ├── ui/                # Composants Shadcn
│   ├── common/            # ✅ Composants réutilisables (créé)
│   │   ├── PhotoWithFallback.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── LoadingSpinner.jsx
│   └── conges/            # ✅ Gestion congés (extrait)
│       └── CongeManager.jsx
│
├── contexts/              # ✅ Contextes React (créé)
│   ├── AuthContext.jsx
│   └── PlanningContext.jsx
│
├── pages/                 # ✅ Pages (créé)
│   └── LoginPage.jsx
│
└── utils/                 # ✅ Utilitaires (créé)
    ├── api.js
    └── helpers.js
```

## 3. Fonctionnalités Implémentées

### 3.1 Architecture Multi-Centres ✅
- Système de rôles : Super-Admin > Manager > Employé
- Assignation d'employés à plusieurs centres
- Sélecteur de centre à la connexion et dans le header
- Cloisonnement des données par centre

### 3.2 Authentification ✅
- Login avec email/mot de passe et sélection de centre
- Système de retry automatique robuste (useRef + délais progressifs)
- Token JWT persisté dans localStorage
- Demande d'inscription pour nouveaux utilisateurs

### 3.3 Planning Interactif ✅ (Modernisé)
- **Header moderne** avec gradient cyan-vert (#0091B9 → #19CD91)
- Vue Jour avec sections Matin/Après-midi
- Vue Semaine avec calendrier 7 jours et filtres par rôle
- Vue Mois avec grille calendrier complète
- Vue Planning (directeur) pour gestion globale
- **100% responsive mobile** - toutes les vues fonctionnent

### 3.4 Gestion des Congés ✅
- Interface modernisée avec cartes de statistiques
- Filtres par statut (En attente, Approuvées, Refusées)
- Support multi-types : Congé payé, RTT, Sans solde, Maladie
- Composant extrait dans `/components/conges/CongeManager.jsx`

### 3.5 Système de Notifications ✅
- Notifications push via Firebase
- Notification matinale à 7h (APScheduler cron)
- Interface de test pour admin
- Réponses rapides (backend prêt)

### 3.6 Autres Fonctionnalités ✅
- Gestion du personnel avec fiches détaillées
- Messagerie interne (chat général, privé, groupes)
- Coffre-fort de documents
- Plan du cabinet interactif
- Gestion des salles
- Gestion des stocks

## 4. Credentials de Test
- **Email:** directeur@cabinet.fr
- **Mot de passe:** admin123

## 5. Session de travail (28/02/2026)

### Complété
- ✅ Modernisation header PlanningManager (gradient moderne + boutons intégrés)
- ✅ Correction vues Planning Semaine/Mois sur mobile
- ✅ Amélioration système retry authentification
- ✅ **Début refactorisation App.js:**
  - Structure de dossiers créée (`contexts/`, `utils/`, `components/common/`, `pages/`)
  - `AuthContext.jsx` créé
  - `PlanningContext.jsx` créé
  - `api.js` et `helpers.js` créés
  - `CongeManager.jsx` extrait (560 lignes)
  - `LoginPage.jsx` créé
  - Guide de refactorisation documenté
- ✅ Tests frontend : 100% de réussite

### Structure de refactorisation créée
Voir `/app/frontend/src/REFACTORING_GUIDE.md` pour le guide complet de migration.

## 6. Tâches Restantes

### Haute Priorité (P0)
- [ ] **Continuer refactorisation App.js:**
  - Extraire `PlanningManager` (~9400 lignes) - priorité 1
  - Extraire `PersonnelManager` (~500 lignes)
  - Extraire `ChatManager` (~420 lignes)
  - Mettre à jour App.js pour utiliser les imports

### Moyenne Priorité (P2)
- [ ] Finaliser réponses rapides notifications (Service Worker)
- [ ] Moderniser autres sections (Personnel, Messages, etc.)

### Basse Priorité (P3)
- [ ] Validation calcul heures supplémentaires
- [ ] Configuration fine permissions managers
- [ ] Remplacement confirm() par modales modernes

## 7. Problèmes Connus

### Partiellement Résolus
- **Rechargement mobile** : Système de retry amélioré avec timeouts progressifs

### En attente
- **Notifications Push** : Firebase SDK non initialisé (FIREBASE_CREDENTIALS manquant)

## 8. Endpoints API Principaux

### Authentification
- `POST /api/auth/login` - Connexion avec centre
- `GET /api/users/me` - Utilisateur courant

### Centres
- `GET /api/centres/public` - Liste publique
- `POST /api/centres/{id}/switch` - Changement centre

### Planning
- `GET /api/planning/{date}` - Planning jour
- `GET /api/planning/semaine/{date}` - Planning semaine
- `GET /api/planning/mois/{mois}` - Planning mois

### Congés
- `GET /api/conges` - Liste
- `POST /api/conges` - Nouvelle demande
- `PUT /api/conges/{id}/approuver` - Approuver/Refuser

## 9. Schéma de Base de Données

### Collection `users`
```json
{
  "username": "string",
  "email": "string",
  "password_hash": "string",
  "role": "Super-Admin|Manager|Médecin|Assistant|Secrétaire",
  "centre_ids": ["ObjectId"],
  "centre_actif_id": "ObjectId",
  "actif": true
}
```

### Collection `centres`
```json
{
  "nom": "string",
  "visible_sections": ["string"],
  "manager_permissions": {}
}
```

---
Dernière mise à jour: 28 février 2026
