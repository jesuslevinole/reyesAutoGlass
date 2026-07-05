import React, { useState, useMemo, useRef } from 'react';
import {
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle,
  Loader2, Play, ShieldCheck, ArrowRight, ListChecks, Trash2,
} from 'lucide-react';
import { workOrderService } from '../../services/workOrderService';
import {
  WORK_ORDER_HEADER_SCHEMA,
  WORK_ORDER_DETAIL_SCHEMA,
  type FieldSchema,
} from '../../config/workOrderSchemas';
import type { WorkOrderData, WorkOrderPart } from '../../types/workOrder';

interface Props {
  onImported?: () => void;
}

// ---------------------------------------------------------------------------
//  Parser CSV robusto (sin dependencias).
//  - Detecta el separador (coma, punto y coma o tabulador).
//  - Soporta comillas, separadores y saltos de línea internos.
//  - Recupera archivos "rotos" por Excel donde cada fila viene envuelta
//    entera entre comillas (queda todo en una sola celda).
// ---------------------------------------------------------------------------

// Separa una línea lógica en campos respetando comillas.
function tokenizeLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === delim) { out.push(field); field = ''; i++; continue; }
    field += c; i++;
  }
  out.push(field);
  return out;
}

// Detecta el separador contando ocurrencias fuera de comillas en la 1a línea.
function detectDelimiter(text: string): string {
  let line = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') q = !q;
    else if (!q && (c === '\n')) break;
    else line += c;
  }
  const cands = [',', ';', '\t'];
  const counts = cands.map((d) => (line.split(d).length - 1));
  let best = ',', max = -1;
  cands.forEach((d, idx) => { if (counts[idx] > max) { max = counts[idx]; best = d; } });
  return best;
}

