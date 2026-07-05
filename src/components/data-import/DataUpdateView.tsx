import { useState, useRef, useCallback, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, doc, getDoc, updateDoc, setDoc, getDocs, query, where, limit } from 'firebase/firestore';

// ── Paleta rag-app (tema claro, acento slate + azul) ──────────────────────
const C = {
  bg: '#FAFBFC', panel: '#FFFFFF', border: '#E5E7EB', borderSoft: '#F1F5F9',
  text: '#0F172A', textMuted: '#64748B', textFaint: '#94A3B8',
  accent: '#1E293B', accentHover: '#0F172A', accentSoft: 'rgba(15,23,42,0.06)', accentBorder: '#CBD5E1',
  green: '#10B981', greenSoft: '#ECFDF5', greenBorder: '#A7F3D0',
  blue: '#1D4ED8', blueSoft: '#EFF6FF', blueBorder: '#BFDBFE',
  amber: '#A16207', amberText: '#78350F', amberSoft: '#FFFBEB', amberBorder: '#FEF3C7',
  red: '#EF4444', redText: '#991B1B', redSoft: '#FEF2F2', redBorder: '#FECACA',
};

type IconProps = { size?: number; color?: string; strokeWidth?: number; style?: React.CSSProperties; className?: string };
const mkIcon = (paths: React.ReactNode) =>
  ({ size = 16, color = 'currentColor', strokeWidth = 2, style, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }} className={className}>{paths}</svg>
  );
const Upload = mkIcon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>);
const ArrowRight = mkIcon(<><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>);
const AlertCircle = mkIcon(<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>);
const CheckCircle = mkIcon(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>);
const Database = mkIcon(<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></>);
const Loader2 = mkIcon(<><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></>);
const RotateCcw = mkIcon(<><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></>);
const FileSpreadsheet = mkIcon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /><line x1="12" y1="13" x2="12" y2="21" /></>);
const ChevronDown = mkIcon(<polyline points="6 9 12 15 18 9" />);
const Save = mkIcon(<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>);

// Colecciones "bonitas" + lista fija editable + doc de config (igual que el importador).
const COLECCIONES_BONITAS: { id: string; name: string }[] = [
  { id: 'work_orders', name: 'Órdenes (encabezados)' },
  { id: 'work_order_details', name: 'Detalles (partes)' },
  { id: 'customers', name: 'Clientes' },
  { id: 'team', name: 'Equipo' },
];
const COLECCIONES_CONOCIDAS: string[] = [
  'work_orders', 'work_order_details', 'customers', 'team',
  'catalog_calibration_type', 'catalog_company', 'catalog_expenses',
  'catalog_insurance', 'catalog_jobtype', 'catalog_molding',
  'catalog_part_number', 'catalog_payment_method', 'catalog_price_tier',
  'catalog_tag', 'catalog_vehicle', 'catalog_zipcode',
];
const CONFIG_IMPORT_DOC = { col: 'config_import', id: 'config' };

// ── Parser de CSV sin dependencias externas ────────────────────────────────
// Soporta campos entre comillas con comas y saltos de línea internos, comillas
// escapadas (""), y finales de línea \n, \r\n o \r. Devuelve encabezados +
// filas como objetos { encabezado: valor }.
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const s = text.replace(/^\uFEFF/, ''); // quitar BOM
  const matrix: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); field = ''; matrix.push(row); row = []; }
      else if (ch === '\r') { if (s[i + 1] !== '\n') { row.push(field); field = ''; matrix.push(row); row = []; } }
      else { field += ch; }
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); matrix.push(row); }

  const nonEmpty = matrix.filter(r => r.some(c => (c ?? '').toString().trim() !== ''));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map(h => (h ?? '').toString().trim());
  const rows = nonEmpty.slice(1).map(r => {
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => { if (h) o[h] = (r[idx] ?? '').toString(); });
    return o;
  });
  return { headers, rows };
}

type Step = 'upload' | 'config' | 'preview' | 'running' | 'done';
type ValType = 'auto' | 'text' | 'number';
type MatchMode = 'docId' | 'field';

interface UpdProgress {
  current: number;
  total: number;
  updated: number;
  skipped: number;
  errors: { row: number; id: string; message: string }[];
}

