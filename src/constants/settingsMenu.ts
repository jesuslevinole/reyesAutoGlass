import { 
  Crosshair, 
  CreditCard, 
  Receipt, 
  Hash, 
  Layers, 
  Shapes, 
  CarFront, 
  Building2, 
  Briefcase, 
  MapPin, 
  Tag, 
  ShieldCheck 
} from 'lucide-react';

// Única línea que genera el error corregida:
import { type SettingMenuOption } from '../types/settings';

export const SETTINGS_MENU_OPTIONS: SettingMenuOption[] = [
  { id: 'calibration', title: 'Calibration Type', description: 'Manage ADAS calibration parameters', route: '/settings/calibration', icon: Crosshair },
  { id: 'payment', title: 'Payment Method', description: 'Configure accepted payment gateways', route: '/settings/payment', icon: CreditCard },
  { id: 'expenses', title: 'Expenses', description: 'Track and manage operational costs', route: '/settings/expenses', icon: Receipt },
  { id: 'part-number', title: 'Part Number', description: 'Manage inventory and part numbers', route: '/settings/part-number', icon: Hash },
  { id: 'price-tier', title: 'Price Tier', description: 'Setup pricing levels and structures', route: '/settings/price-tier', icon: Layers },
  { id: 'molding', title: 'Molding', description: 'Configure molding options and specs', route: '/settings/molding', icon: Shapes },
  { id: 'vehicle', title: 'Vehicle', description: 'Database for vehicle makes and models', route: '/settings/vehicle', icon: CarFront },
  { id: 'company', title: 'Company', description: 'Manage B2B partners and clients', route: '/settings/company', icon: Building2 },
  { id: 'jobtype', title: 'Jobtype', description: 'Categorize service types provided', route: '/settings/jobtype', icon: Briefcase },
  { id: 'zipcode', title: 'Zipcode', description: 'Manage coverage areas and postal codes', route: '/settings/zipcode', icon: MapPin },
  { id: 'tag', title: 'Tag', description: 'Create and assign system tags', route: '/settings/tag', icon: Tag },
  { id: 'insurance', title: 'Insurance', description: 'Configure insurance providers network', route: '/settings/insurance', icon: ShieldCheck },
];