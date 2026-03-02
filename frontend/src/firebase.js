// Firebase configuration - Using environment variables for security
// NEVER commit API keys to Git! Use .env files instead.
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Configuration Firebase depuis les variables d'environnement
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Vérifier que les variables d'environnement sont définies
const requiredEnvVars = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.warn('⚠️ Variables Firebase manquantes:', missingVars.join(', '));
  console.warn('⚠️ Configurez-les dans le fichier .env');
}

// Initialize Firebase
let app = null;
let messaging = null;

try {
  // Afficher les clés utilisées pour debug
  console.log('🔧 Firebase Config Debug:');
  console.log('   API Key:', firebaseConfig.apiKey);
  console.log('   Project ID:', firebaseConfig.projectId);
  console.log('   App ID:', firebaseConfig.appId);
  console.log('   Messaging Sender ID:', firebaseConfig.messagingSenderId);
  
  // Ne pas initialiser si les clés sont manquantes
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase App initialisé');
    
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      messaging = getMessaging(app);
      console.log('✅ Firebase Messaging initialisé');
    }
  } else {
    console.warn('⚠️ Firebase non initialisé - clés API manquantes');
  }
} catch (error) {
  console.error('❌ Erreur initialisation Firebase:', error);
}

export { messaging, getToken, onMessage };
export default app;
