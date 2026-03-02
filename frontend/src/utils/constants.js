/**
 * Constantes de l'application
 */

// Rôles utilisateur
export const ROLES = {
  SUPER_ADMIN: 'Super-Admin',
  MANAGER: 'Manager',
  DIRECTEUR: 'Directeur',
  MEDECIN: 'Médecin',
  ASSISTANT: 'Assistant',
  SECRETAIRE: 'Secrétaire'
};

// Types de créneaux
export const CRENEAU_TYPES = {
  MATIN: 'MATIN',
  APRES_MIDI: 'APRES_MIDI',
  JOURNEE_COMPLETE: 'JOURNEE_COMPLETE'
};

// Statuts de demande
export const STATUTS = {
  EN_ATTENTE: 'EN_ATTENTE',
  APPROUVE: 'APPROUVE',
  REJETE: 'REJETE',
  ANNULE: 'ANNULE'
};

// Types de congés
export const TYPES_CONGES = {
  CP: 'CP',
  RTT: 'RTT',
  ABS: 'ABS',
  MALADIE: 'Maladie',
  FORMATION: 'Formation',
  AUTRE: 'Autre'
};

// Couleurs par rôle
export const ROLE_COLORS = {
  'Médecin': 'bg-blue-100 text-blue-800',
  'Assistant': 'bg-green-100 text-green-800',
  'Secrétaire': 'bg-purple-100 text-purple-800',
  'Directeur': 'bg-red-100 text-red-800',
  'Super-Admin': 'bg-red-100 text-red-800',
  'Manager': 'bg-orange-100 text-orange-800'
};

// Jours de la semaine
export const JOURS_SEMAINE = [
  'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'
];

// Horaires par défaut
export const HORAIRES_DEFAULT = {
  matin: { debut: '08:00', fin: '12:00' },
  apres_midi: { debut: '14:00', fin: '18:00' }
};
