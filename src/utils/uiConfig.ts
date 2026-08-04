// Overrides de UI persistidos en Firestore (colección `config_ui`).
// Documentos: uno por módulo ({ title?, labels?, columnOrder? }) y `_menu` ({ order? }).
// Mismo patrón de configuración compartida por Firestore usado en otros proyectos.

import type { ModuleDef, NavItem } from '../config/modules';
import type { Row } from '../services/firestore';

export interface ModuleOverride {
  /** Título del módulo (también renombra su entrada del menú) */
  title?: string;
  /** Etiquetas personalizadas por key de campo */
  labels?: Record<string, string>;
  /** Orden de las columnas del listado (keys inList) */
  columnOrder?: string[];
  /** Orden de los campos del formulario */
  formOrder?: string[];
  /** Columnas visibles del listado (cualquier campo del módulo) */
  visibleColumns?: string[];
}

/** Permisos por acción de un rol sobre un módulo. */
export interface ModulePerm {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
}

export const FULL_PERM: ModulePerm = { view: true, add: true, edit: true, delete: true };

function asOverride(doc: Row | undefined): ModuleOverride {
  if (!doc) return {};
  const d = doc as Record<string, unknown>;
  return {
    title: typeof d.title === 'string' && d.title ? d.title : undefined,
    labels: (d.labels && typeof d.labels === 'object') ? d.labels as Record<string, string> : undefined,
    columnOrder: Array.isArray(d.columnOrder) ? d.columnOrder as string[] : undefined,
    formOrder: Array.isArray(d.formOrder) ? d.formOrder as string[] : undefined,
    visibleColumns: Array.isArray(d.visibleColumns) && (d.visibleColumns as string[]).length > 0
      ? d.visibleColumns as string[] : undefined,
  };
}

/** Aplica los overrides de un módulo: título, etiquetas de campos y orden de columnas. */
export function applyOverrides(module: ModuleDef, configDoc: Row | undefined): ModuleDef {
  const ov = asOverride(configDoc);
  if (!ov.title && !ov.labels && !ov.columnOrder && !ov.formOrder && !ov.visibleColumns) return module;
  let fields = module.fields.map((f) => {
    const custom = ov.labels?.[f.key];
    return custom ? { ...f, label: custom } : f;
  });
  if (ov.formOrder && ov.formOrder.length > 0) {
    const order = ov.formOrder;
    fields = [...fields].sort((a, b) => {
      const ia = order.indexOf(a.key);
      const ib = order.indexOf(b.key);
      return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
    });
  }
  return {
    ...module,
    title: ov.title ?? module.title,
    columnOrder: ov.columnOrder,
    visibleColumns: ov.visibleColumns,
    fields,
  };
}

/** Reordena el menú según config_ui/_menu.order; ids no listados conservan su posición al final. */
export function orderNav(items: NavItem[], menuDoc: Row | undefined): NavItem[] {
  const d = menuDoc as Record<string, unknown> | undefined;
  const order = Array.isArray(d?.order) ? d.order as string[] : null;
  if (!order) return items;
  const byId = new Map(items.map((i) => [i.id, i]));
  const sorted: NavItem[] = [];
  for (const id of order) {
    const item = byId.get(id);
    if (item) { sorted.push(item); byId.delete(id); }
  }
  return [...sorted, ...byId.values()];
}
