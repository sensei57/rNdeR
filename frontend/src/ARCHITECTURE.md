# Architecture du Frontend

Ce document décrit la structure modulaire du frontend React.

## Structure des dossiers

```
/app/frontend/src/
├── App.js                  # Composant principal (routes)
├── App.css                 # Styles globaux
├── index.js                # Point d'entrée
├── contexts/               # Contextes React
│   ├── AuthContext.jsx     # Authentification
│   └── PlanningContext.jsx # État du planning
├── components/             # Composants réutilisables
│   ├── ui/                 # Composants UI de base (shadcn/ui)
│   ├── common/             # Composants partagés
│   │   ├── PhotoWithFallback.jsx    ✅ EXTRAIT
│   │   ├── LoadingSpinner.jsx       ✅ EXTRAIT
│   │   └── Skeletons.jsx            ✅ EXTRAIT
│   ├── auth/               # Authentification
│   │   ├── LoginPage.jsx            ✅ EXTRAIT (225 lignes)
│   │   └── InscriptionPage.jsx      ✅ EXTRAIT (187 lignes)
│   ├── layout/             # Layout
│   │   └── Navigation.jsx           ✅ EXTRAIT (281 lignes)
│   ├── planning/           # Planning
│   │   ├── PlanningManager.jsx      ✅ EXTRAIT (9354 lignes)
│   │   ├── PlanningHeader.jsx       ✅ EXTRAIT
│   │   └── PlanningFilters.jsx      ✅ EXTRAIT
│   ├── personnel/          # Gestion du personnel
│   │   └── PersonnelCards.jsx       ✅ EXTRAIT (247 lignes)
│   ├── conges/             # Gestion des congés
│   │   └── CongeManager.jsx         ✅ EXTRAIT (527 lignes)
│   ├── chat/               # Messagerie
│   │   └── ChatManager.jsx          ✅ EXTRAIT (435 lignes)
│   ├── dashboard/          # Tableau de bord
│   │   └── ActualitesManager.jsx    ✅ EXTRAIT (1098 lignes)
│   └── notifications/      # Notifications
│       └── NotificationBadge.jsx    ✅ EXTRAIT (48 lignes)
├── hooks/                  # Hooks personnalisés
│   └── usePWA.js           # Installation PWA
├── utils/                  # Utilitaires
│   ├── api.js              ✅ CRÉÉ (43 lignes)
│   ├── helpers.js          ✅ CRÉÉ (96 lignes)
│   └── constants.js        ✅ CRÉÉ (59 lignes)
└── firebase.js             # Configuration Firebase
```

## Composants extraits (Résumé)

| Composant | Lignes | Status |
|-----------|--------|--------|
| LoginPage | 225 | ✅ Extrait |
| InscriptionPage | 187 | ✅ Extrait |
| Navigation | 281 | ✅ Extrait |
| PlanningManager | 9354 | ✅ Extrait |
| PersonnelCards | 247 | ✅ Extrait |
| CongeManager | 527 | ✅ Extrait |
| ChatManager | 435 | ✅ Extrait |
| ActualitesManager | 1098 | ✅ Extrait |
| NotificationBadge | 48 | ✅ Extrait |

## Utilitaires créés

### /utils/api.js
- `BACKEND_URL` - URL du backend
- `API` - URL de l'API
- Configuration axios avec retry

### /utils/helpers.js
- `getPhotoUrl()` - URL complète d'une photo
- `sortEmployeesByRoleThenName()` - Tri des employés
- `filterEmployeesBySearch()` - Filtrage par recherche
- `formatDate()` - Formatage de date
- `formatUserName()` - Formatage de nom
- `ROLES` - Constantes des rôles

### /utils/constants.js
- `ROLES` - Rôles utilisateur
- `CRENEAU_TYPES` - Types de créneaux
- `STATUTS` - Statuts de demande
- `TYPES_CONGES` - Types de congés
- `ROLE_COLORS` - Couleurs par rôle
- `JOURS_SEMAINE` - Jours de la semaine

## Notes importantes

- Le fichier `App.js` contient encore certains composants (pour compatibilité)
- Les composants extraits peuvent être importés directement
- Utiliser les imports depuis les fichiers index.js

## Utilisation

```javascript
// Import des composants
import LoginPage from './components/auth/LoginPage';
import { Navigation } from './components/layout';
import { NotificationBadge } from './components/notifications';

// Import des utilitaires
import { BACKEND_URL, API } from './utils/api';
import { getPhotoUrl, formatDate } from './utils/helpers';
import { ROLES, STATUTS } from './utils/constants';
```
