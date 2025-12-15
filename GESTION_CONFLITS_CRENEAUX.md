# 📋 Gestion Intelligente des Conflits de Créneaux

## 🎯 Objectif

Permettre aux médecins de faire plusieurs demandes pour la même date (ex: MATIN + APRES_MIDI séparés) tout en bloquant les vrais conflits (doublons et chevauchements).

## ✅ Cas Autorisés (Pas de Conflit)

### 1. MATIN + APRES_MIDI Séparés
```
✅ Demande 1 : MATIN pour le 17/12
✅ Demande 2 : APRES_MIDI pour le 17/12
→ Résultat : 2 demandes acceptées, 2 créneaux distincts créés
```

**Pourquoi c'est OK :**
Les deux créneaux sont différents et non chevauchants. Le médecin travaille toute la journée mais via 2 demandes séparées.

### 2. Demandes sur Dates Différentes
```
✅ Demande 1 : MATIN pour le 17/12
✅ Demande 2 : MATIN pour le 18/12
→ Résultat : 2 demandes acceptées
```

**Pourquoi c'est OK :**
Dates différentes, pas de conflit.

## ❌ Cas Bloqués (Conflit Détecté)

### 1. Doublon Strict (Même Créneau)
```
❌ Demande 1 : MATIN pour le 17/12 (EN_ATTENTE ou APPROUVEE)
❌ Demande 2 : MATIN pour le 17/12
→ Erreur : "Une demande MATIN existe déjà pour cette date"
```

**Pourquoi c'est bloqué :**
Doublon inutile. Le médecin ne peut pas travailler deux fois le même créneau.

### 2. JOURNEE_COMPLETE vs MATIN Existant
```
❌ Demande 1 : MATIN pour le 17/12 (EN_ATTENTE ou APPROUVEE)
❌ Demande 2 : JOURNEE_COMPLETE pour le 17/12
→ Erreur : "Impossible de demander une journée complète : vous avez déjà une demande pour l'MATIN. Annulez-la d'abord ou demandez seulement le créneau manquant."
```

**Pourquoi c'est bloqué :**
JOURNEE_COMPLETE inclut déjà MATIN. Conflit de chevauchement.

**Solution :**
- Annuler la demande MATIN
- Puis faire la demande JOURNEE_COMPLETE
- OU garder MATIN et demander seulement APRES_MIDI

### 3. JOURNEE_COMPLETE vs APRES_MIDI Existant
```
❌ Demande 1 : APRES_MIDI pour le 17/12 (EN_ATTENTE ou APPROUVEE)
❌ Demande 2 : JOURNEE_COMPLETE pour le 17/12
→ Erreur : "Impossible de demander une journée complète : vous avez déjà une demande pour l'APRES_MIDI. Annulez-la d'abord ou demandez seulement le créneau manquant."
```

**Pourquoi c'est bloqué :**
JOURNEE_COMPLETE inclut déjà APRES_MIDI. Conflit de chevauchement.

### 4. MATIN vs JOURNEE_COMPLETE Existante
```
❌ Demande 1 : JOURNEE_COMPLETE pour le 17/12 (EN_ATTENTE ou APPROUVEE)
❌ Demande 2 : MATIN pour le 17/12
→ Erreur : "Impossible de demander MATIN : vous avez déjà une demande pour la JOURNEE_COMPLETE. Annulez-la d'abord ou gardez la journée complète."
```

**Pourquoi c'est bloqué :**
La JOURNEE_COMPLETE couvre déjà le MATIN. Conflit de chevauchement.

### 5. APRES_MIDI vs JOURNEE_COMPLETE Existante
```
❌ Demande 1 : JOURNEE_COMPLETE pour le 17/12 (EN_ATTENTE ou APPROUVEE)
❌ Demande 2 : APRES_MIDI pour le 17/12
→ Erreur : "Impossible de demander APRES_MIDI : vous avez déjà une demande pour la JOURNEE_COMPLETE. Annulez-la d'abord ou gardez la journée complète."
```

**Pourquoi c'est bloqué :**
La JOURNEE_COMPLETE couvre déjà l'APRES_MIDI. Conflit de chevauchement.

## 🔄 Scénarios Complexes

### Scénario 1 : Demande Partielle → Complète
```
Étape 1 : Demande MATIN pour 17/12 → ✅ Acceptée
Étape 2 : Demande JOURNEE_COMPLETE pour 17/12 → ❌ Bloquée

Solution :
1. Annuler la demande MATIN
2. Faire demande JOURNEE_COMPLETE
OU
1. Garder demande MATIN
2. Faire demande APRES_MIDI
```

