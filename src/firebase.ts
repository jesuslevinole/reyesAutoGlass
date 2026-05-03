// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// Si luego usas autenticación, la importarás aquí también
// import { getAuth } from "firebase/auth";

// Tu configuración de Firebase (Sácala de tu consola de Firebase en "Project Settings")
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar y exportar los servicios (En este caso, la base de datos)
export const db = getFirestore(app);