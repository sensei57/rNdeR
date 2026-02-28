# PRD - OphtaGestion Multi-Centres v2.8

## 1. Vue d'ensemble
Application web full-stack de gestion de cabinets médicaux multi-centres. **Version 2.8 - Layout Plein Écran.**

## 2. Nouveautés v2.8 (28 février 2026)

### Layout Plein Écran PC
- ✅ Suppression des contraintes `max-w-7xl` sur la navbar, la barre de navigation horizontale et le contenu principal
- ✅ Utilisation de padding adaptatif (`px-4 sm:px-6 lg:px-10 xl:px-12`) pour les marges latérales
- ✅ CSS `dashboard-container` : max-width passé à 100% (avec limite à 1800px sur écrans > 1920px)
- ✅ Correction import icônes Lucide : ajout de `MoreHorizontal` et `ChevronDown`

### Centre Favori (v2.7)
- ✅ Nouveau champ `centre_favori_id` pour chaque utilisateur
- ✅ Interface dans "Mon Profil" pour définir son centre favori
- ✅ Endpoint `PUT /api/users/me/centre-favori`

### Migration des données (v2.7)
- ✅ Endpoint `POST /api/admin/migrate-data-to-centre` (Directeur/Super-Admin)
- ✅ Migration automatique des données sans `centre_id` vers le centre favori
- ✅ Collections migrées : planning, congés, demandes travail, actualités, salles, stocks, notes

## 3. Modules filtrés par centre

| Module | Endpoint | Filtrage |
|--------|----------|----------|
| Actualités | `/api/actualites` | ✅ Par centre |
| Planning | `/api/planning` | ✅ Par centre |
| Congés | `/api/conges` | ✅ Par centre |
| Demandes créneaux | `/api/demandes-travail` | ✅ Par centre |
| Salles | `/api/salles` | ✅ Par centre |
| Stocks | `/api/stocks/*` | ✅ Par centre |
| Notes | `/api/notes` | ✅ Par centre |

## 4. Credentials de Test
- **Email:** directeur@cabinet.fr
- **Mot de passe:** admin123

## 5. Issues Connues
- **PlanningManager** : Le composant fait ~9000 lignes, une extraction serait bénéfique pour la maintenabilité
- **Bug affichage congés** : Les statistiques affichent le bon nombre mais la liste peut afficher "Aucune demande"
- **Rechargement mobile** : Problème persistant de rechargement sur certains appareils mobiles

## 6. Tâches Futures
- Interface de gestion des logos de centre (backend prêt, UI manquante)
- Validation fonctionnelle du calcul des heures supplémentaires
- Amélioration de l'interface des permissions des managers

---
**Version:** 2.8  
**Date:** 28 février 2026  
**Status:** ✅ PRODUCTION READY
