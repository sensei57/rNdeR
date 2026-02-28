# PRD - OphtaGestion

## Énoncé du problème original
Application de gestion pour cabinet d'ophtalmologie avec :
- Planning du personnel et gestion des congés
- Messagerie interne style WhatsApp
- Plan du cabinet avec disposition des salles
- Interface PWA installable
- **NOUVEAU** : Support multi-centres avec gestion hiérarchique

## Utilisateurs cibles
- **Super-Admin (Directeur)** : Gère TOUS les centres, crée centres/managers, valide inscriptions
- **Manager** : Gère UN centre avec droits limités (à définir par Super-Admin)
- Médecins : Appartient à UN centre
- Assistants : Appartient à UN centre
- Secrétaires : Appartient à UN centre

## Architecture technique
- **Frontend:** React + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB
- **Notifications:** Firebase Admin SDK (push notifications)
- **Déploiement cible:** Render.com (production de l'utilisateur)

## Ce qui a été implémenté

### Session 28/02/2026 - Architecture Multi-Centres
- ✅ **Système multi-centres complet**
  - Nouveau modèle `Centre` avec collection MongoDB
  - Migration des données existantes vers le centre "Place de l'Étoile"
  - Isolation des données par centre (users, planning, salles, messages, congés)
  
- ✅ **Nouveaux rôles**
  - `Super-Admin` : Gère tous les centres, droits complets
  - `Manager` : Gère un centre avec droits personnalisables
  - Les anciens "Directeur" sont convertis en "Super-Admin"

- ✅ **Page de connexion améliorée**
  - Sélecteur de centre médical
  - Bouton "Demander un accès" pour les inscriptions
  - Formulaire d'inscription complet avec choix du centre et du poste

- ✅ **Gestion des inscriptions**
  - Nouvel endpoint POST `/api/inscriptions` (public)
  - Endpoints GET/PUT pour approuver/rejeter les demandes
  - Notification au Super-Admin pour chaque nouvelle demande

- ✅ **Navigation multi-centres pour Super-Admin**
  - Sélecteur de centre dans le header
  - Changement de centre en temps réel (rechargement automatique)
  - Filtrage des données selon le centre actif

- ✅ **Endpoints API multi-centres**
  - `GET /api/centres/public` : Liste des centres (sans auth)
  - `GET /api/centres` : Liste des centres accessibles
  - `POST /api/centres` : Créer un centre (Super-Admin)
  - `PUT /api/centres/{id}` : Modifier un centre
  - `POST /api/centres/{id}/switch` : Changer de centre actif
  - `POST /api/admin/migrate-to-multicentre` : Migration des données
  - `GET /api/admin/centres/details` : Détails des centres avec statistiques
  - `GET /api/admin/centres/{id}/employees` : Employés d'un centre
  - `PUT /api/admin/centres/{id}/config` : Configuration rubriques d'un centre
  - `GET /api/admin/rubriques` : Liste des rubriques disponibles
  - `POST /api/admin/managers` : Créer un manager
  - `PUT /api/admin/managers/{id}/permissions` : Modifier permissions manager
  - `PUT /api/admin/employees/{id}/visibility` : Configurer visibilité employé
  - `PUT /api/admin/employees/{id}/centre` : Déplacer employé vers autre centre

- ✅ **Interface "Gestion Multi-Centres" (CentresManager)**
  - Onglet **Centres** : Liste des centres avec stats, création, modification, configuration des rubriques
  - Onglet **Managers** : Gestion des managers par centre avec permissions détaillées
  - Onglet **Employés** : Liste des employés par centre avec visibilité et possibilité de déplacement
  - Onglet **Inscriptions** : Approbation/rejet des demandes d'inscription en attente
- ✅ **Système de notifications de test depuis l'administration**
  - Nouvel endpoint GET `/api/notifications/employees-for-test` : Liste des employés avec statut push
  - Nouvel endpoint POST `/api/notifications/test` : Envoi de notifications personnalisées à plusieurs employés
  - Interface dans AdminManager pour sélectionner les employés et envoyer des notifications
  - Affichage du statut push (actif/inactif) pour chaque employé

- ✅ **Notification matinale du planning (déclenchement à 7h)**
  - Endpoint POST `/api/notifications/send-daily-planning` : Déclenche manuellement l'envoi
  - Message détaillé avec salle et équipe du jour

- ✅ **Réponse rapide aux messages depuis notifications**
  - Nouvel endpoint POST `/api/notifications/quick-reply` : Permet de répondre directement
  - Push notifications avec actions de réponse (Répondre / Ouvrir)

- ✅ **Correction bug créneaux assistants après approbation congé médecin**
  - Nouvelle fonction `handle_assistant_slots_for_leave` dans server.py
  - Quand un médecin prend un congé approuvé :
    - Les créneaux des assistants assignés à ce médecin sont mis à jour
    - Le médecin est retiré de la liste medecin_ids
    - Les créneaux sont marqués `est_repos=True` avec note "À RÉASSIGNER"
    - Les assistants concernés reçoivent une notification
  - Logique ajoutée à l'endpoint PUT `/api/conges/{demande_id}/approuver`

- ✅ **Correction configuration URL backend**
  - Frontend utilise maintenant `process.env.REACT_APP_BACKEND_URL` en priorité
  - Fallback vers URL Render.com si non configuré

- ✅ **Nettoyage des éléments obsolètes**
  - Suppression de l'ancien bouton "Notification" individuel dans la liste des utilisateurs
  - Suppression de l'ancienne modale d'envoi de notification individuelle
  - Suppression des états et fonctions associés (`showNotificationModal`, `notificationMessage`, `handleSendNotification`)
  - L'envoi de notifications se fait maintenant via la nouvelle section "Notifications de Test"

### Session 15/02/2026
- ✅ Correction erreur JavaScript `Phone is not defined`
- ✅ Transformation de la bannière PWA en bouton discret
- ✅ Gestion d'erreur d'image avec fallback vers initiales
- ✅ Correction bug `personnelList is not defined`
- ✅ **OPTIMISATION MOBILE** : Vue Mois passe de 30+ requêtes à 1 seule
- ✅ Gestion multi-appareils pour les notifications push

### Sessions précédentes
- ✅ Refonte de la page de connexion moderne
- ✅ Refonte du tableau de bord
- ✅ Interface de chat style WhatsApp
- ✅ Bulle de chat flottante avec compteur
- ✅ Refonte des cartes d'employés
- ✅ Arrière-plan thématique ophtalmologie
- ✅ Icônes PWA personnalisées

## Bugs en attente

### P1 - Problème de rechargement persistant sur mobile
- **Description:** L'utilisateur signale devoir recharger la page plusieurs fois
- **Status:** À investiguer - possible race condition dans les useEffect

### P2 - Vues "Mois" et "Planning" sur mobile
- **Description:** Affichage potentiellement mal adapté sur petits écrans
- **Status:** Partiellement traité avec optimisation endpoint

### P3 - Gestion des erreurs
- **Description:** Utilisation de `alert()` génériques - à remplacer par des toasts
- **Status:** Non commencé

## Tâches à venir

### P0 - Refactorisation critique
- **`frontend/src/App.js`** - Fichier monolithique de +19,500 lignes
- À découper en composants: Dashboard, Chat, PersonnelList, CabinetPlan, etc.
- Structure suggérée: `src/components/`, `src/pages/`, `src/hooks/`, `src/utils/`

### P1 - Modernisation UI
- Appliquer le nouveau style aux sections restantes

### P2 - Validation
- Validation du calcul des heures supplémentaires

## Fichiers clés
- `/app/frontend/src/App.js` - Monolithe principal
- `/app/frontend/src/App.css` - Styles
- `/app/backend/server.py` - API FastAPI
- `/app/backend/push_notifications.py` - Gestion Firebase

## Endpoints API clés

### Notifications
- `GET /api/notifications` - Liste notifications utilisateur
- `GET /api/notifications/employees-for-test` - Liste employés pour test (Directeur)
- `POST /api/notifications/test` - Envoyer notification de test (Directeur)
- `POST /api/notifications/send-daily-planning` - Déclencher planning quotidien (Directeur)
- `POST /api/notifications/quick-reply` - Répondre depuis notification
- `POST /api/notifications/subscribe` - S'abonner aux push
- `GET /api/notifications/devices` - Liste appareils enregistrés
- `DELETE /api/notifications/devices/{id}` - Supprimer appareil

### Congés
- `POST /api/conges` - Créer demande de congé
- `GET /api/conges` - Liste des congés
- `PUT /api/conges/{id}/approuver` - Approuver/Rejeter (déclenche gestion assistants)

## Credentials de test
- Email: `directeur@cabinet.fr`
- Mot de passe: `admin123`

## Tests
- Fichier de tests: `/app/backend/tests/test_notifications.py`
- Rapport: `/app/test_reports/iteration_2.json`
- Taux de réussite: 95% (21/22 tests passés, 1 ignoré)
