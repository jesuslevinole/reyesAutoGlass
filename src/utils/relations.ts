import type { Row } from '../services/firestore';

/** Etiqueta legible de un documento referenciado por FK.
 *  Cubre catálogos con `name` y contactos con `firstName`/`lastName`. */
export function rowLabel(row: Row | undefined): string {
  if (!row) return '—';
  const r = row as Record<string, unknown>;
  if (typeof r.name === 'string' && r.name) return r.name;
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
