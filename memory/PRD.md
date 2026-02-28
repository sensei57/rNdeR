# PRD - OphtaGestion Multi-Centres v2.6

## 1. Vue d'ensemble
Application web full-stack de gestion de cabinets médicaux multi-centres. **Version 2.6 - Refactorisation finalisée.**

## 2. Nouveautés v2.6 (28 février 2026)

### Refactorisation terminée
- ✅ **App.js** réduit de 20902 à 19429 lignes (-1473 lignes)
- ✅ **ChatManager** extrait → `/components/chat/ChatManager.jsx`
- ✅ **ActualitesManager** extrait → `/components/dashboard/ActualitesManager.jsx`
- ✅ **CongeManager** extrait → `/components/conges/CongeManager.jsx`
- ✅ **PlanningHeader** extrait → `/components/planning/PlanningHeader.jsx`
- ✅ **PlanningFilters** extrait → `/components/planning/PlanningFilters.jsx`

### Correction bug Plan Cabinet
- ✅ Le Plan du Cabinet ne déborde plus sur la droite
- ✅ Layout responsive avec tailles réduites (450x650px)

## 3. Modules filtrés par centre

| Module | Endpoint | Filtrage |
|--------|----------|----------|
| **Actualités** | `/api/actualites` | ✅ Par centre |
| **Planning** | `/api/planning` | ✅ Par centre |
| **Congés** | `/api/conges` | ✅ Par centre |
| **Demandes créneaux** | `/api/demandes-travail` | ✅ Par centre |
| **Plan cabinet** | `/api/cabinet/plan/{date}` | ✅ Par centre |
| **Salles** | `/api/salles` | ✅ Par centre |
| **Stocks** | `/api/stocks/*` | ✅ Par centre |
| **Notes** | `/api/notes`, `/api/planning/notes` | ✅ Par centre |

## 4. Credentials de Test
- **Email:** directeur@cabinet.fr
- **Mot de passe:** admin123

## 5. Backlog restant

### P2 - Moyenne priorité
- [ ] Tests e2e des réponses rapides aux notifications
- [ ] Validation du calcul des heures supplémentaires
- [ ] Problème de rechargement mobile (investigation)

### P3 - Basse priorité
- [ ] Interface de gestion fine des permissions des managers
- [ ] Extraction du PlanningManager (~9000 lignes restantes)

---
**Version:** 2.6  
**Date:** 28 février 2026  
**Status:** ✅ PRODUCTION READY  
**Refactorisation:** ✅ Composants principaux extraits