interface DataUpdateViewProps {
  onOpenMenu?: () => void;
}

export default function DataUpdateView({ onOpenMenu }: DataUpdateViewProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [targetCollection, setTargetCollection] = useState('');
  const [otherCollection, setOtherCollection] = useState('');
  const [coleccionesExtra, setColeccionesExtra] = useState<string[]>([]);
  const [savingList, setSavingList] = useState(false);

  const [matchMode, setMatchMode] = useState<MatchMode>('docId');
  const [idColumn, setIdColumn] = useState('');        // columna del CSV con el ID (o valor a emparejar)
  const [matchField, setMatchField] = useState('');    // campo Firestore a emparejar (modo 'field')
  const [valueColumn, setValueColumn] = useState('');  // columna del CSV con el consecutivo
  const [targetField, setTargetField] = useState('consecutivo'); // campo Firestore a escribir
  const [valueType, setValueType] = useState<ValType>('auto');
  const [applyIdCleaning, setApplyIdCleaning] = useState(true);   // misma limpieza que en importación
  const [createIfMissing, setCreateIfMissing] = useState(false);  // set(merge) si no existe

  const [progress, setProgress] = useState<UpdProgress>({ current: 0, total: 0, updated: 0, skipped: 0, errors: [] });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar lista de colecciones guardada en Firestore.
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, CONFIG_IMPORT_DOC.col, CONFIG_IMPORT_DOC.id));
        const arr = (snap.exists() && Array.isArray((snap.data() as any)?.colecciones))
          ? ((snap.data() as any).colecciones as any[]).map(String) : [];
        setColeccionesExtra(arr);
      } catch { /* silencioso */ }
    })();
  }, []);

  const nombresColecciones = Array.from(new Set([
    ...COLECCIONES_BONITAS.map(c => c.id), ...COLECCIONES_CONOCIDAS, ...coleccionesExtra,
  ])).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const labelColeccion = (id: string) => COLECCIONES_BONITAS.find(c => c.id === id)?.name || id;

  const targetCollectionId = () =>
    (targetCollection === '__other__' ? otherCollection.trim() : targetCollection).trim();

  const agregarAListaColeccion = async () => {
    const name = otherCollection.trim();
    if (!name) { alert('Escribe el nombre de la colección primero.'); return; }
    setSavingList(true);
    try {
      await setDoc(doc(db, CONFIG_IMPORT_DOC.col, CONFIG_IMPORT_DOC.id),
        { colecciones: [...new Set([...coleccionesExtra, name])] }, { merge: true });
      setColeccionesExtra(prev => Array.from(new Set([...prev, name])));
      setTargetCollection(name);
      setOtherCollection('');
    } catch (err: any) {
      alert(`No se pudo guardar en la lista: ${err?.message || err}`);
    } finally { setSavingList(false); }
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  // MISMA limpieza de ID usada al importar, para que el ID empareje.
  const cleanId = (raw: string) => String(raw || '').trim().replace(/\//g, '_').replace(/^\.+|\.+$/g, '');

  const coerceValue = (raw: any): any => {
    if (raw === null || raw === undefined) return '';
    const str = String(raw).trim();
    if (valueType === 'text') return str;
    if (valueType === 'number') { const n = Number(str.replace(/,/g, '')); return isNaN(n) ? str : n; }
    // auto
    if (str === '') return '';
    if (!isNaN(Number(str.replace(/,/g, ''))) && str.replace(/,/g, '') !== '') return Number(str.replace(/,/g, ''));
    return str;
  };

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) { alert('Por favor selecciona un archivo CSV.'); return; }
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result || '');
        const { headers: parsedHeaders, rows } = parseCSV(text);
        if (!rows.length) { alert('El CSV está vacío o no tiene filas válidas.'); return; }
        const data = rows;
        const headers = parsedHeaders.filter(h => h.trim() !== '');
        setCsvData(data);
        setCsvHeaders(headers);
        // Auto-adivinar columnas: id y consecutivo por nombre.
        const norm = (x: string) => x.toLowerCase().replace(/[\s_-]+/g, '');
        const guessId = headers.find(h => ['id', 'docid', 'iddocumento'].includes(norm(h))) || headers[0] || '';
        const guessVal = headers.find(h => ['consecutivo', 'consec', 'numconsecutivo', 'folio', 'referencia', 'numreferencia'].includes(norm(h))) || headers[1] || '';
        setIdColumn(guessId);
        setValueColumn(guessVal);
        setStep('config');
      } catch (err: any) { alert(`Error parseando CSV: ${err?.message || err}`); }
    };
    reader.onerror = () => alert('No se pudo leer el archivo.');
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, []);

  const puedeContinuar = () => {
    if (!targetCollectionId() || !idColumn || !valueColumn || !targetField.trim()) return false;
    if (matchMode === 'field' && !matchField.trim()) return false;
    return true;
  };

  const handleRun = async () => {
    const colId = targetCollectionId();
    if (!puedeContinuar()) { alert('Completa la configuración (colección, columnas y campo destino).'); return; }

    setStep('running');
    setProgress({ current: 0, total: csvData.length, updated: 0, skipped: 0, errors: [] });

    const errors: UpdProgress['errors'] = [];
    let updated = 0, skipped = 0, current = 0;
    const CONC = 20; // concurrencia

    for (let i = 0; i < csvData.length; i += CONC) {
      const chunk = csvData.slice(i, i + CONC);
      await Promise.all(chunk.map(async (row, j) => {
        const rowNumber = i + j + 1;
        const rawId = String(row[idColumn] ?? '').trim();
        const value = coerceValue(row[valueColumn]);
        try {
          if (!rawId) { skipped++; errors.push({ row: rowNumber, id: '(vacío)', message: 'ID/valor de emparejamiento vacío' }); return; }
          if (value === '' ) { skipped++; errors.push({ row: rowNumber, id: rawId, message: 'Consecutivo vacío' }); return; }

          if (matchMode === 'docId') {
            const id = applyIdCleaning ? cleanId(rawId) : rawId;
            const ref = doc(db, colId, id);
            if (createIfMissing) {
              await setDoc(ref, { [targetField.trim()]: value }, { merge: true });
            } else {
              await updateDoc(ref, { [targetField.trim()]: value });
            }
            updated++;
          } else {
            // Emparejar por un campo (no por doc ID): buscar y actualizar coincidencias.
            const qs = await getDocs(query(collection(db, colId), where(matchField.trim(), '==', rawId), limit(50)));
            if (qs.empty) { skipped++; errors.push({ row: rowNumber, id: rawId, message: `Sin coincidencias por ${matchField.trim()}` }); return; }
            await Promise.all(qs.docs.map(d => updateDoc(d.ref, { [targetField.trim()]: value })));
            updated += qs.size;
          }
        } catch (err: any) {
          errors.push({ row: rowNumber, id: rawId, message: err?.code === 'not-found' || /No document to update/i.test(err?.message || '') ? 'El documento no existe (revisa el ID o marca "crear si no existe")' : (err?.message || 'Error desconocido') });
        }
      }));
      current = Math.min(i + CONC, csvData.length);
      setProgress({ current, total: csvData.length, updated, skipped, errors: [...errors] });
    }

    setProgress({ current: csvData.length, total: csvData.length, updated, skipped, errors });
    setStep('done');
  };

  const handleReset = () => {
    setStep('upload'); setCsvFile(null); setCsvData([]); setCsvHeaders([]);
    setTargetCollection(''); setOtherCollection(''); setMatchMode('docId');
    setIdColumn(''); setMatchField(''); setValueColumn(''); setTargetField('consecutivo');
    setValueType('auto'); setApplyIdCleaning(true); setCreateIfMissing(false);
    setProgress({ current: 0, total: 0, updated: 0, skipped: 0, errors: [] });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Estilos ──────────────────────────────────────────────────────────
  const s = {
    card: { backgroundColor: C.panel, borderRadius: '10px', border: `1px solid ${C.border}`, padding: '20px' },
    label: { fontSize: '0.7rem', color: C.textMuted, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '6px', display: 'block' },
    input: { backgroundColor: C.bg, padding: '7px 11px', border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '0.825rem', color: C.text, width: '100%', boxSizing: 'border-box' as const, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s' },
    select: { backgroundColor: C.bg, padding: '7px 11px', border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '0.825rem', color: C.text, width: '100%', boxSizing: 'border-box' as const, outline: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s' },
    btnPrimary: { backgroundColor: C.accent, color: '#fff', border: `1px solid ${C.accent}`, padding: '8px 16px', borderRadius: '7px', fontWeight: 500, cursor: 'pointer', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' },
    btnSecondary: { backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, padding: '8px 16px', borderRadius: '7px', fontWeight: 500, cursor: 'pointer', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' },
    stepBadge: (active: boolean, complete: boolean) => ({
      width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.75rem',
      backgroundColor: complete ? C.green : (active ? C.accent : C.borderSoft), color: complete || active ? '#fff' : C.textFaint, transition: 'all 0.2s', flexShrink: 0
    }),
    field: { marginBottom: '0' },
  };

  const STEPS = ['Subir CSV', 'Configurar', 'Previsualizar', 'Actualizar'];
  const currentStepIndex = step === 'upload' ? 0 : step === 'config' ? 1 : step === 'preview' ? 2 : 3;

  return (
    <div className="fade-in" style={{ padding: '24px', maxWidth: '1180px', margin: '0 auto' }}>
      <style>{`
        .spin-import { animation: spin-import 1s linear infinite; }
        @keyframes spin-import { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .du-ham { background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 7px; padding: 7px 10px; cursor: pointer; color: ${C.textMuted}; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .du-ham:hover { background-color: ${C.borderSoft}; border-color: ${C.textFaint}; color: ${C.text}; }
        .du-primary:hover { background-color: ${C.accentHover} !important; border-color: ${C.accentHover} !important; }
        .du-secondary:hover { background-color: ${C.borderSoft} !important; border-color: ${C.textFaint} !important; }
        .du-input:focus { border-color: ${C.accent} !important; box-shadow: 0 0 0 3px ${C.accentSoft} !important; }
        .du-input::placeholder { color: ${C.textFaint}; }
        .du-input option, .du-input optgroup { background-color: ${C.panel}; color: ${C.text}; }
      `}</style>

      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
        {onOpenMenu && (
          <button className="du-ham" onClick={onOpenMenu}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
        )}
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', color: C.text, fontWeight: 600, letterSpacing: '-0.02em' }}>Actualizar Datos</h1>
          <p style={{ margin: '2px 0 0 0', color: C.textMuted, fontSize: '0.825rem' }}>Asigna un consecutivo (u otro campo) a registros ya existentes desde un CSV</p>
        </div>
      </header>

      {/* PROGRESS BAR */}
      <div style={{ ...s.card, marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', padding: '16px 20px' }}>
        {STEPS.map((label, idx) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '110px' }}>
            <div style={s.stepBadge(idx === currentStepIndex, idx < currentStepIndex)}>
              {idx < currentStepIndex ? <CheckCircle size={14} color="#fff" /> : idx + 1}
            </div>
            <div style={{ fontSize: '0.775rem', fontWeight: idx === currentStepIndex ? 600 : 500, color: idx === currentStepIndex ? C.text : C.textFaint }}>{label}</div>
            {idx < STEPS.length - 1 && <div style={{ flex: 1, height: '1px', backgroundColor: idx < currentStepIndex ? C.green : C.border, marginLeft: '6px' }} />}
          </div>
        ))}
      </div>

      {/* STEP 1: UPLOAD */}
      {step === 'upload' && (
        <div style={s.card}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: C.text, fontWeight: 600 }}>Sube el CSV de consecutivos</h2>
          <p style={{ margin: '0 0 18px 0', color: C.textMuted, fontSize: '0.825rem' }}>
            El archivo debe tener al menos dos columnas: una con el <strong style={{ color: C.text }}>ID del documento</strong> y otra con el <strong style={{ color: C.text }}>consecutivo</strong>. Primera fila = encabezados.
          </p>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{ border: `1.5px dashed ${isDragging ? C.accent : C.border}`, borderRadius: '10px', padding: '44px 20px', textAlign: 'center', cursor: 'pointer', backgroundColor: isDragging ? C.accentSoft : C.bg, transition: 'all 0.18s' }}
          >
            <Upload size={32} strokeWidth={1.5} color={isDragging ? C.accent : C.textMuted} style={{ margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text, marginBottom: '3px' }}>
              {isDragging ? 'Suelta el CSV aquí' : 'Haz clic para seleccionar o arrastra un archivo CSV'}
            </div>
            <div style={{ fontSize: '0.775rem', color: C.textFaint }}>Solo archivos .csv · Ej. columnas: id, consecutivo</div>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]); }} />
          <div style={{ marginTop: '18px', padding: '14px 16px', backgroundColor: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: '8px', display: 'flex', gap: '10px' }}>
            <AlertCircle size={15} color={C.amber} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.8rem', color: C.amberText, lineHeight: 1.55 }}>
              Esta herramienta <strong>solo actualiza</strong> registros que ya existen (no crea nuevos, salvo que lo marques). Ideal para agregar el consecutivo a los generales y a los detalles después de la importación.
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: CONFIG */}
      {step === 'config' && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: '0 0 3px 0', fontSize: '0.95rem', color: C.text, fontWeight: 600 }}>Configura la actualización</h2>
              <p style={{ margin: 0, color: C.textMuted, fontSize: '0.775rem' }}>
                <FileSpreadsheet size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />
                <strong style={{ color: C.text, fontWeight: 600 }}>{csvFile?.name}</strong> · {csvData.length} filas · {csvHeaders.length} columnas
              </p>
            </div>
            <button onClick={handleReset} className="du-secondary" style={s.btnSecondary}><RotateCcw size={13} /> Empezar de nuevo</button>
          </div>

          {/* Colección */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <div style={s.field}>
              <label style={s.label}><Database size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} /> Colección destino</label>
              <select className="du-input" style={s.select} value={targetCollection}
                onChange={(e) => { setTargetCollection(e.target.value); if (e.target.value !== '__other__') setOtherCollection(''); }}>
                <option value="">— Selecciona una colección —</option>
                {nombresColecciones.map(id => <option key={id} value={id}>{labelColeccion(id)}</option>)}
                <option value="__other__">✎ Otra colección (escribir nombre)…</option>
              </select>
              {targetCollection === '__other__' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input className="du-input" style={{ ...s.input, flex: 1 }} placeholder="nombre exacto de la colección"
                    value={otherCollection} onChange={(e) => setOtherCollection(e.target.value)} />
                  <button type="button" onClick={agregarAListaColeccion} disabled={!otherCollection.trim() || savingList}
                    className="du-secondary" style={{ ...s.btnSecondary, padding: '7px 10px', whiteSpace: 'nowrap', opacity: (!otherCollection.trim() || savingList) ? 0.5 : 1 }}
                    title="Guardar en la lista">
                    {savingList ? <Loader2 size={13} className="spin-import" /> : '＋'}
                  </button>
                </div>
              )}
            </div>

            <div style={s.field}>
              <label style={s.label}>Campo a escribir en Firestore</label>
              <input className="du-input" style={s.input} value={targetField} onChange={(e) => setTargetField(e.target.value)} placeholder="consecutivo" />
              <p style={{ margin: '6px 0 0 0', fontSize: '0.7rem', color: C.textFaint }}>El nombre del campo donde se guardará el consecutivo.</p>
            </div>
          </div>

          {/* Emparejar por */}
          <div style={{ marginBottom: '16px', padding: '14px 16px', backgroundColor: C.bg, borderRadius: '8px', border: `1px solid ${C.border}` }}>
            <label style={s.label}>¿Cómo se identifica cada registro?</label>
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.82rem', color: C.text }}>
                <input type="radio" checked={matchMode === 'docId'} onChange={() => setMatchMode('docId')} style={{ accentColor: C.accent }} />
                Por <strong>ID del documento</strong> (recomendado)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.82rem', color: C.text }}>
                <input type="radio" checked={matchMode === 'field'} onChange={() => setMatchMode('field')} style={{ accentColor: C.accent }} />
                Por un <strong>campo</strong> del documento
              </label>
            </div>
            {matchMode === 'field' && (
              <div style={{ marginTop: '10px', maxWidth: '340px' }}>
                <label style={s.label}>Campo Firestore a emparejar</label>
                <input className="du-input" style={s.input} value={matchField} onChange={(e) => setMatchField(e.target.value)} placeholder="p. ej. appsheetId" />
                <p style={{ margin: '6px 0 0 0', fontSize: '0.7rem', color: C.textFaint }}>Se buscará <code>{matchField.trim() || 'campo'} == valorDelCSV</code> y se actualizarán las coincidencias.</p>
              </div>
            )}
          </div>

          {/* Columnas del CSV */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <div style={s.field}>
              <label style={s.label}>Columna del CSV con el {matchMode === 'docId' ? 'ID del documento' : 'valor a emparejar'}</label>
              <select className="du-input" style={s.select} value={idColumn} onChange={(e) => setIdColumn(e.target.value)}>
                <option value="">— Selecciona columna —</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Columna del CSV con el consecutivo</label>
              <select className="du-input" style={s.select} value={valueColumn} onChange={(e) => setValueColumn(e.target.value)}>
                <option value="">— Selecciona columna —</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Tipo del consecutivo</label>
              <select className="du-input" style={s.select} value={valueType} onChange={(e) => setValueType(e.target.value as ValType)}>
                <option value="auto">Automático</option>
                <option value="text">Texto (p. ej. TR-010726-004)</option>
                <option value="number">Número</option>
              </select>
            </div>
          </div>

          {/* Opciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px', padding: '14px 16px', backgroundColor: C.bg, borderRadius: '8px', border: `1px solid ${C.border}` }}>
            {matchMode === 'docId' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: C.text }}>
                <input type="checkbox" checked={applyIdCleaning} onChange={(e) => setApplyIdCleaning(e.target.checked)} style={{ accentColor: C.accent }} />
                Aplicar la misma limpieza de ID que en la importación (recomendado: reemplaza <code>/</code> por <code>_</code>)
              </label>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: C.text }}>
              <input type="checkbox" checked={createIfMissing} onChange={(e) => setCreateIfMissing(e.target.checked)} style={{ accentColor: C.accent }} disabled={matchMode === 'field'} />
              <span style={{ opacity: matchMode === 'field' ? 0.5 : 1 }}>Crear el documento si no existe (merge). <span style={{ color: C.textFaint }}>Déjalo desmarcado para solo actualizar existentes.</span></span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button onClick={() => setStep('preview')} disabled={!puedeContinuar()} className="du-primary"
              style={{ ...s.btnPrimary, opacity: !puedeContinuar() ? 0.4 : 1, cursor: !puedeContinuar() ? 'not-allowed' : 'pointer' }}>
              Previsualizar <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW */}
      {step === 'preview' && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: '0 0 3px 0', fontSize: '0.95rem', color: C.text, fontWeight: 600 }}>Previsualiza antes de actualizar</h2>
              <p style={{ margin: 0, color: C.textMuted, fontSize: '0.775rem' }}>
                Primeras 5 filas · colección <strong style={{ color: C.text }}>{targetCollectionId()}</strong> · campo <strong style={{ color: C.text }}>{targetField.trim()}</strong>
              </p>
            </div>
            <button onClick={() => setStep('config')} className="du-secondary" style={s.btnSecondary}>
              <ChevronDown size={13} style={{ transform: 'rotate(90deg)' }} /> Volver a configurar
            </button>
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', overflowX: 'auto', marginBottom: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${C.border}`, backgroundColor: C.bg }}>{matchMode === 'docId' ? 'ID documento' : `Emparejar ${matchField.trim()}`}</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${C.border}`, backgroundColor: C.bg }}>{targetField.trim()} ←</th>
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 5).map((row, idx) => {
                  const rawId = String(row[idColumn] ?? '').trim();
                  const shownId = matchMode === 'docId' && applyIdCleaning ? cleanId(rawId) : rawId;
                  const val = coerceValue(row[valueColumn]);
                  return (
                    <tr key={idx}>
                      <td style={{ padding: '8px 12px', borderBottom: `1px solid ${C.borderSoft}`, fontSize: '0.8rem', color: C.text, fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace' }}>{shownId || <span style={{ color: C.red }}>(vacío)</span>}</td>
                      <td style={{ padding: '8px 12px', borderBottom: `1px solid ${C.borderSoft}`, fontSize: '0.8rem', color: C.green, fontWeight: 600, fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace' }}>{val === '' ? <span style={{ color: C.red }}>(vacío)</span> : String(val)}{typeof val === 'number' && <span style={{ color: C.textFaint, fontWeight: 400 }}> (número)</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {csvData.length > 5 && (
            <p style={{ textAlign: 'center', color: C.textFaint, fontSize: '0.775rem', marginBottom: '16px' }}>
              y <strong style={{ color: C.textMuted }}>{csvData.length - 5}</strong> filas más se actualizarán igual
            </p>
          )}

          <div style={{ padding: '14px 16px', backgroundColor: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: '8px', marginBottom: '18px', display: 'flex', gap: '10px' }}>
            <AlertCircle size={16} color={C.amber} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.8rem', color: C.amberText, lineHeight: 1.5 }}>
              <strong style={{ fontWeight: 600 }}>Se actualizarán {csvData.length} registros en "{targetCollectionId()}"</strong>
              <div style={{ marginTop: '3px', fontSize: '0.75rem', opacity: 0.9 }}>Solo se toca el campo <strong>{targetField.trim()}</strong>; el resto de cada documento se conserva. {createIfMissing ? 'Se crearán los que no existan.' : 'Los que no existan se reportarán como error (no se crean).'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button onClick={handleReset} className="du-secondary" style={s.btnSecondary}>Cancelar</button>
            <button onClick={handleRun} style={{ ...s.btnPrimary, backgroundColor: C.green, borderColor: C.green }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2ea043'; e.currentTarget.style.borderColor = '#2ea043'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = C.green; e.currentTarget.style.borderColor = C.green; }}>
              <Save size={14} /> Actualizar {csvData.length} registros
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: RUNNING */}
      {step === 'running' && (
        <div style={s.card}>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Loader2 size={32} strokeWidth={1.75} className="spin-import" color={C.accent} style={{ margin: '0 auto 16px', display: 'block' }} />
            <h2 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: C.text, fontWeight: 600 }}>Actualizando consecutivos</h2>
            <p style={{ margin: '0 0 22px 0', color: C.textMuted, fontSize: '0.8rem' }}>{progress.current} de {progress.total} procesados · {progress.updated} actualizados</p>
            <div style={{ maxWidth: '360px', margin: '0 auto' }}>
              <div style={{ height: '6px', backgroundColor: C.borderSoft, borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`, height: '100%', backgroundColor: C.accent, transition: 'width 0.3s ease', borderRadius: '3px' }} />
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: C.textMuted, fontWeight: 500, fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace' }}>
                {progress.total ? Math.round((progress.current / progress.total) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: DONE */}
      {step === 'done' && (
        <div style={s.card}>
          <div style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: C.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <CheckCircle size={26} strokeWidth={2} color={C.green} />
            </div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: C.text, fontWeight: 600 }}>Actualización completa</h2>
            <p style={{ margin: '0 0 22px 0', color: C.textMuted, fontSize: '0.8rem' }}>
              <strong style={{ color: C.green, fontWeight: 600 }}>{progress.updated}</strong> registros actualizados en <strong style={{ color: C.text }}>{targetCollectionId()}</strong>
              {progress.skipped > 0 && <span>, <strong style={{ color: C.amberText }}>{progress.skipped}</strong> saltados</span>}
              {progress.errors.length > 0 && <span>, <strong style={{ color: C.red }}>{progress.errors.length}</strong> con aviso</span>}
            </p>

            {progress.errors.length > 0 && (
              <details style={{ textAlign: 'left', maxWidth: '620px', margin: '0 auto 22px', backgroundColor: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: '8px', padding: '12px 14px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: C.redText, fontSize: '0.8rem' }}>Ver {progress.errors.length} avisos</summary>
                <div style={{ marginTop: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                  {progress.errors.map((err, i) => (
                    <div key={i} style={{ fontSize: '0.75rem', color: C.redText, padding: '4px 0', borderBottom: i < progress.errors.length - 1 ? `1px solid ${C.redBorder}` : 'none' }}>
                      <strong>Fila {err.row}</strong> <span style={{ color: C.textMuted, fontFamily: 'ui-monospace, monospace' }}>({err.id})</span>: {err.message}
                    </div>
                  ))}
                </div>
              </details>
            )}

            <button onClick={handleReset} className="du-primary" style={{ ...s.btnPrimary, margin: '0 auto' }}>
              <RotateCcw size={14} /> Actualizar otro archivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}