# 📱 Guide d'Installation PWA - Gestion Personnel Médical

## Qu'est-ce qu'une PWA ?

Une **Progressive Web App (PWA)** permet d'utiliser l'application web comme une vraie application mobile :
- ✅ Icône sur l'écran d'accueil
- ✅ Fonctionne hors ligne
- ✅ Notifications push quotidiennes
- ✅ Expérience app native

---

## 📲 Installation sur Android (Chrome)

### Étape 1 : Ouvrir l'application
1. Ouvrez **Chrome** sur votre téléphone Android
2. Accédez à l'URL de l'application

### Étape 2 : Installer l'application
1. Appuyez sur le **menu** (⋮) en haut à droite
2. Sélectionnez **"Ajouter à l'écran d'accueil"** ou **"Installer l'application"**
3. Confirmez l'installation

### Étape 3 : Activer les notifications
1. Ouvrez l'application depuis votre écran d'accueil
2. Allez dans **"Mon Profil"**
3. Dans la section **"Notifications Push"**, cliquez sur **"Activer"**
4. Autorisez les notifications quand le navigateur vous le demande

✅ **C'est fait !** Vous recevrez votre planning chaque matin à 7h00.

---

## 📱 Installation sur iPhone/iPad (Safari)

### Étape 1 : Ouvrir l'application
1. Ouvrez **Safari** sur votre iPhone/iPad
2. Accédez à l'URL de l'application

### Étape 2 : Installer l'application
1. Appuyez sur le **bouton Partager** (icône avec une flèche vers le haut)
2. Faites défiler et sélectionnez **"Sur l'écran d'accueil"**
3. Donnez un nom à l'application (ex: "Planning Cabinet")
4. Appuyez sur **"Ajouter"**

### Étape 3 : Activer les notifications
1. Ouvrez l'application depuis votre écran d'accueil
2. Allez dans **"Mon Profil"**
3. Dans la section **"Notifications Push"**, cliquez sur **"Activer"**
4. Autorisez les notifications quand le système vous le demande

✅ **C'est fait !** Vous recevrez votre planning chaque matin à 7h00.

---

## 🔔 Fonctionnement des Notifications

### Quand recevez-vous les notifications ?
- **Chaque matin à 7h00** (du lundi au vendredi)
- Uniquement les jours où vous avez un planning

### Que contient la notification ?
```
📅 Votre Planning du Jour

🏥 MATIN (9h-12h)
• Salle : Consultation 1
• Avec : Julie Moreau (Assistant)

🏥 APRÈS-MIDI (14h-18h)
• Salle : Consultation 2
• Avec : Dr. Jean Bernard
```

### Comment désactiver les notifications ?
1. Allez dans **"Mon Profil"**
2. Dans la section **"Notifications Push"**
3. Désactivez les notifications dans les paramètres

---

## 🛠️ Dépannage

### "Je ne reçois pas de notifications"
1. Vérifiez que les notifications sont activées dans **"Mon Profil"**
2. Vérifiez les paramètres de votre téléphone :
   - Android : Paramètres > Applications > Gestion Cabinet > Notifications
   - iOS : Réglages > Notifications > Safari
3. Assurez-vous que le mode "Ne pas déranger" est désactivé

### "L'application ne s'installe pas"
1. Assurez-vous d'utiliser le bon navigateur :
   - Android : Chrome
   - iOS : Safari
2. Videz le cache du navigateur
3. Réessayez l'installation

### "L'application ne fonctionne pas hors ligne"
- Ouvrez l'application au moins une fois avec une connexion internet
- Le cache se chargera automatiquement
- Ensuite, l'application fonctionnera même sans connexion

---

## 📞 Support

En cas de problème, contactez l'administrateur ou consultez la section **Administration** de l'application.

---

## ⚙️ Configuration Technique (Pour Administrateurs)

### Service Worker
- Fichier : `/public/service-worker.js`
- Gère le cache et les notifications push

### Manifest
- Fichier : `/public/manifest.json`
- Définit l'apparence et le comportement de l'app

### Icônes
- 192x192px : `/public/icon-192.png`
- 512x512px : `/public/icon-512.png`

**Note** : Les icônes actuelles sont des placeholders. Remplacez-les par de vraies images pour une meilleure expérience utilisateur.

### Envoi de notifications (Backend)
Les notifications sont envoyées via le backend chaque matin à 7h00 à tous les employés ayant un planning pour la journée.

---

✅ **Votre application est maintenant une PWA complète !**
