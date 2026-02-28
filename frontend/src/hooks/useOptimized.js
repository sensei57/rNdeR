// Hooks personnalisés pour améliorer la réactivité

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Cache simple en mémoire
const cache = new Map();
const CACHE_DURATION = 30000; // 30 secondes

/**
 * Hook pour fetch avec cache et gestion d'erreur optimisée
 */
export const useCachedFetch = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { 
    cacheDuration = CACHE_DURATION, 
    skip = false,
    transform = (d) => d 
  } = options;

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (skip) {
      setLoading(false);
      return;
    }

    const cacheKey = url;
    const cached = cache.get(cacheKey);
    
    // Utiliser le cache si valide et pas de force refresh
    if (!forceRefresh && cached && Date.now() - cached.timestamp < cacheDuration) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${API}${url}`, { timeout: 10000 });
      const transformedData = transform(response.data);
      
      // Mettre en cache
      cache.set(cacheKey, {
        data: transformedData,
        timestamp: Date.now()
      });
      
      setData(transformedData);
      setError(null);
    } catch (err) {
      console.error(`Erreur fetch ${url}:`, err);
      setError(err);
      // Utiliser le cache périmé en cas d'erreur
      if (cached) {
        setData(cached.data);
      }
    } finally {
      setLoading(false);
    }
  }, [url, cacheDuration, skip, transform]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: () => fetchData(true) };
};

/**
 * Hook pour polling intelligent (s'arrête quand l'onglet est caché)
 */
export const useSmartPolling = (callback, interval = 30000) => {
  const savedCallback = useRef(callback);
  const intervalRef = useRef(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') {
        savedCallback.current();
      }
    };

    // Premier appel immédiat
    tick();

    // Polling
    intervalRef.current = setInterval(tick, interval);

    // Pause quand l'onglet est caché
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick(); // Refresh immédiat au retour
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [interval]);

  return intervalRef;
};

/**
 * Hook pour debounce (éviter les appels trop fréquents)
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook pour throttle (limiter les appels)
 */
export const useThrottle = (callback, limit = 1000) => {
  const lastRan = useRef(Date.now());
  const lastFunc = useRef(null);

  return useCallback((...args) => {
    const now = Date.now();
    
    if (now - lastRan.current >= limit) {
      callback(...args);
      lastRan.current = now;
    } else {
      clearTimeout(lastFunc.current);
      lastFunc.current = setTimeout(() => {
        callback(...args);
        lastRan.current = Date.now();
      }, limit - (now - lastRan.current));
    }
  }, [callback, limit]);
};

/**
 * Hook pour lazy loading des données
 */
export const useLazyLoad = (fetchFn) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (loaded) return data;
    
    setLoading(true);
    try {
      const result = await fetchFn();
      setData(result);
      setLoaded(true);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchFn, loaded, data]);

  return { data, loading, loaded, error, load };
};

/**
 * Invalider le cache (utile après une modification)
 */
export const invalidateCache = (urlPattern = null) => {
  if (urlPattern) {
    for (const key of cache.keys()) {
      if (key.includes(urlPattern)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
};

export default {
  useCachedFetch,
  useSmartPolling,
  useDebounce,
  useThrottle,
  useLazyLoad,
  invalidateCache
};
