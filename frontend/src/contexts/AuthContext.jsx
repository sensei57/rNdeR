import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../utils/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [centres, setCentres] = useState([]);
  const [centreActif, setCentreActif] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Configuration axios avec retry automatique
  useEffect(() => {
    // Intercepteur pour retry automatique sur erreur réseau
    const interceptor = axios.interceptors.response.use(
      response => response,
      async error => {
        const config = error.config;
        
        // Ne pas retry si c'est une erreur d'auth ou si on a déjà retry
        if (error.response?.status === 401 || error.response?.status === 403) {
          return Promise.reject(error);
        }
        
        // Retry sur erreur réseau (timeout, network error)
        if (!config._retryCount) {
          config._retryCount = 0;
        }
        
        if (config._retryCount < 2 && (!error.response || error.response.status >= 500)) {
          config._retryCount += 1;
          console.log(`Retry ${config._retryCount} pour ${config.url}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * config._retryCount));
          return axios(config);
        }
        
        return Promise.reject(error);
      }
    );
    
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/users/me`, { timeout: 60000 });
      setUser(response.data);
      setRetryCount(0); // Reset retry count on success
      
      // Charger les centres
      try {
        const centresResponse = await axios.get(`${API}/centres`, { timeout: 60000 });
        const allCentres = centresResponse.data.centres || [];
        
        if (response.data.role === 'Super-Admin' || response.data.role === 'Directeur') {
          setCentres(allCentres);
          
          if (response.data.centre_actif_id) {
            const actif = allCentres.find(c => c.id === response.data.centre_actif_id);
            setCentreActif(actif || allCentres[0] || null);
          } else if (allCentres.length > 0) {
            setCentreActif(allCentres[0]);
          }
        } else {
          const userCentreIds = response.data.centre_ids || (response.data.centre_id ? [response.data.centre_id] : []);
          if (userCentreIds.length > 0) {
            const userCentres = allCentres.filter(c => userCentreIds.includes(c.id));
            setCentres(userCentres);
            
            const centreActifId = response.data.centre_actif_id || userCentreIds[0];
            const activeCentre = userCentres.find(c => c.id === centreActifId);
            setCentreActif(activeCentre || userCentres[0] || null);
          }
        }
      } catch (centreError) {
        console.warn('Erreur chargement centres, utilisation des données en cache:', centreError);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error);
      
      // Retry automatique sur erreur réseau (pas sur 401/403)
      if (retryCount < maxRetries && (!error.response || error.response.status >= 500)) {
        setRetryCount(prev => prev + 1);
        console.log(`Retry fetchCurrentUser (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => fetchCurrentUser(), 2000 * (retryCount + 1));
        return;
      }
      
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, centreId = null) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password, centre_id: centreId });
      const { access_token, user: userData, centres: userCentres } = response.data;
      
      setToken(access_token);
      setUser(userData);
      setCentres(userCentres || []);
      
      // Définir le centre actif
      if (userCentres && userCentres.length > 0) {
        const actif = centreId 
          ? userCentres.find(c => c.id === centreId) 
          : userCentres[0];
        setCentreActif(actif || userCentres[0]);
      }
      
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      toast.success('Connexion réussie !');
      
      return true;
    } catch (error) {
      const message = error.response?.data?.detail || 'Email ou mot de passe incorrect';
      toast.error(message);
      throw error;
    }
  };

  const switchCentre = async (centreId) => {
    try {
      const response = await axios.post(`${API}/centres/${centreId}/switch`);
      const newCentre = centres.find(c => c.id === centreId);
      setCentreActif(newCentre);
      
      // Mettre à jour l'utilisateur
      setUser(prev => ({ ...prev, centre_actif_id: centreId }));
      
      toast.success(response.data.message);
      
      // Recharger la page pour mettre à jour toutes les données
      window.location.reload();
    } catch (error) {
      toast.error('Erreur lors du changement de centre');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setCentres([]);
    setCentreActif(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    toast.success('Déconnexion réussie');
  };

  return (
    <AuthContext.Provider value={{ 
      user, setUser, token, setToken, 
      centres, setCentres, centreActif, setCentreActif,
      login, logout, switchCentre, loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
