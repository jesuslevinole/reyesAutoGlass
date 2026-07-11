import {
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { CustomerData } from '../types/customer';

/**
 * Servicio de CLIENTES con el mismo caché de tres niveles que work orders y
 * comisiones: memoria (cambio de vista instantáneo) + localStorage (pinta al
 * instante tras recargas) + red (lectura FORZADA al servidor, con respaldo a la
 * caché local de Firestore solo si no hay conexión). Las mutaciones actualizan
 * el caché en el momento — sin re-descargar toda la colección.
 */

const COLLECTION = 'customers';
const LS_KEY = 'rag_customers_v2';
const CACHE_TTL_MS = 5 * 60 * 1000;

let _mem: CustomerData[] | null = null;
let _at = 0;
let _revalidating = false;

function readLS(): { at: number; list: CustomerData[] } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return (p && Array.isArray(p.list) && p.list.length > 0) ? p : null; // nunca servir snapshot vacío
  } catch { return null; }
}

function writeLS(list: CustomerData[]) {
  try {
    if (list.length > 0) localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), list }));
  } catch { /* cuota llena: seguimos solo con memoria */ }
}

function storeCache(list: CustomerData[]) {
  _mem = list;
  _at = Date.now();
  writeLS(list);
}

async function fetchFromServer(): Promise<CustomerData[]> {
  let snap;
  try {
    snap = await getDocsFromServer(collection(db, COLLECTION));
  } catch {
    snap = await getDocs(collection(db, COLLECTION)); // sin red: caché local de Firestore
  }
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as CustomerData) }));
  storeCache(list);
  return list;
}

function revalidateInBackground() {
  if (_revalidating) return;
  _revalidating = true;
  fetchFromServer().catch(() => {}).finally(() => { _revalidating = false; });
}

export const customerService = {
  async getAll(force = false): Promise<CustomerData[]> {
    if (!force && _mem && (Date.now() - _at) < CACHE_TTL_MS) return _mem;

    if (!force) {
      const local = readLS();
      if (local) {
        _mem = local.list;
        _at = local.at;
        if ((Date.now() - local.at) >= CACHE_TTL_MS) revalidateInBackground();
        return local.list;
      }
    }

    try {
      return await fetchFromServer();
    } catch (err) {
      const local = readLS();
      if (local) return local.list;
      throw err;
    }
  },

  invalidateCache(): void {
    _mem = null;
    _at = 0;
    try { localStorage.removeItem(LS_KEY); } catch { /* ignorar */ }
  },

  /** Crea un cliente y lo agrega al caché al instante. Devuelve el cliente con su id. */
  async create(data: Omit<CustomerData, 'id'>): Promise<CustomerData> {
    const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const createdAt = new Date().toLocaleDateString('es-ES', dateOptions);
    const ref = await addDoc(collection(db, COLLECTION), { ...data, createdAt });
    const nuevo: CustomerData = { id: ref.id, ...data, createdAt } as CustomerData;
    storeCache([...(_mem || []), nuevo]);
    return nuevo;
  },

  /** Actualiza un cliente y parcha el caché en el momento. */
  async update(id: string, data: Partial<CustomerData>): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), { ...data });
    if (_mem) storeCache(_mem.map((c) => (c.id === id ? { ...c, ...data, id } : c)));
  },

  /** Elimina un cliente y lo quita del caché en el momento. */
  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
    if (_mem) storeCache(_mem.filter((c) => c.id !== id));
  },
};