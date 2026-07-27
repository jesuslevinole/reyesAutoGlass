// Tipos canónicos del dominio — única fuente de verdad.
// Derivados del diagrama entidad-relación del sistema de Work Orders.

export type InsuranceType = 'PERSONAL' | 'INSURANCE';
export type DetailType = 'PARTS' | 'SERVICES' | 'MOLDING';
export type StatusType = 'QUOTE' | 'WORK ORDER';
export type PaymentMethodType = 'SERVICES' | 'EXPENSES' | 'ALL';
export type CompanyType = 'TECH' | 'AGENT' | 'DISTRIBUTOR';

export interface WorkOrder {
  id: string;
  insuranceType: InsuranceType;
  dateRegister: string;
  idStatus: string;
  idCompany: string;
  idAgent: string;
  idZipcode: string;
  longTrip: number;
  year: number;
  mark: string;
  model: string;
  body: string;
  vinNumber: string;
  plate: string;
  idCustomer: string;
  appointmentDate: string;
  timeIn: string;
  timeOut: string;
  /** Solo camino INSURANCE */
  idInsurance?: string;
  subtotalPart: number;
  subtotalMolding: number;
  subtotalServices: number;
  totalLabor: number;
  /** Solo camino INSURANCE */
  deductible?: number;
  /** Solo camino INSURANCE */
  kitFlatRate?: number;
  taxPercent: number;
  taxDolar: number;
  cashComeback: number;
  total: number;
  /** Solo camino PERSONAL */
  upsold?: number;
  paid: number;
  balance: number;
}

export interface ServicesDetail {
  id: string;
  idWorkorder: string;
  type: DetailType;
  idJobtype: string;
  idPartnumber: string;
  nagsDescription: string;
  glassCost: number;
  idDistributor: string;
  orderNumber: string;
  pricetier: boolean;
  idPricetier: string;
  amountPricetier: number;
  calibrationType: boolean;
  idCalibrationType: string;
  amountCalibrationtype: number;
  totalLabor: number;
  /** Campos exclusivos del camino INSURANCE (lógica NAGS) */
  listPrice?: number;
  nagsDiscountRate?: number;
  pricePartInsurance?: number;
  nagsLaborHour?: number;
  priceForHour?: number;
  totalLaborHour?: number;
}

export interface CatStatus {
  id: string;
  name: string;
  type: StatusType;
  color: string;
}

export interface CatZipcode {
  id: string;
  country: string;
  city: string;
  state: string;
  zipcode: string;
  tax: number;
  longTrip: number;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  alternativePhone: string;
  email: string;
  address: string;
}

export interface Agent extends Customer {
  idCompany: string;
}

export type Tech = Customer;
export type Distributor = Omit<Customer, 'firstName' | 'lastName'> & { name: string };

export interface Payment {
  id: string;
  idWorkorder: string;
  idPaymentmethod: string;
  // Nota de seguridad: NO se almacenan número de tarjeta completo ni CVV (PCI-DSS).
  cardLast4: string;
  cardBrand: string;
  firstName: string;
  lastName: string;
  idAutorization: string;
  amount: number;
}

export interface PaymentDistributor {
  id: string;
  datePayment: string;
  /** ENUMLIST: relación N:M */
  idDistributor: string[];
  /** ENUMLIST: relación N:M */
  idWorkorder: string[];
  subtotal: number;
  debit: number;
  credit: number;
  total: number;
  idPaymentmethod: string;
}
