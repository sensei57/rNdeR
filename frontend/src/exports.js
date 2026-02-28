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
export { CardSkeleton, StatsSkeleton, PlanningSkeleton, ListSkeleton, DashboardSkeleton, GlobalLoader } from './components/common/Skeletons';

// Composants de gestion
export { CongeManager } from './components/conges';
export { ChatManager } from './components/chat';

// Pages
export { default as LoginPage } from './pages/LoginPage';

// Hooks optimisés
export { useCachedFetch, useSmartPolling, useDebounce, useThrottle, useLazyLoad, invalidateCache } from './hooks/useOptimized';
