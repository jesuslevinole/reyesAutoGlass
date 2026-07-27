// Configuración declarativa de módulos. Cada módulo del diagrama ER se describe
// una sola vez aquí y GenericModuleView renderiza tabla, formulario, export e import.
// (Mismo patrón config-driven que los flujos por Firestore usados en otros proyectos.)

export type FieldType =
  | 'text' | 'longtext' | 'email' | 'phone'
  | 'int' | 'decimal' | 'percent'
  | 'date' | 'time'
  | 'enum' | 'fk' | 'fkList' | 'boolean' | 'color';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Valores permitidos cuando type === 'enum' */
  options?: string[];
  /** Colección referenciada cuando type === 'fk' | 'fkList' */
  fkCollection?: string;
  /** El campo solo aplica/se muestra cuando otro campo tiene cierto valor */
  showIf?: { key: string; equals: string };
  /** Se muestra como columna en la tabla del listado */
  inList?: boolean;
  /** Sección (pestaña) del formulario a la que pertenece el campo */
  section?: string;
  /** Nombres alternativos del campo en la base existente (se lee el primero presente) */
  altKeys?: string[];
  required?: boolean;
}

export interface ModuleDef {
  id: string;
  collection: string;
  /** Nombre de tabla SQL — se usa como nombre del archivo template */
  sqlName: string;
  title: string;
  singular: string;
  description: string;
  /** Pestañas del formulario modal; si se omite, una sola sección */
  sections?: { id: string; title: string }[];
  /** Orden personalizado de las columnas del listado (keys de campos inList) — runtime, viene de config_ui */
  columnOrder?: string[];
  fields: FieldDef[];
}

const contactFields: FieldDef[] = [
  { key: 'firstName', label: 'Nombre', type: 'text', inList: true, required: true },
  { key: 'lastName', label: 'Apellido', type: 'text', inList: true, required: true },
  { key: 'phone', label: 'Teléfono', type: 'phone', inList: true },
  { key: 'alternativePhone', label: 'Teléfono alternativo', type: 'phone' },
  { key: 'email', label: 'Email', type: 'email', inList: true },
  { key: 'address', label: 'Dirección', type: 'longtext' },
];

