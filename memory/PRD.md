# OphtaGestion - PRD (Product Requirements Document)

## Application Overview
OphtaGestion est une application de gestion de cabinet ophtalmologique développée en React (frontend) et FastAPI (backend) avec MongoDB.

## Original Problem Statement
L'utilisateur a demandé une vérification complète de son site pour corriger des erreurs de code et des incohérences, notamment :
1. Correction des bugs de synchronisation et de calcul des heures supplémentaires
2. Modernisation du design avec un style inspiré de KEAP pour l'ophtalmologie
3. Application PWA pour une expérience mobile native

## Core Features Implemented

### Authentication
- Login avec email/password (JWT tokens)
- Gestion des rôles : Directeur, Médecin, Assistant, Secrétaire
- Session management

### Planning Management
- Vue jour, semaine, mois
- Attribution des créneaux par employé
- Configuration semaines A/B
- Export PDF du planning

### Leave Management (Congés)
Types de congés supportés:
- `CONGE_PAYE` : Congé payé (compte en heures effectives ET en congés)
- `CONGE_SANS_SOLDE` : Congé sans solde (compte en heures effectives SEULEMENT)
- `MALADIE` : Congé maladie (compte en heures effectives SEULEMENT)
- `REPOS` : Repos (aucun effet)
- `HEURES_A_RECUPERER` : Heures à récupérer (affecte heures sup positivement)
- `HEURES_RECUPEREES` : Heures récupérées (affecte heures sup négativement)

### Personnel Management
- CRUD des utilisateurs
- Configuration des heures par employé
- Attribution des salles

### Messaging & Actualités
- Messagerie interne
- Fil d'actualités avec refresh automatique (polling)

### PWA
- Manifest.json configuré
- Service worker pour offline support
- Banner d'installation

## Recent Session Accomplishments (15 Février 2026)

### Bug Fix P0 : Calcul des heures supplémentaires
**CORRIGÉ** - Les fonctions `getHeuresSupMois` et `getHeuresSupAnnee` dans `App.js` ont été mises à jour pour :
- Inclure `MALADIE` et `CONGE_SANS_SOLDE` dans les heures effectives
- Exclure `HEURES_A_RECUPERER` et `HEURES_RECUPEREES` des heures effectives tout en les comptant dans le solde des heures sup
- Formule : `(heures effectives - contrat) + heures à récupérer - heures récupérées`

### Modernisation du Design - Style KEAP
**COMPLÉTÉ** - Nouveau design moderne implémenté :
- **Palette de couleurs** : Cyan/Turquoise (#0091B9 → #19CD91) pour l'ophtalmologie
- **Typographie** : Police "Plus Jakarta Sans"
- **Page de Login** : 
  - Panneau gauche avec gradient et branding OphtaGestion
  - Statistiques visuelles (98% temps gagné, 24/7, 100% sécurisé)
  - Formulaire moderne épuré
- **Navigation** :
  - Navbar avec backdrop blur et shadow douce
  - Logo OphtaGestion avec icône œil
  - Menu hamburger avec dropdown animé
  - Avatar utilisateur avec gradient selon le rôle
- **CSS Variables** : Système complet de design tokens

### Bug Fix : BACKEND_URL
**CORRIGÉ** par l'agent de test - Le frontend utilisait une URL hardcodée Render.com au lieu de `process.env.REACT_APP_BACKEND_URL`

## Technology Stack
- **Frontend**: React 19, Tailwind CSS, Shadcn/UI, Axios
- **Backend**: FastAPI (Python), Motor (async MongoDB)
- **Database**: MongoDB
- **Auth**: JWT tokens with pbkdf2_sha256 password hashing
- **PWA**: Service Worker + Manifest

## Code Architecture
```
/app/
├── backend/
│   ├── server.py        # API FastAPI (~1900 lignes)
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json
│   │   └── service-worker.js
│   ├── src/
│   │   ├── App.js         # Composant principal (~18700 lignes)
│   │   ├── App.css        # Styles KEAP modernes
│   │   ├── hooks/usePWA.js
│   │   └── components/ui/  # Shadcn components
│   └── package.json
└── memory/
    └── PRD.md
```

## API Endpoints (Key)
- `POST /api/auth/login` - Authentification
- `GET /api/users` - Liste des utilisateurs
- `GET /api/planning/semaine/{date}` - Planning hebdomadaire
- `GET/POST /api/conges` - Gestion des congés
- `GET /api/init-admin-simple` - Initialisation admin

## Test Credentials
- **Email**: `directeur@cabinet.fr`
- **Password**: `admin123`

## Pending Tasks (Backlog)

### P1 - Refactorisation de App.js
Le fichier `frontend/src/App.js` fait ~18700 lignes et doit être découpé en composants modulaires :
- PlanningManager.js
- CongeManager.js
- PersonnelManager.js
- ChatManager.js
- etc.

### P2 - Vérification des créneaux assistants
Vérifier que l'approbation des congés médecins crée bien les créneaux pour les assistants

### P3 - Amélioration gestion des erreurs
Remplacer les messages d'erreur génériques par des retours plus informatifs

## Known Issues
- Firebase notifications non configurées dans l'environnement de preview (manque FIREBASE_CREDENTIALS)

## Design System

### Colors
```css
--primary-500: #0091B9;  /* Cyan médical */
--accent-500: #19CD91;   /* Vert émeraude */
--warm-500: #FF914B;     /* Orange accent */
```

### Shadows
```css
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.06);
--shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 16px 32px rgba(0, 0, 0, 0.12);
```

### Border Radius
```css
--radius: 10px;
--radius-lg: 20px;
--radius-full: 9999px;
```
