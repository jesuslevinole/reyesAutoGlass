// Mapa único de íconos por módulo (lucide-react) — lo comparten Sidebar y el modal
// de formularios para no duplicar la asignación módulo → ícono.
import {
  Banknote, Database, Briefcase, Building2, CircleDot, ClipboardList, CreditCard, Crosshair,
  HandCoins, Hash, Layers, LayoutDashboard, ListTree, MapPin, Percent, ShieldCheck,
  Truck, UserCog, Users, Wallet, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const MODULE_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  db_import: Database,
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
