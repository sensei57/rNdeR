# PRD - OphtaGestion Multi-Centres v2.5

## 1. Vue d'ensemble
Application web full-stack de gestion de cabinets médicaux multi-centres. **Version 2.5 avec tous les modules indépendants par centre.**

## 2. Nouveautés v2.5 (28 février 2026)

### Tous les modules maintenant indépendants par centre
Ajout du filtrage par centre pour :
- ✅ **Salles** : Chaque centre a ses propres salles
- ✅ **Stocks** (catégories et articles) : Inventaire indépendant par centre
- ✅ **Notes générales** : Notes visibles par centre
- ✅ **Notes du planning** : Notes journalières par centre
- ✅ **Réservations de salles** : Réservations filtrées par centre

## 3. Récapitulatif complet des modules filtrés par centre

| Module | Endpoint | Filtrage |
|--------|----------|----------|
| **Actualités** | `/api/actualites` | ✅ Par centre |
| **Planning** | `/api/planning` | ✅ Par centre |
| **Congés** | `/api/conges` | ✅ Par centre |
| **Demandes créneaux** | `/api/demandes-travail` | ✅ Par centre |
| **Plan cabinet** | `/api/cabinet/plan/{date}` | ✅ Par centre |
| **Salles** | `/api/salles` | ✅ Par centre |
| **Stocks catégories** | `/api/stocks/categories` | ✅ Par centre |
| **Stocks articles** | `/api/stocks/articles` | ✅ Par centre |
| **Notes générales** | `/api/notes` | ✅ Par centre |
| **Notes planning** | `/api/planning/notes` | ✅ Par centre |

## 4. Logique d'isolation des données

### Création de données
- Le `centre_id` est automatiquement assigné au centre actif de l'utilisateur
- Si aucun centre actif, utilise le premier centre de l'utilisateur

### Lecture des données
- Les données du centre actif sont retournées
- Les données sans `centre_id` (legacy) restent visibles pour rétrocompatibilité

### Vue globale (Directeur uniquement)
- `/api/users?all_centres=true` : Tous les employés de tous les centres

## 5. Credentials de Test
- **Email:** directeur@cabinet.fr
- **Mot de passe:** admin123

## 6. Prochaines étapes (Backlog)

### P1 - Haute priorité
- [ ] Refactorisation du `PlanningManager` (~9000 lignes)
- [ ] Problème de rechargement mobile (investigation)

### P2 - Moyenne priorité
- [ ] Tests e2e des réponses rapides aux notifications
- [ ] Validation du calcul des heures supplémentaires

### P3 - Basse priorité
- [ ] Interface de gestion fine des permissions des managers

---
**Version:** 2.5  
**Date:** 28 février 2026  
**Status:** ✅ PRODUCTION READY  
**Mobile:** ✅ Responsive complet  
**Multi-centres:** ✅ Isolation complète des données
