// ============================================================
// Caché de lecturas Firestore — diseñado para MINIMIZAR lecturas:
//  1) Snapshots persistentes en localStorage (con trozos para
//     colecciones grandes como los 11k part numbers).
//  2) TTL por colección: si el snapshot está fresco NO se toca la
//     red (cero lecturas); si está viejo, pinta el snapshot y
//     refresca en segundo plano una sola vez.
//  3) Listeners PERSISTENTES: una sola suscripción onSnapshot por
//     colección para toda la sesión — volver a entrar a un módulo
//     NO re-lee la colección completa, solo recibe deltas.
// ============================================================

import type { Row } from './firestore';
import { fetchAll, subscribe } from './firestore';

/* ============ Snapshots en localStorage (con trozos) ============ */

const SNAP_PREFIX = 'gw_snap_';
const CHUNK_BYTES = 700_000;      // tamaño por trozo
const MAX_TOTAL_BYTES = 3_500_000; // tope total por colección

interface SnapshotMeta { t: number; chunks: number }

function readSnapshot(collectionName: string): { rows: Row[]; t: number } | null {
  try {
    const metaRaw = localStorage.getItem(SNAP_PREFIX + collectionName);
    if (!metaRaw) return null;
    const meta = JSON.parse(metaRaw) as SnapshotMeta | Row[];
    // Formato viejo: el doc era directamente el array
    if (Array.isArray(meta)) return { rows: meta, t: 0 };
    let raw = '';
    for (let i = 0; i < meta.chunks; i++) {
      const part = localStorage.getItem(`${SNAP_PREFIX}${collectionName}__${i}`);
      if (part === null) return null;
      raw += part;
    }
    const rows = JSON.parse(raw) as Row[];
    return Array.isArray(rows) ? { rows, t: meta.t } : null;
  } catch {
    return null;
  }
}

function writeSnapshot(collectionName: string, rows: Row[]): void {
  try {
    const raw = JSON.stringify(rows);
    if (raw.length > MAX_TOTAL_BYTES) return;
    const chunks = Math.max(1, Math.ceil(raw.length / CHUNK_BYTES));
    for (let i = 0; i < chunks; i++) {
      localStorage.setItem(
        `${SNAP_PREFIX}${collectionName}__${i}`,
        raw.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES),
      );
    }
    const meta: SnapshotMeta = { t: Date.now(), chunks };
    localStorage.setItem(SNAP_PREFIX + collectionName, JSON.stringify(meta));
  } catch {
    // cuota llena — la memoria sigue funcionando
  }
}

function clearSnapshot(collectionName: string): void {
  try {
    const metaRaw = localStorage.getItem(SNAP_PREFIX + collectionName);
    if (metaRaw) {
      const meta = JSON.parse(metaRaw) as SnapshotMeta | Row[];
      const chunks = Array.isArray(meta) ? 0 : meta.chunks;
      for (let i = 0; i < chunks; i++) {
        localStorage.removeItem(`${SNAP_PREFIX}${collectionName}__${i}`);
      }
    }
    localStorage.removeItem(SNAP_PREFIX + collectionName);
  } catch {
    // sin acceso a storage
  }
}

/* ============ TTL por colección ============ */

const DAY = 24 * 60 * 60 * 1000;
/** Mientras el snapshot sea más joven que esto, NO se lee la red. */
function ttlFor(collectionName: string): number {
  if (collectionName === 'catalog_part_number') return 7 * DAY; // 11k docs, casi estático
  if (collectionName.startsWith('catalog_')) return DAY;
  if (collectionName === 'config_ui') return DAY;
  return 6 * 60 * 60 * 1000; // resto: 6 horas
}

/* ============ fetchAll con caché de dos capas + TTL ============ */

const memory = new Map<string, Promise<Row[]>>();

export function cachedFetchAll(collectionName: string): Promise<Row[]> {
  const hit = memory.get(collectionName);
  if (hit) return hit;

  const snap = readSnapshot(collectionName);
  const fresh = snap && Date.now() - snap.t < ttlFor(collectionName);

  if (snap && fresh) {
    // Snapshot vigente → CERO lecturas de red
    const instant = Promise.resolve(snap.rows);
    memory.set(collectionName, instant);
    return instant;
  }

  const network = fetchAll(collectionName)
    .then((rows) => {
      writeSnapshot(collectionName, rows);
      memory.set(collectionName, Promise.resolve(rows));
      return rows;
    })
    .catch((error: unknown) => {
      memory.delete(collectionName);
      throw error;
    });

  if (snap) {
    // Snapshot viejo: pintar ya, refrescar una vez en segundo plano
    const instant = Promise.resolve(snap.rows);
    memory.set(collectionName, instant);
    void network;
    return instant;
  }
  memory.set(collectionName, network);
  return network;
}

/* ============ Suscripciones persistentes (una por colección) ============ */

interface LiveEntry {
  rows: Row[] | null;
  listeners: Set<(rows: Row[], fromCache: boolean) => void>;
  errorListeners: Set<(error: Error) => void>;
}
const live = new Map<string, LiveEntry>();

/** subscribe con arranque instantáneo y UNA sola suscripción de red por
 *  colección para toda la sesión: re-entrar a un módulo no re-lee nada. */
export function subscribeCached(
  collectionName: string,
  onRows: (rows: Row[], fromCache: boolean) => void,
  onError?: (error: Error) => void,
): () => void {
  let entry = live.get(collectionName);
  if (!entry) {
    entry = { rows: null, listeners: new Set(), errorListeners: new Set() };
    live.set(collectionName, entry);
    // Listener de red único y persistente (no se cancela al salir de la vista)
    subscribe(collectionName, (rows) => {
      const e = live.get(collectionName);
      if (!e) return;
      e.rows = rows;
      writeSnapshot(collectionName, rows);
      memory.set(collectionName, Promise.resolve(rows));
      for (const cb of e.listeners) cb(rows, false);
    }, (error) => {
      const e = live.get(collectionName);
      if (!e) return;
      for (const cb of e.errorListeners) cb(error);
    });
  }

  entry.listeners.add(onRows);
  if (onError) entry.errorListeners.add(onError);

  // Arranque instantáneo: datos vivos si ya llegaron, o snapshot local
  if (entry.rows) {
    onRows(entry.rows, false);
  } else {
    const snap = readSnapshot(collectionName);
    if (snap && snap.rows.length > 0) onRows(snap.rows, true);
  }

  return () => {
    entry.listeners.delete(onRows);
    if (onError) entry.errorListeners.delete(onError);
    // El listener de red se conserva: los deltas siguen llegando baratos
  };
}

/* ============ Invalidación ============ */

export function invalidateCatalog(collectionName: string): void {
  memory.delete(collectionName);
  clearSnapshot(collectionName);
  // Si hay listener vivo, su próximo snapshot re-escribe el caché solo
}

/** Pre-carga en segundo plano (solo colecciones chicas). */
export function warmCatalogs(collections: string[]): void {
  for (const name of collections) void cachedFetchAll(name).catch(() => undefined);
}
