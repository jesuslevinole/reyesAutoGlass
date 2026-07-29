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

/** Colores de tag del AppSheet (nombres) → hex de la paleta de la app. */
const TAG_COLORS: Record<string, string> = {
  green: '#16a34a', red: '#dc2626', black: '#334155', blue: '#3583f6',
  yellow: '#d97706', orange: '#ea580c', purple: '#7c3aed', pink: '#db2777',
  gray: '#64748b', grey: '#64748b', white: '#94a3b8', brown: '#92400e',
};

/** Convierte un color de tag (nombre AppSheet o hex) a hex utilizable en CSS. */
export function tagColorToHex(color: unknown): string {
  if (typeof color !== 'string' || !color) return '#94a3b8';
  if (color.startsWith('#')) return color;
  return TAG_COLORS[color.trim().toLowerCase()] ?? '#94a3b8';
}

/** Keys candidatos para nombrar un documento referenciado por FK. */
const LABEL_KEYS = [
  'name', 'tag', 'part_number', 'price_tier', 'calibration_type', 'job_type',
  'payment_method', 'partNumber', 'priceTier', 'calibrationType', 'jobType',
  'paymentMethod', 'company', 'molding', 'expense', 'description', 'title',
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
