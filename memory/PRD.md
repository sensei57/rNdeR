# OphtagGestion - Application de Gestion de Cabinet Médical

## Problem Statement
Application full-stack de gestion de cabinet médical multi-centres permettant la gestion du planning, des congés, des actualités, des stocks et de la communication interne.

## Architecture

### Stack Technique
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + MongoDB (via motor)
- **Auth**: JWT + bcrypt
- **Notifications**: Firebase Cloud Messaging
- **Exports**: jspdf + jspdf-autotable + html2canvas

### Structure des Fichiers
```
/app/
├── backend/
│   ├── server.py           # API FastAPI principale
│   ├── push_notifications.py # Gestion Firebase FCM
│   └── .env                 # Configuration MongoDB
├── frontend/
│   ├── src/App.js          # Application React principale
│   └── public/
│       └── firebase-messaging-sw.js # Service Worker FCM
└── memory/
    └── PRD.md              # Ce fichier
```

## Fonctionnalités Implémentées

### Core
- [x] Authentification JWT avec rôles (Super-Admin, Directeur, Manager, Médecin, Assistant, Secrétaire)
- [x] Gestion multi-centres avec configuration par centre
- [x] Planning avec créneaux MATIN/APRES_MIDI
- [x] Gestion des congés avec workflow d'approbation
- [x] Messagerie interne (privée et groupes)
- [x] Gestion des stocks par centre
- [x] Plan du cabinet avec salles

### Actualités (Refonte Récente)
- [x] Création avec texte + image + fichier combinés
- [x] Ciblage multi-groupes (sélection multiple parmi Médecin, Assistant, Secrétaire)
- [x] Signature requise pour confirmer lecture
- [x] Upload d'images et fichiers vers Firebase Storage
- [x] Compression automatique des images (max 300KB)
- [x] **Carrousel de navigation** (Nouveau - Mars 2026):
  - Compteur "X / Y" pour indiquer la position
  - Navigation précédent/suivant avec flèches
  - Points de navigation (dots) cliquables
  - Badge "NOUVEAU" sur les actualités non lues
  - Indicateur du nombre d'actualités non lues avec animation
  - Persistance de l'état de lecture dans localStorage par utilisateur

### Notifications Push
- [x] Intégration Firebase Cloud Messaging
- [x] Support multi-appareils par utilisateur
- [x] Notifications automatiques à 7h (planning du jour)
- [x] Notifications de test personnalisées

### Migration Multi-Centres
- [x] API `/api/admin/migrate-data-to-centre`
- [x] Interface dans Mon Profil > Centre Favori
- [x] Migration automatique vers centre favori

## Problèmes Connus (Issues)

### P0 - Critiques
1. ~~**Requêtes N+1 dans le backend**~~ (RÉSOLU - 3 Mars 2026)
   - Optimisé 15+ endpoints avec batch queries via `$in`
   - Réduction significative des appels MongoDB

### P1 - Importants
2. **Frontend App.js monolithique** (~20,000 lignes)
   - Extraire: PlanningManager, PersonnelManager, DemandesTravailManager, AdminManager, StocksManager

3. **Composant PlanningManager monolithique** (~9000 lignes)

### P2 - Mineurs
4. Interface de gestion des logos de centre (backend prêt)
5. Affichage anniversaires/congés (filtrage par centre)

## API Endpoints Clés

### Auth
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription

### Multi-Centres
- `GET /api/centres` - Liste des centres
- `POST /api/admin/migrate-data-to-centre` - Migration données orphelines

### Actualités
- `GET /api/actualites` - Liste des actualités
- `POST /api/actualites` - Créer une actualité
- `POST /api/actualites/upload-file` - Upload image/fichier
- `POST /api/actualites/sign/{id}` - Signer une actualité

### Notifications
- `POST /api/notifications/subscribe` - Enregistrer token FCM
- `POST /api/notifications/test` - Envoyer notification test

## Schéma DB Clé

### users
```json
{
  "id": "uuid",
  "email": "string",
  "nom": "string",
  "prenom": "string",
  "role": "Super-Admin|Directeur|Manager|Médecin|Assistant|Secrétaire",
  "centre_id": "uuid",
  "centre_ids": ["uuid"],
  "centre_favori_id": "uuid",
  "fcm_devices": [{"device_id": "string", "fcm_token": "string", ...}]
}
```

### actualites
```json
{
  "id": "uuid",
  "titre": "string",
  "contenu": "string",
  "image_url": "string?",
  "fichier_url": "string?",
  "groupe_cible": "tous|Médecin|Assistant|Secrétaire",
  "centre_id": "uuid",
  "signature_requise": "boolean",
  "signatures": [{"user_id": "uuid", "user_name": "string", "signed_at": "datetime"}]
}
```

## Credentials Test
- Email: `directeur@cabinet.fr`
- Password: `admin123`

## Dernière Mise à Jour
- Date: 3 Mars 2026
- Session: Correction des requêtes N+1 dans le backend (15+ endpoints optimisés)

## Historique des Sessions
- **3 Mars 2026**: Optimisation N+1 queries (batch fetch avec `$in` operator) - 15+ endpoints corrigés
- **2 Mars 2026**: Optimisation du démarrage serveur pour cold start rapide (MongoDB et Scheduler en arrière-plan)
- **1er Mars 2026**: Carrousel actualités, correction bugs congés (centre_id), permissions Super-Admin
- **Sessions précédentes**: Migration Firebase Storage, scission des congés, corrections bugs API
