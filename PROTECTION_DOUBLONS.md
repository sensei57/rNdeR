# 🛡️ Protection Contre les Doublons et Conflits

## ✅ Ce Qui Est Protégé (Après Déploiement)

### 1. Doublons EN_ATTENTE

**Scénario :**
```
Médecin crée Demande 1 : MATIN pour 17/12 → EN_ATTENTE ✅
Médecin essaie Demande 2 : MATIN pour 17/12 → ❌ BLOQUÉ
```

**Protection :**
- Ligne 2267-2271 : Récupère toutes demandes avec statut != REJETE/ANNULE
- Ligne 2280-2284 : Détecte doublon strict (même créneau)
- Message : "Une demande MATIN existe déjà pour cette date"

**Statuts inclus dans la vérification :**
- ✅ EN_ATTENTE (demande en cours d'examen)
- ✅ APPROUVE (demande déjà approuvée)
- ❌ REJETE (ignoré - médecin peut redemander)
- ❌ ANNULE (ignoré - médecin peut redemander)

---

### 2. Doublons APPROUVE

**Scénario :**
```
Demande 1 : MATIN → APPROUVEE ✅
Médecin essaie Demande 2 : MATIN → ❌ BLOQUÉ
```

**Protection :**
- Même logique que doublons EN_ATTENTE
- Une demande APPROUVEE empêche de refaire la même demande

---

### 3. Conflits EN_ATTENTE + EN_ATTENTE

**Scénario :**
```
Demande 1 : MATIN → EN_ATTENTE ✅
Médecin essaie Demande 2 : JOURNEE_COMPLETE → ❌ BLOQUÉ
```

**Protection :**
- Ligne 2289-2294 : Détecte JOURNEE vs MATIN/APRES_MIDI
- Message : "Impossible de demander une journée complète : vous avez déjà une demande pour l'MATIN. Annulez-la d'abord..."

---

### 4. Conflits EN_ATTENTE + APPROUVE

**Scénario :**
```
Demande 1 : MATIN → APPROUVEE ✅
Médecin essaie Demande 2 : JOURNEE_COMPLETE → ❌ BLOQUÉ
```

**Protection :**
- Même logique que #3
- Peu importe le statut (EN_ATTENTE ou APPROUVE), le conflit est détecté

---

### 5. Conflits à l'Approbation (Directeur)

**Scénario :**
```
Demande 1 : MATIN → EN_ATTENTE
Demande 2 : JOURNEE → EN_ATTENTE
Directeur approuve Demande 1 ✅
Directeur essaie d'approuver Demande 2 ❌ BLOQUÉ
```

**Protection :**
- Ligne 2562-2596 : Vérification avant approbation
- Détecte demandes APPROUVEES qui seraient en conflit
- Message : "Impossible d'approuver JOURNEE_COMPLETE : ce médecin a déjà MATIN approuvé..."

---

## 🔍 Tous les Cas Gérés

### Matrice Complète (Demande Existante vs Nouvelle Demande)

```
┌─────────────────────────────────────────────────────────────────┐
│  Existant →          MATIN         APRES_MIDI      JOURNEE       │
│  Statut ↓          EN_ATT/APPR    EN_ATT/APPR    EN_ATT/APPR    │
│  Nouvelle ↓                                                      │
├─────────────────────────────────────────────────────────────────┤
│  MATIN                ❌             ✅              ❌           │
│  APRES_MIDI           ✅             ❌              ❌           │
│  JOURNEE              ❌             ❌              ❌           │
└─────────────────────────────────────────────────────────────────┘

✅ = Autorisé (pas de conflit)
❌ = Bloqué (conflit détecté)
```

### Détail par Combinaison

**1. MATIN Existant (EN_ATTENTE ou APPROUVE)**
- ❌ Nouvelle MATIN → Doublon strict bloqué
- ✅ Nouvelle APRES_MIDI → OK (créneaux différents)
- ❌ Nouvelle JOURNEE → Conflit (JOURNEE inclut MATIN)

**2. APRES_MIDI Existant (EN_ATTENTE ou APPROUVE)**
- ✅ Nouvelle MATIN → OK (créneaux différents)
- ❌ Nouvelle APRES_MIDI → Doublon strict bloqué
- ❌ Nouvelle JOURNEE → Conflit (JOURNEE inclut APRES_MIDI)

**3. JOURNEE Existante (EN_ATTENTE ou APPROUVE)**
- ❌ Nouvelle MATIN → Conflit (JOURNEE couvre déjà MATIN)
- ❌ Nouvelle APRES_MIDI → Conflit (JOURNEE couvre déjà APRES_MIDI)
- ❌ Nouvelle JOURNEE → Doublon strict bloqué

---

## 🚫 Ce Qui N'Est PAS Un Conflit

### Demandes sur Dates Différentes
```
✅ MATIN 17/12 + MATIN 18/12 → OK (dates différentes)
```

### Demandes REJETEES ou ANNULEES
```
✅ MATIN 17/12 REJETE + MATIN 17/12 nouvelle → OK (REJETE ignoré)
✅ MATIN 17/12 ANNULE + MATIN 17/12 nouvelle → OK (ANNULE ignoré)
```

### MATIN + APRES_MIDI Même Date
```
✅ MATIN 17/12 + APRES_MIDI 17/12 → OK (créneaux différents)
```

---

## 🔧 Implémentation Technique

### Protection Niveau 1 : Création (Backend)

**Fichier :** `server.py`
**Lignes :** 2263-2306

**Logique :**
1. Récupérer toutes demandes médecin/date avec statut actif
2. Pour chaque demande existante :
   - Vérifier doublon strict
   - Vérifier conflit JOURNEE vs MATIN/APRES_MIDI
   - Vérifier conflit MATIN/APRES_MIDI vs JOURNEE
3. Bloquer si conflit détecté

**Statuts actifs vérifiés :**
```python
"statut": {"$nin": ["REJETE", "ANNULE"]}
# Inclut : EN_ATTENTE, APPROUVE
# Exclut : REJETE, ANNULE
```

### Protection Niveau 2 : Approbation (Backend)

**Fichier :** `server.py`
**Lignes :** 2562-2596

**Logique :**
1. Avant d'approuver, récupérer demandes APPROUVEES médecin/date
2. Vérifier conflits avec la demande à approuver
3. Bloquer si conflit détecté

**Statuts vérifiés :**
```python
"statut": "APPROUVE"
# Vérifie uniquement les demandes déjà approuvées
```

---

## 🧪 Tests de Validation

### Test 1 : Doublon EN_ATTENTE Strict
```
1. Médecin → Demande MATIN 17/12
2. Médecin → Demande MATIN 17/12 (encore)
3. ❌ "Une demande MATIN existe déjà pour cette date"
```

### Test 2 : Doublon EN_ATTENTE + APPROUVE
```
1. Médecin → Demande MATIN 17/12
2. Directeur → Approuve
3. Médecin → Demande MATIN 17/12 (encore)
4. ❌ "Une demande MATIN existe déjà pour cette date"
```

### Test 3 : Conflit EN_ATTENTE JOURNEE vs MATIN
```
1. Médecin → Demande MATIN 17/12
2. Médecin → Demande JOURNEE 17/12
3. ❌ "Impossible de demander une journée complète : vous avez déjà une demande pour l'MATIN..."
```

### Test 4 : Conflit à l'Approbation
```
1. Médecin → Demande MATIN 17/12
2. Médecin → Demande JOURNEE 17/12
3. Directeur → Approuve MATIN
4. Directeur → Essaie d'approuver JOURNEE
5. ❌ "Impossible d'approuver JOURNEE_COMPLETE : ce médecin a déjà MATIN approuvé..."
```

### Test 5 : MATIN + APRES_MIDI OK
```
1. Médecin → Demande MATIN 17/12
2. Médecin → Demande APRES_MIDI 17/12
3. ✅ Les 2 acceptées (créneaux différents)
```

### Test 6 : Refaire Après Annulation
```
1. Médecin → Demande MATIN 17/12
2. Annuler la demande
3. Médecin → Demande MATIN 17/12 (refait)
4. ✅ Acceptée (ANNULE ignoré)
```

---

## 📊 Statistiques de Protection

**Nombre de vérifications par demande :**
- ✅ Vérification statuts actifs (EN_ATTENTE + APPROUVE)
- ✅ Vérification doublons stricts
- ✅ Vérification conflits JOURNEE
- ✅ Vérification conflits partiels
- ✅ Double vérification à l'approbation

**Total : 5 niveaux de protection**

---

## ⚠️ État Actuel

**Version Déployée (Production) :**
❌ Aucune protection active
❌ Doublons possibles
❌ Conflits possibles

**Version Locale (Développement) :**
✅ Toutes protections actives
✅ Doublons bloqués
✅ Conflits bloqués

**Action requise :**
🔴 **SAVE TO GITHUB + REDEPLOY pour activer toutes les protections**

---

**Date de documentation :** 15 décembre 2025
**Auteur :** Agent E1
**Version :** 2.1
