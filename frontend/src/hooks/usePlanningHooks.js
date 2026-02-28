import { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

/**
 * Hook pour gérer les données du planning
 */
export const usePlanningData = (user) => {
  const [planning, setPlanning] = useState([]);
  const [planningSemaine, setPlanningSemaine] = useState(null);
  const [planningMois, setPlanningMois] = useState([]);
  const [users, setUsers] = useState([]);
  const [salles, setSalles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch planning jour
  const fetchPlanningJour = useCallback(async (date) => {
    try {
      const response = await axios.get(`${API}/planning/${date}`);
      setPlanning(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Erreur planning jour:', error);
      setPlanning([]);
    }
  }, []);

  // Fetch planning semaine
  const fetchPlanningSemaine = useCallback(async (date) => {
    try {
      const response = await axios.get(`${API}/planning/semaine/${date}`);
      setPlanningSemaine(response.data);
    } catch (error) {
      console.error('Erreur planning semaine:', error);
      setPlanningSemaine(null);
    }
  }, []);

  // Fetch planning mois
  const fetchPlanningMois = useCallback(async (mois) => {
    try {
      const response = await axios.get(`${API}/planning/mois/${mois}`);
      setPlanningMois(response.data?.planning || []);
    } catch (error) {
      console.error('Erreur planning mois:', error);
      setPlanningMois([]);
    }
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/users`);
      const data = Array.isArray(response.data) ? response.data : [];
      setUsers(data.filter(u => u.actif));
    } catch (error) {
      console.error('Erreur users:', error);
      setUsers([]);
    }
  }, []);

  // Fetch salles
  const fetchSalles = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/salles`);
      setSalles(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Erreur salles:', error);
      setSalles([]);
    }
  }, []);

  // Initialisation
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchUsers(), fetchSalles()]);
      setLoading(false);
    };
    if (user) init();
  }, [user, fetchUsers, fetchSalles]);

  return {
    planning,
    planningSemaine,
    planningMois,
    users,
    salles,
    loading,
    fetchPlanningJour,
    fetchPlanningSemaine,
    fetchPlanningMois,
    fetchUsers,
    fetchSalles,
    refetch: () => Promise.all([fetchUsers(), fetchSalles()])
  };
};

/**
 * Hook pour gérer les filtres du planning
 */
export const usePlanningFilters = () => {
  const [filterRole, setFilterRole] = useState(['Médecin', 'Assistant', 'Secrétaire']);
  const [filterEmploye, setFilterEmploye] = useState('tous');
  const [filterEmployeMois, setFilterEmployeMois] = useState('tous');
  const [showDetails, setShowDetails] = useState(true);
  const [showRecapColumns, setShowRecapColumns] = useState(true);
  const [searchEmploye, setSearchEmploye] = useState('');

  const handleRoleToggle = (role) => {
    if (filterRole.includes(role)) {
      if (filterRole.length > 1) {
        setFilterRole(filterRole.filter(r => r !== role));
      }
    } else {
      setFilterRole([...filterRole, role]);
    }
  };

  const resetFilters = () => {
    setFilterRole(['Médecin', 'Assistant', 'Secrétaire']);
    setFilterEmploye('tous');
    setFilterEmployeMois('tous');
    setSearchEmploye('');
  };

  return {
    filterRole,
    setFilterRole,
    filterEmploye,
    setFilterEmploye,
    filterEmployeMois,
    setFilterEmployeMois,
    showDetails,
    setShowDetails,
    showRecapColumns,
    setShowRecapColumns,
    searchEmploye,
    setSearchEmploye,
    handleRoleToggle,
    resetFilters
  };
};

/**
 * Hook pour gérer la navigation des dates
 */
export const usePlanningNavigation = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWeek, setSelectedWeek] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [viewMode, setViewMode] = useState('jour');

  // Navigation jour
  const navigateDay = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  // Navigation semaine
  const navigateWeek = (direction) => {
    const current = new Date(selectedWeek);
    current.setDate(current.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedWeek(current.toISOString().split('T')[0]);
  };

  // Navigation mois
  const navigateMonth = (direction) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    let newMonth = month + (direction === 'next' ? 1 : -1);
    let newYear = year;
    
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    
    setSelectedMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  // Aller à aujourd'hui
  const goToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    setSelectedWeek(today);
    setSelectedMonth(today.slice(0, 7));
  };

  return {
    selectedDate,
    setSelectedDate,
    selectedWeek,
    setSelectedWeek,
    selectedMonth,
    setSelectedMonth,
    viewMode,
    setViewMode,
    navigateDay,
    navigateWeek,
    navigateMonth,
    goToToday
  };
};

/**
 * Hook pour les opérations CRUD sur les créneaux
 */
export const useCreneaux = (onSuccess) => {
  const [loading, setLoading] = useState(false);

  const createCreneau = async (creneauData) => {
    setLoading(true);
    try {
      await axios.post(`${API}/planning`, creneauData);
      toast.success('Créneau créé');
      onSuccess?.();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur création créneau');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateCreneau = async (id, creneauData) => {
    setLoading(true);
    try {
      await axios.put(`${API}/planning/${id}`, creneauData);
      toast.success('Créneau modifié');
      onSuccess?.();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur modification créneau');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteCreneau = async (id) => {
    setLoading(true);
    try {
      await axios.delete(`${API}/planning/${id}`);
      toast.success('Créneau supprimé');
      onSuccess?.();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur suppression créneau');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const copyCreneau = async (creneauData, targetDate) => {
    return createCreneau({ ...creneauData, date: targetDate });
  };

  return {
    loading,
    createCreneau,
    updateCreneau,
    deleteCreneau,
    copyCreneau
  };
};

export default {
  usePlanningData,
  usePlanningFilters,
  usePlanningNavigation,
  useCreneaux
};
