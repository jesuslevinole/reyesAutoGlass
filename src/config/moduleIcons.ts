// Mapa único de íconos por módulo (lucide-react) — lo comparten Sidebar y el modal
// de formularios para no duplicar la asignación módulo → ícono.
import {
  Banknote, Briefcase, Building2, CircleDot, ClipboardList, CreditCard, Crosshair,
  Database, HandCoins, Hash, Layers, LayoutDashboard, ListTree, MapPin, Percent,
  Settings, ShieldCheck, Truck, UserCog, Users, Wallet, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const MODULE_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  catalogs: Database,
  settings: Settings,
  workorders: ClipboardList,
  servicesdetail: ListTree,
  customers: Users,
  agents: UserCog,
  techs: Wrench,
  distributors: Truck,
  insurances: ShieldCheck,
  payments: CreditCard,
  paymentdistributor: Banknote,
  techpayments: HandCoins,
  agentcomissions: Percent,
  cat_status: CircleDot,
  cat_zipcode: MapPin,
  cat_company: Building2,
  cat_jobtype: Briefcase,
  cat_calibrationtype: Crosshair,
  cat_pricetier: Layers,
  cat_partnumber: Hash,
  cat_paymentmethod: Wallet,
};
