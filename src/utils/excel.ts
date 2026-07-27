// Exportación del template como archivo Excel real (.xlsx) con ExcelJS.
// ExcelJS se importa dinámicamente para no engordar el bundle inicial:
// solo se descarga cuando el usuario pulsa "Exportar template Excel".

import type { ModuleDef } from '../config/modules';
import type { Row } from '../services/firestore';

export async function downloadExcelTemplate(module: ModuleDef, rows: Row[]): Promise<void> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(module.sqlName);

  const headers = ['id', ...module.fields.map((f) => f.key)];
  sheet.addRow(headers);

  // Encabezado con la identidad de la app: azul, negritas, congelado
  const headRow = sheet.getRow(1);
  headRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3583F6' } };
  headRow.height = 20;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of rows) {
    sheet.addRow(headers.map((h) => {
      const value = row[h];
      // Los ENUMLIST (arrays) se serializan separados por " , " estilo AppSheet
      return Array.isArray(value) ? value.join(' , ') : value ?? '';
    }));
  }

  headers.forEach((h, i) => {
    sheet.getColumn(i + 1).width = Math.max(14, h.length + 4);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${module.sqlName}_template.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
