// Pipelines CRM definidos por el cliente:
//   Quote:      Draft → Converted
//   Work Order: Accepted → Assigned → Sent → Paid → Complied
// Cada cotización y orden avanza por estas etapas; los tags se auto-crean si faltan.

import type { Row } from '../services/firestore';
import { createRow } from '../services/firestore';
import { invalidateCatalog } from '../services/catalogCache';

export const QUOTE_PIPELINE = ['Draft', 'Converted'] as const;
export const WORKORDER_PIPELINE = ['Accepted', 'Assigned', 'Sent', 'Paid', 'Complied'] as const;

/** Color sugerido por etapa (nombres de color estilo AppSheet). */
const STAGE_COLORS: Record<string, string> = {
  Draft: 'Gray', Converted: 'Green',
  Accepted: 'Blue', Assigned: 'Purple', Sent: 'Orange', Paid: 'Green', Complied: 'Black',
};

export function pipelineFor(kind: 'quote' | 'workorder'): readonly string[] {
  return kind === 'quote' ? QUOTE_PIPELINE : WORKORDER_PIPELINE;
}

/** Índice de un status dentro del pipeline (−1 si está fuera del proceso). */
export function stageIndex(pipeline: readonly string[], statusName: string): number {
  return pipeline.findIndex((s) => s.toLowerCase() === statusName.trim().toLowerCase());
}

/** Busca el tag de una etapa por nombre y tipo; si no existe, lo crea en el catálogo. */
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