### Scénario 2 : Demande Complète → Partielle
```
Étape 1 : Demande JOURNEE_COMPLETE pour 17/12 → ✅ Acceptée
Étape 2 : Demande MATIN pour 17/12 → ❌ Bloquée

Solution :
1. Garder la JOURNEE_COMPLETE (inutile de demander MATIN en plus)
OU
1. Annuler la JOURNEE_COMPLETE
2. Faire 2 demandes séparées (MATIN + APRES_MIDI)
```

### Scénario 3 : Compléter la Journée
```
Étape 1 : Demande MATIN pour 17/12 → ✅ Acceptée et approuvée
Étape 2 : Demande APRES_MIDI pour 17/12 → ✅ Acceptée

Résultat : Le médecin a 2 créneaux séparés pour la journée complète
```

## 🛡️ Statuts Ignorés

Les demandes avec ces statuts **n'empêchent PAS** de refaire une demande :
- ✅ `REJETE` : Le directeur a refusé
- ✅ `ANNULE` : La demande a été annulée

Les demandes avec ces statuts **empêchent** de refaire une demande :
- ❌ `EN_ATTENTE` : En cours d'examen
- ❌ `APPROUVE` : Déjà approuvée

## 💡 Messages d'Erreur

Tous les messages d'erreur sont explicites et indiquent :
1. **Quel est le conflit** (ex: "journée complète" vs "MATIN")
2. **Pourquoi c'est bloqué** (ex: "vous avez déjà une demande")
3. **Comment résoudre** (ex: "annulez-la d'abord ou demandez seulement le créneau manquant")

## 🔧 Implémentation Technique

### Backend (server.py)

**Lignes 2243-2279 : Demande Individuelle**
```python
# Récupérer toutes les demandes actives pour ce médecin à cette date
demandes_existantes = await db.demandes_travail.find({
    "medecin_id": medecin_id,
    "date_demandee": demande_data.date_demandee,
    "statut": {"$nin": ["REJETE", "ANNULE"]}
}).to_list(length=None)

# Analyser chaque conflit potentiel
for demande_existante in demandes_existantes:
    # Cas 1 : Doublon strict
    # Cas 2 : JOURNEE vs MATIN/APRES_MIDI
    # Cas 3 : MATIN/APRES_MIDI vs JOURNEE
    # Cas 4 : MATIN + APRES_MIDI = OK
```

**Lignes 2209-2235 : Semaine Type**
Même logique appliquée pour chaque jour de la semaine type.

## 🧪 Tests Recommandés

### Test 1 : MATIN + APRES_MIDI
```
1. Demandez MATIN pour demain
2. Demandez APRES_MIDI pour demain
3. ✅ Les 2 demandes doivent être acceptées
```

### Test 2 : Doublon
```
1. Demandez MATIN pour demain
2. Essayez de demander MATIN pour demain encore
3. ❌ Erreur : "Une demande MATIN existe déjà"
```

### Test 3 : JOURNEE après MATIN
```
1. Demandez MATIN pour demain
2. Essayez de demander JOURNEE_COMPLETE
3. ❌ Erreur explicite avec solution
```

### Test 4 : Refaire Après Annulation
```
1. Demandez MATIN pour demain
2. Annulez cette demande
3. Demandez MATIN pour demain à nouveau
4. ✅ Doit fonctionner (ANNULE ignoré)
```

## 📊 Résumé Visuel

```
┌─────────────────────────────────────────────────────┐
│              MATRICE DES CONFLITS                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Existant →     MATIN   APRES_MIDI   JOURNEE        │
│  Nouvelle ↓                                          │
│                                                      │
│  MATIN          ❌       ✅            ❌            │
│  APRES_MIDI     ✅       ❌            ❌            │
│  JOURNEE        ❌       ❌            ❌            │
│                                                      │
└─────────────────────────────────────────────────────┘

✅ = Autorisé (pas de conflit)
❌ = Bloqué (conflit détecté)
```

## 🎓 Pour les Utilisateurs

**Conseil simple :**
Si vous voulez travailler toute la journée :
- **Option 1** : Faites une demande JOURNEE_COMPLETE
- **Option 2** : Faites 2 demandes séparées (MATIN + APRES_MIDI)

Les deux options fonctionnent, mais si vous avez déjà commencé avec l'une, terminez avec cette approche (ou annulez et recommencez avec l'autre).

---

**Date de mise en œuvre** : 15 décembre 2025
**Version** : 2.0
**Auteur** : Agent E1
