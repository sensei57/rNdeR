// Firebase configuration
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAyFIWDwfSGmcLzfPpPL_qo1w5Vxm6ctS4",
  authDomain: "cabinet-medical-ope.firebaseapp.com",
  projectId: "cabinet-medical-ope",
  storageBucket: "cabinet-medical-ope.firebasestorage.app",
  messagingSenderId: "752001506338",
  appId: "1:752001506338:web:2eb60761bd9d7c00973e7b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
let messaging = null;

try {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.error('Error initializing Firebase Messaging:', error);
}

export { messaging, getToken, onMessage };
export default app;