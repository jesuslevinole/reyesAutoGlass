// Autenticación provisional. El bypass permite entrar sin credenciales mientras
// se conecta Firebase Auth — poner en false antes de salir a producción real.
export const BYPASS_ENABLED = true;

export interface Session {
  name: string;
  email?: string;
}

const STORAGE_KEY = 'glassworks_session';

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return typeof parsed?.name === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
