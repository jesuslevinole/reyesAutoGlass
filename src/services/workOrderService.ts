import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
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

// ─── Caché en memoria de las cabeceras ──────────────────────────────────────
// Evita re-descargar todas las órdenes cada vez que se cambia de vista.
// Se invalida automáticamente al crear/editar/eliminar. TTL de seguridad por si
// otra pestaña/usuario cambia datos (se refresca solo tras ese tiempo).
let _headerCache: WorkOrderData[] | null = null;
let _headerCacheAt = 0;
const HEADER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function invalidateHeaderCache() {
  _headerCache = null;
  _headerCacheAt = 0;
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
  batch: ReturnType<typeof writeBatch>,
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
    // Si hay caché reciente y no se fuerza, devuelve al instante (cambio de vista rápido).
    if (!force && _headerCache && (Date.now() - _headerCacheAt) < HEADER_CACHE_TTL_MS) {
      return _headerCache;
    }
    const headerSnap = await getDocs(collection(db, HEADER_COLLECTION));
    const list = headerSnap.docs.map(
      (d) => ({ ...(d.data() as WorkOrderData), id: d.id, parts: [] } as WorkOrderData)
    );
    _headerCache = list;
    _headerCacheAt = Date.now();
    return list;
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
   * Crea una nueva Work Order: cabecera (sin `parts`) en `work_orders`
   * y cada parte como documento aparte en `work_order_details`.
   * Usa `data.id` (el código "WO-001" que arma la página) como ID del documento.
   */
  async create(data: WorkOrderData): Promise<string> {
    const { parts, id, ...header } = data;
    const batch = writeBatch(db);

    const headerRef = id
      ? doc(db, HEADER_COLLECTION, id)
      : doc(collection(db, HEADER_COLLECTION));
    const workOrderId = headerRef.id;

    batch.set(
      headerRef,
      stripUndefined({
        ...header,
        id: workOrderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );

    writeDetails(batch, workOrderId, parts || []);

    await batch.commit();
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