export const MODULES: ModuleDef[] = [
  {
    id: 'workorders',
    collection: 'work_orders',
    sqlName: 'BD_WORKORDER',
    title: 'Work Orders',
    singular: 'Work Order',
    description: 'Órdenes de trabajo — caminos Personal e Insurance',
    sections: [
      { id: 'general', title: 'General' },
      { id: 'vehiculo', title: 'Vehículo' },
      { id: 'cita', title: 'Cliente y cita' },
      { id: 'financiero', title: 'Financiero' },
    ],
    fields: [
      { key: 'insuranceType', label: 'Tipo', type: 'enum', options: ['PERSONAL', 'INSURANCE'], inList: true, required: true, section: 'general' },
      { key: 'dateRegister', label: 'Fecha de registro', type: 'date', inList: true, required: true, section: 'general' },
      { key: 'idStatus', label: 'Status', type: 'fk', fkCollection: 'catalog_tag', inList: true, required: true, section: 'general' },
      { key: 'idCompany', label: 'Compañía', type: 'fk', fkCollection: 'catalog_company', section: 'general' },
      { key: 'idAgent', label: 'Agente', type: 'fk', fkCollection: 'agents', section: 'general' },
      { key: 'idZipcode', label: 'Zipcode', type: 'fk', fkCollection: 'catalog_zipcode', section: 'general' },
      { key: 'longTrip', label: 'Long trip', type: 'decimal', section: 'general' },
      { key: 'year', label: 'Año', type: 'int', section: 'vehiculo' },
      { key: 'mark', label: 'Marca', type: 'text', inList: true, section: 'vehiculo' },
      { key: 'model', label: 'Modelo', type: 'text', inList: true, section: 'vehiculo' },
      { key: 'body', label: 'Body', type: 'text', section: 'vehiculo' },
      { key: 'vinNumber', label: 'VIN', type: 'text', section: 'vehiculo' },
      { key: 'plate', label: 'Placa', type: 'text', section: 'vehiculo' },
      { key: 'idCustomer', label: 'Cliente', type: 'fk', fkCollection: 'customers', inList: true, required: true, section: 'cita' },
      { key: 'appointmentDate', label: 'Fecha de cita', type: 'date', section: 'cita' },
      { key: 'timeIn', label: 'Hora entrada', type: 'time', section: 'cita' },
      { key: 'timeOut', label: 'Hora salida', type: 'time', section: 'cita' },
      { key: 'idInsurance', label: 'Aseguradora', type: 'fk', fkCollection: 'catalog_insurance', showIf: { key: 'insuranceType', equals: 'INSURANCE' }, section: 'cita' },
      { key: 'subtotalPart', label: 'Subtotal parts', type: 'decimal', section: 'financiero' },
      { key: 'subtotalMolding', label: 'Subtotal molding', type: 'decimal', section: 'financiero' },
      { key: 'subtotalServices', label: 'Subtotal services', type: 'decimal', section: 'financiero' },
      { key: 'totalLabor', label: 'Total labor', type: 'decimal', section: 'financiero' },
      { key: 'deductible', label: 'Deducible', type: 'decimal', showIf: { key: 'insuranceType', equals: 'INSURANCE' }, section: 'financiero' },
      { key: 'kitFlatRate', label: 'Kit flat rate', type: 'decimal', showIf: { key: 'insuranceType', equals: 'INSURANCE' }, section: 'financiero' },
      { key: 'taxPercent', label: 'Tax %', type: 'percent', section: 'financiero' },
      { key: 'taxDolar', label: 'Tax $', type: 'decimal', section: 'financiero' },
      { key: 'cashComeback', label: 'Cash comeback', type: 'decimal', section: 'financiero' },
      { key: 'total', label: 'Total', type: 'decimal', inList: true, section: 'financiero' },
      { key: 'upsold', label: 'Upsold', type: 'decimal', showIf: { key: 'insuranceType', equals: 'PERSONAL' }, section: 'financiero' },
      { key: 'paid', label: 'Pagado', type: 'decimal', section: 'financiero' },
      { key: 'balance', label: 'Balance', type: 'decimal', inList: true, section: 'financiero' },
    ],
  },
  {
    id: 'servicesdetail',
    collection: 'work_order_details',
    sqlName: 'BD_SERVICESDETAIL',
    title: 'Detalle de servicios',
    singular: 'Detalle',
    description: 'Parts, services y moldings por Work Order',
    sections: [
      { id: 'general', title: 'General' },
      { id: 'precios', title: 'Precios y calibración' },
      { id: 'nags', title: 'Insurance / NAGS' },
    ],
    fields: [
      { key: 'idWorkorder', label: 'Work Order', type: 'fk', fkCollection: 'work_orders', inList: true, required: true, section: 'general' },
      { key: 'type', label: 'Tipo', type: 'enum', options: ['PARTS', 'SERVICES', 'MOLDING'], inList: true, required: true, section: 'general' },
      { key: 'idJobtype', label: 'Job type', type: 'fk', fkCollection: 'catalog_jobtype', inList: true, section: 'general' },
      { key: 'idPartnumber', label: 'Part number', type: 'fk', fkCollection: 'catalog_part_number', inList: true, section: 'general' },
      { key: 'glassCost', label: 'Costo del vidrio', type: 'decimal', inList: true, section: 'general' },
      { key: 'idDistributor', label: 'Distribuidor', type: 'fk', fkCollection: 'distributors', inList: true, section: 'general' },
      { key: 'orderNumber', label: 'Order number', type: 'text', section: 'general' },
      { key: 'pricetier', label: '¿Price tier?', type: 'boolean', section: 'precios' },
      { key: 'idPricetier', label: 'Price tier', type: 'fk', fkCollection: 'catalog_price_tier', section: 'precios' },
      { key: 'amountPricetier', label: 'Monto price tier', type: 'decimal', section: 'precios' },
      { key: 'calibrationType', label: '¿Calibración?', type: 'boolean', section: 'precios' },
      { key: 'idCalibrationType', label: 'Tipo de calibración', type: 'fk', fkCollection: 'catalog_calibration_type', section: 'precios' },
      { key: 'amountCalibrationtype', label: 'Monto calibración', type: 'decimal', section: 'precios' },
      { key: 'totalLabor', label: 'Total labor', type: 'decimal', inList: true, section: 'precios' },
      { key: 'listPrice', label: 'List price (INS)', type: 'decimal', section: 'nags' },
      { key: 'nagsDiscountRate', label: 'NAGS discount % (INS)', type: 'percent', section: 'nags' },
      { key: 'pricePartInsurance', label: 'Price part insurance (INS)', type: 'decimal', section: 'nags' },
      { key: 'nagsLaborHour', label: 'NAGS labor hour (INS)', type: 'decimal', section: 'nags' },
      { key: 'priceForHour', label: 'Price for hour (INS)', type: 'decimal', section: 'nags' },
      { key: 'totalLaborHour', label: 'Total labor hour (INS)', type: 'decimal', section: 'nags' },
    ],
  },
  {
    id: 'customers',
    collection: 'customers',
    sqlName: 'BD_CUSTOMER',
    title: 'Clientes',
    singular: 'Cliente',
    description: 'Clientes del taller',
    fields: [...contactFields],
  },
  {
    id: 'agents',
    collection: 'agents',
    sqlName: 'BD_AGENT',
    title: 'Agentes',
    singular: 'Agente',
    description: 'Agentes por compañía',
    fields: [
      { key: 'idCompany', label: 'Compañía', type: 'fk', fkCollection: 'catalog_company', inList: true, required: true },
      ...contactFields,
    ],
  },
  {
    id: 'techs',
    collection: 'techs',
    sqlName: 'BD_TECH',
    title: 'Técnicos',
    singular: 'Técnico',
    description: 'Técnicos instaladores',
    fields: [...contactFields],
  },
  {
    id: 'distributors',
    collection: 'distributors',
    sqlName: 'BD_DISTRIBUTOR',
    title: 'Distribuidores',
    singular: 'Distribuidor',
    description: 'Proveedores de vidrio',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', inList: true, required: true },
      { key: 'phone', label: 'Teléfono', type: 'phone', inList: true },
      { key: 'alternativePhone', label: 'Teléfono alternativo', type: 'phone' },
      { key: 'email', label: 'Email', type: 'email', inList: true },
      { key: 'address', label: 'Dirección', type: 'longtext' },
    ],
  },
  {
    id: 'insurances',
    collection: 'catalog_insurance',
    sqlName: 'BD_INSURANCE',
    title: 'Aseguradoras',
    singular: 'Aseguradora',
    description: 'Aseguradoras del camino Insurance',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', inList: true, required: true },
      { key: 'phone', label: 'Teléfono', type: 'phone', inList: true },
      { key: 'email', label: 'Email', type: 'email', inList: true },
      { key: 'address', label: 'Dirección', type: 'longtext' },
    ],
  },
  {
    id: 'payments',
    collection: 'payments',
    sqlName: 'BD_PAYMENT',
    title: 'Pagos',
    singular: 'Pago',
    description: 'Pagos de clientes por Work Order',
    sections: [
      { id: 'pago', title: 'Pago' },
      { id: 'tarjeta', title: 'Tarjeta y titular' },
    ],
    fields: [
      { key: 'idWorkorder', label: 'Work Order', type: 'fk', fkCollection: 'work_orders', inList: true, required: true, section: 'pago' },
      { key: 'idPaymentmethod', label: 'Método de pago', type: 'fk', fkCollection: 'catalog_payment_method', inList: true, required: true, section: 'pago' },
      // PCI-DSS: nunca se guardan número completo ni CVV — solo últimos 4 y marca.
      { key: 'cardLast4', label: 'Últimos 4 dígitos', type: 'text', section: 'tarjeta' },
      { key: 'cardBrand', label: 'Marca de tarjeta', type: 'text', section: 'tarjeta' },
      { key: 'firstName', label: 'Nombre', type: 'text', section: 'tarjeta' },
      { key: 'lastName', label: 'Apellido', type: 'text', section: 'tarjeta' },
      { key: 'idAutorization', label: 'ID de autorización', type: 'text', inList: true, section: 'pago' },
      { key: 'amount', label: 'Monto', type: 'decimal', inList: true, required: true, section: 'pago' },
    ],
  },
  {
    id: 'paymentdistributor',
    collection: 'paymentdistributor',
    sqlName: 'BD_PAYMENTDISTRIBUTOR',
    title: 'Pagos a distribuidores',
    singular: 'Pago a distribuidor',
    description: 'Pagos a proveedores (N:M con órdenes y distribuidores)',
    fields: [
      { key: 'datePayment', label: 'Fecha de pago', type: 'date', inList: true, required: true },
      { key: 'idDistributor', label: 'Distribuidores', type: 'fkList', fkCollection: 'distributors', inList: true },
      { key: 'idWorkorder', label: 'Work Orders', type: 'fkList', fkCollection: 'work_orders' },
      { key: 'subtotal', label: 'Subtotal', type: 'decimal' },
      { key: 'debit', label: 'Débito', type: 'decimal' },
      { key: 'credit', label: 'Crédito', type: 'decimal' },
      { key: 'total', label: 'Total', type: 'decimal', inList: true },
      { key: 'idPaymentmethod', label: 'Método de pago', type: 'fk', fkCollection: 'catalog_payment_method', inList: true },
    ],
  },
  {
    id: 'techpayments',
    collection: 'techpayments',
    sqlName: 'BD_TECHPAYMENT',
    title: 'Pagos a técnicos',
    singular: 'Pago a técnico',
    description: 'Labor y efectivo pagado a técnicos',
    fields: [
      { key: 'idTech', label: 'Técnico', type: 'fk', fkCollection: 'techs', inList: true, required: true },
      { key: 'labor', label: 'Labor', type: 'decimal', inList: true },
      { key: 'cash', label: 'Efectivo', type: 'decimal', inList: true },
      { key: 'totalLabor', label: 'Total labor', type: 'decimal', inList: true },
    ],
  },
  {
    id: 'agentcomissions',
    collection: 'agent_commissions',
    sqlName: 'AGENT_COMMISSIONS',
    title: 'Comisiones',
    singular: 'Comisión',
    description: 'Comisiones de agentes por tipo de venta',
    fields: [
      // ⭐ agentId apunta a la colección `team` (por confirmar con la estructura real)
      { key: 'agentId', label: 'Agente', type: 'fk', fkCollection: 'team', inList: true, required: true },
      { key: 'companyId', label: 'Compañía', type: 'fk', fkCollection: 'catalog_company', inList: true },
      { key: 'servicesCommission', label: 'Comisión services', type: 'decimal' },
      { key: 'insuranceCommission', label: 'Comisión insurance', type: 'decimal' },
      { key: 'oemCommission', label: 'Comisión OEM', type: 'decimal' },
      { key: 'aftermarketCommission', label: 'Comisión aftermarket', type: 'decimal' },
      { key: 'recommendCommission', label: 'Comisión recomendación', type: 'decimal' },
      { key: 'totalCommission', label: 'Comisión total', type: 'decimal', inList: true },
      { key: 'checked', label: '¿Revisada?', type: 'boolean', inList: true },
      { key: 'paid', label: '¿Pagada?', type: 'boolean', inList: true },
      { key: 'paymentId', label: 'Pago (commission_payments)', type: 'text' },
    ],
  },
  // ==================== CATÁLOGOS ====================
  {
    id: 'cat_zipcode',
    collection: 'catalog_zipcode',
    sqlName: 'CAT_ZIPCODE',
    title: 'Zipcodes',
    singular: 'Zipcode',
    description: 'Zonas de servicio con tax y long trip',
    fields: [
      { key: 'country', label: 'País', type: 'text' },
      { key: 'city', label: 'Ciudad', type: 'text', inList: true, required: true },
      { key: 'state', label: 'Estado', type: 'text', inList: true },
      { key: 'zipcode', label: 'Zipcode', type: 'text', inList: true, required: true },
      { key: 'tax', label: 'Tax %', type: 'percent', inList: true },
      { key: 'longTrip', label: 'Long trip', type: 'decimal' },
    ],
  },
  {
    id: 'cat_company',
    collection: 'catalog_company',
    sqlName: 'CAT_COMPANY',
    title: 'Compañías',
    singular: 'Compañía',
    description: 'Compañías de tipo Tech, Agent o Distributor',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', inList: true, required: true },
      { key: 'type', label: 'Tipo', type: 'enum', options: ['TECH', 'AGENT', 'DISTRIBUTOR'], inList: true, required: true },
    ],
  },
  {
    id: 'cat_jobtype',
    collection: 'catalog_jobtype',
    sqlName: 'CAT_JOBTYPE',
    title: 'Job types',
    singular: 'Job type',
    description: 'Tipos de trabajo por categoría',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', inList: true, required: true, altKeys: ['jobType', 'description', 'title'] },
      { key: 'type', label: 'Tipo', type: 'enum', options: ['PARTS', 'SERVICES', 'MOLDING'], inList: true, required: true },
    ],
  },
  {
    id: 'cat_calibrationtype',
    collection: 'catalog_calibration_type',
    sqlName: 'CAT_CALIBRATIONTYPE',
    title: 'Tipos de calibración',
    singular: 'Tipo de calibración',
    description: 'Calibraciones ADAS y sus montos',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', inList: true, required: true, altKeys: ['calibrationType', 'calibration', 'description', 'title'] },
      { key: 'amount', label: 'Monto', type: 'decimal', inList: true, altKeys: ['price', 'cost', 'value'] },
    ],
  },
  {
    id: 'cat_pricetier',
    collection: 'catalog_price_tier',
    sqlName: 'CAT_PRICETIER',
    title: 'Price tiers',
    singular: 'Price tier',
    description: 'Niveles de precio',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', inList: true, required: true, altKeys: ['priceTier', 'tier', 'description', 'title'] },
      { key: 'amount', label: 'Monto', type: 'decimal', inList: true, altKeys: ['price', 'cost', 'value'] },
    ],
  },
  {
    id: 'cat_partnumber',
    collection: 'catalog_part_number',
    sqlName: 'CAT_PARTNUMBER',
    title: 'Part numbers',
    singular: 'Part number',
    description: 'Catálogo NAGS de números de parte',
    fields: [
      { key: 'name', label: 'Part number', type: 'text', inList: true, required: true, altKeys: ['partNumber', 'number', 'part'] },
      { key: 'nagsDescription', label: 'Descripción NAGS', type: 'longtext', inList: true, altKeys: ['description', 'nags', 'nagsDesc'] },
    ],
  },
  {
    id: 'cat_paymentmethod',
    collection: 'catalog_payment_method',
    sqlName: 'CAT_PAYMENTMETHOD',
    title: 'Métodos de pago',
    singular: 'Método de pago',
    description: 'Métodos para servicios y gastos',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', inList: true, required: true, altKeys: ['paymentMethod', 'method', 'description'] },
      { key: 'type', label: 'Tipo', type: 'enum', options: ['SERVICES', 'EXPENSES', 'ALL'], inList: true, required: true },
    ],
  },
  {
    id: 'cat_molding',
    collection: 'catalog_molding',
    sqlName: 'CAT_MOLDING',
    title: 'Moldings',
    singular: 'Molding',
    description: 'Catálogo de moldings',
    fields: [
      // ⭐ Campos provisionales: ajustar cuando conozcamos la estructura real (ver Inspector)
      { key: 'name', label: 'Nombre', type: 'text', inList: true, required: true, altKeys: ['molding', 'description', 'title'] },
      { key: 'amount', label: 'Monto', type: 'decimal', inList: true },
    ],
  },
  {
    id: 'cat_tag',
    collection: 'catalog_tag',
    sqlName: 'CAT_TAG',
    title: 'Status (Tags)',
    singular: 'Tag',
    description: 'Status de cotizaciones y órdenes',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', inList: true, required: true },
      { key: 'color', label: 'Color', type: 'color', inList: true },
    ],
  },
  {
    id: 'cat_expenses',
    collection: 'catalog_expenses',
    sqlName: 'CAT_EXPENSES',
    title: 'Gastos',
    singular: 'Gasto',
    description: 'Catálogo de tipos de gasto',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', inList: true, required: true, altKeys: ['expense', 'description', 'title'] },
      { key: 'amount', label: 'Monto', type: 'decimal', inList: true },
    ],
  },
];

