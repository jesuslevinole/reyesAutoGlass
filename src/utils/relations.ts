import type { Row } from '../services/firestore';

/** Lee el valor de un campo probando su key principal y sus altKeys (bases existentes). */
export function getFieldValue(
  row: Record<string, unknown>,
  field: { key: string; altKeys?: string[] },
): unknown {
  if (row[field.key] !== undefined && row[field.key] !== '') return row[field.key];
  for (const alt of field.altKeys ?? []) {
    if (row[alt] !== undefined && row[alt] !== '') return row[alt];
  }
  return row[field.key];
}

/** Keys candidatos para nombrar un documento referenciado por FK. */
const LABEL_KEYS = [
  'name', 'tag', 'partNumber', 'priceTier', 'calibrationType', 'jobType',
  'paymentMethod', 'company', 'molding', 'description', 'title',
];

/** Etiqueta legible de un documento referenciado por FK.
 *  Cubre catálogos con `name` (o equivalentes) y contactos con `firstName`/`lastName`. */
export function rowLabel(row: Row | undefined): string {
  if (!row) return '—';
  const r = row as Record<string, unknown>;
  for (const key of LABEL_KEYS) {
    if (typeof r[key] === 'string' && r[key]) return r[key] as string;
  }
  const first = typeof r.firstName === 'string' ? r.firstName : '';
  const last = typeof r.lastName === 'string' ? r.lastName : '';
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (typeof r.zipcode === 'string' || typeof r.zipcode === 'number') {
    return `${r.city ?? ''} ${r.zipcode}`.trim();
  }
  return row.id.slice(0, 8);
}

export function getRelationName(id: unknown, catalog: Row[]): string {
  if (typeof id !== 'string' || !id) return '—';
  return rowLabel(catalog.find((c) => c.id === id));
}

export function getRelationColor(id: unknown, catalog: Row[]): string {
  if (typeof id !== 'string') return '#94a3b8';
  const row = catalog.find((c) => c.id === id) as Record<string, unknown> | undefined;
  return typeof row?.color === 'string' && row.color ? row.color : '#94a3b8';
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export function money(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  return usd.format(Number.isFinite(n) ? n : 0);
}

/** DD/MM/AAAA a partir de un string ISO (AAAA-MM-DD) sin problemas de zona horaria. */
export function formatDate(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
