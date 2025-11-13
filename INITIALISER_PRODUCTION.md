# 🚀 Guide d'Initialisation de la Base de Données de Production

## 📋 Contexte

Votre application est déployée sur **https://lets-resume.emergent.host** mais la base de données de production est vide. C'est pourquoi vous ne pouvez pas vous connecter.

---

## ✅ Solution : Initialiser la Base de Production

### Étape 1 : Redéployer l'Application

**L'endpoint d'initialisation vient d'être ajouté** au code. Vous devez d'abord redéployer pour qu'il soit disponible en production.

1. Cliquez sur le bouton **"Deploy"** dans l'interface Emergent
2. Attendez que le déploiement se termine (5-10 minutes)
3. Vérifiez que l'application est bien accessible sur https://lets-resume.emergent.host

---

### Étape 2 : Appeler l'Endpoint d'Initialisation

Une fois le déploiement terminé, exécutez cette commande **depuis votre ordinateur** :

```bash
curl -X POST https://lets-resume.emergent.host/api/init-database \
  -H "Content-Type: application/json" \
  -d '{"secret_token": "init-medical-cabinet-2025"}'
```

**Résultat attendu :**
```json
{
  "message": "Base de données initialisée avec succès !",
  "utilisateurs_crees": 7,
  "salles_creees": 5,
  "configuration_creee": 1,
  "identifiants": {
    "super_admin": {
      "email": "admin@cabinet.fr",
      "password": "SuperAdmin2025!",
      "note": "Compte protégé - Ne peut jamais être supprimé"
    },
    "directeur": {
      "email": "directeur@cabinet.fr",
      "password": "admin123"
    },
    "medecin": {
      "email": "dr.dupont@cabinet.fr",
      "password": "medecin123"
    }
  }
}
```

---

### Étape 3 : Se Connecter

Allez sur **https://lets-resume.emergent.host/login** et connectez-vous avec :

#### 🛡️ Super Admin (Compte de Secours)
- **Email** : `admin@cabinet.fr`
- **Mot de passe** : `SuperAdmin2025!`

#### 👨‍💼 Directeur
- **Email** : `directeur@cabinet.fr`
- **Mot de passe** : `admin123`

#### 👨‍⚕️ Médecin
- **Email** : `dr.dupont@cabinet.fr`
- **Mot de passe** : `medecin123`

---

## 🔒 Sécurité

### Token d'Initialisation

L'endpoint est protégé par un token secret : `init-medical-cabinet-2025`

**Important** : Cet endpoint peut être appelé **une seule fois**. Si la base contient déjà des utilisateurs, il refusera l'initialisation pour éviter la perte de données.

### Après l'Initialisation

Une fois la base initialisée :
- ✅ Le super admin ne peut jamais être supprimé ou désactivé
- ✅ Vous pouvez créer d'autres utilisateurs depuis l'interface
- ✅ Vous pouvez modifier les mots de passe depuis "Mon Profil"

---

## ❌ Problèmes Courants

### Erreur "Not Found"
**Cause** : L'endpoint n'est pas encore déployé en production.  
**Solution** : Redéployez l'application (Étape 1).

### Erreur "Field required"
**Cause** : Mauvais format de la requête.  
**Solution** : Utilisez exactement la commande curl fournie ci-dessus.

### Erreur "Token d'initialisation invalide"
**Cause** : Le token secret est incorrect.  
**Solution** : Utilisez `init-medical-cabinet-2025` comme token.

### Erreur "La base contient déjà X utilisateurs"
**Cause** : La base a déjà été initialisée.  
**Solution** : Essayez de vous connecter avec les identifiants fournis ci-dessus.

---

## 🆘 En Cas de Problème

Si vous ne pouvez toujours pas vous connecter après l'initialisation :

1. Vérifiez que le déploiement s'est bien terminé
2. Vérifiez que l'URL est bien `https://lets-resume.emergent.host`
3. Essayez avec le super admin : `admin@cabinet.fr` / `SuperAdmin2025!`
4. Vérifiez la console du navigateur pour voir les erreurs (F12)

---

## 📝 Récapitulatif

```
1. Cliquer sur "Deploy" dans Emergent
2. Attendre la fin du déploiement
3. Exécuter la commande curl d'initialisation
4. Se connecter sur https://lets-resume.emergent.host/login
```

**Temps estimé** : 10-15 minutes (déploiement + initialisation)

---

**Note** : Une fois l'initialisation faite, vous n'aurez plus besoin de refaire cette procédure. Les utilisateurs seront persistants en production !
