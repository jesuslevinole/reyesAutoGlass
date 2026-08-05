import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, FileSpreadsheet, X } from 'lucide-react';
import type { FieldDef, ModuleDef } from '../config/modules';
import { MODULES } from '../config/modules';
import { MODULE_ICONS } from '../config/moduleIcons';
import type { Row } from '../services/firestore';
import { cachedFetchAll } from '../services/catalogCache';
import { formatPhone, getFieldValue, getRelationName } from '../utils/relations';
import './ReportsView.css';

/** Módulos exportables: todo lo que tenga colección de datos. */
const EXPORTABLE = MODULES.filter((m) => Boolean(m.collection));

export default function ReportsView() {
  const [moduleId, setModuleId] = useState<string>(EXPORTABLE[0]?.id ?? '');
  const module = useMemo(() => EXPORTABLE.find((m) => m.id === moduleId) ?? EXPORTABLE[0], [moduleId]);
  // Selección ORDENADA de columnas (el orden del array es el del Excel)
  const [columns, setColumns] = useState<string[]>(() =>
    (EXPORTABLE[0]?.fields ?? []).filter((f) => f.inList).map((f) => f.key));
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState('');

  const pickModule = (m: ModuleDef) => {
    setModuleId(m.id);
    setColumns(m.fields.filter((f) => f.inList).map((f) => f.key));
    setDone('');
  };

  const toggle = (key: string) =>
    setColumns((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const move = (index: number, dir: -1 | 1) => {
    setColumns((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const labelOf = (key: string) => module.fields.find((f) => f.key === key)?.label ?? key;

  const exportExcel = async () => {
    if (columns.length === 0) return;
    setExporting(true);
    setDone('');
    try {
      const fields = columns
        .map((key) => module.fields.find((f) => f.key === key))
        .filter((f): f is FieldDef => Boolean(f));

      // Datos del módulo + catálogos de sus FKs (todo por caché — cero lecturas si está fresco)
      const rows = await cachedFetchAll(module.collection);
      const fkCollections = [...new Set(fields.filter((f) => f.type === 'fk' && f.fkCollection).map((f) => f.fkCollection as string))];
      const fkData: Record<string, Row[]> = {};
      for (const col of fkCollections) fkData[col] = await cachedFetchAll(col);

      const cellOf = (row: Row, field: FieldDef): string | number => {
        const value = getFieldValue(row, field);
        if (value === undefined || value === null || value === '') return '';
        if (field.type === 'fk') return getRelationName(String(value), fkData[field.fkCollection ?? ''] ?? []);
        if (field.type === 'phone') return formatPhone(value);
        if (field.type === 'decimal' || field.type === 'int' || field.type === 'percent') {
          const n = Number(value);
          return Number.isFinite(n) ? n : String(value);
        }
        return String(value);
      };

      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(module.title.slice(0, 31));

      sheet.columns = fields.map((f) => ({
        header: f.label.toUpperCase(),
        key: f.key,
        width: Math.max(14, f.label.length + 4),
      }));
      const head = sheet.getRow(1);
      head.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      head.alignment = { vertical: 'middle' };
      head.height = 22;

      for (const row of rows) {
        const excelRow = sheet.addRow(fields.map((f) => cellOf(row, f)));
        fields.forEach((f, i) => {
          if (f.type === 'decimal') excelRow.getCell(i + 1).numFmt = '"$"#,##0.00';
          if (f.type === 'percent') excelRow.getCell(i + 1).numFmt = '0.00"%"';
        });
      }
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: fields.length } };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${module.id}-report-${stamp}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(`${rows.length} rows exported`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="module-view">
      <header className="module-head">
        <div>
          <h1>Reports</h1>
          <p className="module-desc">Export any module to Excel — choose exactly which columns and in what order</p>
        </div>
        <div className="module-actions">
          <button
            className="btn-primary btn-gradient"
            disabled={exporting || columns.length === 0}
            onClick={() => void exportExcel()}
          >
            <Download size={15} />
            {exporting ? 'Exporting…' : `Export Excel (${columns.length})`}
          </button>
        </div>
      </header>

      {done && <p className="rp-done"><FileSpreadsheet size={14} /> {done}</p>}

      <div className="rp-layout">
        <nav className="rp-modules" aria-label="Module">
          {EXPORTABLE.map((m) => {
            const Icon = MODULE_ICONS[m.id] ?? FileSpreadsheet;
            return (
              <button
                key={m.id}
                type="button"
                className={`rp-module${m.id === module.id ? ' active' : ''}`}
                onClick={() => pickModule(m)}
              >
                <Icon size={15} />
                {m.title}
              </button>
            );
          })}
        </nav>

        <div className="rp-panel">
          <div className="rp-panel-head">
            <h2>{module.title}</h2>
            <span className="rp-quick">
              <button type="button" onClick={() => setColumns(module.fields.map((f) => f.key))}>All</button>
              <button type="button" onClick={() => setColumns(module.fields.filter((f) => f.inList).map((f) => f.key))}>Default</button>
              <button type="button" onClick={() => setColumns([])}>None</button>
            </span>
          </div>

          <ul className="rp-fields">
            {module.fields.map((field) => {
              const checked = columns.includes(field.key);
              return (
                <li key={field.key}>
                  <label className={`rp-field${checked ? ' checked' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(field.key)} />
                    {field.label}
                  </label>
                </li>
              );
            })}
          </ul>

          {columns.length > 0 && (
            <>
              <p className="rp-order-label">Excel column order ({columns.length})</p>
              <ol className="rp-order">
                {columns.map((key, index) => (
                  <li key={key}>
                    <span className="rp-order-num">{index + 1}</span>
                    <span className="rp-order-name">{labelOf(key)}</span>
                    <span className="rp-order-actions">
                      <button className="btn-icon-ghost" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                        <ArrowUp size={13} />
                      </button>
                      <button className="btn-icon-ghost" onClick={() => move(index, 1)} disabled={index === columns.length - 1} aria-label="Move down">
                        <ArrowDown size={13} />
                      </button>
                      <button className="btn-danger-ghost" onClick={() => toggle(key)} aria-label="Remove">
                        <X size={13} />
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
