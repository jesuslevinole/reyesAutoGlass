import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';

// ============================================================================
//  ⚠️ ACCESO TEMPORAL SIN CREDENCIALES (BYPASS)
//  Pon esto en `false` (o elimina el bloque de bypass) ANTES de producción.
//  Con `true`, aparece el botón "Entrar como Super Admin" en el login y
//  permite entrar sin correo ni contraseña.
// ============================================================================
export const BYPASS_ENABLED = true;
const BYPASS_KEY = 'rag_bypass_session';

interface AuthContextValue {
  user: User | null;
  bypass: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  enterBypass: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Se recuerda el bypass durante la pestaña (sessionStorage) para sobrevivir a las redirecciones.
  const [bypass, setBypass] = useState<boolean>(
    () => BYPASS_ENABLED && sessionStorage.getItem(BYPASS_KEY) === '1'
  );

  useEffect(() => {
    // Mantiene la sesión sincronizada (persistencia local por defecto de Firebase).
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const logout = async () => {
    // Limpia también el bypass al cerrar sesión.
    setBypass(false);
    sessionStorage.removeItem(BYPASS_KEY);
    try {
      await signOut(auth);
    } catch {
      // Si no había sesión real de Firebase (caso bypass), no es un error.
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const enterBypass = () => {
    if (!BYPASS_ENABLED) return;
    sessionStorage.setItem(BYPASS_KEY, '1');
    setBypass(true);
  };

  return (
    <AuthContext.Provider value={{ user, bypass, loading, login, logout, resetPassword, enterBypass }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
};

/**
 * Traduce los códigos de error de Firebase Auth a mensajes en español.
 */
export const authErrorMessage = (error: unknown): string => {
  const code = (error as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-email': return 'El correo no tiene un formato válido.';
    case 'auth/user-disabled': return 'Esta cuenta está deshabilitada.';
    case 'auth/user-not-found': return 'No existe una cuenta con ese correo.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Correo o contraseña incorrectos.';
    case 'auth/too-many-requests': return 'Demasiados intentos. Intenta de nuevo en unos minutos.';
    case 'auth/network-request-failed': return 'Error de red. Revisa tu conexión.';
    case 'auth/missing-password': return 'Ingresa tu contraseña.';
    default: return 'No se pudo iniciar sesión. Verifica tus datos e intenta de nuevo.';
  }
};