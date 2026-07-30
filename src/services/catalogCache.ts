// Caché en memoria de catálogos: una sola lectura por colección por sesión.
// Los selects con búsqueda abren al instante en todos los formularios.

import type { Row } from './firestore';
import { fetchAll, subscribe } from './firestore';

const cache = new Map<string, Promise<Row[]>>();

/* ============ Capa persistente (localStorage) — pinta al instante ============ */

const SNAP_PREFIX = 'gw_snap_';
const MAX_SNAPSHOT_BYTES = 900_000; // proteger la cuota de localStorage

function readSnapshot(collectionName: string): Row[] | null {
  try {
    const raw = localStorage.getItem(SNAP_PREFIX + collectionName);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as Row[] : null;
  } catch {
    return null;
  }
}

function writeSnapshot(collectionName: string, rows: Row[]): void {
  try {
    const raw = JSON.stringify(rows);
    if (raw.length > MAX_SNAPSHOT_BYTES) return; // colecciones enormes no se persisten
    localStorage.setItem(SNAP_PREFIX + collectionName, raw);
  } catch {
    // cuota llena u otro fallo — el caché en memoria sigue funcionando
  }
}

/** subscribe con arranque instantáneo: entrega el snapshot local primero
 *  (si existe) y luego los datos en vivo de Firestore, re-guardando el snapshot. */
export function subscribeCached(
  collectionName: string,
  onRows: (rows: Row[], fromCache: boolean) => void,
  onError?: (error: unknown) => void,
): () => void {
  const snapshot = readSnapshot(collectionName);
  if (snapshot && snapshot.length > 0) onRows(snapshot, true);
  return subscribe(collectionName, (rows) => {
    writeSnapshot(collectionName, rows);
    onRows(rows, false);
  }, onError);
}

/** fetchAll con caché en memoria + localStorage:
 *  la primera llamada de la sesión resuelve al instante con el snapshot local
 *  (si existe) mientras refresca de Firestore en segundo plano. */
export function cachedFetchAll(collectionName: string): Promise<Row[]> {
  const hit = cache.get(collectionName);
  if (hit) return hit;

  const network = fetchAll(collectionName)
    .then((rows) => {
      writeSnapshot(collectionName, rows);
      cache.set(collectionName, Promise.resolve(rows));
      return rows;
    })
    .catch((error: unknown) => {
      cache.delete(collectionName);
      throw error;
    });

  const snapshot = readSnapshot(collectionName);
  if (snapshot && snapshot.length > 0) {
    // Pintar ya con el snapshot; la red actualiza el caché para el siguiente consumo
    const instant = Promise.resolve(snapshot);
    cache.set(collectionName, instant);
    void network;
    return instant;
  }
  cache.set(collectionName, network);
  return network;
}

/** Invalida una colección (tras crear/editar registros de catálogo). */
export function invalidateCatalog(collectionName: string): void {
  cache.delete(collectionName);
  try {
    localStorage.removeItem(SNAP_PREFIX + collectionName);
  } catch {
    // sin acceso a storage — suficiente con limpiar memoria
  }
}

/** Pre-carga en segundo plano los catálogos más usados (al entrar a la app). */
export function warmCatalogs(collections: string[]): void {
  for (const name of collections) void cachedFetchAll(name).catch(() => undefined);
}
