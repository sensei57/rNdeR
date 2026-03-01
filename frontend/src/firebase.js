// Firebase configuration
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAyFIWDwfSGmcLzfPpPL_qo1w5Vxm6ctS4",
  authDomain: "cabinet-medical-ope.firebaseapp.com",
  projectId: "cabinet-medical-ope",
  storageBucket: "cabinet-medical-ope.appspot.com",
  messagingSenderId: "752001506338",
  appId: "1:752001506338:web:2eb60761bd9d7c00973e7b"
};

// Initialize Firebase
let app = null;
let messaging = null;

try {
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase App initialisé');
  
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    messaging = getMessaging(app);
    console.log('✅ Firebase Messaging initialisé');
  }
} catch (error) {
  console.error('❌ Erreur initialisation Firebase:', error);
}

export { messaging, getToken, onMessage };
export default app;
