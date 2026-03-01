# 🚀 Guide de Déploiement - Cabinet Médical

## 📋 Résumé du Problème Résolu

**Problème**: L'authentification fonctionnait en local mais pas sur la version déployée.

**Cause**: La base de données MongoDB était vide en production (0 utilisateurs).

**Solution**: Initialisation de la base de données avec le script `scripts/init_database_production.py`.

---

## 🔧 Initialisation de la Base de Données en Production

### Méthode 1: Script Automatique (Recommandé)

```bash
cd /app
python3 scripts/init_database_production.py
```

Le script va créer automatiquement:
- ✅ 6 utilisateurs par défaut
- ✅ 5 salles du cabinet
- ✅ 1 configuration globale

### Méthode 2: Réinitialisation Complète

Si la base contient déjà des données et vous voulez repartir de zéro:

```bash
cd /app
python3 scripts/init_database_production.py
# Le script vous demandera confirmation avant de supprimer les données existantes
```

---

## 👥 Identifiants par Défaut

### 🛡️ Super Administrateur (Compte de Secours - PROTÉGÉ)
- **Email**: `admin@cabinet.fr`
- **Mot de passe**: `SuperAdmin2025!`
- **Rôle**: Directeur
- **Nom**: Administrateur Système
- **⚠️ IMPORTANT**: Ce compte ne peut JAMAIS être supprimé ou désactivé
- **Usage**: À utiliser en cas de problème avec les autres comptes

### 🔑 Directeur (Administrateur Principal)
- **Email**: `directeur@cabinet.fr`
- **Mot de passe**: `admin123`
- **Rôle**: Directeur
- **Nom**: Pierre Martin

### 👨‍⚕️ Médecins
1. **Dr. Marie Dupont**
   - Email: `dr.dupont@cabinet.fr`
   - Mot de passe: `medecin123`
   
2. **Dr. Jean Bernard**
   - Email: `dr.bernard@cabinet.fr`
   - Mot de passe: `medecin123`

### 👨‍⚕️ Assistants
1. **Julie Moreau**
   - Email: `julie.moreau@cabinet.fr`
   - Mot de passe: `assistant123`
   
2. **Sophie Petit**
   - Email: `sophie.petit@cabinet.fr`
   - Mot de passe: `assistant123`

### 👨‍💼 Secrétaire
- **Emma Leroy**
  - Email: `emma.leroy@cabinet.fr`
  - Mot de passe: `secretaire123`

---

## 🏥 Salles Créées

1. **Cabinet 1** - Cabinet médical (position: 100, 100)
2. **Cabinet 2** - Cabinet médical (position: 300, 100)
3. **Salle de soin 1** - Salle de soin (position: 100, 300)
4. **Salle de soin 2** - Salle de soin (position: 300, 300)
5. **Salle d'attente** - Salle d'attente (position: 200, 500)

---

## ⚙️ Configuration par Défaut

- **Max médecins par créneau**: 6
- **Max assistants par créneau**: 8
- **Horaires matin**: 08:00 - 12:00
- **Horaires après-midi**: 14:00 - 18:00
- **Délai notification**: 7 jours

---

## 🔍 Vérification de la Base de Données

### Vérifier les utilisateurs en base:

```bash
python3 << 'EOF'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client['gestion_cabinet']
    count = await db.users.count_documents({})
    print(f"Nombre d'utilisateurs: {count}")
    users = await db.users.find({}).to_list(20)
    for user in users:
        print(f"- {user['email']} ({user['role']}) - Actif: {user['actif']}")
    client.close()

asyncio.run(check())
EOF
```

---

## 🚨 Problèmes Courants

### Problème 1: "Email ou mot de passe incorrect"
**Cause**: Base de données vide ou utilisateurs non créés.
**Solution**: Exécuter le script d'initialisation.

```bash
python3 scripts/init_database_production.py
```

### Problème 2: Connexion réussie en local mais pas en production
**Cause**: Base de données de production vide.
**Solution**: Initialiser la base de données de production avec le script.

### Problème 3: Service backend ne démarre pas
**Cause**: Variables d'environnement manquantes.
**Solution**: Vérifier que `/app/backend/.env` contient:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=gestion_cabinet
CORS_ORIGINS=*
SECRET_KEY=cabinet-medical-super-secret-key-2025-prod-leblond-francis-secure
```

### Problème 4: Frontend ne peut pas contacter le backend
**Cause**: URL backend mal configurée.
**Solution**: Vérifier que `/app/frontend/.env` contient:
```
REACT_APP_BACKEND_URL=https://actualites-feature.preview.emergentagent.com
```

---

## 📊 État des Services

### Vérifier les services:
```bash
sudo supervisorctl status
```

### Redémarrer les services:
```bash
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
```

### Voir les logs:
```bash
# Backend
tail -f /var/log/supervisor/backend.err.log

# Frontend
tail -f /var/log/supervisor/frontend.err.log
```

---

## ✅ Checklist de Déploiement

- [ ] Variables d'environnement configurées (`backend/.env` et `frontend/.env`)
- [ ] MongoDB accessible
- [ ] Base de données initialisée avec le script
- [ ] Services backend et frontend démarrés
- [ ] Test de connexion avec `directeur@cabinet.fr` / `admin123`
- [ ] Vérification de l'accès aux différentes sections de l'application

---

## 🎯 Prochaines Étapes

1. **En production**: Changer les mots de passe par défaut
2. **Sécurité**: Modifier la `SECRET_KEY` dans `backend/.env`
3. **CORS**: Configurer `CORS_ORIGINS` avec le domaine de production au lieu de `*`
4. **Backup**: Mettre en place une stratégie de sauvegarde MongoDB

---

## 📞 Support

Si vous rencontrez des problèmes:
1. Vérifier les logs: `/var/log/supervisor/backend.err.log`
2. Vérifier la base de données: nombre d'utilisateurs, salles, configuration
3. Réinitialiser la base si nécessaire avec le script d'initialisation

---

**Date de création**: Janvier 2025  
**Version**: 1.0  
**Auteur**: Assistant AI - Emergent
