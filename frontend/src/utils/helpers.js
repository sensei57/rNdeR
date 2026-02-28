import { BACKEND_URL } from './api';

// Fonction utilitaire pour obtenir l'URL complète d'une photo
export const getPhotoUrl = (photoUrl) => {
  if (!photoUrl) return null;
  // Si c'est une URL locale uploadée (commence par /api)
  if (photoUrl.startsWith('/api')) {
    return `${BACKEND_URL}${photoUrl}`;
  }
  // Sinon c'est une URL externe complète
  return photoUrl;
};

// Fonction utilitaire pour trier les employés par rôle (Médecin > Assistant > Secrétaire) puis par prénom
export const sortEmployeesByRoleThenName = (employees) => {
  const roleOrder = { 'Médecin': 1, 'Assistant': 2, 'Secrétaire': 3, 'Directeur': 4 };
  return [...employees].sort((a, b) => {
    // D'abord trier par rôle
    const roleA = roleOrder[a.role] || 99;
    const roleB = roleOrder[b.role] || 99;
    if (roleA !== roleB) return roleA - roleB;
    // Ensuite par prénom (alphabétique)
    return (a.prenom || '').localeCompare(b.prenom || '', 'fr');
  });
};

// Fonction pour filtrer les employés par recherche de nom/prénom
export const filterEmployeesBySearch = (employees, searchTerm) => {
  if (!searchTerm || searchTerm.trim() === '') return employees;
  const term = searchTerm.toLowerCase().trim();
  return employees.filter(emp => 
    (emp.prenom && emp.prenom.toLowerCase().includes(term)) ||
    (emp.nom && emp.nom.toLowerCase().includes(term)) ||
    (`${emp.prenom} ${emp.nom}`.toLowerCase().includes(term))
  );
};

// Formater une date en français
export const formatDateFr = (date, options = {}) => {
  const defaultOptions = { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  };
  return new Date(date).toLocaleDateString('fr-FR', { ...defaultOptions, ...options });
};

// Obtenir les initiales d'un nom
export const getInitials = (prenom, nom) => {
  return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase();
};

// Couleur du rôle
export const getRoleColor = (role) => {
  switch (role) {
    case 'Médecin':
      return 'bg-gradient-to-br from-blue-400 to-blue-600';
    case 'Assistant':
      return 'bg-gradient-to-br from-emerald-400 to-emerald-600';
    case 'Secrétaire':
      return 'bg-gradient-to-br from-purple-400 to-purple-600';
    case 'Manager':
      return 'bg-gradient-to-br from-orange-400 to-orange-600';
    case 'Super-Admin':
    case 'Directeur':
      return 'bg-gradient-to-br from-gray-600 to-gray-800';
    default:
      return 'bg-gradient-to-br from-gray-400 to-gray-600';
  }
};
