import axios from 'axios';

// Configuration automatique de l'URL backend
// Utilise d'abord la variable d'environnement, sinon fallback pour Render.com
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || (
  window.location.hostname.includes('test') 
    ? 'https://ope-francis-test.onrender.com' 
    : 'https://ope-francis.onrender.com'
);

export const isTestMode = window.location.hostname.includes('test') || window.location.hostname.includes('preview');

export const API = `${BACKEND_URL}/api`;

// Configuration axios pour retry automatique sur mobile
axios.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config;
    // Retry jusqu'à 2 fois en cas d'erreur réseau
    if (!config || config.__retryCount >= 2) {
      return Promise.reject(error);
    }
    config.__retryCount = config.__retryCount || 0;
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || !error.response) {
      config.__retryCount += 1;
      console.log(`🔄 Retry ${config.__retryCount}/2 pour ${config.url}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * config.__retryCount));
      return axios(config);
    }
    return Promise.reject(error);
  }
);

// Log pour debug
console.log(`%c 🚀 MODE ${isTestMode ? 'TEST' : 'PROD'} ACTIF `, 
            `background: ${isTestMode ? '#ffeb3b' : '#4caf50'}; color: #000; font-weight: bold;`);
console.log(`%c 🔗 Backend: ${BACKEND_URL} `, 
            `background: #2196f3; color: #fff; font-weight: bold;`);

export default axios;
