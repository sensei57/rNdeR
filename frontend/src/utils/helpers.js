/**
 * Fonctions utilitaires pour l'application
 */
import { BACKEND_URL } from './api';

/**
 * Obtient l'URL complète d'une photo
 */
export const getPhotoUrl = (photoUrl) => {
  if (!photoUrl) return null;
  if (photoUrl.startsWith('/api')) {
    return `${BACKEND_URL}${photoUrl}`;
  }
  return photoUrl;
};

/**
 * Trie les employés par rôle puis par prénom
 */
export const sortEmployeesByRoleThenName = (employees) => {
  const roleOrder = { 'Médecin': 1, 'Assistant': 2, 'Secrétaire': 3, 'Directeur': 4 };
  return [...employees].sort((a, b) => {
    const roleA = roleOrder[a.role] || 99;
    const roleB = roleOrder[b.role] || 99;
    if (roleA !== roleB) return roleA - roleB;
    return (a.prenom || '').localeCompare(b.prenom || '', 'fr');
  });
};

/**
 * Filtre les employés par recherche de nom/prénom
 */
export const filterEmployeesBySearch = (employees, searchTerm) => {
  if (!searchTerm || searchTerm.trim() === '') return employees;
  const term = searchTerm.toLowerCase().trim();
  return employees.filter(emp =>
    (emp.prenom && emp.prenom.toLowerCase().includes(term)) ||
    (emp.nom && emp.nom.toLowerCase().includes(term)) ||
    (`${emp.prenom} ${emp.nom}`.toLowerCase().includes(term))
  );
};

/**
 * Formate une date en français
 */
export const formatDate = (dateString, options = {}) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const defaultOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options
  };
  return date.toLocaleDateString('fr-FR', defaultOptions);
};

/**
 * Formate un nom complet avec titre si médecin
 */
export const formatUserName = (user) => {
  if (!user) return '';
  const prefix = user.role === 'Médecin' ? 'Dr. ' : '';
  return `${prefix}${user.prenom || ''} ${user.nom || ''}`.trim();
};

/**
 * Rôles utilisateur
 */
export const ROLES = {
  SUPER_ADMIN: 'Super-Admin',
  MANAGER: 'Manager',
  DIRECTEUR: 'Directeur',
  MEDECIN: 'Médecin',
  ASSISTANT: 'Assistant',
  SECRETAIRE: 'Secrétaire'
};

/**
 * Types de créneaux
 */
export const CRENEAU_TYPES = {
  MATIN: 'MATIN',
  APRES_MIDI: 'APRES_MIDI',
  JOURNEE_COMPLETE: 'JOURNEE_COMPLETE'
};

/**
 * Statuts de demande
 */
export const STATUTS = {
  EN_ATTENTE: 'EN_ATTENTE',
  APPROUVE: 'APPROUVE',
  REJETE: 'REJETE',
  ANNULE: 'ANNULE'
};
