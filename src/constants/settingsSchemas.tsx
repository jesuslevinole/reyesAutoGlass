import { 
  Crosshair, CreditCard, Receipt, Barcode, Layers, 
  Shapes, Car, Building2, Briefcase, MapPin, Tag, ShieldCheck 
} from 'lucide-react';
import type { CatalogSchema } from '../types/settings';

export const isCurrency = (fieldName: string) => fieldName === 'amount' || fieldName === 'long_trip';
export const isPercentage = (fieldName: string) => fieldName === 'tax';

export const catalogsConfig: CatalogSchema[] = [
  { id: 'calibration_type', title: 'Calibration type', icon: <Crosshair size={28} />, fields: [{ name: 'name', label: 'Calibration Type', type: 'text', required: true }, { name: 'amount', label: 'Amount', type: 'number', required: true }] },
  { id: 'payment_method', title: 'Payment method', icon: <CreditCard size={28} />, fields: [{ name: 'name', label: 'Name', type: 'text', required: true }, { name: 'type', label: 'Type', type: 'select', options: ['Expenses', 'Services', 'All'], required: true }] },
  { id: 'expenses', title: 'Expenses', icon: <Receipt size={28} />, fields: [{ name: 'name', label: 'Name', type: 'text', required: true }] },
  { id: 'part_number', title: 'Part Number', icon: <Barcode size={28} />, fields: [{ name: 'part_number', label: 'Part Number', type: 'text', required: true }, { name: 'nags_description', label: 'Nags Description', type: 'text' }] },
  { id: 'price_tier', title: 'Price tier', icon: <Layers size={28} />, fields: [{ name: 'price_tier', label: 'Price Tier', type: 'text', required: true }, { name: 'amount', label: 'Amount', type: 'number', required: true }] },
  { id: 'molding', title: 'Molding', icon: <Shapes size={28} />, fields: [{ name: 'molding', label: 'Molding', type: 'text', required: true }] },
  { id: 'vehicle', title: 'Vehicle', icon: <Car size={28} />, fields: [{ name: 'year', label: 'Year', type: 'number', required: true }, { name: 'make', label: 'Make', type: 'text', required: true }, { name: 'model', label: 'Model', type: 'text', required: true }, { name: 'body', label: 'Body', type: 'text', required: true }] },
  { id: 'company', title: 'Company', icon: <Building2 size={28} />, fields: [{ name: 'name', label: 'Name', type: 'text', required: true }, { name: 'type', label: 'Type', type: 'select', options: ['Distributor', 'Agent', 'Tech'], required: true }] },
  { id: 'jobtype', title: 'Jobtype', icon: <Briefcase size={28} />, fields: [{ name: 'name', label: 'Name', type: 'text', required: true }, { name: 'type', label: 'Type', type: 'select', options: ['Services', 'Parts', 'Molding'], required: true }] },
  { id: 'zipcode', title: 'Zipcode', icon: <MapPin size={28} />, fields: [{ name: 'city', label: 'City', type: 'text', required: true }, { name: 'country', label: 'Country', type: 'text', required: true }, { name: 'state', label: 'State', type: 'text', required: true }, { name: 'zipcode', label: 'Zipcode', type: 'number', required: true }, { name: 'tax', label: 'Tax', type: 'number', required: true }, { name: 'long_trip', label: 'Long trip', type: 'number' }] },
  { id: 'tag', title: 'Tag', icon: <Tag size={28} />, fields: [{ name: 'name', label: 'Name', type: 'text', required: true }, { name: 'type', label: 'Type', type: 'select', options: ['Quote', 'Work Order'], required: true }] },
  { id: 'insurance', title: 'Insurance', icon: <ShieldCheck size={28} />, fields: [{ name: 'insurance_carrier', label: 'Insurance Carrier', type: 'text', required: true }] },
];