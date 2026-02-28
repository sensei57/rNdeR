# PRD - OphtaGestion Multi-Centres v2.4

## 1. Vue d'ensemble
Application web full-stack de gestion de cabinets médicaux multi-centres. **Version 2.4 avec données indépendantes par centre.**

## 2. Nouveautés v2.4 (28 février 2026)

### Indépendance des données par centre
Les modules suivants sont maintenant indépendants pour chaque centre :
- ✅ **Actualités** : Chaque centre a ses propres actualités
- ✅ **Planning** : Les créneaux sont associés au centre actif
- ✅ **Congés** : Les demandes de congé sont filtrées par centre
- ✅ **Demandes de créneaux** : Les demandes de travail sont par centre
- ✅ **Plan de cabinet** : Les salles et planning sont filtrés par centre

### Changements techniques
- Ajout du champ `centre_id` aux modèles : `CreneauPlanning`, `Actualite`, `DemandeConge`, `DemandeJourTravail`
- Les endpoints filtrent automatiquement par le centre actif de l'utilisateur
- Rétrocompatibilité : les données sans `centre_id` restent visibles (legacy)

## 3. Nouveautés v2.3 (28 février 2026)

### Gestion Multi-Centres Améliorée
- ✅ **Vue globale des employés** : Le Directeur voit TOUS les employés de TOUS les centres
- ✅ **Filtres avancés** : Par rôle (Médecin, Assistant, Secrétaire) et par centre
- ✅ **Recherche par nom** : Champ de recherche pour filtrer rapidement
- ✅ **Assignation multi-centres** : Possibilité d'assigner un employé à plusieurs centres

## 4. État des fonctionnalités

### Toutes les fonctionnalités validées
- ✅ **Authentification** : Login multi-centre, retry automatique
- ✅ **Planning** : Header composant intégré, Vues Jour/Semaine/Mois, **filtré par centre**
- ✅ **Congés** : Interface modernisée avec stats, **filtré par centre**
- ✅ **Messages** : Chat général/privé/groupes
- ✅ **Actualités** : Actualités ciblées, anniversaires, **filtré par centre**
- ✅ **Stocks** : Header gradient, catégories
- ✅ **Salles** : Header gradient, configuration
- ✅ **Notifications** : Push Firebase, réponses rapides
- ✅ **Vue Mobile** : 100% responsive sur téléphone
- ✅ **Gestion Multi-Centres** : Vue globale avec filtres

## 5. API - Filtrage par centre

### Endpoints modifiés
```
GET /api/actualites              # Actualités du centre actif
GET /api/planning                # Planning du centre actif
GET /api/conges                  # Congés du centre actif (Directeur)
GET /api/demandes-travail        # Demandes du centre actif (Directeur)
GET /api/cabinet/plan/{date}     # Plan du centre actif
GET /api/users?all_centres=true  # TOUS les employés (Gestion Multi-Centres)
```

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
**Version:** 2.4  
**Date:** 28 février 2026  
**Status:** ✅ PRODUCTION READY  
**Mobile:** ✅ Responsive complet
