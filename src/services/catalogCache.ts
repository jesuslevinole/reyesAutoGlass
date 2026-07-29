// Caché en memoria de catálogos: una sola lectura por colección por sesión.
// Los selects con búsqueda abren al instante en todos los formularios.

import type { Row } from './firestore';
import { fetchAll } from './firestore';

const cache = new Map<string, Promise<Row[]>>();

/** fetchAll con caché — llamadas repetidas reutilizan la misma promesa/resultado. */
export function cachedFetchAll(collectionName: string): Promise<Row[]> {
  const hit = cache.get(collectionName);
  if (hit) return hit;
  const promise = fetchAll(collectionName).catch((error: unknown) => {
    // No cachear errores: el siguiente intento vuelve a leer
    cache.delete(collectionName);
    throw error;
  });
  cache.set(collectionName, promise);
  return promise;
}

/** Invalida una colección (tras crear/editar registros de catálogo). */
export function invalidateCatalog(collectionName: string): void {
  cache.delete(collectionName);
}

/** Pre-carga en segundo plano los catálogos más usados (al entrar a la app). */
export function warmCatalogs(collections: string[]): void {
  for (const name of collections) void cachedFetchAll(name).catch(() => undefined);
}
