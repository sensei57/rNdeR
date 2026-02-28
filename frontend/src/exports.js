// Export des composants modulaires
// Ces composants sont extraits du fichier App.js monolithique

// Contextes
export { AuthProvider, useAuth } from './contexts/AuthContext';
export { PlanningProvider, usePlanning } from './contexts/PlanningContext';

// Utilitaires
export { API, BACKEND_URL, isTestMode } from './utils/api';
export { getPhotoUrl, sortEmployeesByRoleThenName, filterEmployeesBySearch, formatDateFr, getInitials, getRoleColor } from './utils/helpers';

// Composants communs
export { PhotoWithFallback, UserAvatar } from './components/common/PhotoWithFallback';
export { default as ProtectedRoute } from './components/common/ProtectedRoute';
export { LoadingSpinner, EmptyState } from './components/common/LoadingSpinner';

// Composants de gestion
export { CongeManager } from './components/conges';

// Pages
export { default as LoginPage } from './pages/LoginPage';
