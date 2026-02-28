# Guide de Refactorisation - PlanningManager

## État actuel

Le composant `PlanningManager` dans `App.js` fait environ **9 400 lignes** (lignes 4670-14049).
C'est le composant le plus complexe de l'application.

## Structure actuelle

Le PlanningManager gère 4 modes de vue :
1. **Vue Jour** : Planning détaillé d'une journée
2. **Vue Semaine** : Planning sur 7 jours  
3. **Vue Mois** : Calendrier mensuel
4. **Vue Planning** : Vue directeur complète

## Plan de découpage proposé

### Étape 1 : Extraire les sous-vues

```
/components/planning/
├── index.js
├── PlanningManager.jsx      # Composant orchestrateur (~500 lignes)
├── PlanningHeader.jsx       # Header avec boutons de vue (~100 lignes)
├── PlanningFilters.jsx      # Filtres par rôle/employé (~150 lignes)
├── PlanningJour.jsx         # Vue jour (~800 lignes)
├── PlanningSemaine.jsx      # Vue semaine (~1200 lignes)
├── PlanningMois.jsx         # Vue mois (~600 lignes)
├── PlanningComplet.jsx      # Vue directeur (~1500 lignes)
├── CreneauCard.jsx          # Carte de créneau réutilisable (~200 lignes)
├── CreneauModal.jsx         # Modal création/édition (~400 lignes)
└── hooks/
    ├── usePlanning.js       # Logique de fetch planning
    ├── useCreneaux.js       # CRUD créneaux
    └── usePlanningFilters.js # Gestion des filtres
```

### Étape 2 : Identifier les dépendances

Le PlanningManager dépend de :
- `useAuth()` : Utilisateur courant
- `users` : Liste des employés
- `salles` : Liste des salles
- `planning` : Données du planning jour
- `planningSemaine` : Données du planning semaine
- `planningMois` : Données du planning mois

### Étape 3 : Créer les hooks personnalisés

```javascript
// hooks/usePlanning.js
export const usePlanning = () => {
  const [viewMode, setViewMode] = useState('jour');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [planning, setPlanning] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // ... logique de fetch
  
  return {
    viewMode, setViewMode,
    selectedDate, setSelectedDate,
    planning, loading,
    fetchPlanning
  };
};
```

### Étape 4 : Extraire les composants

#### PlanningHeader.jsx
```jsx
const PlanningHeader = ({ viewMode, setViewMode, hasDirectorView }) => (
  <div className="bg-gradient-to-r from-[#0091B9] to-[#19CD91] rounded-2xl p-6">
    {/* Titre et boutons de vue */}
  </div>
);
```

#### PlanningJour.jsx
```jsx
const PlanningJour = ({ 
  date, 
  planning, 
  users, 
  salles, 
  filterRole,
  filterEmploye,
  onCreateCreneau,
  onEditCreneau,
  onDeleteCreneau 
}) => {
  // Logique vue jour
};
```

### Étape 5 : Composer le PlanningManager

```jsx
const PlanningManager = () => {
  const { viewMode, setViewMode, ... } = usePlanning();
  const { filterRole, filterEmploye, ... } = usePlanningFilters();
  
  return (
    <div className="space-y-6">
      <PlanningHeader 
        viewMode={viewMode} 
        setViewMode={setViewMode}
        hasDirectorView={hasDirectorView()}
      />
      
      <PlanningFilters 
        filterRole={filterRole}
        filterEmploye={filterEmploye}
        // ...
      />
      
      {viewMode === 'jour' && <PlanningJour {...jourProps} />}
      {viewMode === 'semaine' && <PlanningSemaine {...semaineProps} />}
      {viewMode === 'mois' && <PlanningMois {...moisProps} />}
      {viewMode === 'planning' && <PlanningComplet {...completProps} />}
    </div>
  );
};
```

## Ordre de migration recommandé

1. **Créer les hooks** (`usePlanning`, `useCreneaux`, `usePlanningFilters`)
2. **Extraire PlanningHeader** (le plus simple)
3. **Extraire PlanningFilters**
4. **Extraire CreneauCard** et **CreneauModal** (réutilisables)
5. **Extraire PlanningJour** (le plus utilisé)
6. **Extraire PlanningMois** (le plus simple des vues)
7. **Extraire PlanningSemaine**
8. **Extraire PlanningComplet** (le plus complexe)
9. **Remplacer** dans App.js par import du nouveau PlanningManager

## Points d'attention

### État partagé
Le planning utilise beaucoup d'état partagé. Utiliser :
- React Context pour l'état global
- Props drilling minimisé avec composition

### Performance
- Utiliser `useMemo` pour les calculs coûteux
- Utiliser `useCallback` pour les handlers passés aux enfants
- Éviter les re-renders inutiles avec `React.memo`

### Tests
Créer des tests unitaires pour chaque sous-composant avant de les intégrer.

## Estimation du temps

| Tâche | Durée estimée |
|-------|---------------|
| Hooks | 2-3h |
| PlanningHeader | 1h |
| PlanningFilters | 1-2h |
| CreneauCard/Modal | 2-3h |
| PlanningJour | 3-4h |
| PlanningMois | 2h |
| PlanningSemaine | 3-4h |
| PlanningComplet | 4-5h |
| Intégration/Tests | 3-4h |
| **Total** | **~24h** |

## Risques

1. **Régression** : Tester chaque étape avant de continuer
2. **Performance** : Le nouveau code pourrait être moins optimisé
3. **État incohérent** : Bien gérer la synchronisation entre composants

## Conclusion

Cette refactorisation est un travail conséquent mais nécessaire pour la maintenabilité à long terme. Procéder par étapes et tester régulièrement.

---

*Guide de refactorisation v1.0 - Février 2026*
