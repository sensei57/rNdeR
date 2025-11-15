# 🚀 Guide de Déploiement - Firebase Cloud Functions

## 📋 Prérequis

1. **Installer Firebase CLI** (si pas déjà fait) :
   ```bash
   npm install -g firebase-tools
   ```

2. **Se connecter à Firebase** :
   ```bash
   firebase login
   ```

## 🔧 Déploiement des Cloud Functions

### Étape 1 : Aller dans le dossier

```bash
cd /app/firebase-functions
```

### Étape 2 : Installer les dépendances

```bash
npm install
```

### Étape 3 : Déployer les functions

```bash
firebase deploy --only functions
```

### Étape 4 : Noter les URLs

Après le déploiement, Firebase affichera les URLs des functions :

```
✔  functions[sendPushNotification(us-central1)]: Successful create operation.
Function URL (sendPushNotification): https://us-central1-cabinet-medical-ope.cloudfunctions.net/sendPushNotification

✔  functions[sendMulticastNotification(us-central1)]: Successful create operation.
Function URL (sendMulticastNotification): https://us-central1-cabinet-medical-ope.cloudfunctions.net/sendMulticastNotification
```

**⚠️ IMPORTANT** : Copiez ces URLs !

### Étape 5 : Configurer le Backend

Ajoutez ces URLs dans `/app/backend/.env` :

```env
FIREBASE_FUNCTION_SEND_PUSH=https://us-central1-cabinet-medical-ope.cloudfunctions.net/sendPushNotification
FIREBASE_FUNCTION_MULTICAST=https://us-central1-cabinet-medical-ope.cloudfunctions.net/sendMulticastNotification
```

### Étape 6 : Redémarrer le Backend

```bash
sudo supervisorctl restart backend
```

---

## 🧪 Tester les Functions

### Test 1 : Envoyer une notification à un utilisateur

```bash
curl -X POST https://us-central1-cabinet-medical-ope.cloudfunctions.net/sendPushNotification \
  -H "Content-Type: application/json" \
  -d '{
    "token": "VOTRE_FCM_TOKEN_ICI",
    "title": "Test Notification",
    "body": "Ceci est un test",
    "data": {
      "type": "planning",
      "url": "/planning"
    }
  }'
```

### Test 2 : Envoyer à plusieurs utilisateurs

```bash
curl -X POST https://us-central1-cabinet-medical-ope.cloudfunctions.net/sendMulticastNotification \
  -H "Content-Type: application/json" \
  -d '{
    "tokens": ["token1", "token2"],
    "title": "Notification Groupe",
    "body": "Message pour tous",
    "data": {
      "type": "planning"
    }
  }'
```

---

## 📊 Vérifier les Logs

```bash
firebase functions:log
```

Ou dans la console Firebase :
https://console.firebase.google.com/project/cabinet-medical-ope/functions/logs

---

## 🔄 Mettre à Jour les Functions

Après avoir modifié `index.js` :

```bash
firebase deploy --only functions
```

---

## ⚠️ Résolution de Problèmes

### Erreur "Permission Denied"

Si vous avez une erreur de permissions :
1. Allez sur https://console.firebase.google.com/project/cabinet-medical-ope/settings/iam
2. Vérifiez que votre compte a le rôle "Editor" ou "Owner"

### Erreur "Billing Required"

Firebase Cloud Functions nécessite un plan Blaze (paiement à l'usage).
- Allez sur https://console.firebase.google.com/project/cabinet-medical-ope/usage
- Activez le plan Blaze

**Note** : Le plan Blaze a un quota gratuit généreux (2M invocations/mois)

---

## 💡 Utilisation dans le Backend

Une fois déployées, le backend utilisera automatiquement ces functions pour envoyer les notifications push quand :
- Un nouveau créneau est attribué
- Une demande de congé est approuvée/rejetée
- Une demande de travail est créée
- Une notification importante est envoyée

Les utilisateurs recevront les notifications même quand l'app est fermée ! 🎉
