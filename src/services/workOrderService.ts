import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  query,
  where,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { WorkOrderData } from '../types/workOrder';

/**
 * Estrategia de persistencia (separación general / detalle):
 *  - "general"  -> colección `work_orders`        (cabecera: cliente, vehículo, seguro, totales, etc.)
 *  - "detalle"  -> colección `work_order_details` (cada parte/servicio, enlazado por `workOrderId`)
 *
 * La página (`WorkOrderPage`) y el formulario siguen manejando un único objeto
 * `WorkOrderData` (con `parts` adentro). El split solo ocurre aquí, al guardar/leer.
 *
 * Expone exactamente la API que la página ya usa:
 *   getAll(), getById(id), getLastNumber(), create(data), update(id, data), remove(id)
 */

const HEADER_COLLECTION = 'work_orders';
const DETAIL_COLLECTION = 'work_order_details';

// ─── Consecutivo transaccional (Wo-XXXX) ────────────────────────────────────
// El número correlativo vive en el documento `counters/work_orders` ({ last: 3865 })
// y se asigna dentro de una TRANSACCIÓN junto con la escritura de la orden:
//  - Sin duplicados: si dos usuarios guardan a la vez, Firestore reintenta una de
//    las transacciones y cada orden recibe un número distinto.
//  - Sin saltos: el contador solo avanza si la orden se escribe con éxito
//    (número y orden se confirman en la misma operación atómica).
//  - Respeta lo existente: la primera vez se siembra con el máximo consecutivo
//    actual de la colección (ej. Wo-3865 → la siguiente será Wo-3866).
const COUNTERS_COLLECTION = 'counters';
const WO_COUNTER_DOC = 'work_orders';
const CONSEC_PREFIX = 'Wo-';

/** Extrae el número final de un texto ("Wo-3865" → 3865; sin número → 0). */
function numSuffix(s: any): number {
  const m = String(s || '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

// ─── Caché de cabeceras: memoria + localStorage (persistente entre recargas) ─
// Objetivo: que la lista de órdenes pinte AL INSTANTE incluso tras un F5.
//  - Memoria: evita re-descargar al cambiar de vista dentro de la sesión.
//  - localStorage: sobrevive a recargas; se sirve de inmediato ("stale") y se
//    refresca desde Firestore EN SEGUNDO PLANO ("revalidate") si ya pasó el TTL.
//  - Toda mutación (create/update/remove) invalida ambos niveles.
let _headerCache: WorkOrderData[] | null = null;
let _headerCacheAt = 0;
const HEADER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const LS_KEY = 'rag_wo_headers_v2';
let _revalidating = false;

function invalidateHeaderCache() {
  _headerCache = null;
  _headerCacheAt = 0;
  try { localStorage.removeItem(LS_KEY); } catch { /* modo privado/quota: ignorar */ }
}

function readLocalCache(): { at: number; list: WorkOrderData[] } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.list) || parsed.list.length === 0) return null; // nunca servir un snapshot vacío
    return parsed;
  } catch { return null; }
}

function writeLocalCache(list: WorkOrderData[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), list }));
  } catch { /* si excede la cuota de localStorage, seguimos solo con memoria */ }
}

async function fetchHeadersFromServer(): Promise<WorkOrderData[]> {
  // Con persistentLocalCache activo, getDocs puede resolver desde una caché local
  // VACÍA si el canal de red falla. Por eso: primero lectura FORZADA al servidor;
  // solo si no hay red (offline real) se usa la caché local de Firestore.
  let headerSnap;
  try {
    headerSnap = await getDocsFromServer(collection(db, HEADER_COLLECTION));
  } catch (err) {
    console.warn('[workOrderService] sin servidor, usando caché local de Firestore:', err);
    headerSnap = await getDocs(collection(db, HEADER_COLLECTION));
  }
  const list = headerSnap.docs.map(
    (d) => ({ ...(d.data() as WorkOrderData), id: d.id, parts: [] } as WorkOrderData)
  );
  console.log('[workOrderService] work_orders leídas:', list.length);
  _headerCache = list;
  _headerCacheAt = Date.now();
  if (list.length > 0) writeLocalCache(list); // nunca persistir una lista vacía
  return list;
}

