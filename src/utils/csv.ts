// Importación de CSV para poblar Firestore desde bases SQL exportadas.
// (La exportación del template se hace en utils/excel.ts como .xlsx real.)

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
