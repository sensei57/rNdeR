# PRD - OphtaGestion Multi-Centres v2.9

## 1. Vue d'ensemble
Application web full-stack de gestion de cabinets médicaux multi-centres. **Version 2.9 - UI/UX Améliorations.**

## 2. Nouveautés v2.9 (28 février 2026)

### Menu Navigation Horizontal Optimisé
- ✅ Menu "Plus" réservé uniquement aux items admin (Administration, Gestion Centres)
- ✅ Tous les autres items (Coffre-Fort, Plan Cabinet, Salles, Stocks) visibles dans la barre principale
- ✅ Meilleure utilisation de l'espace horizontal sur desktop

### Plan du Cabinet - Layout Responsive
- ✅ Nouveau système de grille CSS responsive (`room-card-grid`)
- ✅ Le plan s'adapte maintenant à la largeur disponible
- ✅ Suppression des positions absolues fixes en pixels

### Planning - Noms Tronqués
- ✅ Les noms des employés sont maintenant tronqués avec `truncate` et `max-w-[100px]`
- ✅ Info-bulle (title) affiche le nom complet au survol
- ✅ Évite les débordements de texte dans les cellules

### v2.8 - Layout Plein Écran PC
- ✅ Suppression des contraintes `max-w-7xl` 
- ✅ Padding adaptatif (`px-4 sm:px-6 lg:px-10 xl:px-12`)
- ✅ CSS `dashboard-container` : max-width à 100%

### v2.7 - Centre Favori et Migration
- ✅ Champ `centre_favori_id` pour chaque utilisateur
- ✅ Migration automatique des données sans `centre_id`

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
- **PlanningManager** : Le composant fait ~9000 lignes, une extraction serait bénéfique
- **Bug affichage congés** : La liste peut afficher "Aucune demande" malgré les stats
- **Rechargement mobile** : Problème persistant sur certains appareils

## 6. Notes Techniques
- **Plan Cabinet dans Actualités** : Affiche "Aucun planning" si aucune salle n'est configurée
- Les données sont isolées par centre - un centre sans configuration affichera des listes vides

## 7. Tâches Futures
- Interface de gestion des logos de centre (backend prêt, UI manquante)
- Validation fonctionnelle du calcul des heures supplémentaires
- Amélioration de l'interface des permissions des managers

---
**Version:** 2.9  
**Date:** 28 février 2026  
**Status:** ✅ PRODUCTION READY
