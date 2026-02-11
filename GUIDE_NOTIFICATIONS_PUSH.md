# 📱 Guide des Notifications Push - Application Cabinet Médical

## ✅ Système Implémenté

Les notifications push Firebase sont maintenant **opérationnelles** avec Firebase Admin SDK directement dans le backend.

---

## 🚀 Configuration pour Render (IMPORTANT)

### Étape 1 : Obtenir les credentials Firebase

1. Allez sur **https://console.firebase.google.com**
2. Sélectionnez le projet **`cabinet-medical-ope`**
3. Cliquez sur ⚙️ **Paramètres du projet** (roue dentée en haut à gauche)
4. Onglet **Comptes de service**
5. Cliquez sur **"Générer une nouvelle clé privée"**
6. Un fichier JSON sera téléchargé (ex: `cabinet-medical-ope-firebase-adminsdk-xxxxx.json`)

### Étape 2 : Configurer sur Render

1. Dans Render, allez dans **Environment** de votre service backend
2. Ajoutez une nouvelle variable d'environnement :
   - **Key** : `FIREBASE_CREDENTIALS`
   - **Value** : Copiez-collez **TOUT le contenu** du fichier JSON téléchargé
3. Cliquez sur **Save Changes**
4. Le service redémarrera automatiquement

### Vérification

Après le redémarrage, vous pouvez vérifier que Firebase est actif :
- Connectez-vous comme Directeur
- Appelez `GET /api/notifications/firebase-status`
- Vous devriez voir `"initialized": true`

---

## 🎯 Fonctionnalités

Les notifications push sont envoyées automatiquement pour :

