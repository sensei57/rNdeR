# Refactorisation de App.js - Guide

## État actuel
Le fichier `/app/frontend/src/App.js` contient **20 749 lignes** et doit être découpé en composants modulaires.

## Structure de fichiers proposée

```
frontend/src/
├── App.js                 # Point d'entrée simplifié (routes + providers)
├── App.css                # Styles globaux
├── index.js               # Rendu React
│
├── components/
│   ├── ui/                # Composants Shadcn (déjà présent)
│   │
│   ├── common/            # Composants réutilisables ✅ (créé)
│   │   ├── index.js
│   │   ├── PhotoWithFallback.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── LoadingSpinner.jsx
│   │
│   ├── auth/              # Authentification
│   │   └── LoginPage.jsx
│   │
│   ├── dashboard/         # Tableau de bord
│   │   └── ActualitesManager.jsx
│   │
│   ├── planning/          # Gestion du planning
│   │   └── PlanningManager.jsx  (~9400 lignes - priorité haute)
│   │
│   ├── personnel/         # Gestion du personnel
│   │   └── PersonnelManager.jsx
│   │
│   ├── conges/            # Gestion des congés ✅ (créé)
│   │   ├── index.js
│   │   └── CongeManager.jsx
│   │
│   ├── chat/              # Messagerie
│   │   └── ChatManager.jsx
│   │
│   ├── cabinet/           # Plan du cabinet
│   │   └── PlanCabinetManager.jsx
│   │
│   ├── stocks/            # Gestion des stocks
│   │   └── StocksManager.jsx
│   │
│   └── admin/             # Administration
│       ├── AdminManager.jsx
│       └── CentresManager.jsx
│
├── contexts/              # Contextes React ✅ (créé)
│   ├── index.js
│   ├── AuthContext.jsx
│   └── PlanningContext.jsx
│
├── hooks/                 # Hooks personnalisés ✅ (existant)
│   └── usePWA.js
│
├── pages/                 # Pages principales ✅ (créé)
│   ├── index.js
│   └── LoginPage.jsx
│
└── utils/                 # Utilitaires ✅ (créé)
    ├── api.js
    └── helpers.js
```

## Composants à extraire (par priorité)

### Priorité 1 - Critique
| Composant | Lignes | Fichier cible |
|-----------|--------|---------------|
| PlanningManager | 4638-14018 (~9400) | `components/planning/PlanningManager.jsx` |

### Priorité 2 - Haute
| Composant | Lignes | Fichier cible |
|-----------|--------|---------------|
| CongeManager | 3127-3685 (~560) | ✅ `components/conges/CongeManager.jsx` |
| PersonnelManager | 2632-3126 (~500) | `components/personnel/PersonnelManager.jsx` |
| ChatManager | 19667-20088 (~420) | `components/chat/ChatManager.jsx` |

### Priorité 3 - Moyenne
| Composant | Lignes | Fichier cible |
|-----------|--------|---------------|
| ActualitesManager | 2160-2629 (~470) | `components/dashboard/ActualitesManager.jsx` |
| StocksManager | 18129-18853 (~725) | `components/stocks/StocksManager.jsx` |
| AdminManager | 16457-17366 (~910) | `components/admin/AdminManager.jsx` |
| CentresManager | 17367-18128 (~760) | `components/admin/CentresManager.jsx` |

### Priorité 4 - Basse
| Composant | Lignes | Fichier cible |
|-----------|--------|---------------|
| SallesManager | 3688-4637 (~950) | `components/cabinet/SallesManager.jsx` |
| DemandesTravailManager | 14018-16278 (~2260) | `components/planning/DemandesTravailManager.jsx` |
| PlanCabinetManager | 16279-16456 (~180) | `components/cabinet/PlanCabinetManager.jsx` |
| CoffreFortManager | 18854-19099 (~245) | `components/stocks/CoffreFortManager.jsx` |
| MonProfilManager | 20089-20488 (~400) | `components/personnel/MonProfilManager.jsx` |

## Imports communs nécessaires

Chaque composant extrait aura besoin de ces imports standards :

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
// Icônes utilisées
import { ... } from 'lucide-react';
// Composants UI Shadcn
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
// etc.
```

## Variables globales à exporter

```javascript
// utils/api.js
export const API = process.env.REACT_APP_BACKEND_URL + '/api';
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// utils/helpers.js
export const getPhotoUrl = (url) => { ... };
export const sortEmployeesByRoleThenName = (employees) => { ... };
// etc.
```

## Stratégie de migration

1. **Créer le fichier du composant** avec tous ses imports
2. **Copier le code** du composant depuis App.js
3. **Adapter les imports** (axios, toast, API, etc.)
4. **Exporter le composant** depuis index.js du dossier
5. **Tester le composant** isolément
6. **Mettre à jour App.js** pour importer depuis le nouveau fichier
7. **Supprimer le code** dupliqué de App.js

## État d'avancement

- [x] Création de la structure de dossiers
- [x] `contexts/AuthContext.jsx`
- [x] `contexts/PlanningContext.jsx`
- [x] `utils/api.js`
- [x] `utils/helpers.js`
- [x] `components/common/`
- [x] `components/conges/CongeManager.jsx`
- [x] `pages/LoginPage.jsx`
- [ ] `components/planning/PlanningManager.jsx` (priorité suivante)
- [ ] Migration complète

## Notes importantes

- **Ne pas casser l'existant** : App.js fonctionne, migrer progressivement
- **Tester après chaque extraction** : Vérifier que l'app compile
- **Conserver les styles CSS** : App.css reste global pour le moment
- **Contextes partagés** : useAuth() et usePlanning() doivent rester accessibles
