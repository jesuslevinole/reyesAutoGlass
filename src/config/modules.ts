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
  /** Filtro de opciones FK: solo documentos cuyo campo coincida (p.ej. tags tipo Work Order) */
  fkFilter?: { key: string; equals: string };
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
  /** Columnas visibles del listado (keys) — runtime, viene de config_ui */
  visibleColumns?: string[];
  /** Orden personalizado de las columnas del listado (keys de campos inList) — runtime, viene de config_ui */
  columnOrder?: string[];
  fields: FieldDef[];
}


export const MODULES: ModuleDef[] = [
  {
    id: 'quotes',
    collection: 'quotes',
    sqlName: 'BD_QUOTE',
    title: 'Quotes',
    singular: 'Quote',
    description: 'Quotes — converted into Work Orders when accepted',
    sections: [
      { id: 'general', title: 'General' },
      { id: 'vehiculo', title: 'Vehicle' },
      { id: 'financiero', title: 'Financial' },
    ],
    fields: [
      { key: 'quoteNumber', label: 'Quote #', type: 'text', inList: true, section: 'general', altKeys: ['quote_number', 'q_number'] },
      { key: 'insuranceType', label: 'Type', type: 'enum', options: ['Personal', 'Insurance'], inList: true, required: true, section: 'general', altKeys: ['insurrance', 'insurance', 'insurance_type'] },
      { key: 'dateRegister', label: 'Date', type: 'date', inList: true, section: 'general', altKeys: ['date_register', 'created_at', 'date'] },
      { key: 'idStatus', label: 'Status', type: 'fk', fkCollection: 'catalog_tag', fkFilter: { key: 'type', equals: 'Quote' }, inList: true, required: true, section: 'general', altKeys: ['tag_id', 'status_id', 'id_status'] },
      { key: 'idCustomer', label: 'Customer', type: 'fk', fkCollection: 'customers', inList: true, required: true, section: 'general', altKeys: ['customer_id', 'id_customer'] },
      { key: 'idAgent', label: 'Agent', type: 'fk', fkCollection: 'team', section: 'general', altKeys: ['agent_id', 'id_agent'] },
      { key: 'idZipcode', label: 'Zipcode', type: 'fk', fkCollection: 'catalog_zipcode', section: 'general', altKeys: ['zipcode_id', 'id_zipcode'] },
      { key: 'year', label: 'Year', type: 'int', section: 'vehiculo' },
      { key: 'mark', label: 'Make', type: 'text', inList: true, section: 'vehiculo', altKeys: ['make'] },
      { key: 'model', label: 'Model', type: 'text', inList: true, section: 'vehiculo' },
      { key: 'body', label: 'Body', type: 'text', section: 'vehiculo' },
      { key: 'vinNumber', label: 'VIN', type: 'text', section: 'vehiculo', altKeys: ['vin', 'vin_number'] },
      { key: 'idTier', label: 'Price tier', type: 'fk', fkCollection: 'catalog_price_tier', section: 'financiero', altKeys: ['tier_id', 'id_tier'] },
      { key: 'subtotalPart', label: 'Subtotal parts', type: 'decimal', section: 'financiero', altKeys: ['subtotal_part'] },
      { key: 'totalLabor', label: 'Labor', type: 'decimal', section: 'financiero', altKeys: ['labor', 'total_labor'] },
      { key: 'taxPercent', label: 'Tax %', type: 'percent', section: 'financiero', altKeys: ['tax_percent', 'tax'] },
      { key: 'total', label: 'Total', type: 'decimal', inList: true, section: 'financiero' },
      { key: 'notes', label: 'Notes', type: 'longtext', section: 'financiero', altKeys: ['note'] },
      { key: 'convertedWorkOrderId', label: 'Generated Work Order (id)', type: 'text', section: 'general', altKeys: ['converted_work_order_id'] },
      { key: 'convertedWorkOrderNumber', label: 'Converted to WO', type: 'text', inList: true, section: 'general', altKeys: ['converted_work_order_number'] },
    ],
  },
  {
    id: 'workorders',
    collection: 'work_orders',
    sqlName: 'BD_WORKORDER',
    title: 'Work Orders',
    singular: 'Work Order',
    description: 'Work orders — Personal and Insurance paths',
    sections: [
      { id: 'general', title: 'General' },
      { id: 'vehiculo', title: 'Vehicle' },
      { id: 'cita', title: 'Cliente y cita' },
      { id: 'financiero', title: 'Financial' },
    ],
    fields: [
      { key: 'workOrderNumber', label: 'Work order #', type: 'text', inList: true, section: 'general', altKeys: ['work_order_number', 'wo_number', 'work_order', 'consecutive'] },
      { key: 'quoteNumber', label: 'From quote', type: 'text', section: 'general', altKeys: ['quote_number'] },
      { key: 'insuranceType', label: 'Type', type: 'enum', options: ['Personal', 'Insurance'], inList: true, required: true, section: 'general', altKeys: ['insurrance', 'insurance', 'insurance_type'] },
      { key: 'dateRegister', label: 'Date', type: 'date', section: 'general', altKeys: ['date_register', 'created_at', 'date'] },
      { key: 'idStatus', label: 'Status', type: 'fk', fkCollection: 'catalog_tag', fkFilter: { key: 'type', equals: 'Work Order' }, inList: true, required: true, section: 'general', altKeys: ['tag_id', 'status_id', 'id_status', 'tag', 'status'] },
      { key: 'idAgent', label: 'Agent', type: 'fk', fkCollection: 'team', section: 'general', altKeys: ['agent_id', 'id_agent'] },
      { key: 'idTech', label: 'Technician', type: 'fk', fkCollection: 'team', section: 'general', altKeys: ['tech_id', 'id_tech'] },
      { key: 'techLabor', label: 'Tech labor', type: 'decimal', section: 'general', altKeys: ['tech_labor', 'labor_tech', 'tech_pay'] },
      { key: 'idZipcode', label: 'Zipcode', type: 'fk', fkCollection: 'catalog_zipcode', section: 'general', altKeys: ['zipcode_id', 'zip_code_id', 'id_zipcode'] },
      { key: 'idCompany', label: 'Company', type: 'fk', fkCollection: 'catalog_company', fkFilter: { key: 'type', equals: 'Agent' }, section: 'general', altKeys: ['company_id', 'id_company'] },
      { key: 'year', label: 'Year', type: 'int', section: 'vehiculo', altKeys: ['vehicle_year'] },
      { key: 'mark', label: 'Make', type: 'text', inList: true, section: 'vehiculo', altKeys: ['make', 'vehicle_make'] },
      { key: 'model', label: 'Model', type: 'text', inList: true, section: 'vehiculo', altKeys: ['vehicle_model'] },
      { key: 'body', label: 'Body', type: 'text', section: 'vehiculo', altKeys: ['vehicle_body'] },
      { key: 'vinNumber', label: 'VIN', type: 'text', section: 'vehiculo', altKeys: ['vin', 'vin_number'] },
      { key: 'plate', label: 'Plate', type: 'text', section: 'vehiculo', altKeys: ['license_plate'] },
      { key: 'idCustomer', label: 'Customer', type: 'fk', fkCollection: 'customers', inList: true, required: true, section: 'cita', altKeys: ['customer_id', 'id_customer'] },
      { key: 'appointmentDate', label: 'Appointment date', type: 'date', inList: true, section: 'cita', altKeys: ['appointment_date', 'appoiment_date'] },
      { key: 'timeIn', label: 'Time start', type: 'time', section: 'cita', altKeys: ['time_in'] },
      { key: 'timeOut', label: 'Time end', type: 'time', section: 'cita', altKeys: ['time_out'] },
      { key: 'idInsurance', label: 'Insurance carrier', type: 'fk', fkCollection: 'catalog_insurance', showIf: { key: 'insuranceType', equals: 'Insurance' }, section: 'cita', altKeys: ['insurance_id', 'id_insurance'] },
      { key: 'idTier', label: 'Price tier', type: 'fk', fkCollection: 'catalog_price_tier', section: 'financiero', altKeys: ['tier_id', 'price_tier_id', 'id_tier', 'tier'] },
      { key: 'idCalibration', label: 'Calibration', type: 'fk', fkCollection: 'catalog_calibration_type', section: 'financiero', altKeys: ['calibration_type_id', 'id_calibration', 'calibration_type'] },
      { key: 'subtotalPart', label: 'Subtotal parts', type: 'decimal', section: 'financiero', altKeys: ['subtotal_part'] },
      { key: 'subtotalMolding', label: 'Subtotal molding', type: 'decimal', section: 'financiero', altKeys: ['subtotal_molding'] },
      { key: 'subtotalServices', label: 'Subtotal services', type: 'decimal', section: 'financiero', altKeys: ['subtotal_services'] },
      { key: 'totalLabor', label: 'Labor', type: 'decimal', section: 'financiero', altKeys: ['labor', 'total_labor'] },
      { key: 'taxPercent', label: 'Tax %', type: 'percent', section: 'financiero', altKeys: ['tax_percent', 'tax'] },
      { key: 'taxDolar', label: 'Total tax', type: 'decimal', section: 'financiero', altKeys: ['total_tax', 'tax_dolar'] },
      { key: 'longTrip', label: 'Long trip', type: 'decimal', section: 'financiero', altKeys: ['long_trip'] },
      { key: 'discount', label: 'Discount', type: 'decimal', section: 'financiero', altKeys: ['discount'] },
      { key: 'discountType', label: 'Discount type', type: 'enum', options: ['Percentage', 'Fixed'], section: 'financiero', altKeys: ['discount_type'] },
      { key: 'discountValue', label: 'Discount value', type: 'decimal', section: 'financiero', altKeys: ['discount_value'] },
      { key: 'discountReason', label: 'Discount reason', type: 'text', section: 'financiero', altKeys: ['discount_reason'] },
      { key: 'customerSuggestedPrice', label: 'Customer Suggested Price', type: 'decimal', section: 'financiero', altKeys: ['customer_suggested_price', 'suggested_price'] },
      { key: 'notes', label: 'Notes', type: 'longtext', section: 'financiero', altKeys: ['note'] },
      { key: 'upsell', label: 'Upsell', type: 'decimal', section: 'financiero', altKeys: ['upsell'] },
      { key: 'upsold', label: 'Upsold', type: 'decimal', showIf: { key: 'insuranceType', equals: 'Personal' }, section: 'financiero', altKeys: ['upsold'] },
      { key: 'total', label: 'Total', type: 'decimal', inList: true, section: 'financiero', altKeys: ['total'] },
      { key: 'deductible', label: 'Deductible', type: 'decimal', showIf: { key: 'insuranceType', equals: 'Insurance' }, section: 'financiero', altKeys: ['deductible'] },
      { key: 'kitFlatRate', label: 'Flat Rate Kit', type: 'decimal', showIf: { key: 'insuranceType', equals: 'Insurance' }, section: 'financiero', altKeys: ['kit_flat_rate', 'flat_rate_kit'] },
      { key: 'policyNumber', label: 'Policy Number', type: 'text', showIf: { key: 'insuranceType', equals: 'Insurance' }, section: 'financiero', altKeys: ['policy_number'] },
      { key: 'claimNumber', label: 'Claim Number', type: 'text', showIf: { key: 'insuranceType', equals: 'Insurance' }, section: 'financiero', altKeys: ['claim_number'] },
      { key: 'listPrice', label: 'List Price', type: 'decimal', showIf: { key: 'insuranceType', equals: 'Insurance' }, section: 'financiero', altKeys: ['list_price'] },
      { key: 'nagsRate', label: 'NAGS Rate', type: 'decimal', showIf: { key: 'insuranceType', equals: 'Insurance' }, section: 'financiero', altKeys: ['nags_rate', 'nags_discount_rate'] },
      { key: 'pricePartInsurance', label: 'Price Part Insurance', type: 'decimal', showIf: { key: 'insuranceType', equals: 'Insurance' }, section: 'financiero', altKeys: ['price_part_insurance'] },
      { key: 'nagsLaborHour', label: 'NAGS Labor Hour', type: 'decimal', showIf: { key: 'insuranceType', equals: 'Insurance' }, section: 'financiero', altKeys: ['nags_labor_hour'] },
      { key: 'priceForHour', label: 'Price For Hour', type: 'decimal', showIf: { key: 'insuranceType', equals: 'Insurance' }, section: 'financiero', altKeys: ['price_for_hour'] },
      { key: 'idAutorization', label: 'ID Autorization', type: 'text', section: 'financiero', altKeys: ['id_autorization', 'authorization_id'] },
      { key: 'cashComeback', label: 'Cash comeback', type: 'decimal', section: 'financiero', altKeys: ['cash_comeback'] },
      { key: 'paid', label: 'Paid', type: 'decimal', section: 'financiero', altKeys: ['paid'] },
      { key: 'balance', label: 'Balance', type: 'decimal', section: 'financiero', altKeys: ['balance'] },
    ],
  },
  {
    id: 'servicesdetail',
    collection: 'work_order_details',
    sqlName: 'BD_SERVICESDETAIL',
    title: 'Service Details',
    singular: 'Detail',
    description: 'Parts, services and moldings per Work Order',
    sections: [
      { id: 'general', title: 'General' },
      { id: 'precios', title: 'Pricing & calibration' },
      { id: 'nags', title: 'Insurance / NAGS' },
    ],
    fields: [
      { key: 'idWorkorder', label: 'Work Order', type: 'fk', fkCollection: 'work_orders', inList: true, required: true, section: 'general', altKeys: ['work_order_id', 'id_work_order', 'workOrderId'] },
      { key: 'type', label: 'Type', type: 'enum', options: ['Parts', 'Services'], inList: true, section: 'general' },
      { key: 'idJobtype', label: 'Job type', type: 'fk', fkCollection: 'catalog_jobtype', inList: true, section: 'general', altKeys: ['job_type_id', 'id_job_type', 'jobTypeId'] },
      { key: 'description', label: 'Description', type: 'text', showIf: { key: 'type', equals: 'Services' }, section: 'general', altKeys: ['service_description'] },
      { key: 'amount', label: 'Amount', type: 'decimal', showIf: { key: 'type', equals: 'Services' }, section: 'general', altKeys: ['service_amount'] },
      { key: 'note', label: 'Note', type: 'text', showIf: { key: 'type', equals: 'Services' }, section: 'general', altKeys: ['notes'] },
      { key: 'idPartnumber', label: 'Part number', type: 'fk', fkCollection: 'catalog_part_number', inList: true, section: 'general', altKeys: ['part_number_id', 'id_part_number', 'partNumberId'] },
      { key: 'glassCost', label: 'Glass cost', type: 'decimal', inList: true, section: 'general', altKeys: ['glass_cost', 'cost', 'part_cost'] },
      { key: 'idDistributor', label: 'Distributor', type: 'fk', fkCollection: 'catalog_company', fkFilter: { key: 'type', equals: 'Distributor' }, inList: true, section: 'general', altKeys: ['distributor_id', 'id_distributor', 'distributorId'] },
      { key: 'orderNumber', label: 'Order number', type: 'text', section: 'general', altKeys: ['distributor_order', 'order_number'] },
      { key: 'insurance', label: 'Insurance', type: 'enum', options: ['Personal', 'Insurance'], section: 'general', altKeys: ['insurrance', 'insurance_type'] },
      { key: 'pricetier', label: 'Price tier?', type: 'boolean', section: 'precios', altKeys: ['price_tier', 'has_price_tier'] },
      { key: 'idPricetier', label: 'Price tier', type: 'fk', fkCollection: 'catalog_price_tier', section: 'precios', altKeys: ['price_tier_id', 'id_price_tier'] },
      { key: 'amountPricetier', label: 'Price tier amount', type: 'decimal', section: 'precios', altKeys: ['amount_price_tier', 'tier_amount'] },
      { key: 'calibrationType', label: 'Calibration?', type: 'boolean', section: 'precios', altKeys: ['calibration_type', 'has_calibration'] },
      { key: 'idCalibrationType', label: 'Calibration type', type: 'fk', fkCollection: 'catalog_calibration_type', section: 'precios', altKeys: ['calibration_type_id', 'id_calibration_type'] },
      { key: 'amountCalibrationtype', label: 'Calibration amount', type: 'decimal', section: 'precios', altKeys: ['amount_calibration_type', 'calibration_amount'] },
      { key: 'totalLabor', label: 'Total labor', type: 'decimal', inList: true, section: 'precios', altKeys: ['labor', 'total_labor', 'price'] },
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
    title: 'Customers',
    singular: 'Customer',
    description: 'Shop customers',
    fields: [
      { key: 'first_name', label: 'Name', type: 'text', inList: true, required: true, altKeys: ['firstName', 'name'] },
      { key: 'last_name', label: 'Last name', type: 'text', inList: true, altKeys: ['lastName'] },
      { key: 'phone', label: 'Primary phone', type: 'phone', inList: true, altKeys: ['phone_number', 'primary_phone'] },
      { key: 'alternative_phone', label: 'Secondary phone', type: 'phone', altKeys: ['alternativePhone', 'secondary_phone'] },
      { key: 'email', label: 'Email', type: 'email', inList: true },
      { key: 'address', label: 'Street address', type: 'text', inList: true },
      { key: 'apartment', label: 'Unit / Apt / Suite #', type: 'text', altKeys: ['apartment_number', 'apt', 'unit', 'suite'] },
      { key: 'city', label: 'City', type: 'text', inList: true },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'zipcode', label: 'Zipcode', type: 'text', altKeys: ['zip', 'zip_code'] },
      { key: 'notes', label: 'Notes', type: 'longtext', altKeys: ['note'] },
    ],
  },
  {
    id: 'team',
    collection: 'team',
    sqlName: 'BD_TEAM',
    title: 'Team',
    singular: 'Member',
    description: 'Shop agents and technicians (team collection)',
    fields: [
      { key: 'first_name', label: 'Name', type: 'text', inList: true, required: true, altKeys: ['firstName', 'name'] },
      { key: 'last_name', label: 'Last name', type: 'text', inList: true, altKeys: ['lastName'] },
      { key: 'type', label: 'Type', type: 'enum', options: ['Agent', 'Tech'], inList: true, altKeys: ['role'] },
      { key: 'companyId', label: 'Company', type: 'fk', fkCollection: 'catalog_company', inList: true, altKeys: ['company_id', 'id_company'] },
      { key: 'phone', label: 'Phone', type: 'phone', inList: true, altKeys: ['phone_number'] },
      { key: 'email', label: 'Email', type: 'email' },
    ],
  },
  {
    id: 'insurances',
    collection: 'catalog_insurance',
    sqlName: 'BD_INSURANCE',
    title: 'Insurance Companies',
    singular: 'Insurance company',
    description: 'Aseguradoras del camino Insurance',
    fields: [
      { key: 'name', label: 'Name', type: 'text', inList: true, required: true },
      { key: 'phone', label: 'Phone', type: 'phone', inList: true },
      { key: 'email', label: 'Email', type: 'email', inList: true },
      { key: 'address', label: 'Address', type: 'longtext' },
    ],
  },
  {
    id: 'commissionpayments',
    collection: 'commission_payments',
    sqlName: 'BD_COMMISSION_PAYMENTS',
    title: 'Commission Payments',
    singular: 'Payment',
    description: 'Payments made to agents (Send Money)',
    fields: [
      // ⭐ Campos por confirmar con el Inspector — altKeys cubren las variantes probables
      { key: 'reference', label: 'Reference', type: 'text', inList: true, altKeys: ['payment_reference', 'ref', 'name'] },
      { key: 'agentId', label: 'Agent', type: 'fk', fkCollection: 'team', inList: true, altKeys: ['agent_id', 'payee_id'] },
      { key: 'amount', label: 'Amount', type: 'decimal', inList: true, altKeys: ['total', 'total_amount'] },
      { key: 'date', label: 'Date', type: 'date', inList: true, altKeys: ['payment_date', 'created_at'] },
      { key: 'paymentMethodId', label: 'Payment method', type: 'fk', fkCollection: 'catalog_payment_method', altKeys: ['payment_method_id', 'id_payment_method'] },
      { key: 'notes', label: 'Notes', type: 'longtext', altKeys: ['note', 'description'] },
    ],
  },
  {
    id: 'agentcomissions',
    collection: 'agent_commissions',
    sqlName: 'AGENT_COMMISSIONS',
    title: 'Commissions',
    singular: 'Commission',
    description: 'Agent commissions by sale type',
    fields: [
      // ⭐ agentId apunta a la colección `team` (por confirmar con la estructura real)
      { key: 'agentId', label: 'Agent', type: 'fk', fkCollection: 'team', inList: true, required: true },
      { key: 'companyId', label: 'Company', type: 'fk', fkCollection: 'catalog_company', inList: true },
      { key: 'servicesCommission', label: 'Services commission', type: 'decimal' },
      { key: 'insuranceCommission', label: 'Insurance commission', type: 'decimal' },
      { key: 'oemCommission', label: 'OEM commission', type: 'decimal' },
      { key: 'aftermarketCommission', label: 'Aftermarket commission', type: 'decimal' },
      { key: 'recommendCommission', label: 'Recommend commission', type: 'decimal' },
      { key: 'totalCommission', label: 'Total commission', type: 'decimal', inList: true },
      { key: 'checked', label: 'Checked?', type: 'boolean', inList: true },
      { key: 'paid', label: 'Paid?', type: 'boolean', inList: true },
      { key: 'paymentId', label: 'Payment (commission_payments)', type: 'text' },
    ],
  },
  {
    id: 'users',
    collection: 'users',
    sqlName: 'BD_USERS',
    title: 'Users',
    singular: 'User',
    description: 'Application users and their role',
    fields: [
      { key: 'name', label: 'Name', type: 'text', inList: true, required: true },
      { key: 'email', label: 'Email', type: 'email', inList: true, required: true },
      { key: 'roleId', label: 'Role', type: 'fk', fkCollection: 'roles', inList: true },
      { key: 'active', label: 'Active?', type: 'boolean', inList: true },
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
      { key: 'country', label: 'County', type: 'text', altKeys: ['county'] },
      { key: 'city', label: 'City', type: 'text', inList: true, required: true },
      { key: 'state', label: 'State', type: 'text', inList: true },
      { key: 'zipcode', label: 'Zipcode', type: 'text', inList: true, required: true },
      { key: 'tax', label: 'Tax %', type: 'percent', inList: true },
      { key: 'longTrip', label: 'Long trip', type: 'decimal', altKeys: ['long_trip'] },
    ],
  },
  {
    id: 'cat_company',
    collection: 'catalog_company',
    sqlName: 'CAT_COMPANY',
    title: 'Companies',
    singular: 'Company',
    description: 'Compañías de tipo Tech, Agent o Distributor',
    fields: [
      { key: 'name', label: 'Name', type: 'text', inList: true, required: true, altKeys: ['company'] },
      { key: 'type', label: 'Type', type: 'enum', options: ['Distributor', 'Agent', 'Tech'], inList: true, required: true },
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
      { key: 'name', label: 'Name', type: 'text', inList: true, required: true, altKeys: ['job_type', 'jobType', 'description', 'title'] },
      { key: 'type', label: 'Type', type: 'enum', options: ['Parts', 'Services'], inList: true, required: true },
    ],
  },
  {
    id: 'cat_calibrationtype',
    collection: 'catalog_calibration_type',
    sqlName: 'CAT_CALIBRATIONTYPE',
    title: 'Calibration Types',
    singular: 'Tipo de calibración',
    description: 'Calibraciones ADAS y sus montos',
    fields: [
      { key: 'name', label: 'Name', type: 'text', inList: true, required: true, altKeys: ['calibration_type', 'calibrationType', 'description', 'title'] },
      { key: 'amount', label: 'Amount', type: 'decimal', inList: true, altKeys: ['price', 'cost', 'value'] },
    ],
  },
  {
    id: 'cat_pricetier',
    collection: 'catalog_price_tier',
    sqlName: 'CAT_PRICETIER',
    title: 'Price tiers',
    singular: 'Price tier',
    description: 'Price tiers',
    fields: [
      { key: 'name', label: 'Name', type: 'text', inList: true, required: true, altKeys: ['price_tier', 'priceTier', 'tier', 'description'] },
      { key: 'amount', label: 'Amount', type: 'decimal', inList: true, altKeys: ['price', 'cost', 'value'] },
    ],
  },
  {
    id: 'cat_partnumber',
    collection: 'catalog_part_number',
    sqlName: 'CAT_PARTNUMBER',
    title: 'Part numbers',
    singular: 'Part number',
    description: 'NAGS part number catalog',
    fields: [
      { key: 'name', label: 'Part number', type: 'text', inList: true, required: true, altKeys: ['part_number', 'partNumber', 'number'] },
      { key: 'nagsDescription', label: 'NAGS description', type: 'longtext', inList: true, altKeys: ['nags_description', 'description', 'nags'] },
    ],
  },
  {
    id: 'cat_paymentmethod',
    collection: 'catalog_payment_method',
    sqlName: 'CAT_PAYMENTMETHOD',
    title: 'Payment Methods',
    singular: 'Payment method',
    description: 'Métodos para servicios y gastos',
    fields: [
      { key: 'name', label: 'Name', type: 'text', inList: true, required: true, altKeys: ['payment_method', 'paymentMethod', 'method'] },
      { key: 'type', label: 'Type', type: 'enum', options: ['All', 'Services', 'Expense'], inList: true },
      { key: 'type', label: 'Type', type: 'enum', options: ['SERVICES', 'EXPENSES', 'ALL'], inList: true, required: true },
    ],
  },
  {
    id: 'cat_molding',
    collection: 'catalog_molding',
    sqlName: 'CAT_MOLDING',
    title: 'Moldings',
    singular: 'Molding',
    description: 'Molding catalog',
    fields: [
      // ⭐ Campos provisionales: ajustar cuando conozcamos la estructura real (ver Inspector)
      { key: 'name', label: 'Name', type: 'text', inList: true, required: true, altKeys: ['molding', 'description', 'title', 'moldingName'] },
      { key: 'amount', label: 'Amount', type: 'decimal', inList: true },
    ],
  },
  {
    id: 'cat_tag',
    collection: 'catalog_tag',
    sqlName: 'CAT_TAG',
    title: 'Status (Tags)',
    singular: 'Tag',
    description: 'Quote and work order statuses',
    fields: [
      { key: 'name', label: 'Name', type: 'text', inList: true, required: true },
      { key: 'color', label: 'Color', type: 'text', inList: true },
      { key: 'type', label: 'Type', type: 'enum', options: ['Work Order', 'Quote'], inList: true, altKeys: ['tag_type'] },
    ],
  },
  {
    id: 'cat_expenses',
    collection: 'catalog_expenses',
    sqlName: 'CAT_EXPENSES',
    title: 'Expenses',
    singular: 'Expense',
    description: 'Expense type catalog',
    fields: [
      { key: 'name', label: 'Name', type: 'text', inList: true, required: true, altKeys: ['expense', 'expense_name', 'description', 'title'] },
      { key: 'amount', label: 'Amount', type: 'decimal', inList: true },
    ],
  },
  {
    id: 'expenses',
    collection: 'expenses',
    sqlName: 'BD_EXPENSES',
    title: 'Expenses',
    singular: 'Expense',
    description: 'Shop expenses — capture and track every cost',
    fields: [
      { key: 'dateExpenses', label: 'Date', type: 'date', inList: true, required: true, altKeys: ['DATE_EXPENSES', 'date_expenses', 'date'] },
      { key: 'idExpenseType', label: 'Expense', type: 'fk', fkCollection: 'catalog_expenses', inList: true, required: true, altKeys: ['expenses', 'EXPENSES', 'id_expense', 'expense_type'] },
      { key: 'description', label: 'Description', type: 'text', inList: true, altKeys: ['DESCRIPTION'] },
      { key: 'amount', label: 'Amount', type: 'decimal', inList: true, required: true, altKeys: ['AMOUNT'] },
      { key: 'idPaymentMethod', label: 'Payment method', type: 'fk', fkCollection: 'catalog_payment_method', inList: true, altKeys: ['payment_method', 'PAYMENT_METHOD', 'id_payment_method'] },
      { key: 'reference', label: 'Reference', type: 'text', altKeys: ['REFERENCE'] },
      { key: 'note', label: 'Note', type: 'longtext', altKeys: ['NOTE', 'notes'] },
      { key: 'statusExpenses', label: 'Status', type: 'enum', options: ['No', 'Yes'], inList: true, altKeys: ['STATUS_EXPENSES', 'status_expenses', 'status'] },
      { key: 'fileUrl', label: 'File URL', type: 'text', altKeys: ['upload_file', 'UPLOAD_FILE', 'file'] },
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
  { id: 'quotes', label: 'Quotes' },
  { id: 'workorders', label: 'Work Orders' },
  { id: 'servicesdetail', label: 'Service Details' },
  { id: 'customers', label: 'Customers' },
  { id: 'team', label: 'Team' },
  { id: 'insurances', label: 'Insurance' },
  { id: 'agentcomissions', label: 'Commissions' },
  { id: 'commissionpayments', label: 'Commission Payments' },
  { id: 'users', label: 'Users' },
  { id: 'roles', label: 'Roles' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'statusflow', label: 'Status Flow' },
  { id: 'catalogs', label: 'Catalogs' },
  { id: 'settings', label: 'Settings' },
];