export function getModule(id: string): ModuleDef {
  const mod = MODULES.find((m) => m.id === id);
  if (!mod) throw new Error(`Módulo no configurado: ${id}`);
  return mod;
}

/** IDs de los módulos de catálogo — se agrupan en una sola vista "Catálogos" */
export const CATALOG_IDS = [
  'cat_tag', 'cat_zipcode', 'cat_company', 'cat_jobtype',
  'cat_calibrationtype', 'cat_pricetier', 'cat_partnumber', 'cat_paymentmethod',
  'cat_molding', 'cat_expenses',
] as const;

export interface NavItem {
  id: string;
  label: string;
}

/** Menú lateral plano (sin encabezados). El orden puede personalizarse en Configuración. */
export const DEFAULT_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'workorders', label: 'Work Orders' },
  { id: 'servicesdetail', label: 'Detalle de servicios' },
  { id: 'customers', label: 'Clientes' },
  { id: 'agents', label: 'Agentes' },
  { id: 'techs', label: 'Técnicos' },
  { id: 'distributors', label: 'Distribuidores' },
  { id: 'insurances', label: 'Aseguradoras' },
  { id: 'payments', label: 'Pagos' },
  { id: 'paymentdistributor', label: 'Pagos a distribuidores' },
  { id: 'techpayments', label: 'Pagos a técnicos' },
  { id: 'agentcomissions', label: 'Comisiones' },
  { id: 'catalogs', label: 'Catálogos' },
  { id: 'settings', label: 'Configuración' },
];
