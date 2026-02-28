# PRD - OphtaGestion Multi-Centres

## 1. Vue d'ensemble
Application web full-stack de gestion de cabinet médical multi-centres permettant la gestion du personnel, du planning, des congés, de la messagerie interne et des notifications.

## 2. Fonctionnalités Validées (100% tests passés)

### Authentification ✅
- Login avec email/mot de passe
- Sélection de centre à la connexion
- Système de retry automatique robuste

### Planning Interactif ✅
- Vue Jour avec sections Matin/Après-midi
- Vue Semaine avec calendrier 7 jours
- Vue Mois avec grille calendrier complète
- **Heures supplémentaires** calculées et affichées
- Header moderne avec gradient

### Gestion des Congés ✅
- Interface modernisée avec cartes de statistiques
- Filtres par statut
- Support multi-types de congés
- Composant extrait : `CongeManager.jsx`

### Messagerie/Chat ✅
- Chat général, privé et groupes
- Polling intelligent (10s, pause si caché)
- Composant extrait : `ChatManager.jsx`

### Actualités ✅
- Actualités générales et ciblées par rôle
- Bannière anniversaires
- Plan du cabinet intégré
- Composant extrait : `ActualitesManager.jsx`

### Notifications ✅
- Push notifications (Firebase)
- Cron matinal à 7h
- **Réponses rapides** : Backend prêt (`/api/notifications/quick-reply`)

## 3. Composants Extraits

| Composant | Lignes | Fichier | Status |
|-----------|--------|---------|--------|
| CongeManager | ~400 | `/components/conges/CongeManager.jsx` | ✅ |
| ChatManager | ~340 | `/components/chat/ChatManager.jsx` | ✅ |
| ActualitesManager | ~370 | `/components/dashboard/ActualitesManager.jsx` | ✅ |
| LoginPage | ~280 | `/pages/LoginPage.jsx` | ✅ |
| AuthContext | ~150 | `/contexts/AuthContext.jsx` | ✅ |
| PlanningContext | ~30 | `/contexts/PlanningContext.jsx` | ✅ |
| useOptimized | ~150 | `/hooks/useOptimized.js` | ✅ |
| Skeletons | ~80 | `/components/common/Skeletons.jsx` | ✅ |

## 4. Optimisations de Performance

### Polling Intelligent
| Composant | Intervalle | Optimisation |
|-----------|-----------|--------------|
| Actualités | 60s | Pause si onglet caché |
| Messages | 10s | Pause si onglet caché |
| Notifications | 45s | Pause si onglet caché |

### Métriques Validées
- Login : 2.15s desktop / 2.57s mobile
- Navigation : < 2s
- Changement de vue : < 1s

## 5. Credentials de Test
- **Email:** directeur@cabinet.fr
- **Mot de passe:** admin123
- **Utilisateur:** Francis LEBLOND (Super-Admin)

## 6. Architecture

### Stack
- **Frontend:** React 18, Tailwind CSS, Shadcn/UI
- **Backend:** FastAPI, MongoDB (Motor)
- **Cron:** APScheduler

### Structure finale
```
frontend/src/
├── App.js                 # Principal (~20780 lignes)
├── exports.js             # Index des exports
├── components/
│   ├── ui/                # Shadcn
│   ├── common/            # Skeletons, LoadingSpinner
│   ├── conges/            # CongeManager
│   ├── chat/              # ChatManager
│   └── dashboard/         # ActualitesManager
├── contexts/              # AuthContext, PlanningContext
├── hooks/                 # useOptimized
├── pages/                 # LoginPage
└── utils/                 # api, helpers
```

## 7. Tâches Restantes (Backlog)

### Moyenne Priorité (P2)
- [ ] Implémenter réponses rapides côté Service Worker
- [ ] Extraire PlanningManager (~9400 lignes) - composant très volumineux
- [ ] Moderniser sections Personnel, Stocks, Salles

### Basse Priorité (P3)
- [ ] Configuration fine permissions managers
- [ ] Documentation utilisateur

## 8. Navigation Disponible (14+ sections)
- Actualités, Mon Profil, Personnel, Planning, Congés
- Demande de créneaux, Messages, Mon Coffre-Fort
- Plan Cabinet, Gestion Salles, Gestion Stocks
- Administration, Gestion Centres, Déconnexion

---
Dernière mise à jour: 28 février 2026
Tests: 100% passés (iteration_5.json)
