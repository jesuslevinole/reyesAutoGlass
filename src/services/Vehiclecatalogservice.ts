/**
 * vehicleCatalogService.ts
 *
 * Lee la colección local 'catalog_vehicle' (migrada desde CAT_VEHICLE.csv)
 * en CASCADA, para alimentar tanto el formulario de Work Order como la vista
 * del catálogo, SIN cargar toda la colección (evita lecturas masivas).
 *
 * Estructura esperada de cada documento en 'catalog_vehicle':
 *   { year: string, make: string, model: string, body: string }
 *   (el ID del documento es el ID_VEHICLE original)
 *
 * Cascada:
 *   getMakes(year)              -> marcas de ese año
 *   getModels(year, make)       -> modelos de esa marca + año
 *   getBodies(year, make, model)-> body de ese modelo + marca + año
 *   getVehicles(...)            -> documentos completos que coinciden con el filtro
 *
 * NOTA SOBRE LECTURAS: Firestore no tiene "DISTINCT". Para obtener, por
 * ejemplo, las marcas de un año, se leen los documentos de ese año y se
 * deduplican en memoria. Es muchísimo menos que leer las 350k filas, pero un
 * año muy poblado puede leer varios miles de documentos. Si esto se vuelve
 * costoso, lo ideal es precalcular un índice (árbol año->marca->modelo->body)
 * en un solo documento. Pídelo y te lo armo.
 */

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const COLECCION = 'catalog_vehicle';

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export const vehicleCatalogService = {
  /**
   * Marcas disponibles para un año.
   */
  async getMakes(year: string): Promise<string[]> {
    if (!year || !year.trim()) return [];
    try {
      const q = query(collection(db, COLECCION), where('year', '==', year.trim()));
      const snap = await getDocs(q);
      const makes = snap.docs.map((d) => (d.data().make || '').toString().trim());
      return dedupeSort(makes);
    } catch (error) {
      console.error('Error obteniendo marcas (catalog_vehicle):', error);
      return [];
    }
  },

  /**
   * Modelos disponibles para una marca + año.
   */
  async getModels(year: string, make: string): Promise<string[]> {
    if (!year || !year.trim() || !make || !make.trim()) return [];
    try {
      const q = query(
        collection(db, COLECCION),
        where('year', '==', year.trim()),
        where('make', '==', make.trim())
      );
      const snap = await getDocs(q);
      const models = snap.docs.map((d) => (d.data().model || '').toString().trim());
      return dedupeSort(models);
    } catch (error) {
      console.error('Error obteniendo modelos (catalog_vehicle):', error);
      return [];
    }
  },

  /**
   * Body disponibles para un modelo + marca + año.
   */
  async getBodies(year: string, make: string, model: string): Promise<string[]> {
    if (!year || !year.trim() || !make || !make.trim() || !model || !model.trim()) return [];
    try {
      const q = query(
        collection(db, COLECCION),
        where('year', '==', year.trim()),
        where('make', '==', make.trim()),
        where('model', '==', model.trim())
      );
      const snap = await getDocs(q);
      const bodies = snap.docs.map((d) => (d.data().body || '').toString().trim());
      return dedupeSort(bodies);
    } catch (error) {
      console.error('Error obteniendo body (catalog_vehicle):', error);
      return [];
    }
  },

  /**
   * Documentos completos que coinciden con año + marca + modelo (+ body opcional).
   * Se usa para mostrar resultados en la vista del catálogo.
   */
  async getVehicles(
    year: string,
    make: string,
    model: string,
    body?: string
  ): Promise<any[]> {
    if (!year || !year.trim() || !make || !make.trim() || !model || !model.trim()) return [];
    try {
      const condiciones = [
        where('year', '==', year.trim()),
        where('make', '==', make.trim()),
        where('model', '==', model.trim()),
      ];
      if (body && body.trim()) {
        condiciones.push(where('body', '==', body.trim()));
      }
      const q = query(collection(db, COLECCION), ...condiciones);
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error('Error obteniendo vehículos (catalog_vehicle):', error);
      return [];
    }
  },
};