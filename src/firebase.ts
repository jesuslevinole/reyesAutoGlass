import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Credenciales vía variables de entorno (.env.local — ver README).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

/** Visible en el pie del sidebar para confirmar a qué proyecto está conectada la app. */
export const firebaseProjectId: string = firebaseConfig.projectId ?? 'sin configurar';
