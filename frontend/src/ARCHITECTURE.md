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
│   │   ├── PhotoWithFallback.jsx
│   │   ├── LoadingSpinner.jsx
│   │   └── Skeletons.jsx
│   ├── auth/               # Authentification
│   │   ├── LoginPage.jsx
│   │   └── InscriptionPage.jsx
│   ├── planning/           # Planning
│   │   ├── PlanningManager.jsx
│   │   ├── PlanningHeader.jsx
│   │   └── PlanningFilters.jsx
│   ├── personnel/          # Gestion du personnel
│   │   ├── PersonnelCards.jsx
│   │   └── PersonnelManager.jsx
│   ├── conges/             # Gestion des congés
│   │   └── CongeManager.jsx
│   ├── demandes/           # Demandes de travail
│   │   └── DemandesTravailManager.jsx
│   ├── salles/             # Gestion des salles
│   │   ├── SallesManager.jsx
│   │   └── PlanCabinetManager.jsx
│   ├── chat/               # Messagerie
│   │   └── ChatManager.jsx
│   ├── notifications/      # Notifications
│   │   ├── PushNotificationManager.jsx
│   │   ├── NotificationBadge.jsx
│   │   └── DevicesList.jsx
│   ├── admin/              # Administration
│   │   ├── AdminManager.jsx
│   │   ├── CentresManager.jsx
│   │   └── AttributionManager.jsx
│   ├── stocks/             # Gestion des stocks
│   │   └── StocksManager.jsx
│   ├── documents/          # Documents
│   │   └── CoffreFortManager.jsx
│   ├── profile/            # Profil utilisateur
│   │   ├── MonProfilManager.jsx
│   │   └── CentreFavoriManager.jsx
│   └── dashboard/          # Tableau de bord
│       └── ActualitesManager.jsx
├── hooks/                  # Hooks personnalisés
│   ├── usePWA.js           # Installation PWA
│   ├── use-toast.js        # Notifications toast
│   └── usePlanningHooks.js # Hooks planning
├── utils/                  # Utilitaires
│   ├── api.js              # Configuration axios
│   ├── helpers.js          # Fonctions utilitaires
│   └── constants.js        # Constantes
└── pages/                  # Pages (si nécessaire)
    └── LoginPage.jsx       # Page de connexion
```

## Composants principaux dans App.js

Le fichier `App.js` contient encore les composants suivants
(pour éviter de casser les imports circulaires):

- **PlanningManager** (~10,000 lignes) - Le plus gros composant
- **PersonnelManager** - Gestion du personnel
- **DemandesTravailManager** - Demandes de créneaux
- **AdminManager** - Administration
- **StocksManager** - Gestion des stocks
- **Navigation** - Menu de navigation
- **Dashboard** - Tableau de bord

## Composants extraits

Les composants suivants ont été extraits dans des fichiers séparés:

### /components/common/
- `PhotoWithFallback` - Image avec fallback sur initiales
- `LoadingSpinner` - Indicateur de chargement
- `Skeletons` - Squelettes de chargement

### /components/personnel/
- `MedecinCard` - Carte médecin
- `AssistantCard` - Carte assistant
- `SecretaireCard` - Carte secrétaire

### /components/planning/
- `PlanningHeader` - En-tête du planning
- `PlanningFilters` - Filtres du planning

### /components/chat/
- `ChatManager` - Gestionnaire de messagerie

### /components/conges/
- `CongeManager` - Gestionnaire de congés

### /components/dashboard/
- `ActualitesManager` - Gestionnaire d'actualités

## Utilitaires

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

### /utils/constants.js
- `ROLES` - Rôles utilisateur
- `CRENEAU_TYPES` - Types de créneaux
- `STATUTS` - Statuts de demande
- `TYPES_CONGES` - Types de congés

## Migration future

Pour continuer la restructuration:

1. **Extraire PlanningManager** (le plus gros)
   - Diviser en sous-composants
   - Utiliser les hooks personnalisés

2. **Extraire les autres managers**
   - AdminManager
   - StocksManager
   - DemandesTravailManager

3. **Créer des hooks personnalisés**
   - usePersonnel()
   - usePlanning()
   - useConges()

4. **Utiliser React Query**
   - Pour la gestion du cache
   - Pour les mutations optimistes

## Notes importantes

- Le fichier `App.js` reste le point d'entrée principal
- Les contextes (AuthContext, PlanningContext) sont déjà extraits
- Les composants UI (shadcn/ui) sont dans `/components/ui/`
- Utiliser les imports depuis les fichiers index.js
