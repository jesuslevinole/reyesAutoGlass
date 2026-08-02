import {
  addDoc,
  collection,
  limit,
  query,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

/** Fila genérica de cualquier colección: id + campos del módulo.
 *  ⭐ `unknown` (no `any`): cada vista castea al tipo canónico donde lo necesita. */
export type Row = { id: string } & Record<string, unknown>;

export function subscribe(
  collectionName: string,
  cb: (rows: Row[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, collectionName),
    (snap) => { cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); },
    (error) => {
      // Sin esto, un error de permisos se ve idéntico a una colección vacía.
      console.error(`[Firestore] Error leyendo "${collectionName}":`, error.code, error.message);
      onError?.(error);
    },
  );
}

export async function fetchAll(collectionName: string): Promise<Row[]> {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Trae solo N documentos — para inspección de estructura sin descargar la colección completa. */
export async function fetchSample(collectionName: string, count = 1): Promise<Row[]> {
  const snap = await getDocs(query(collection(db, collectionName), limit(count)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createRow(collectionName: string, data: Record<string, unknown>): Promise<string> {
  const ref = await addDoc(collection(db, collectionName), data);
  return ref.id;
}

export async function updateRow(collectionName: string, id: string, data: Record<string, unknown>): Promise<void> {
  await updateDoc(doc(db, collectionName, id), data);
}

export async function deleteRow(collectionName: string, id: string): Promise<void> {
  await deleteDoc(doc(db, collectionName, id));
}

/** Importación masiva desde CSV. Firestore limita cada batch a 500 escrituras. */
export async function createMany(collectionName: string, rows: Record<string, unknown>[]): Promise<number> {
  const CHUNK = 450;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const row of rows.slice(i, i + CHUNK)) {
      batch.set(doc(collection(db, collectionName)), row);
    }
    await batch.commit();
  }
  return rows.length;
}

/** Guarda (merge) un documento con id conocido — usado por la configuración de UI. */
export async function setRowMerged(collectionName: string, id: string, data: Record<string, unknown>): Promise<void> {
  await setDoc(doc(db, collectionName, id), data, { merge: true });
}


/** Consecutivo transaccional (sin saltos ni duplicados bajo concurrencia):
 *  counters/<counterId> { n } → devuelve `${prefix}-001`, `${prefix}-002`, … */
export async function nextConsecutive(counterId: string, prefix: string): Promise<string> {
  const ref = doc(db, 'counters', counterId);
  const n = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? Number((snap.data() as { n?: unknown }).n ?? 0) : 0;
    const next = current + 1;
    tx.set(ref, { n: next }, { merge: true });
    return next;
  });
  return `${prefix}-${String(n).padStart(3, '0')}`;
}
