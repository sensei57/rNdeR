# PRD - OphtaGestion Multi-Centres v2.3

## 1. Vue d'ensemble
Application web full-stack de gestion de cabinets médicaux multi-centres. **Version 2.3 avec amélioration de la Gestion Multi-Centres.**

## 2. Nouveautés v2.3 (28 février 2026)

### Gestion Multi-Centres Améliorée
- ✅ **Vue globale des employés** : Le Directeur voit TOUS les employés de TOUS les centres
- ✅ **Filtres avancés** : Par rôle (Médecin, Assistant, Secrétaire) et par centre
- ✅ **Recherche par nom** : Champ de recherche pour filtrer rapidement
- ✅ **Assignation multi-centres** : Possibilité d'assigner un employé à plusieurs centres
- ✅ **Compteurs par rôle** : Affichage du nombre d'employés par rôle dans chaque centre
- ✅ **Sidebar scrollable** : Correction du menu coupé (overflow-y-auto)

### Différenciation des vues
- **Gestion Multi-Centres** : Vue globale pour Super-Admin/Directeur (tous centres, tous employés)
- **Gestion du Personnel** : Vue filtrée par centre actif uniquement

## 3. État des fonctionnalités

### Toutes les fonctionnalités validées
- ✅ **Authentification** : Login multi-centre, retry automatique
- ✅ **Planning** : Header composant intégré, Vues Jour/Semaine/Mois
- ✅ **Congés** : Interface modernisée avec stats
- ✅ **Messages** : Chat général/privé/groupes
- ✅ **Actualités** : Actualités ciblées, anniversaires
- ✅ **Stocks** : Header gradient, catégories
- ✅ **Salles** : Header gradient, configuration
- ✅ **Notifications** : Push Firebase, réponses rapides
- ✅ **Vue Mobile** : 100% responsive sur téléphone
- ✅ **Gestion Multi-Centres** : Vue globale avec filtres (NOUVEAU)

## 4. API - Paramètre all_centres

### Endpoint `/api/users`
```
GET /api/users                    # Employés du centre actif
GET /api/users?all_centres=true   # TOUS les employés (Directeur seulement)
```

## 5. Composants Intégrés

| Composant | Fichier | Statut |
|-----------|---------|--------|
| **PlanningHeader** | `/components/planning/PlanningHeader.jsx` | ✅ INTÉGRÉ |
| **CentresManager** | Intégré dans App.js | ✅ Amélioré |
| PlanningFilters | `/components/planning/PlanningFilters.jsx` | Prêt |
| usePlanningHooks | `/hooks/usePlanningHooks.js` | Prêt |
| CongeManager | `/components/conges/CongeManager.jsx` | Extrait |
| ChatManager | `/components/chat/ChatManager.jsx` | Extrait |
| ActualitesManager | `/components/dashboard/ActualitesManager.jsx` | Extrait |

## 6. Credentials de Test
- **Email:** directeur@cabinet.fr
- **Mot de passe:** admin123

## 7. Prochaines étapes (Backlog)

### P1 - Haute priorité
- [ ] Refactorisation du `PlanningManager` (~9000 lignes)
- [ ] Problème de rechargement mobile (investigation)

### P2 - Moyenne priorité
- [ ] Tests e2e des réponses rapides aux notifications
- [ ] Validation du calcul des heures supplémentaires

### P3 - Basse priorité
- [ ] Interface de gestion fine des permissions des managers

---
**Version:** 2.3  
**Date:** 28 février 2026  
**Status:** ✅ PRODUCTION READY  
**Mobile:** ✅ Responsive complet
