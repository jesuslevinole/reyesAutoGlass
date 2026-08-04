// Mapa único de íconos por módulo (lucide-react) — lo comparten Sidebar y el modal
// de formularios para no duplicar la asignación módulo → ícono.
import {
  Banknote, Briefcase, Building2, CalendarRange, ClipboardList, Crosshair, FileText,
  Database, Frame, Hash, Layers, LayoutDashboard, ListTree, MapPin, Percent,
  Receipt, Settings, Shield, ShieldCheck, Tag, UserCog, UserRound, Users, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const MODULE_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  expenses: Receipt,
  calendar: CalendarRange,
  statusflow: ListTree,
  catalogs: Database,
  settings: Settings,
  users: UserRound,
  roles: Shield,
  quotes: FileText,
  workorders: ClipboardList,
  servicesdetail: ListTree,
  customers: Users,
  agents: UserCog,
  insurances: ShieldCheck,
  team: UserCog,
  commissionpayments: Banknote,
  agentcomissions: Percent,
  cat_zipcode: MapPin,
  cat_company: Building2,
  cat_jobtype: Briefcase,
  cat_calibrationtype: Crosshair,
  cat_pricetier: Layers,
  cat_partnumber: Hash,
  cat_paymentmethod: Wallet,
  cat_molding: Frame,
  cat_tag: Tag,
  cat_expenses: Receipt,
};
