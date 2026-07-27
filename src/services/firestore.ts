import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

/** Fila genérica de cualquier colección: id + campos del módulo.
 *  ⭐ `unknown` (no `any`): cada vista castea al tipo canónico donde lo necesita. */
export type Row = { id: string } & Record<string, unknown>;

export function subscribe(collectionName: string, cb: (rows: Row[]) => void): () => void {
  return onSnapshot(collection(db, collectionName), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function fetchAll(collectionName: string): Promise<Row[]> {
  const snap = await getDocs(collection(db, collectionName));
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
