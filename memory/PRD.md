# PRD - OphtaGestion

## Énoncé du problème original
Application de gestion pour cabinet d'ophtalmologie avec :
- Planning du personnel et gestion des congés
- Messagerie interne style WhatsApp
- Plan du cabinet avec disposition des salles
- Interface PWA installable

## Utilisateurs cibles
- Directeur de cabinet (admin)
- Médecins
- Assistants
- Secrétaires

## Architecture technique
- **Frontend:** React + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB
- **Déploiement cible:** Render.com (production de l'utilisateur)

## Ce qui a été implémenté

### Session 15/02/2026
- ✅ Correction erreur JavaScript `Phone is not defined` - Import manquant ajouté
- ✅ Transformation de la bannière PWA en bouton discret centré
- ✅ Gestion d'erreur d'image avec fallback vers initiales :
  - Composants `MedecinCard`, `AssistantCard`, `SecretaireCard` pour la gestion du personnel
  - Composant `RoomCardContent` pour le Plan du Cabinet
  - Affichage automatique des initiales si l'image ne charge pas

### Sessions précédentes
- ✅ Refonte de la page de connexion moderne
- ✅ Refonte du tableau de bord (Plan du Cabinet, Actualités)
- ✅ Interface de chat style WhatsApp avec photos
- ✅ Bulle de chat flottante avec compteur de messages non lus
- ✅ Refonte des cartes d'employés dans la gestion du personnel
- ✅ Arrière-plan thématique ophtalmologie
- ✅ Icônes PWA personnalisées avec le logo utilisateur

## Bugs en attente

### P2 - Création créneaux assistants
- **Description:** L'approbation d'un congé pour un médecin ne crée pas les créneaux pour les assistants remplaçants
- **Status:** Non investigué

### P3 - Gestion des erreurs
- **Description:** Utilisation de `alert()` génériques - à remplacer par des toasts
- **Status:** Non commencé

## Tâches à venir

### P0 - Refactorisation critique
- **`frontend/src/App.js`** - Fichier monolithique de +20,000 lignes
- À découper en composants: Dashboard, Chat, PersonnelList, CabinetPlan, etc.

### P1 - Modernisation UI
- Appliquer le nouveau style aux autres sections: Planning/Calendrier, formulaires, modales

## Fichiers clés
- `/app/frontend/src/App.js` - Monolithe principal (nouveaux composants ajoutés: MedecinCard, AssistantCard, SecretaireCard, RoomCardContent)
- `/app/frontend/src/App.css` - Styles avec thème ophtalmologie
- `/app/backend/server.py` - API FastAPI

## Credentials de test
- Email: `directeur@cabinet.fr`
- Mot de passe: `admin123`