### 💬 Messages
- **Message privé** : Le destinataire reçoit une notification
- **Message groupe** : Tous les membres du groupe (sauf l'expéditeur) reçoivent une notification
- **Message général** : Tous les employés actifs (sauf l'expéditeur) reçoivent une notification

### 🏖️ Congés
- **Nouvelle demande** : Le directeur reçoit une notification
- **Approbation/Rejet** : L'employé reçoit une notification
- **Congé approuvé** : Les collègues qui travaillent pendant les jours de congé reçoivent une notification

### 📅 Demandes de Créneaux
- **Nouvelle demande** : Le directeur reçoit une notification
- **Approbation/Rejet** : Le médecin reçoit une notification
- **Demande d'annulation** : Le directeur reçoit une notification

### 📊 Planning Quotidien
- Chaque matin à 7h45, tous les employés reçoivent leur planning du jour avec :
  - Les créneaux de travail
  - Les collègues présents
  - La salle assignée

---

## 🚀 Activation pour les Utilisateurs

### Étape 1 : Aller dans Mon Profil
1. Connectez-vous à l'application
2. Cliquez sur votre avatar en haut à droite
3. Sélectionnez "Mon Profil"

### Étape 2 : Activer les Notifications Push
1. Scrollez jusqu'à la section "Notifications Push"
2. Cliquez sur le bouton pour activer
3. **Autorisez les notifications** quand le navigateur/téléphone le demande
4. Vous verrez "Notifications Firebase activées ✓"

### Étape 3 : Tester
1. Cliquez sur le bouton "Test" dans la section Notifications Push
2. Vous devriez recevoir une notification de test

---

## 📱 Installation sur Téléphone (PWA)

Pour recevoir les notifications même quand l'application est fermée :

### Sur Android (Chrome)
1. Ouvrez l'application dans Chrome
2. Appuyez sur le menu (⋮) → "Installer l'application"
3. Ou attendez que la bannière "Ajouter à l'écran d'accueil" apparaisse
4. Activez les notifications dans Mon Profil

### Sur iOS (Safari)
1. Ouvrez l'application dans Safari
2. Appuyez sur le bouton Partager (⬆️)
3. Sélectionnez "Sur l'écran d'accueil"
4. Activez les notifications dans Mon Profil

---

## 🧪 Test des Notifications Push

Un script de test est disponible pour vérifier le bon fonctionnement :

```bash
cd /app
python3 test_push_notification.py
```

Ce script :
- Recherche un utilisateur avec un token FCM enregistré
- Envoie une notification de test
- Affiche le résultat

---

## 🔧 Configuration Technique

### Sources des Credentials Firebase (priorité)
1. **Variable d'environnement `FIREBASE_CREDENTIALS`** (JSON string) - ✅ Recommandé pour Render
2. **Fichier `firebase-credentials.json`** dans `/app/backend/` - Fallback local

### Fichiers Modifiés
- `/app/backend/push_notifications.py` : Module Firebase Admin SDK (supporte env var + fichier)
- `/app/backend/server.py` : Endpoints notifications

### Endpoint de diagnostic (Directeur uniquement)
```
GET /api/notifications/firebase-status
```
Retourne :
```json
{
  "initialized": true,
  "credentials_source": "env_var",  // ou "file" ou "none"
  "has_env_var": true,
  "has_file": false,
  "status": "active",
  "message": "Firebase prêt pour les notifications push",
  "users_with_fcm_token": 5
}
```

### Dépendances
- `firebase-admin==7.1.0` (déjà installé)

### Base de Données
Les tokens FCM sont stockés dans le champ `fcm_token` de la collection `users` :
```json
{
  "id": "user-id",
  "prenom": "Francis",
  "nom": "LEBLOND",
  "fcm_token": "fXYZ123...",
  "fcm_updated_at": "2025-12-04T..."
}
```

---

## ❓ Résolution de Problèmes

### Problème 1 : "Aucune notification reçue"

**Vérifications :**
1. L'utilisateur a-t-il activé les notifications dans Mon Profil ?
2. Le navigateur/téléphone a-t-il autorisé les notifications ?
3. L'application est-elle installée en PWA ?
4. Le token FCM est-il enregistré en base ?

**Test :**
```bash
# Vérifier si l'utilisateur a un token FCM
mongo gestion_cabinet --eval "db.users.find({fcm_token: {\$exists: true}}).pretty()"
```

### Problème 2 : "Firebase non initialisé"

**Vérification :**
```bash
# Vérifier que le fichier credentials existe
ls -la /app/backend/firebase-credentials.json

# Tester l'initialisation
python3 -c "
import sys
sys.path.insert(0, '/app/backend')
from push_notifications import initialize_firebase
print('OK' if initialize_firebase() else 'ERREUR')
"
```

### Problème 3 : "Token invalide"

Les tokens FCM peuvent expirer. Solution :
1. L'utilisateur doit se déconnecter
2. Se reconnecter
3. Réactiver les notifications dans Mon Profil

---

## 📊 Logs de Débogage

### Logs Backend
```bash
# Voir les logs de notifications
tail -f /var/log/supervisor/backend.out.log | grep -i "notification\|firebase"
```

### Logs d'Erreur
```bash
tail -f /var/log/supervisor/backend.err.log
```

---

## 🔒 Sécurité

- ⚠️ Le fichier `firebase-credentials.json` contient des clés privées
- Ne JAMAIS le committer dans Git
- Ne JAMAIS le partager
- Permissions : `chmod 600 firebase-credentials.json`

---

## ✅ Checklist de Déploiement

- [x] Firebase Admin SDK installé
- [x] Credentials Firebase sauvegardées
- [x] Module push_notifications.py mis à jour
- [x] Endpoint /notifications/subscribe modifié
- [x] Backend redémarré
- [ ] Utilisateurs activent les notifications
- [ ] Test d'envoi de message réussi

---

## 📞 Support

En cas de problème, vérifiez :
1. Les logs backend pour les erreurs Firebase
2. La console du navigateur pour les erreurs JavaScript
3. Les paramètres de notification du navigateur/téléphone

**Date de mise à jour :** 2025-12-04  
**Version :** 2.0 - Firebase Admin SDK Direct
