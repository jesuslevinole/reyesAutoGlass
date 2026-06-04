/**
 * vehicleApi.ts  (versión CarAPI - carapi.app)
 *
 * Adaptador para CarAPI manteniendo la MISMA interfaz que la versión NHTSA,
 * para que sea reemplazo directo en WorkOrderForm.tsx:
 *   - getMakes(year?)              -> marcas (opcionalmente filtradas por año)
 *   - getModels(make, year?)       -> modelos de una marca (filtrados por año)
 *   - getBodyClasses(year?, make?, model?) -> tipos de carrocería (body)
 *   - decodeVin(vin)               -> { year, make, model, body }
 *
 * ────────────────────────────────────────────────────────────────────────
 *  IMPORTANTE - LÉEME ANTES DE USAR
 * ────────────────────────────────────────────────────────────────────────
 * 1) CORS: CarAPI NO permite llamadas desde el navegador. Esta app es React
 *    del lado del cliente, así que NO puedes apuntar CARAPI_BASE directamente
 *    a "https://carapi.app/api": el navegador bloqueará la respuesta.
 *    Debes pasar por un PROXY propio del lado del servidor (por ejemplo una
 *    Cloud Function de Firebase) que reenvíe la petición a CarAPI.
 *    Por eso CARAPI_BASE abajo apunta a una ruta de proxy, no a CarAPI.
 *
 * 2) CAPA GRATUITA: sin suscripción, CarAPI devuelve un dataset de DEMO
 *    (datos limitados) y la decodificación de VIN es función de pago. Para
 *    datos reales completos necesitas un plan y enviar un JWT (ver el proxy).
 *
 * 3) Sin proxy aún: si solo quieres probar el dataset demo desde un entorno
 *    server-side (no navegador), puedes poner CARAPI_BASE = 'https://carapi.app/api'.
 */

// Apunta esto a TU proxy. Ejemplos:
//   - Cloud Function:  'https://us-central1-tu-proyecto.cloudfunctions.net/carapi'
//   - Mismo dominio:   '/api/carapi'
const CARAPI_BASE = '/api/carapi';

export interface DecodedVehicle {
  year: string;
  make: string;
  model: string;
  body: string;
}

/**
 * Construye una query string a partir de un objeto, omitiendo valores vacíos.
 */
function buildQuery(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value).trim())}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

async function fetchCarApi(endpoint: string): Promise<any> {
  const url = `${CARAPI_BASE}/${endpoint}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`CarAPI respondió ${res.status} para ${endpoint}`);
  }
  return res.json();
}

/**
 * CarAPI devuelve colecciones tipo { data: [...] } o, en algunos endpoints,
 * un array directo (ej. /years). Esta función normaliza ambos casos.
 */
function extractData(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.data)) return json.data;
  return [];
}

export const vehicleApi = {
  /**
   * Marcas. CarAPI permite filtrar por año (a diferencia de la NHTSA).
   */
  async getMakes(year?: string): Promise<string[]> {
    try {
      const json = await fetchCarApi(`makes${buildQuery({ year })}`);
      const makes = extractData(json)
        .map((m) => (m.name || m.make || '').toString().trim())
        .filter(Boolean);
      return Array.from(new Set(makes)).sort((a, b) => a.localeCompare(b));
    } catch (error) {
      console.error('Error obteniendo marcas (CarAPI):', error);
      return [];
    }
  },

  /**
   * Modelos de una marca, filtrados por año si se pasa.
   */
  async getModels(make: string, year?: string): Promise<string[]> {
    if (!make || !make.trim()) return [];
    try {
      const json = await fetchCarApi(`models${buildQuery({ make: make.trim(), year })}`);
      const models = extractData(json)
        .map((m) => (m.name || m.model || '').toString().trim())
        .filter(Boolean);
      return Array.from(new Set(models)).sort((a, b) => a.localeCompare(b));
    } catch (error) {
      console.error('Error obteniendo modelos (CarAPI):', error);
      return [];
    }
  },

  /**
   * Tipos de carrocería (body). CarAPI permite filtrar por año/marca/modelo,
   * así el body puede depender del modelo (cosa que la NHTSA no permitía).
   * Los parámetros son opcionales para mantener compatibilidad con la llamada
   * actual del formulario (getBodyClasses() sin argumentos).
   */
  async getBodyClasses(year?: string, make?: string, model?: string): Promise<string[]> {
    try {
      const json = await fetchCarApi(`bodies${buildQuery({ year, make, model })}`);
      const bodies = extractData(json)
        .map((b) => (b.type || b.name || '').toString().trim())
        .filter(Boolean);
      return Array.from(new Set(bodies)).sort((a, b) => a.localeCompare(b));
    } catch (error) {
      console.error('Error obteniendo body classes (CarAPI):', error);
      return [];
    }
  },

  /**
   * Decodifica un VIN (17 caracteres) -> año, marca, modelo y carrocería.
   * Nota: la decodificación de VIN en CarAPI es función de PAGO; en la capa
   * gratuita / demo puede no devolver datos.
   */
  async decodeVin(vin: string): Promise<DecodedVehicle> {
    const cleanVin = (vin || '').trim().toUpperCase();
    if (cleanVin.length !== 17) {
      throw new Error('El VIN debe tener 17 caracteres.');
    }

    const json = await fetchCarApi(`vin/${encodeURIComponent(cleanVin)}`);
    const info = Array.isArray(json) ? json[0] || {} : json || {};

    // CarAPI suele anidar el body dentro de "bodies" (array). Tomamos el primero.
    let body = '';
    if (Array.isArray(info.bodies) && info.bodies.length > 0) {
      body = (info.bodies[0].type || '').toString().trim();
    } else if (info.body_type || info.body) {
      body = (info.body_type || info.body).toString().trim();
    }

    return {
      year: (info.year || '').toString().trim(),
      make: (info.make || '').toString().trim(),
      model: (info.model || '').toString().trim(),
      body,
    };
  },
};