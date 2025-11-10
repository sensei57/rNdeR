# 📋 Guide d'Utilisation - Application Cabinet Médical

## ✅ Statut de l'Application
**Tous les systèmes sont opérationnels !** ✅
- Backend: ✅ En fonctionnement
- Frontend: ✅ En fonctionnement  
- Base de données: ✅ Initialisée avec données de test

---

## 🔐 Identifiants de Connexion

### 👔 Directeur (Accès Complet)
- **Email:** `directeur@cabinet.fr`
- **Mot de passe:** `admin123`
- **Permissions:** Accès à toutes les fonctionnalités (gestion personnel, salles, planning, configuration, stocks, etc.)

### 👨‍⚕️ Médecins
- **Email 1:** `dr.dupont@cabinet.fr` - Marie Dupont
- **Email 2:** `dr.bernard@cabinet.fr` - Jean Bernard
- **Mot de passe:** `medecin123`
- **Permissions:** Consultation planning personnel, demandes de congés

### 👩‍⚕️ Assistants
- **Email 1:** `assistant1@cabinet.fr` - Julie Moreau
- **Email 2:** `assistant2@cabinet.fr` - Sophie Petit
- **Mot de passe:** `assistant123`
- **Permissions:** Consultation planning personnel, demandes de congés

### 📋 Secrétaire
- **Email:** `secretaire@cabinet.fr` - Emma Leroy
- **Mot de passe:** `secretaire123`
- **Permissions:** Consultation planning, gestion documents

⚠️ **Important:** Changez ces mots de passe après votre première connexion pour des raisons de sécurité !

---

## 📊 Données Initialisées

### 🏥 Salles Créées (5)
1. **Cabinet 1** - Type: MEDECIN (bleu)
2. **Cabinet 2** - Type: MEDECIN (vert)
3. **Salle de soin 1** - Type: ASSISTANT (orange)
4. **Salle de soin 2** - Type: ASSISTANT (rouge)
5. **Salle d'attente** - Type: ATTENTE (violet)

### ⚙️ Configuration du Cabinet
- **Médecins max/jour:** 6
- **Assistants max/jour:** 8
- **Horaires matin:** 08:00 - 12:00
- **Horaires après-midi:** 14:00 - 18:00

---

## 🎯 Fonctionnalité : Modifier le Nombre de Places Disponibles

### Comment accéder à la configuration ?

**En tant que Directeur:**

1. **Connectez-vous** avec `directeur@cabinet.fr` / `admin123`

2. **Naviguez vers "Gestion des Salles"** dans le menu principal

3. **Cliquez sur le bouton "Configuration"** (icône ⚙️ en haut à droite)

4. **Modifiez les valeurs** dans le formulaire :
   - **Nombre maximum de médecins par jour** (ex: 4, 6, 8...)
   - **Nombre maximum d'assistants par jour** (ex: 4, 6, 8...)
   - **Heures d'ouverture matin** (début et fin)
   - **Heures d'ouverture après-midi** (début et fin)

5. **Cliquez sur "Sauvegarder"** pour appliquer les changements

### Effet de la configuration

Ces paramètres définissent :
- **Quotas globaux** : Nombre maximum de médecins et assistants qui peuvent travailler par jour
- **Horaires du cabinet** : Plages horaires pour les créneaux matin et après-midi
- **Contraintes de planning** : Le système respectera ces limites lors de l'attribution des créneaux

---

## 🚀 Autres Fonctionnalités Disponibles (Directeur)

### 👥 Gestion du Personnel
- Ajouter/modifier/supprimer des employés
- Gérer les rôles et permissions
- Activer/désactiver des comptes
- Réinitialiser les mots de passe

### 📅 Planning Interactif
- Vue globale du planning (tous les employés)
- Filtrage par rôle (Médecins, Assistants, Secrétaires)
- Attribution des créneaux par salle
- Navigation par semaine
- Option "Journée complète"
- Liaison médecin-assistant

### 🏥 Gestion des Salles
- Créer/modifier/supprimer des salles
- Définir le type (MEDECIN, ASSISTANT, ATTENTE)
- Personnaliser les couleurs
- Positionner sur le plan

### 📦 Gestion des Stocks
- Catégories de produits
- Articles avec seuils d'alerte
- Calcul automatique des quantités à commander
- Permissions d'accès par utilisateur

### 🔧 Administration des Comptes
- Liste complète des utilisateurs
- Modification des emails
- Réinitialisation des mots de passe
- Activation/désactivation des comptes
- Suppression définitive (avec toutes les données associées)

---

## 🐛 En cas de Problème

### L'application ne se charge pas
```bash
# Redémarrer tous les services
sudo supervisorctl restart all
```

### Problème de connexion
```bash
# Vérifier que les services tournent
sudo supervisorctl status

# Réinitialiser la base de données
cd /app/backend
python3 init_full.py
```

### Voir les logs en cas d'erreur
```bash
# Logs backend
tail -n 50 /var/log/supervisor/backend.err.log

# Logs frontend
tail -n 50 /var/log/supervisor/frontend.err.log
```

---

## 📝 Notes Importantes

1. **Base de données:** Les données sont persistées dans MongoDB
2. **Scripts disponibles:**
   - `/app/backend/init_db.py` - Créer uniquement le directeur
   - `/app/backend/init_full.py` - Initialisation complète (utilisateurs + salles + config)
3. **Sauvegarde:** Pensez à sauvegarder régulièrement vos données importantes
4. **Sécurité:** Changez tous les mots de passe par défaut en production

---

## ✅ Tests Effectués

Tous les endpoints principaux ont été testés et fonctionnent correctement :
- ✅ Authentification (login)
- ✅ Récupération des salles (5 salles)
- ✅ Récupération des utilisateurs (6 utilisateurs)
- ✅ Configuration du cabinet
- ✅ Planning hebdomadaire

**Taux de réussite:** 100% ✅

---

**Date de dernière mise à jour:** 2025-11-10
**Version:** 1.0
