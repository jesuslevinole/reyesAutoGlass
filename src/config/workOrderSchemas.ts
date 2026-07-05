// ============================================================================
//  workOrderSchemas.ts
//  Definición central de las colecciones de Work Orders para
//  (1) generar plantillas de importación y (2) importar datos desde AppSheet.
//
//  IMPORTANTE: Los nombres de colección de abajo son mi propuesta para separar
//  ENCABEZADO y DETALLE. Ajústalos si tu workOrderService usa otros nombres.
//  Ruta sugerida del archivo: src/config/workOrderSchemas.ts
// ============================================================================

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date' // YYYY-MM-DD
  | 'time' // HH:MM
  | 'enum';

export interface FieldSchema {
  key: string; // nombre EXACTO del campo en Firestore (encabezado del CSV)
  label: string; // etiqueta legible para el usuario
  type: FieldType;
  required?: boolean;
  enumValues?: string[];
  example?: string | number | boolean;
  note?: string;
}

export interface CollectionSchema {
  /** Nombre de la colección en Firestore. AJUSTA si tu service usa otro. */
  collection: string;
  label: string;
  description: string;
  /**
   * 'field-id' -> el valor de la columna `id` se usa como ID del documento.
   * 'auto'     -> Firestore genera el ID automáticamente (addDoc).
   */
  idStrategy: 'field-id' | 'auto';
  fields: FieldSchema[];
}

// ---------------------------------------------------------------------------
//  ENCABEZADO (general de la Work Order)
//  Reconstruido desde initialWorkOrderState en WorkOrderPage.tsx.
//  Se excluye `parts` porque ahora vive en la colección de detalle.
// ---------------------------------------------------------------------------
export const WORK_ORDER_HEADER_SCHEMA: CollectionSchema = {
  collection: 'work_orders',
  label: 'Work Orders (Encabezado)',
  description:
    'Registro general de cada orden/cotización. Un documento por orden. El campo "id" (ej. WO-001) enlaza con el detalle.',
  idStrategy: 'field-id',
  fields: [
    { key: 'id', label: 'ID de Orden', type: 'string', required: true, example: 'WO-001', note: 'Clave del documento. En AppSheet suele ser el ID de la fila padre.' },
    { key: 'documentType', label: 'Tipo de Documento', type: 'enum', required: true, enumValues: ['Work Order', 'Quote'], example: 'Work Order' },
    { key: 'type', label: 'Tipo', type: 'enum', required: true, enumValues: ['Personal', 'Insurance'], example: 'Personal' },
    { key: 'date', label: 'Fecha de Orden', type: 'date', example: '2026-01-15' },
    { key: 'status', label: 'Estatus', type: 'string', example: 'New', note: 'New / In Progress / Job Done / Cancelled, u otros estatus históricos.' },
    { key: 'company', label: 'Compañía', type: 'string', example: '' },
    { key: 'zipcode', label: 'Código Postal', type: 'string', example: '92501' },
    { key: 'longTrip', label: 'Long Trip', type: 'number', example: 0 },
    { key: 'year', label: 'Año del Vehículo', type: 'string', example: '2020' },
    { key: 'mark', label: 'Marca', type: 'string', example: 'Toyota' },
    { key: 'model', label: 'Modelo', type: 'string', example: 'Camry' },
    { key: 'body', label: 'Carrocería', type: 'string', example: 'Sedan' },
    { key: 'vinNumber', label: 'Número VIN', type: 'string', example: '' },
    { key: 'plate', label: 'Placa', type: 'string', example: '' },
    { key: 'customerType', label: 'Tipo de Cliente', type: 'enum', enumValues: ['Existing', 'New'], example: 'Existing' },
    { key: 'customer', label: 'Cliente', type: 'string', example: 'John Doe' },
    { key: 'firstName', label: 'Nombre', type: 'string', example: '' },
    { key: 'lastName', label: 'Apellido', type: 'string', example: '' },
    { key: 'phone', label: 'Teléfono', type: 'string', example: '9515551234' },
    { key: 'altPhone', label: 'Teléfono Alt.', type: 'string', example: '' },
    { key: 'email', label: 'Correo', type: 'string', example: '' },
    { key: 'address', label: 'Dirección', type: 'string', example: '123 Main St, Riverside CA' },
    { key: 'appointmentDate', label: 'Fecha de Cita', type: 'date', example: '2026-01-20' },
    { key: 'timeStart', label: 'Hora Inicio', type: 'time', example: '09:00' },
    { key: 'timeEnd', label: 'Hora Fin', type: 'time', example: '10:00' },
    { key: 'insuranceCarrier', label: 'Aseguradora', type: 'string', example: '' },
    { key: 'policyId', label: 'Número de Póliza', type: 'string', example: '' },
    { key: 'referral', label: 'Referencia (Seguro)', type: 'string', example: '' },
    { key: 'policyHolder', label: 'Titular de Póliza', type: 'string', example: '' },
    { key: 'policyAddress', label: 'Dirección de Póliza', type: 'string', example: '' },
    { key: 'agent', label: 'Agente', type: 'string', example: '' },
    { key: 'subtotalPart', label: 'Subtotal Partes', type: 'number', example: 250 },
    { key: 'subtotalMolding', label: 'Subtotal Molduras', type: 'number', example: 0 },
    { key: 'subtotalServices', label: 'Subtotal Servicios', type: 'number', example: 0 },
    { key: 'totalLabor', label: 'Total Mano de Obra', type: 'number', example: 80 },
    { key: 'deductible', label: 'Deducible', type: 'number', example: 0 },
    { key: 'kitFlatRate', label: 'Kit Flat Rate', type: 'number', example: 0 },
    { key: 'upsell', label: 'Upsell', type: 'number', example: 0 },
    { key: 'taxPercent', label: 'Impuesto (%)', type: 'number', example: 7 },
    { key: 'callDirection', label: 'Dirección Llamada', type: 'enum', enumValues: ['IN', 'OUT'], example: 'IN' },
    { key: 'paid', label: 'Pagado', type: 'number', example: 0 },
    { key: 'cashComeback', label: 'Cash Comeback', type: 'number', example: 0 },
    { key: 'upsold', label: 'Upsold', type: 'number', example: 0 },
  ],
};

