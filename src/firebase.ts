// Importa las funciones necesarias de los SDKs
import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Configuración de tu web app usando variables de entorno (Sintaxis de Vite)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar y exportar los servicios para usarlos en el resto de la App.
//
// ⭐ Se usa initializeFirestore con auto-detección de long polling en lugar de
//    getFirestore(app). Motivo: en algunas redes/navegadores (extensiones de
//    privacidad/adblock, proxies, firewalls corporativos) el canal de streaming
//    de Firestore (WebChannel "Listen") queda bloqueado y devuelve errores 404,
//    lo que hace que las lecturas resuelvan con la caché local vacía (0 registros).
//    Con esta opción, Firestore detecta ese bloqueo y usa HTTP long-polling,
//    evitando el problema sin afectar al resto de la app.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export const auth = getAuth(app);

export default app;