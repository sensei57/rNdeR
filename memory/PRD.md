# PRD - OphtaGestion Multi-Centres

## 1. Vue d'ensemble
Application web full-stack de gestion de cabinet médical multi-centres permettant la gestion du personnel, du planning, des congés, de la messagerie interne et des notifications.

## 2. Architecture Technique

### Stack Technologique
- **Frontend:** React 18, Tailwind CSS, Shadcn/UI, Lucide-react
- **Backend:** FastAPI, Motor (MongoDB async), Pydantic
- **Base de données:** MongoDB
- **Planification:** APScheduler pour les tâches cron

### Structure des fichiers (Refactorisé)
```
frontend/src/
├── App.js                 # Fichier principal (~20780 lignes - en cours de découpage)
├── App.css                # Styles globaux + optimisations performance
├── exports.js             # ✅ Index centralisé des exports
│
├── components/
│   ├── ui/                # Composants Shadcn
│   ├── common/            # ✅ Composants réutilisables
│   │   ├── PhotoWithFallback.jsx
│   │   ├── ProtectedRoute.jsx
│   │   ├── LoadingSpinner.jsx
│   │   └── Skeletons.jsx  # ✅ Nouveaux skeletons
│   ├── conges/            # ✅ Gestion congés (extrait)
│   │   └── CongeManager.jsx
│   └── chat/              # ✅ Chat/Messages (extrait)
│       └── ChatManager.jsx
│
├── contexts/              # ✅ Contextes React
│   ├── AuthContext.jsx
│   └── PlanningContext.jsx
│
├── hooks/                 # ✅ Hooks personnalisés
│   └── useOptimized.js    # Hooks de performance (cache, polling intelligent)
│
├── pages/                 # ✅ Pages
│   └── LoginPage.jsx
│
└── utils/                 # ✅ Utilitaires
    ├── api.js
    └── helpers.js
```

## 3. Optimisations de Performance (Session 28/02/2026)

### Polling Intelligent
| Composant | Avant | Après | Optimisation |
|-----------|-------|-------|--------------|
| Actualités | 30s | 60s | Pause si onglet caché |
| Messages | 5s | 10s | Pause si onglet caché |
| Notifications | 30s | 45s | Pause si onglet caché |
| Messages non lus | 10s | 15s | Pause si onglet caché |

### Métriques de Performance Validées
| Action | Desktop | Mobile | Seuil | Statut |
|--------|---------|--------|-------|--------|
| Login | 2.15s | 2.57s | <5s | ✅ |
| Navigation Planning | 1.11s | - | <2s | ✅ |
| Navigation Messages | 1.58s | - | <2s | ✅ |
| Vue Jour | 0.55s | - | <1s | ✅ |
| Vue Semaine | 0.63s | - | <1s | ✅ |
| Vue Mois | 0.72s | - | <1s | ✅ |

### CSS Optimisations
- Transitions fluides avec variables CSS (`--transition-fast`, `--transition-normal`)
- Feedback tactile instantané (scale 0.97 on active)
- GPU acceleration (`will-change`, `backface-visibility`)
- Support `prefers-reduced-motion`
- Skeleton animations pour UX perçue

## 4. Fonctionnalités Implémentées

### 4.1 Architecture Multi-Centres ✅
- Système de rôles : Super-Admin > Manager > Employé
- Assignation d'employés à plusieurs centres
- Sélecteur de centre à la connexion et dans le header

### 4.2 Authentification ✅
- Login avec retry automatique robuste
- Token JWT persisté dans localStorage
- Timeout progressifs (1.5s, 3s, 4.5s)

### 4.3 Planning Interactif ✅
- Header moderne avec gradient
- Vues Jour/Semaine/Mois 100% responsive
- Changements de vue ultra-rapides (<0.72s)

### 4.4 Gestion des Congés ✅
- Interface modernisée avec cartes de statistiques
- Composant extrait dans `/components/conges/`

### 4.5 Messagerie/Chat ✅
- Chat général, privé et groupes
- Composant extrait dans `/components/chat/`
- Polling intelligent (10s, pause si caché)

### 4.6 Système de Notifications ✅
- Notifications push (Firebase)
- Cron matinal à 7h (APScheduler)

## 5. Credentials de Test
- **Email:** directeur@cabinet.fr
- **Mot de passe:** admin123

## 6. Composants Extraits (Refactorisation)

| Composant | Lignes | Fichier | Status |
|-----------|--------|---------|--------|
| CongeManager | ~400 | `/components/conges/CongeManager.jsx` | ✅ Extrait |
| ChatManager | ~340 | `/components/chat/ChatManager.jsx` | ✅ Extrait |
| LoginPage | ~280 | `/pages/LoginPage.jsx` | ✅ Créé |
| AuthContext | ~150 | `/contexts/AuthContext.jsx` | ✅ Créé |
| PlanningContext | ~30 | `/contexts/PlanningContext.jsx` | ✅ Créé |
| useOptimized | ~150 | `/hooks/useOptimized.js` | ✅ Créé |
| Skeletons | ~80 | `/components/common/Skeletons.jsx` | ✅ Créé |

## 7. Tâches Restantes

### Haute Priorité (P0)
- [ ] **Continuer refactorisation App.js:**
  - Extraire `PlanningManager` (~9400 lignes) - le plus gros
  - Extraire `PersonnelManager` (~500 lignes)
  - Extraire `ActualitesManager` (~470 lignes)
  - Intégrer les composants extraits dans App.js

### Moyenne Priorité (P2)
- [ ] Finaliser réponses rapides notifications
- [ ] Moderniser autres sections

### Basse Priorité (P3)
- [ ] Validation heures supplémentaires
- [ ] Configuration fine permissions managers

## 8. Endpoints API Principaux

### Authentification
- `POST /api/auth/login`
- `GET /api/users/me`

### Planning
- `GET /api/planning/{date}`
- `GET /api/planning/semaine/{date}`
- `GET /api/planning/mois/{mois}`

### Congés
- `GET /api/conges`
- `POST /api/conges`
- `PUT /api/conges/{id}/approuver`

### Messages
- `GET /api/messages`
- `POST /api/messages`
- `GET /api/messages/conversation/{user_id}`

---
Dernière mise à jour: 28 février 2026
Performance testée: 100% des tests passés