function parseCSV(input: string): { headers: string[]; rows: Record<string, string>[] } {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // quitar BOM

  const delim = detectDelimiter(text);

  const matrix: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === delim) { cur.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { cur.push(field); matrix.push(cur); cur = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || cur.length > 0) { cur.push(field); matrix.push(cur); }

  const nonEmpty = matrix.filter((r) => r.some((v) => v.trim() !== ''));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h) => h.trim());

  const rows = nonEmpty.slice(1).map((r) => {
    // Recuperación Excel: fila entera quedó en una sola celda con separadores dentro.
    if (headers.length > 1 && r.length === 1 && r[0].includes(delim)) {
      r = tokenizeLine(r[0], delim);
    }
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

// ---------------------------------------------------------------------------
//  Coerción de tipos según el esquema.
// ---------------------------------------------------------------------------
const TRUE_RE = /^(true|1|si|sí|yes|x)$/i;

function coerceValue(f: FieldSchema, raw: string): { value?: any; error?: string } {
  const v = raw.trim();
  if (v === '') return { value: undefined };
  if (f.type === 'number') {
    const n = Number(v.replace(/,/g, ''));
    if (Number.isNaN(n)) return { error: `"${f.key}": "${v}" no es un número` };
    return { value: n };
  }
  if (f.type === 'boolean') return { value: TRUE_RE.test(v) };
  if (f.type === 'enum') {
    if (f.enumValues && !f.enumValues.includes(v)) {
      return { error: `"${f.key}": valor inválido "${v}" (permitidos: ${f.enumValues.filter(Boolean).join(', ')})` };
    }
    return { value: v };
  }
  return { value: v }; // string / date / time
}

interface HeaderRecord { rowNum: number; id: string; data: WorkOrderData; errors: string[]; }
interface DetailRecord { rowNum: number; workOrderId: string; lineOrder: number; part: WorkOrderPart; errors: string[]; }

// Construye un WorkOrderData completo con defaults de tipo.
function buildHeader(row: Record<string, string>, rowNum: number): HeaderRecord {
  const errors: string[] = [];
  const data: any = {};

  for (const f of WORK_ORDER_HEADER_SCHEMA.fields) {
    const raw = row[f.key] ?? '';
    const { value, error } = coerceValue(f, raw);
    if (error) errors.push(error);

    if (value === undefined) {
      if (f.required && raw.trim() === '') errors.push(`Falta el campo obligatorio "${f.key}"`);
      // Default por tipo para respetar el contrato de WorkOrderData.
      data[f.key] = f.type === 'number' ? 0 : '';
    } else {
      data[f.key] = value;
    }
  }

  const id = String(data.id || '').trim();
  return { rowNum, id, data: data as WorkOrderData, errors };
}

// Construye una parte/servicio pura (WorkOrderPart) + su FK y orden.
function buildDetail(row: Record<string, string>, rowNum: number, fallbackOrder: number): DetailRecord {
  const errors: string[] = [];
  const part: any = {};
  let workOrderId = '';
  let lineOrder = fallbackOrder;

  for (const f of WORK_ORDER_DETAIL_SCHEMA.fields) {
    const raw = row[f.key] ?? '';
    const { value, error } = coerceValue(f, raw);
    if (error) errors.push(error);

    if (f.key === 'workOrderId') {
      workOrderId = String(value ?? '').trim();
      if (!workOrderId) errors.push('Falta el campo obligatorio "workOrderId"');
      continue;
    }
    if (f.key === 'lineOrder') {
      if (value !== undefined) lineOrder = value as number;
      continue;
    }
    if (f.key === 'type') {
      if (value === undefined) errors.push('Falta el campo obligatorio "type" (Parts o Services)');
      else part.type = value;
      continue;
    }
    if (value === undefined) {
      // jobtype es string no-opcional en el tipo; el resto se omite si viene vacío.
      if (f.key === 'jobtype') part.jobtype = '';
      continue;
    }
    part[f.key] = value;
  }

  if (part.jobtype === undefined) part.jobtype = '';
  return { rowNum, workOrderId, lineOrder, part: part as WorkOrderPart, errors };
}

// ---------------------------------------------------------------------------
//  Componente principal
// ---------------------------------------------------------------------------
type ImportResults = {
  created: string[];
  updated: string[];
  skipped: string[];
  failed: { id: string; error: string }[];
};

export const DataImportView: React.FC<Props> = ({ onImported }) => {
  const headerInputRef = useRef<HTMLInputElement>(null);
  const detailInputRef = useRef<HTMLInputElement>(null);

  const [headerFileName, setHeaderFileName] = useState('');
  const [detailFileName, setDetailFileName] = useState('');
  const [headers, setHeaders] = useState<HeaderRecord[] | null>(null);
  const [details, setDetails] = useState<DetailRecord[] | null>(null);
  const [parseError, setParseError] = useState('');

  const [overwrite, setOverwrite] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ImportResults | null>(null);

  // --- Lectura de archivos ---
  const handleHeaderFile = async (file: File | undefined) => {
    if (!file) return;
    setResults(null); setParseError('');
    try {
      const text = await file.text();
      const { headers: cols, rows } = parseCSV(text);
      const missing = WORK_ORDER_HEADER_SCHEMA.fields.filter((f) => f.required && !cols.includes(f.key)).map((f) => f.key);
      if (missing.length) { setParseError(`Al encabezado le faltan columnas obligatorias: ${missing.join(', ')}`); return; }
      setHeaderFileName(file.name);
      setHeaders(rows.map((r, i) => buildHeader(r, i + 2))); // +2: fila 1 = títulos
    } catch (e) {
      setParseError('No se pudo leer el archivo de encabezados: ' + String(e));
    }
  };

  const handleDetailFile = async (file: File | undefined) => {
    if (!file) return;
    setResults(null); setParseError('');
    try {
      const text = await file.text();
      const { headers: cols, rows } = parseCSV(text);
      const missing = WORK_ORDER_DETAIL_SCHEMA.fields.filter((f) => f.required && !cols.includes(f.key)).map((f) => f.key);
      if (missing.length) { setParseError(`Al detalle le faltan columnas obligatorias: ${missing.join(', ')}`); return; }
      setDetailFileName(file.name);
      setDetails(rows.map((r, i) => buildDetail(r, i + 2, i)));
    } catch (e) {
      setParseError('No se pudo leer el archivo de detalle: ' + String(e));
    }
  };

  // --- Validación cruzada ---
  const validation = useMemo(() => {
    if (!headers) return null;
    const headerIds = new Set(headers.map((h) => h.id).filter(Boolean));

    // IDs duplicados en el encabezado.
    const seen = new Set<string>();
    const dupIds = new Set<string>();
    headers.forEach((h) => { if (h.id) { if (seen.has(h.id)) dupIds.add(h.id); else seen.add(h.id); } });

    const headerErrors = headers.filter((h) => h.errors.length > 0 || !h.id);
    const detailErrors = (details || []).filter((d) => d.errors.length > 0);
    const orphanDetails = (details || []).filter((d) => d.workOrderId && !headerIds.has(d.workOrderId));

    const validHeaders = headers.filter((h) => h.id && h.errors.length === 0 && !dupIds.has(h.id));
    const validDetails = (details || []).filter((d) => d.errors.length === 0 && headerIds.has(d.workOrderId));

    // Conteo de partes por orden válida.
    const partsCount = new Map<string, number>();
    validDetails.forEach((d) => partsCount.set(d.workOrderId, (partsCount.get(d.workOrderId) || 0) + 1));

    return {
      headerIds, dupIds: [...dupIds], headerErrors, detailErrors, orphanDetails,
      validHeaders, validDetails, partsCount,
    };
  }, [headers, details]);

  // --- Ejecutar importación ---
  const runImport = async () => {
    if (!validation || validation.validHeaders.length === 0) return;
    setIsImporting(true);
    setResults(null);

    const res: ImportResults = { created: [], updated: [], skipped: [], failed: [] };

    // Agrupar partes válidas por orden y ordenarlas por lineOrder.
    const partsByOrder = new Map<string, DetailRecord[]>();
    validation.validDetails.forEach((d) => {
      if (!partsByOrder.has(d.workOrderId)) partsByOrder.set(d.workOrderId, []);
      partsByOrder.get(d.workOrderId)!.push(d);
    });

    const total = validation.validHeaders.length;
    setProgress({ done: 0, total });

    for (let idx = 0; idx < validation.validHeaders.length; idx++) {
      const h = validation.validHeaders[idx];
      const parts = (partsByOrder.get(h.id) || [])
        .sort((a, b) => a.lineOrder - b.lineOrder)
        .map((d) => d.part);

      const payload: WorkOrderData = { ...h.data, id: h.id, parts };

      try {
        const existing = await workOrderService.getById(h.id);
        if (existing) {
          if (!overwrite) { res.skipped.push(h.id); }
          else { await workOrderService.update(h.id, payload); res.updated.push(h.id); }
        } else {
          await workOrderService.create(payload);
          res.created.push(h.id);
        }
      } catch (e) {
        res.failed.push({ id: h.id, error: String(e) });
      }
      setProgress({ done: idx + 1, total });
    }

    setResults(res);
    setIsImporting(false);
    if (onImported && (res.created.length || res.updated.length)) onImported();
  };

  const resetAll = () => {
    setHeaders(null); setDetails(null); setHeaderFileName(''); setDetailFileName('');
    setResults(null); setParseError(''); setProgress({ done: 0, total: 0 });
    if (headerInputRef.current) headerInputRef.current.value = '';
    if (detailInputRef.current) detailInputRef.current.value = '';
  };

  const canImport = !!validation && validation.validHeaders.length > 0 && !isImporting;

  // -------------------------------------------------------------------------
  //  UI
  // -------------------------------------------------------------------------
  return (
    <div className="animate-in fade-in" style={{ padding: '2rem 2.5rem', flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box' }}>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>

      {/* HEADER */}
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#0F172A', fontWeight: 800 }}>Importar Datos</h1>
        <p style={{ margin: '2px 0 0 0', color: '#64748B', fontSize: '0.85rem' }}>
          Carga los CSV llenados desde AppSheet. El encabezado va a <code style={{ background: '#F1F5F9', padding: '0 4px', borderRadius: 4 }}>work_orders</code> y el detalle a <code style={{ background: '#F1F5F9', padding: '0 4px', borderRadius: 4 }}>work_order_details</code>.
        </p>
      </header>

      {/* PASO 1: CARGA DE ARCHIVOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <FilePicker
          label="1. Encabezados (work_orders)"
          fileName={headerFileName}
          count={headers?.length}
          inputRef={headerInputRef}
          onFile={handleHeaderFile}
          accent="#2563EB"
        />
        <FilePicker
          label="2. Detalle (work_order_details)"
          fileName={detailFileName}
          count={details?.length}
          inputRef={detailInputRef}
          onFile={handleDetailFile}
          accent="#7C3AED"
          optional
        />
      </div>

      {parseError && (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '0.9rem 1.1rem', borderRadius: '10px', marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
          <XCircle size={18} /> {parseError}
        </div>
      )}

      {/* PASO 2: VALIDACIÓN */}
      {validation && (
        <div style={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <ShieldCheck size={18} color="#0F172A" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>Validación</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.9rem', marginBottom: '1rem' }}>
            <Stat label="Órdenes válidas" value={validation.validHeaders.length} color="#059669" icon={<CheckCircle2 size={16} />} />
            <Stat label="Partes válidas" value={validation.validDetails.length} color="#2563EB" icon={<ListChecks size={16} />} />
            <Stat label="Órdenes con error" value={validation.headerErrors.length} color="#DC2626" icon={<XCircle size={16} />} />
            <Stat label="Partes con error" value={validation.detailErrors.length} color="#DC2626" icon={<XCircle size={16} />} />
            <Stat label="Partes huérfanas" value={validation.orphanDetails.length} color="#D97706" icon={<AlertTriangle size={16} />} />
          </div>

          {validation.dupIds.length > 0 && (
            <IssueBlock color="#DC2626" title={`IDs de orden duplicados (${validation.dupIds.length})`}>
              {validation.dupIds.slice(0, 20).join(', ')}{validation.dupIds.length > 20 ? '…' : ''}
            </IssueBlock>
          )}

          {validation.headerErrors.length > 0 && (
            <IssueBlock color="#DC2626" title={`Errores en encabezados (${validation.headerErrors.length})`}>
              {validation.headerErrors.slice(0, 15).map((h) => (
                <div key={h.rowNum} style={{ marginBottom: 4 }}>
                  <strong>Fila {h.rowNum}{h.id ? ` (${h.id})` : ''}:</strong> {h.errors.join(' · ') || 'sin ID'}
                </div>
              ))}
              {validation.headerErrors.length > 15 && <div>…y {validation.headerErrors.length - 15} más</div>}
            </IssueBlock>
          )}

          {validation.detailErrors.length > 0 && (
            <IssueBlock color="#DC2626" title={`Errores en detalle (${validation.detailErrors.length})`}>
              {validation.detailErrors.slice(0, 15).map((d) => (
                <div key={d.rowNum} style={{ marginBottom: 4 }}>
                  <strong>Fila {d.rowNum}{d.workOrderId ? ` (${d.workOrderId})` : ''}:</strong> {d.errors.join(' · ')}
                </div>
              ))}
              {validation.detailErrors.length > 15 && <div>…y {validation.detailErrors.length - 15} más</div>}
            </IssueBlock>
          )}

          {validation.orphanDetails.length > 0 && (
            <IssueBlock color="#D97706" title={`Partes sin orden en este archivo (${validation.orphanDetails.length})`}>
              Estas partes referencian un workOrderId que no está en el CSV de encabezados y no se importarán:
              {' '}{[...new Set(validation.orphanDetails.map((d) => d.workOrderId))].slice(0, 20).join(', ')}
            </IssueBlock>
          )}

          {validation.headerErrors.length === 0 && validation.detailErrors.length === 0 && validation.dupIds.length === 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#047857', fontWeight: 600, fontSize: '0.88rem' }}>
              <CheckCircle2 size={18} /> Todo listo para importar. No se encontraron errores.
            </div>
          )}
        </div>
      )}

      {/* PASO 3: OPCIONES + BOTÓN IMPORTAR (barra fija al fondo) */}
      {validation && (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 5, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', boxShadow: '0 -6px 16px -8px rgba(15,23,42,0.15)', marginTop: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#2563EB', cursor: 'pointer' }} />
            Sobrescribir órdenes que ya existan (si se desmarca, se omiten)
          </label>

          <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
            <button onClick={resetAll} disabled={isImporting} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontWeight: 600, fontSize: '0.85rem', cursor: isImporting ? 'not-allowed' : 'pointer' }}>
              <Trash2 size={15} /> Limpiar
            </button>
            <button onClick={runImport} disabled={!canImport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.4rem', borderRadius: '8px', border: 'none', backgroundColor: canImport ? '#0F172A' : '#94A3B8', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: canImport ? 'pointer' : 'not-allowed' }}>
              {isImporting ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Importando {progress.done}/{progress.total}</> : <><Play size={16} /> Importar {validation.validHeaders.length} órdenes</>}
            </button>
          </div>
        </div>
      )}

      {/* RESULTADOS */}
      {results && (
        <div style={{ marginTop: '1.5rem', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <CheckCircle2 size={20} color="#059669" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>Importación finalizada</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.9rem' }}>
            <Stat label="Creadas" value={results.created.length} color="#059669" icon={<CheckCircle2 size={16} />} />
            <Stat label="Actualizadas" value={results.updated.length} color="#2563EB" icon={<ArrowRight size={16} />} />
            <Stat label="Omitidas (ya existían)" value={results.skipped.length} color="#64748B" icon={<AlertTriangle size={16} />} />
            <Stat label="Fallidas" value={results.failed.length} color="#DC2626" icon={<XCircle size={16} />} />
          </div>
          {results.failed.length > 0 && (
            <IssueBlock color="#DC2626" title="Detalle de fallas">
              {results.failed.slice(0, 20).map((f) => (
                <div key={f.id} style={{ marginBottom: 4 }}><strong>{f.id}:</strong> {f.error}</div>
              ))}
            </IssueBlock>
          )}
          {results.skipped.length > 0 && (
            <p style={{ marginTop: '0.9rem', fontSize: '0.82rem', color: '#64748B' }}>
              {results.skipped.length} orden(es) se omitieron por ya existir. Marca “Sobrescribir” y vuelve a importar si quieres actualizarlas.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
//  Subcomponentes de UI
// ---------------------------------------------------------------------------
const FilePicker: React.FC<{
  label: string; fileName: string; count?: number; accent: string; optional?: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File | undefined) => void;
}> = ({ label, fileName, count, accent, optional, inputRef, onFile }) => (
  <div
    onClick={() => inputRef.current?.click()}
    style={{ border: `2px dashed ${fileName ? accent : '#CBD5E1'}`, borderRadius: '12px', padding: '1.5rem', backgroundColor: fileName ? '#F8FAFC' : 'white', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
  >
    <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <div style={{ padding: '0.5rem', borderRadius: '8px', backgroundColor: fileName ? accent : '#F1F5F9', color: fileName ? 'white' : '#94A3B8', display: 'flex' }}>
        {fileName ? <FileSpreadsheet size={20} /> : <UploadCloud size={20} />}
      </div>
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>{label}{optional && <span style={{ color: '#94A3B8', fontWeight: 500 }}> (opcional)</span>}</div>
        <div style={{ fontSize: '0.8rem', color: fileName ? '#475569' : '#94A3B8' }}>
          {fileName ? `${fileName}${count !== undefined ? ` · ${count} filas` : ''}` : 'Haz clic para elegir un archivo CSV'}
        </div>
      </div>
    </div>
  </div>
);

const Stat: React.FC<{ label: string; value: number; color: string; icon: React.ReactNode }> = ({ label, value, color, icon }) => (
  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0.9rem 1rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color, marginBottom: '0.3rem' }}>{icon}<span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{value}</span></div>
    <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>{label}</div>
  </div>
);

const IssueBlock: React.FC<{ color: string; title: string; children: React.ReactNode }> = ({ color, title, children }) => (
  <div style={{ marginTop: '1rem', backgroundColor: color === '#DC2626' ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${color === '#DC2626' ? '#FECACA' : '#FDE68A'}`, borderRadius: '10px', padding: '0.9rem 1.1rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color, fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.5rem' }}>
      <AlertTriangle size={15} /> {title}
    </div>
    <div style={{ fontSize: '0.8rem', color: '#475569', maxHeight: '220px', overflowY: 'auto', lineHeight: 1.6 }}>{children}</div>
  </div>
);