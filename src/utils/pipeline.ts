// Pipelines CRM alimentados por el catálogo de Status (catalog_tag):
// cada tag ya dice si es de Quote o de Work Order. El configurador define
// el ORDEN de las etapas, su MECANISMO (automático al llenar campos, o
// manual por botón) y los CAMPOS REQUERIDOS para entrar a cada una.

import type { Row } from '../services/firestore';
import { createRow, setRowMerged } from '../services/firestore';
import { cachedFetchAll, invalidateCatalog } from '../services/catalogCache';
import { rowLabel } from './relations';

export interface Stage { id: string; name: string; color: string }

export interface StageConfig {
  mechanism: 'auto' | 'manual';
  required: string[];
  /** true = el status existe pero NO forma parte de la barra del pipeline (p. ej. Cancelled) */
  hidden?: boolean;
}
export interface KindRules {
  /** Orden de las etapas (ids de tags del catálogo) */
  order: string[];
  stages: Record<string, StageConfig>;
}
export interface StatusRules { quote: KindRules; workorder: KindRules }

const EMPTY_KIND: KindRules = { order: [], stages: {} };

/** Colores sugeridos al auto-crear tags de automatización. */
const STAGE_COLORS: Record<string, string> = {
  Draft: 'Gray', Converted: 'Green', Accepted: 'Blue',
};

/** Etapas del pipeline: tags del catálogo del tipo dado, en el orden configurado. */
export function stagesFromTags(tags: Row[], kind: 'quote' | 'workorder', order: string[]): Stage[] {
  const type = kind === 'quote' ? 'Quote' : 'Work Order';
  const ofType = tags.filter((t) => String((t as Record<string, unknown>).type ?? '').includes(type));
  const sorted = [...ofType].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
  });
  return sorted.map((t) => ({
    id: t.id,
    name: rowLabel(t),
    color: String((t as Record<string, unknown>).color ?? ''),
  }));
}

export async function loadStatusRules(): Promise<StatusRules> {
  const docs = await cachedFetchAll('config_ui');
  const found = docs.find((d) => d.id === '_statusRules') as Record<string, unknown> | undefined;
  const parse = (raw: unknown): KindRules => {
    if (!raw || typeof raw !== 'object') return { ...EMPTY_KIND };
    const r = raw as Record<string, unknown>;
    // Formato nuevo
    if (Array.isArray(r.order) || (r.stages && typeof r.stages === 'object')) {
      return {
        order: Array.isArray(r.order) ? r.order as string[] : [],
        stages: (r.stages as Record<string, StageConfig>) ?? {},
      };
    }
    // Formato anterior: Record<stageName, string[]> → migra como manual
    const stages: Record<string, StageConfig> = {};
    for (const [key, value] of Object.entries(r)) {
      if (Array.isArray(value)) stages[key] = { mechanism: 'manual', required: value as string[] };
    }
    return { order: [], stages };
  };
  return {
    quote: parse(found?.quote),
    workorder: parse(found?.workorder),
  };
}

export async function saveStatusRules(rules: StatusRules): Promise<void> {
  await setRowMerged('config_ui', '_statusRules', rules as unknown as Record<string, unknown>);
  invalidateCatalog('config_ui');
}

export function configOf(rules: KindRules, stageId: string): StageConfig {
  return rules.stages[stageId] ?? { mechanism: 'manual', required: [] };
}

/** Etapas visibles en la barra del pipeline (sin las marcadas como ocultas). */
export function visibleStages(stages: Stage[], rules: KindRules): Stage[] {
  return stages.filter((s) => !configOf(rules, s.id).hidden);
}

/** Campos vacíos que impiden entrar a la etapa (por id de tag). */
export function missingForStage(
  rules: KindRules,
  stageId: string,
  resolve: (fieldKey: string) => unknown,
  labelOf: (fieldKey: string) => string,
): string[] {
  const required = configOf(rules, stageId).required;
  const missing: string[] = [];
  for (const key of required) {
    const v = resolve(key);
    if (v === undefined || v === null || v === '') missing.push(labelOf(key));
  }
  return missing;
}

/** Avance automático: desde la etapa actual, recorre las siguientes de mecanismo
 *  'auto' cuyos requisitos ya estén cumplidos. Devuelve el id destino o null. */
export function autoAdvanceTarget(
  stages: Stage[],
  rules: KindRules,
  currentId: string,
  resolve: (fieldKey: string) => unknown,
): string | null {
  const start = stages.findIndex((s) => s.id === currentId);
  if (start === -1) return null;
  let target: string | null = null;
  for (let i = start + 1; i < stages.length; i++) {
    const cfg = configOf(rules, stages[i].id);
    if (cfg.mechanism !== 'auto') break;
    const missing = cfg.required.some((key) => {
      const v = resolve(key);
      return v === undefined || v === null || v === '';
    });
    if (missing) break;
    target = stages[i].id;
  }
  return target;
}

/** Busca un tag por nombre y tipo; si no existe, lo crea (automatizaciones). */
export async function ensureTag(
  tags: Row[],
  name: string,
  type: 'Quote' | 'Work Order',
): Promise<string> {
  const existing = tags.find((t) => {
    const r = t as Record<string, unknown>;
    return String(r.name ?? '').trim().toLowerCase() === name.toLowerCase()
      && String(r.type ?? '').includes(type);
  });
  if (existing) return existing.id;
  const id = await createRow('catalog_tag', {
    name,
    color: STAGE_COLORS[name] ?? 'Blue',
    type,
  });
  invalidateCatalog('catalog_tag');
  return id;
}
