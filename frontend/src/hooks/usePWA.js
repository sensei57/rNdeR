import { useState, useEffect } from 'react';

/**
 * Hook personnalisé pour gérer l'installation PWA
 * Permet d'afficher un bouton "Installer l'application" et de gérer le processus d'installation
 */
export const usePWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Vérifier si c'est iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // Vérifier si déjà installé (mode standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    setIsInstalled(isStandalone);

    // Écouter l'événement beforeinstallprompt (Chrome, Edge, etc.)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log('[PWA] Application installable détectée');
    };

    // Écouter l'événement appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('[PWA] Application installée avec succès');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Enregistrer le service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker enregistré:', registration.scope);
        })
        .catch((error) => {
          console.error('[PWA] Erreur Service Worker:', error);
        });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Fonction pour déclencher l'installation
  const installApp = async () => {
    if (!deferredPrompt) {
      console.log('[PWA] Pas de prompt disponible');
      return false;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] Résultat installation:', outcome);
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[PWA] Erreur installation:', error);
      return false;
    }
  };

  return {
    isInstallable,
    isInstalled,
    isIOS,
    installApp,
    // Instructions pour iOS (doit être fait manuellement)
    iOSInstructions: isIOS && !isInstalled ? 
      "Pour installer l'app sur iPhone/iPad : Appuyez sur le bouton Partager (⬆️) puis 'Sur l'écran d'accueil'" 
      : null
  };
};

export default usePWA;