// ---------------------------------------------------------------------------
//  DETALLE (partes y servicios de la Work Order)
//  Reconstruido desde initialDraftPart en WorkOrderForm.tsx.
//  Se agrega `workOrderId` como llave foránea al encabezado.
// ---------------------------------------------------------------------------
export const WORK_ORDER_DETAIL_SCHEMA: CollectionSchema = {
  collection: 'work_order_details',
  label: 'Work Order Details (Detalle)',
  description:
    'Cada parte o servicio de una orden. Varias filas por orden. La columna "workOrderId" debe coincidir con el "id" del encabezado. El importador agrega "lineOrder" para preservar el orden.',
  idStrategy: 'auto',
  fields: [
    { key: 'workOrderId', label: 'ID de Orden (FK)', type: 'string', required: true, example: 'WO-001', note: 'Debe coincidir con el "id" del encabezado. En AppSheet es la referencia al padre.' },
    { key: 'lineOrder', label: 'Orden de Línea', type: 'number', example: 0, note: 'Opcional. Ordena las líneas dentro de una orden (0,1,2...). Si se omite, se usa el orden del archivo.' },
    { key: 'type', label: 'Tipo de Línea', type: 'enum', required: true, enumValues: ['Parts', 'Services'], example: 'Parts' },
    { key: 'jobtype', label: 'Job Type', type: 'string', example: 'Windshield' },
    { key: 'partNumber', label: 'Número de Parte', type: 'string', example: 'FW02688' },
    { key: 'nagsDescription', label: 'Descripción NAGS', type: 'string', example: 'Windshield' },
    { key: 'glassCost', label: 'Costo del Vidrio', type: 'number', example: 250 },
    { key: 'hasPriceTier', label: 'Tiene Price Tier', type: 'boolean', example: false },
    { key: 'priceTierName', label: 'Nombre Price Tier', type: 'string', example: '' },
    { key: 'priceTierAmount', label: 'Monto Price Tier', type: 'number', example: 0 },
    { key: 'hasCalibration', label: 'Tiene Calibración', type: 'boolean', example: false },
    { key: 'calibrationName', label: 'Nombre Calibración', type: 'string', example: '' },
    { key: 'calibrationAmount', label: 'Monto Calibración', type: 'number', example: 0 },
    { key: 'description', label: 'Descripción (Servicio)', type: 'string', example: '' },
    { key: 'amount', label: 'Monto (Servicio)', type: 'number', example: 0 },
    { key: 'note', label: 'Nota', type: 'string', example: '' },
  ],
};

// Lista maestra usada por el generador de plantillas y el importador.
export const IMPORT_SCHEMAS: CollectionSchema[] = [
  WORK_ORDER_HEADER_SCHEMA,
  WORK_ORDER_DETAIL_SCHEMA,
];

// Helper para localizar un esquema por nombre de colección.
export const getSchemaByCollection = (name: string): CollectionSchema | undefined =>
  IMPORT_SCHEMAS.find((s) => s.collection === name);