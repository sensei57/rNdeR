# PRD - OphtaGestion Multi-Centres v2.7

## 1. Vue d'ensemble
Application web full-stack de gestion de cabinets médicaux multi-centres. **Version 2.7 - Centre Favori et Migration.**

## 2. Nouveautés v2.7 (28 février 2026)

### Centre Favori
- ✅ Nouveau champ `centre_favori_id` pour chaque utilisateur
- ✅ Interface dans "Mon Profil" pour définir son centre favori
- ✅ Endpoint `PUT /api/users/me/centre-favori`

### Migration des données
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

---
**Version:** 2.7  
**Date:** 28 février 2026  
**Status:** ✅ PRODUCTION READY
