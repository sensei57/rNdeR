# PRD - OphtaGestion Multi-Centres

## 1. Vue d'ensemble
Application web full-stack de gestion de cabinet médical multi-centres permettant la gestion du personnel, du planning, des congés, de la messagerie interne et des notifications.

## 2. Architecture Technique

### Stack Technologique
- **Frontend:** React 18, Tailwind CSS, Shadcn/UI, Lucide-react
- **Backend:** FastAPI, Motor (MongoDB async), Pydantic
- **Base de données:** MongoDB
- **Planification:** APScheduler pour les tâches cron

### Structure des fichiers
```
/app/
├── backend/
│   ├── server.py        # API FastAPI (~6500 lignes)
│   └── requirements.txt
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.js       # Fichier monolithique (~20750 lignes)
│   │   ├── App.css
│   │   ├── components/ui/
│   │   ├── contexts/    # Nouveaux contextes (AuthContext, PlanningContext)
│   │   ├── utils/       # Nouveaux utilitaires (api.js, helpers.js)
│   │   └── pages/       # Pages extraites (LoginPage.jsx)
│   └── package.json
└── memory/
    └── PRD.md
```

## 3. Fonctionnalités Implémentées

### 3.1 Architecture Multi-Centres ✅
- Système de rôles : Super-Admin > Manager > Employé
- Assignation d'employés à plusieurs centres
- Sélecteur de centre à la connexion et dans le header
- Cloisonnement des données par centre

### 3.2 Authentification ✅
- Login avec email/mot de passe
- Sélection du centre à la connexion
- Demande d'inscription pour nouveaux utilisateurs
- Système de retry automatique sur erreur réseau
- Token JWT persisté dans localStorage

### 3.3 Planning Interactif ✅ (Modernisé 28/02/2026)
- **Header moderne** avec gradient cyan-vert (#0091B9 → #19CD91)
- Vue Jour avec sections Matin/Après-midi
- Vue Semaine avec calendrier 7 jours et filtres par rôle
- Vue Mois avec grille calendrier complète
- Vue Planning (directeur uniquement) pour gestion globale
- **Responsive mobile** : toutes les vues s'adaptent correctement

### 3.4 Gestion des Congés ✅ (Modernisé)
- Interface modernisée avec cartes de statistiques
- Filtres par statut (En attente, Approuvées, Refusées)
- Support multi-types : Congé payé, RTT, Sans solde, Maladie

### 3.5 Système de Notifications ✅
- Notifications push via Firebase
- Notification matinale à 7h (APScheduler)
- Interface de test pour admin
- Réponses rapides (backend prêt)

### 3.6 Autres Fonctionnalités ✅
- Gestion du personnel avec fiches détaillées
- Messagerie interne (chat)
- Coffre-fort de documents
- Plan du cabinet interactif
- Gestion des salles
- Gestion des stocks

## 4. Credentials de Test
- **Email:** directeur@cabinet.fr
- **Mot de passe:** admin123

## 5. Tâches Complétées (28/02/2026)

### Session actuelle
- ✅ Modernisation du header PlanningManager (gradient moderne)
- ✅ Amélioration du système de retry pour l'authentification
- ✅ Correction des vues Planning sur mobile (Semaine et Mois fonctionnelles)
- ✅ Création de la structure de refactorisation (contexts/, utils/, pages/)
- ✅ Tests frontend passés à 100%

## 6. Tâches En Cours / À Venir

### Haute Priorité (P0)
- [ ] **Refactorisation App.js** - Découpage du fichier monolithique (20750 lignes) en composants modulaires

### Moyenne Priorité (P2)
- [ ] Finalisation des réponses rapides aux notifications (Service Worker)
- [ ] Modernisation des autres sections (Personnel, Messages, etc.)

### Basse Priorité (P3)
- [ ] Validation du calcul des heures supplémentaires
- [ ] Configuration fine des permissions managers
- [ ] Remplacement des confirm() natifs par des modales modernes

## 7. Problèmes Connus

### Partiellement Résolus
- **Rechargement mobile** : Système de retry amélioré, mais monitoring nécessaire

### En attente
- **Notifications Push** : Firebase SDK non initialisé (FIREBASE_CREDENTIALS manquant)

## 8. Endpoints API Principaux

### Authentification
- `POST /api/auth/login` - Connexion avec centre
- `GET /api/users/me` - Utilisateur courant

### Centres
- `GET /api/centres/public` - Liste publique des centres
- `POST /api/centres/{id}/switch` - Changement de centre actif

### Planning
- `GET /api/planning/{date}` - Planning d'un jour
- `GET /api/planning/semaine/{date}` - Planning hebdomadaire
- `GET /api/planning/mois/{mois}` - Planning mensuel

### Congés
- `GET /api/conges` - Liste des congés
- `POST /api/conges` - Nouvelle demande
- `PUT /api/conges/{id}/approuver` - Approuver/Refuser

## 9. Schéma de Base de Données

### Collection `users`
```json
{
  "username": "string",
  "email": "string",
  "password_hash": "string",
  "role": "Super-Admin|Manager|Médecin|Assistant|Secrétaire",
  "centre_ids": ["ObjectId"],
  "centre_actif_id": "ObjectId",
  "actif": true,
  "photo_url": "string|null"
}
```

### Collection `centres`
```json
{
  "nom": "string",
  "visible_sections": ["string"],
  "manager_permissions": {
    "can_edit_planning": true,
    "can_manage_conges": true
  }
}
```

---
Dernière mise à jour: 28 février 2026
