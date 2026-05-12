import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "../firebase";
import type { WorkOrderData } from "../types/workOrder";

const COLLECTION_NAME = "work_orders";

export const workOrderService = {
  // 1. Obtener todas las órdenes ordenadas por fecha
  async getAll(): Promise<WorkOrderData[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    
    // Solución al error de TypeScript: usamos 'unknown' como puente seguro
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      firebaseId: doc.id 
    } as unknown as WorkOrderData));
  },

  // 2. Guardar una nueva orden
  async create(data: WorkOrderData): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), data);
    return docRef.id;
  },

  // 3. Actualizar una orden existente
  async update(id: string, data: Partial<WorkOrderData>): Promise<void> {
    // Buscamos el documento por el campo 'id' (el consecutivo WO-001)
    const q = query(collection(db, COLLECTION_NAME));
    const querySnapshot = await getDocs(q);
    const docToUpdate = querySnapshot.docs.find(d => d.data().id === id);
    
    if (docToUpdate) {
      await updateDoc(doc(db, COLLECTION_NAME, docToUpdate.id), data);
    }
  },

  // 4. Eliminar una orden (Soluciona la alerta de 'deleteDoc' sin usar)
  async delete(id: string): Promise<void> {
    const q = query(collection(db, COLLECTION_NAME));
    const querySnapshot = await getDocs(q);
    const docToDelete = querySnapshot.docs.find(d => d.data().id === id);
    
    if (docToDelete) {
      await deleteDoc(doc(db, COLLECTION_NAME, docToDelete.id));
    }
  },

  // 5. Obtener el último número consecutivo
  async getLastNumber(): Promise<number> {
    const q = query(collection(db, COLLECTION_NAME), orderBy("id", "desc"), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return 0;
    
    const lastId = querySnapshot.docs[0].data().id; // Ejemplo: "WO-005"
    const lastNum = parseInt(lastId.split("-")[1], 10);
    return isNaN(lastNum) ? 0 : lastNum;
  }
};