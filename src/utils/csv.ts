// Exportación de templates CSV (compatibles con Excel vía BOM UTF-8)
// e importación de CSV para poblar Firestore desde bases SQL exportadas.

function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Genera el contenido CSV: fila de encabezados (nombres de columna SQL) + datos actuales. */
export function buildCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const head = headers.map(escapeCell).join(',');
  const body = rows.map((r) =>
    headers.map((h) => {
      const v = r[h];
      // Los ENUMLIST (arrays) se serializan separados por " , " estilo AppSheet
      return escapeCell(Array.isArray(v) ? v.join(' , ') : v);
    }).join(','),
  );
  return [head, ...body].join('\r\n');
}

/** Descarga el CSV con BOM para que Excel lo abra con acentos correctos. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parser CSV con soporte de comillas dobles y saltos de línea dentro de celdas. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

/** Convierte filas CSV (headers en fila 0) a objetos, aplicando el conversor de tipo por columna. */
export function csvToObjects(
  parsed: string[][],
  convert: (key: string, raw: string) => unknown,
): Record<string, unknown>[] {
  if (parsed.length < 2) return [];
  const headers = parsed[0].map((h) => h.trim());
  return parsed.slice(1).map((cells) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      if (!h || h.toLowerCase() === 'id') return; // el id lo asigna Firestore
      obj[h] = convert(h, (cells[idx] ?? '').trim());
    });
    return obj;
  });
}