function revalidateInBackground() {
  if (_revalidating) return;
  _revalidating = true;
  fetchHeadersFromServer()
    .catch(() => { /* sin conexión: se mantiene lo local */ })
    .finally(() => { _revalidating = false; });
}

// Tipo auxiliar: una parte/servicio individual del array `parts`.
type WorkOrderPart = NonNullable<WorkOrderData['parts']>[number];

/**
 * Firestore RECHAZA campos con valor `undefined`. Esta función elimina esas claves
 * antes de escribir, evitando el típico error "Unsupported field value: undefined".
 */
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: Record<string, any> = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) clean[key] = obj[key];
  });
  return clean as T;
}

/**
 * Agrega al batch la escritura de las partes de una Work Order en `work_order_details`.
 * Cada parte se guarda con su `workOrderId` (clave foránea) y un `lineOrder` (para ordenar).
 */
function writeDetails(
  batch: { set: (ref: any, data: any) => any },
  workOrderId: string,
  parts: WorkOrderPart[]
) {
  (parts || []).forEach((part, index) => {
    const detailRef = doc(collection(db, DETAIL_COLLECTION));
    batch.set(detailRef, stripUndefined({ ...part, workOrderId, lineOrder: index }));
  });
}

/**
 * Lee y reensambla el array `parts` de una sola Work Order desde `work_order_details`.
 * Se ordena EN MEMORIA por `lineOrder` para no requerir un índice compuesto en Firestore.
 */
async function readDetails(workOrderId: string): Promise<WorkOrderPart[]> {
  const snap = await getDocs(
    query(collection(db, DETAIL_COLLECTION), where('workOrderId', '==', workOrderId))
  );

  return snap.docs
    .map((d) => {
      const { workOrderId: _wo, lineOrder, ...part } = d.data() as WorkOrderPart & {
        workOrderId: string;
        lineOrder: number;
      };
      return { lineOrder: lineOrder ?? 0, part: part as WorkOrderPart };
    })
    .sort((a, b) => a.lineOrder - b.lineOrder)
    .map((x) => x.part);
}

