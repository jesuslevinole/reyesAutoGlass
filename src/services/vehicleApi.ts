/**
 * vehicleApi.ts
 *
 * Wrapper de la API pública y gratuita vPIC de la NHTSA (gobierno de EE. UU.).
 *  - No requiere API key ni catálogo local.
 *  - Documentación: https://vpic.nhtsa.dot.gov/api/
 *
 * Provee:
 *   - getMakes()            -> marcas de autos
 *   - getModels(make, year) -> modelos de una marca (filtrados por año si se pasa)
 *   - getBodyClasses()      -> tipos de carrocería (body class)
 *   - decodeVin(vin)        -> { year, make, model, body } a partir de un VIN
 */

const BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';

interface NhtsaResult {
  [key: string]: any;
}

interface NhtsaResponse {
  Count: number;
  Message: string;
  Results: NhtsaResult[];
}

export interface DecodedVehicle {
  year: string;
  make: string;
  model: string;
  body: string;
}

async function fetchVpic(endpoint: string): Promise<NhtsaResult[]> {
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${BASE_URL}/${endpoint}${separator}format=json`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`vPIC respondió ${res.status} para ${endpoint}`);
  }

  const json = (await res.json()) as NhtsaResponse;
  return json.Results || [];
}

export const vehicleApi = {
  /**
   * Marcas de vehículos tipo "car", ordenadas alfabéticamente.
   */
  async getMakes(): Promise<string[]> {
    try {
      const results = await fetchVpic('GetMakesForVehicleType/car');
      const makes = results
        .map((r) => (r.MakeName || r.Make_Name || '').toString().trim())
        .filter(Boolean);
      return Array.from(new Set(makes)).sort((a, b) => a.localeCompare(b));
    } catch (error) {
      console.error('Error obteniendo marcas (vPIC):', error);
      return [];
    }
  },

  /**
   * Modelos de una marca. Si se pasa el año, filtra por año/marca.
   */
  async getModels(make: string, year?: string): Promise<string[]> {
    if (!make || !make.trim()) return [];
    try {
      const makeEnc = encodeURIComponent(make.trim());
      const endpoint =
        year && year.trim()
          ? `GetModelsForMakeYear/make/${makeEnc}/modelyear/${encodeURIComponent(year.trim())}`
          : `GetModelsForMake/${makeEnc}`;

      const results = await fetchVpic(endpoint);
      const models = results
        .map((r) => (r.Model_Name || r.ModelName || '').toString().trim())
        .filter(Boolean);
      return Array.from(new Set(models)).sort((a, b) => a.localeCompare(b));
    } catch (error) {
      console.error('Error obteniendo modelos (vPIC):', error);
      return [];
    }
  },

  /**
   * Tipos de carrocería (body class) que maneja la NHTSA.
   */
  async getBodyClasses(): Promise<string[]> {
    try {
      const results = await fetchVpic(`GetVehicleVariableValuesList/${encodeURIComponent('body class')}`);
      const names = results
        .map((r) => (r.Name || '').toString().trim())
        .filter(Boolean);
      return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    } catch (error) {
      console.error('Error obteniendo body classes (vPIC):', error);
      return [];
    }
  },

  /**
   * Decodifica un VIN (17 caracteres) -> año, marca, modelo y carrocería.
   */
  async decodeVin(vin: string): Promise<DecodedVehicle> {
    const cleanVin = (vin || '').trim().toUpperCase();
    if (cleanVin.length !== 17) {
      throw new Error('El VIN debe tener 17 caracteres.');
    }

    const results = await fetchVpic(`DecodeVinValues/${encodeURIComponent(cleanVin)}`);
    const info = results[0] || {};

    return {
      year: (info.ModelYear || '').toString().trim(),
      make: (info.Make || '').toString().trim(),
      model: (info.Model || '').toString().trim(),
      body: (info.BodyClass || '').toString().trim(),
    };
  },
};