export const workOrderService = {
  /**
   * Devuelve SOLO las cabeceras de todas las Work Orders (sin partes).
   * La lista/calendario/mapa no necesitan las partes, así que NO se descarga la
   * colección `work_order_details` aquí (era el gran cuello de botella al cargar).
   * Las partes se leen bajo demanda con `getParts(id)` / `getById(id)` al abrir
   * o editar una orden.
   */
  async getAll(force = false): Promise<WorkOrderData[]> {
    // 1. Memoria fresca → instantáneo (cambio de vista dentro de la sesión).
    if (!force && _headerCache && (Date.now() - _headerCacheAt) < HEADER_CACHE_TTL_MS) {
      return _headerCache;
    }

    // 2. localStorage → instantáneo tras una recarga (F5). Si el snapshot ya
    //    pasó el TTL, se devuelve igual (mejor algo YA que esperar la red) y se
    //    dispara una revalidación en segundo plano para la próxima lectura.
    if (!force) {
      const local = readLocalCache();
      if (local) {
        _headerCache = local.list;
        _headerCacheAt = local.at;
        if ((Date.now() - local.at) >= HEADER_CACHE_TTL_MS) revalidateInBackground();
        return local.list;
      }
    }

    // 3. Red (primera vez en este navegador, o force=true). Si falla por completo
    //    y existe un snapshot local (aunque esté viejo), se sirve como respaldo.
    try {
      return await fetchHeadersFromServer();
    } catch (err) {
      const local = readLocalCache();
      if (local) return local.list;
      throw err;
    }
  },

  /** Invalida el caché manualmente (por si se necesita forzar un refresco). */
  invalidateCache(): void {
    invalidateHeaderCache();
  },

  /**
   * Lee SOLO las partes de una Work Order (bajo demanda). Una sola consulta.
   */
  async getParts(id: string): Promise<WorkOrderPart[]> {
    return readDetails(id);
  },

  /**
   * Devuelve una Work Order completa (cabecera + partes) por su id de documento.
   */
  async getById(id: string): Promise<WorkOrderData | null> {
    const headerSnap = await getDoc(doc(db, HEADER_COLLECTION, id));
    if (!headerSnap.exists()) return null;

    const parts = await readDetails(id);
    return { ...(headerSnap.data() as WorkOrderData), id, parts } as WorkOrderData;
  },

  /**
   * Calcula el último número correlativo usado, leyendo el número final del
   * código `id` (ej. "WO-001" / "Quote-012"). Se usa para generar el siguiente.
   */
  async getLastNumber(): Promise<number> {
    const snapshot = await getDocs(collection(db, HEADER_COLLECTION));

    let last = 0;
    snapshot.docs.forEach((d) => {
      const code = (d.data() as WorkOrderData).id || d.id || '';
      const match = code.match(/(\d+)\s*$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > last) last = n;
      }
    });

    return last;
  },

  /**
   * Crea una nueva Work Order asignando el consecutivo `Wo-XXXX` de forma
   * TRANSACCIONAL (ver nota junto a COUNTERS_COLLECTION): el número y la orden
   * se escriben en una sola operación atómica → sin duplicados ni saltos.
   * Si `data.consecutivo` ya viene definido (importaciones/casos especiales),
   * se respeta tal cual y el contador solo se ajusta hacia arriba.
   * Devuelve el ID del documento creado.
   */
  async create(data: WorkOrderData): Promise<string> {
    const { parts, id, ...header } = data;

    // Semilla del contador (solo se usa si `counters/work_orders` aún no existe):
    // el máximo consecutivo real de la colección, para continuar la secuencia.
    let seedMax = 0;
    const counterRef = doc(db, COUNTERS_COLLECTION, WO_COUNTER_DOC);
    const counterSnap = await getDoc(counterRef);
    if (!counterSnap.exists()) {
      const all = await workOrderService.getAll();
      all.forEach((o: any) => {
        seedMax = Math.max(seedMax, numSuffix(o.consecutivo), numSuffix(o.id));
      });
    }

    const workOrderId = await runTransaction(db, async (tx) => {
      // 1. Leer el contador (todas las lecturas van antes de las escrituras).
      const snap = await tx.get(counterRef);
      const last = snap.exists() ? (Number((snap.data() as any).last) || 0) : seedMax;

      // 2. Determinar el consecutivo.
      const presetNum = numSuffix((header as any).consecutivo);
      const consecutivo = presetNum > 0
        ? String((header as any).consecutivo).trim() // respeta el que ya viene
        : `${CONSEC_PREFIX}${last + 1}`;
      const newLast = Math.max(last, presetNum > 0 ? presetNum : last + 1);

      // 3. Escribir contador + cabecera + partes en la MISMA transacción.
      const headerRef = id && String(id).trim()
        ? doc(db, HEADER_COLLECTION, String(id).trim())
        : doc(db, HEADER_COLLECTION, consecutivo); // sin id explícito: el consecutivo es el ID
      const newId = headerRef.id;

      tx.set(counterRef, { last: newLast, updatedAt: new Date().toISOString() });
      tx.set(
        headerRef,
        stripUndefined({
          ...header,
          id: newId,
          consecutivo,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );
      writeDetails(tx, newId, parts || []);

      return newId;
    });

    invalidateHeaderCache();
    return workOrderId;
  },

  /**
   * Actualiza una Work Order existente: reescribe la cabecera y regenera sus partes.
   */
  async update(id: string, data: WorkOrderData): Promise<void> {
    const { parts, id: _ignored, ...header } = data;
    const batch = writeBatch(db);

    // 1. Actualizar cabecera (sin el array `parts`).
    const headerRef = doc(db, HEADER_COLLECTION, id);
    batch.set(
      headerRef,
      stripUndefined({ ...header, id, updatedAt: new Date().toISOString() }),
      { merge: true }
    );

    // 2. Borrar las partes anteriores.
    const existing = await getDocs(
      query(collection(db, DETAIL_COLLECTION), where('workOrderId', '==', id))
    );
    existing.forEach((d) => batch.delete(d.ref));

    // 3. Reescribir las partes actuales.
    writeDetails(batch, id, parts || []);

    await batch.commit();
    invalidateHeaderCache();
  },

  /**
   * Elimina una Work Order y todas sus partes en un solo batch atómico.
   */
  async remove(id: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, HEADER_COLLECTION, id));

    const details = await getDocs(
      query(collection(db, DETAIL_COLLECTION), where('workOrderId', '==', id))
    );
    details.forEach((d) => batch.delete(d.ref));

    await batch.commit();
    invalidateHeaderCache();
  },
};