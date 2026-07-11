import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, Download, Loader2, CheckCircle2, AlertTriangle, Play, RotateCcw, Wallet } from 'lucide-react';
import { db } from '../../firebase';
import { agentCommissionService } from '../../services/agentCommissionService';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';

const COLLECTION = 'agent_commissions';
const PAYMENTS_COLLECTION = 'commission_payments';

type Mode = 'commissions' | 'payments';

// Campos de la colección agent_commissions y su tipo.
const NUM_FIELDS = ['aftermarketCommission', 'recommendCommission', 'oemCommission', 'servicesCommission', 'insuranceCommission', 'totalCommission'];
const BOOL_FIELDS = ['paid', 'checked'];
const STR_FIELDS = ['workOrderId', 'agentId', 'agent', 'companyId', 'company', 'paymentAgentId', 'userCreate', 'userEdit', 'createdAt', 'updatedAt', 'emailSelect'];
const ALL_FIELDS = ['id', ...STR_FIELDS.slice(0, 5), ...NUM_FIELDS, ...BOOL_FIELDS, ...STR_FIELDS.slice(5)];

// ── Parser CSV sin dependencias (comillas, comas/; , saltos internos) ──
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const s = text.replace(/^\uFEFF/, '');
  const delim = (() => {
    const first = s.split(/\r?\n/)[0] || '';
    const c = (d: string) => first.split(d).length - 1;
    return c(';') > c(',') ? ';' : (c('\t') > c(',') ? '\t' : ',');
  })();
  const matrix: string[][] = [];
  let field = '', row: string[] = [], inQ = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); field = ''; matrix.push(row); row = []; }
      else if (ch === '\r') { if (s[i + 1] !== '\n') { row.push(field); field = ''; matrix.push(row); row = []; } }
      else field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); matrix.push(row); }
  const ne = matrix.filter(r => r.some(c => (c ?? '').trim() !== ''));
  if (!ne.length) return { headers: [], rows: [] };
  const headers = ne[0].map(h => (h ?? '').trim());
  const rows = ne.slice(1).map(r => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { if (h) o[h] = (r[i] ?? '').toString(); });
    return o;
  });
  return { headers, rows };
}

const isPlaceholder = (v: string) => /^\s*\[.*\]\s*$/.test(v || '');
const isNullish = (v: string) => { const s = String(v ?? '').trim(); return s === '' || s.toUpperCase() === 'NULL' || isPlaceholder(s); };
const toNum = (v: string) => { if (isNullish(v)) return 0; const n = Number(String(v).replace(/,/g, '').trim()); return isNaN(n) ? 0 : n; };
const toBool = (v: string) => ['true', '1', 'yes', 'sí', 'si', 'verdadero'].includes(String(v).trim().toLowerCase());
const cleanTs = (v: string) => { const s = String(v ?? '').trim(); return (!s || s.startsWith('0000-00-00') || isNullish(s)) ? '' : s; };
const cleanId = (raw: string) => String(raw || '').trim().replace(/\//g, '_').replace(/^\.+|\.+$/g, '');

// Alias de encabezados: acepta tanto el CSV limpio (workOrderId, aftermarketCommission…)
// como el export crudo de SQL/AppSheet (ID_WORKORDER, AFTERMARKET_COMISSION…).
const FIELD_BY_HEADER: Record<string, string> = {
  id: 'id', idagentcomissionwo: 'id', iddocumento: 'id',
  workorderid: 'workOrderId', idworkorder: 'workOrderId',
  agentid: 'agentId', idagent: 'agentId',
  agent: 'agent', agente: 'agent',
  companyid: 'companyId', idcompany: 'companyId',
  company: 'company', compania: 'company', 'compañia': 'company',
  aftermarketcommission: 'aftermarketCommission', aftermarketcomission: 'aftermarketCommission',
  recommendcommission: 'recommendCommission', recommendcomission: 'recommendCommission',
  oemcommission: 'oemCommission', oemcomission: 'oemCommission',
  servicescommission: 'servicesCommission', servicescomission: 'servicesCommission',
  insurancecommission: 'insuranceCommission', insurancecomission: 'insuranceCommission',
  totalcommission: 'totalCommission', totalpaycomission: 'totalCommission', totalpaycommission: 'totalCommission',
  paid: 'paid', statuscomission: 'paid', statuscommission: 'paid',
  checked: 'checked', checkbutton: 'checked',
  paymentagentid: 'paymentAgentId', idpaymentagent: 'paymentAgentId',
  usercreate: 'userCreate', useredit: 'userEdit',
  createdat: 'createdAt', timestampusercreate: 'createdAt',
  updatedat: 'updatedAt', timestampuseredit: 'updatedAt',
  emailselect: 'emailSelect',
};
const normHeader = (h: string) => h.toLowerCase().replace(/[\s_]+/g, '').trim();

// Alias de PAGOS: acepta el export crudo (ID_PAYMENTAGENT, DATE_PAYMENT…) y nombres limpios.
const PAY_FIELD_BY_HEADER: Record<string, string> = {
  id: 'id', idpaymentagent: 'id',
  consecutivo: 'consecutivo', numero: 'consecutivo',
  date: 'date', datepayment: 'date', fecha: 'date',
  agentid: 'agentId', idagentcomission: 'agentId', idagent: 'agentId',
  agent: 'agent', agente: 'agent',
  companyid: 'companyId', idcompany: 'companyId',
  workorderids: 'workOrderIds',
  // ⚠️ En el sistema viejo, "WorkOrderToPay" contiene IDs de COMISIÓN (ID_AGENTCOMISSIONWO), no de work order.
  workordertopay: 'commissionIds', commissionids: 'commissionIds',
  subtotal: 'subtotal', bonus: 'bonus', bono: 'bonus', discount: 'discount', descuento: 'discount', total: 'total',
  paymentmethod: 'paymentMethod', metodopago: 'paymentMethod',
  paid: 'paid', pagada: 'paid',
  usercreate: 'userCreate', useredit: 'userEdit',
  createdat: 'createdAt', timestampusercreate: 'createdAt',
  updatedat: 'updatedAt', timestampuseredit: 'updatedAt',
};

function resolvePayRow(r: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [header, value] of Object.entries(r)) {
    const field = PAY_FIELD_BY_HEADER[normHeader(header)];
    if (field && !(field in out)) out[field] = value;
  }
  return out;
}

// Documento de factura de pago a partir de una fila del CSV.
function buildPaymentDoc(rowRaw: Record<string, string>): Record<string, any> {
  const r = resolvePayRow(rowRaw);
  const toN = (v: any) => { const s = String(v ?? '').trim(); if (!s || s.toUpperCase() === 'NULL' || /^\[.*\]$/.test(s)) return 0; const n = Number(s.replace(/,/g, '')); return isNaN(n) ? 0 : n; };
  const txt = (v: any) => { const s = String(v ?? '').trim(); return (s.toUpperCase() === 'NULL' || /^\[.*\]$/.test(s) || s.startsWith('0000-00-00')) ? '' : s; };
  const splitIds = (v: any) => String(v ?? '').split(',').map(s => s.trim()).filter(s => s && s.toUpperCase() !== 'NULL');
  const d: Record<string, any> = {
    consecutivo: txt(r.consecutivo),
    date: txt(r.date),
    agentId: txt(r.agentId),
    agent: txt(r.agent),
    companyId: txt(r.companyId),
    commissionIds: splitIds(r.commissionIds),
    workOrderIds: splitIds(r.workOrderIds),
    subtotal: toN(r.subtotal),
    bonus: toN(r.bonus),
    discount: toN(r.discount),
    total: toN(r.total),
    paymentMethod: txt(r.paymentMethod),
    // Los pagos históricos importados se consideran pagados salvo que el CSV diga lo contrario.
    paid: ('paid' in r) ? ['true', '1', 'yes', 'sí', 'si'].includes(String(r.paid).trim().toLowerCase()) : true,
    userCreate: txt(r.userCreate),
    userEdit: txt(r.userEdit),
    createdAt: txt(r.createdAt),
    updatedAt: txt(r.updatedAt),
  };
  if (!d.total) d.total = d.subtotal + d.bonus - d.discount;
  if (!d.createdAt) delete d.createdAt;
  if (!d.updatedAt) delete d.updatedAt;
  return d;
}

// Convierte una fila (por encabezados originales) a objeto por campo canónico.
function resolveRow(r: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [header, value] of Object.entries(r)) {
    const field = FIELD_BY_HEADER[normHeader(header)];
    if (field && !(field in out)) out[field] = value;
  }
  return out;
}

const csvCell = (v: any) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const downloadCsv = (name: string, rows: string[][]) => {
  const content = '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
};

type Step = 'upload' | 'preview' | 'importing' | 'done';

export const CommissionsImportView: React.FC = () => {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [clearFirst, setClearFirst] = useState(false);
  const [mode, setMode] = useState<Mode>('commissions');
  const targetCollection = mode === 'payments' ? PAYMENTS_COLLECTION : COLLECTION;
  const [progress, setProgress] = useState({ current: 0, total: 0, ok: 0, errors: [] as { row: number; msg: string }[] });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) { alert('Selecciona un archivo CSV.'); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { headers, rows } = parseCSV(String(e.target?.result || ''));
        if (!rows.length) { alert('El CSV está vacío.'); return; }
        setHeaders(headers); setRows(rows); setStep('preview');
      } catch (err: any) { alert('Error leyendo CSV: ' + (err?.message || err)); }
    };
    reader.readAsText(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, []);

  const buildDoc = (rowRaw: Record<string, string>) => {
    const r = resolveRow(rowRaw);
    const d: Record<string, any> = {};
    STR_FIELDS.forEach(f => {
      if (f in r && !isNullish(r[f])) {
        d[f] = (f === 'createdAt' || f === 'updatedAt') ? cleanTs(r[f]) : String(r[f]).trim();
      }
    });
    NUM_FIELDS.forEach(f => { if (f in r) d[f] = toNum(r[f]); });
    BOOL_FIELDS.forEach(f => { if (f in r) d[f] = toBool(r[f]); });
    // total: si no vino un número válido, se calcula con las 5 categorías.
    const catSum = ['aftermarketCommission', 'recommendCommission', 'oemCommission', 'servicesCommission', 'insuranceCommission']
      .reduce((s, k) => s + (Number(d[k]) || 0), 0);
    if (!d.totalCommission || isNullish(r.totalCommission || '')) d.totalCommission = catSum;
    if (d.createdAt === '') delete d.createdAt;
    if (d.updatedAt === '') delete d.updatedAt;
    return d;
  };

  const runImport = async () => {
    setStep('importing');
    setProgress({ current: 0, total: rows.length, ok: 0, errors: [] });
    const errors: { row: number; msg: string }[] = [];
    let ok = 0;
    const BATCH = 400;
    try {
      // Opcional: vaciar la colección destino antes de importar.
      if (clearFirst) {
        const snap = await getDocs(collection(db, targetCollection));
        for (let i = 0; i < snap.docs.length; i += BATCH) {
          const b = writeBatch(db);
          snap.docs.slice(i, i + BATCH).forEach(dd => b.delete(dd.ref));
          await b.commit();
        }
      }

      // Modo pagos: asigna consecutivo Agent-XXXX por orden de creación
      // (Timestamp_userCreate; verificado que reproduce la numeración del sistema viejo).
      const consecMap = new Map<number, string>();
      if (mode === 'payments') {
        const keyed = rows.map((r, idx) => {
          const res = resolvePayRow(r);
          return { idx, key: String(res.createdAt || res.date || '') };
        });
        keyed.sort((a, b) => a.key.localeCompare(b.key));
        keyed.forEach((k, pos) => consecMap.set(k.idx, `Agent-${String(pos + 1).padStart(4, '0')}`));
      }

      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const batch = writeBatch(db);
        slice.forEach((r, j) => {
          const rowNum = i + j + 1;
          try {
            const resolved = mode === 'payments' ? resolvePayRow(r) : resolveRow(r);
            // Salta la fila de ejemplo de la plantilla.
            if (isNullish(resolved.id || '') && isNullish((resolved as any).workOrderId || '') && isNullish((resolved as any).date || '')) return;
            const data = mode === 'payments' ? buildPaymentDoc(r) : buildDoc(r);
            if (mode === 'payments' && !data.consecutivo) data.consecutivo = consecMap.get(i + j) || '';
            const rawId = String(resolved.id || '').trim();
            if (rawId && !isNullish(rawId)) {
              batch.set(doc(db, targetCollection, cleanId(rawId)), data);
            } else {
              batch.set(doc(collection(db, targetCollection)), data);
            }
            ok++;
          } catch (err: any) {
            errors.push({ row: rowNum, msg: err?.message || 'Error' });
          }
        });
        await batch.commit();
        setProgress({ current: Math.min(i + BATCH, rows.length), total: rows.length, ok, errors: [...errors] });
      }
      setProgress(p => ({ ...p, current: rows.length, ok, errors }));
      agentCommissionService.invalidateCache(); // los listados leerán datos frescos
      setStep('done');
    } catch (err: any) {
      alert('Error al importar: ' + (err?.message || err));
      setStep('preview');
    }
  };

  const reset = () => { setStep('upload'); setFileName(''); setRows([]); setHeaders([]); setProgress({ current: 0, total: 0, ok: 0, errors: [] }); if (fileRef.current) fileRef.current.value = ''; };

  const PAY_HEADERS = ['id', 'date', 'agentId', 'agent', 'commissionIds', 'subtotal', 'bonus', 'discount', 'total', 'paymentMethod', 'paid'];
  const dlEmpty = () => downloadCsv(
    mode === 'payments' ? 'plantilla_commission_payments_vacia.csv' : 'plantilla_agent_commissions_vacia.csv',
    [mode === 'payments' ? PAY_HEADERS : ALL_FIELDS]
  );
  const dlExample = () => {
    if (mode === 'payments') {
      downloadCsv('plantilla_commission_payments_con_ejemplo.csv', [PAY_HEADERS,
        ['[ID opcional]', '2026-01-15', '[ID agente]', '[o nombre del agente]', 'com1 , com2 , com3', '319.80', '81.00', '0.00', '400.80', 'Transferencia', 'true']]);
    } else {
      downloadCsv('plantilla_agent_commissions_con_ejemplo.csv', [ALL_FIELDS,
        ['[ID opcional]', '[ID work order]', '[ID o nombre agente]', '', '', '15.99', '0', '0', '0', '0', '', 'true', 'false', '', '', '', '2026-01-15T10:00:00', '', '']]);
    }
  };

  const pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;
  const card: React.CSSProperties = { backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };

  return (
    <div className="animate-in fade-in" style={{ padding: '2rem 2.5rem', flex: 1, minHeight: 0, overflowY: 'auto', width: '100%', boxSizing: 'border-box' }}>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCFCE7', color: '#16A34A', borderRadius: '10px' }}><Wallet size={22} /></div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#0F172A', fontWeight: 800 }}>{mode === 'payments' ? 'Importar Pagos (Facturas)' : 'Importar Comisiones'}</h1>
            <p style={{ margin: '2px 0 0 0', color: '#64748B', fontSize: '0.85rem' }}>Carga un CSV hacia la colección <strong>{targetCollection}</strong>.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button onClick={dlEmpty} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#334155', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}><Download size={15} /> Plantilla vacía</button>
          <button onClick={dlExample} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563EB', color: 'white', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}><Download size={15} /> Plantilla con ejemplo</button>
        </div>
      </header>

      {/* Selector: qué se importa */}
      <div style={{ display: 'inline-flex', backgroundColor: '#E2E8F0', padding: '4px', borderRadius: '10px', gap: '4px', marginBottom: '1.25rem' }}>
        {([['commissions', 'Comisiones'], ['payments', 'Pagos (facturas)']] as [Mode, string][]).map(([m, lbl]) => (
          <button key={m} onClick={() => { setMode(m); reset(); }} style={{ padding: '0.5rem 1.1rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem', backgroundColor: mode === m ? 'white' : 'transparent', color: mode === m ? '#0F172A' : '#64748B', boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{lbl}</button>
        ))}
      </div>

      {step === 'upload' && (
        <div style={{ ...card, padding: '1.5rem' }}>
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${isDragging ? '#2563EB' : '#CBD5E1'}`, borderRadius: '12px', padding: '3rem 1.5rem', textAlign: 'center', cursor: 'pointer', backgroundColor: isDragging ? '#EFF6FF' : '#F8FAFC' }}
          >
            <UploadCloud size={40} color={isDragging ? '#2563EB' : '#94A3B8'} style={{ margin: '0 auto 0.75rem' }} />
            <div style={{ fontWeight: 700, color: '#0F172A' }}>{isDragging ? 'Suelta el CSV aquí' : 'Haz clic o arrastra tu CSV de comisiones'}</div>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '0.25rem' }}>La columna <strong>id</strong> se usa como ID del documento (si viene vacía, se genera automático).</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      )}

      {step === 'preview' && (
        <div style={{ ...card, padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <p style={{ margin: 0, color: '#334155', fontSize: '0.9rem' }}><strong>{fileName}</strong> · {rows.length} filas · {headers.length} columnas</p>
            <button onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#334155', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}><RotateCcw size={14} /> Cambiar archivo</button>
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', marginBottom: '1.25rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
              <thead><tr>{(mode === 'payments' ? ['date', 'agentId', 'registros', 'subtotal', 'total'] : ['workOrderId', 'agentId', 'aftermarketCommission', 'totalCommission', 'paid']).map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', whiteSpace: 'nowrap' }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => {
                  if (mode === 'payments') {
                    const d = buildPaymentDoc(r);
                    return (
                      <tr key={i}>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.8rem' }}>{d.date || '—'}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.8rem', fontFamily: 'monospace' }}>{d.agentId || d.agent || '—'}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.8rem' }}>{((d.commissionIds || []).length + (d.workOrderIds || []).length)} registro(s)</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.8rem' }}>${(Number(d.subtotal) || 0).toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.8rem', fontWeight: 700 }}>${(Number(d.total) || 0).toFixed(2)}</td>
                      </tr>
                    );
                  }
                  const d = buildDoc(r);
                  return (
                    <tr key={i}>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.8rem', fontFamily: 'monospace' }}>{d.workOrderId || '—'}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.8rem', fontFamily: 'monospace' }}>{d.agentId || d.agent || '—'}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.8rem' }}>${(Number(d.aftermarketCommission) || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.8rem', fontWeight: 700 }}>${(Number(d.totalCommission) || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.8rem' }}>{d.paid ? 'Pagada' : 'Pendiente'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', padding: '0.8rem 1rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.82rem' }}>
            <AlertTriangle size={16} /> Se escribirán {rows.length} registros en <strong>{targetCollection}</strong>. Los que traigan <strong>id</strong> se sobrescriben; los que no, se crean nuevos.
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', padding: '0.7rem 1rem', backgroundColor: clearFirst ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${clearFirst ? '#FECACA' : '#E2E8F0'}`, borderRadius: '10px', cursor: 'pointer' }}>
            <input type="checkbox" checked={clearFirst} onChange={(e) => setClearFirst(e.target.checked)} style={{ width: '17px', height: '17px', accentColor: '#DC2626', cursor: 'pointer' }} />
            <span style={{ fontSize: '0.83rem', color: '#334155' }}>
              <strong style={{ color: '#B91C1C' }}>Vaciar la colección antes de importar</strong> — borra TODOS los registros actuales de <strong>{targetCollection}</strong> primero. Úsalo si necesitas reimportar desde cero (por ejemplo, para limpiar duplicados o registros vacíos).
            </span>
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={runImport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.3rem', borderRadius: '8px', border: 'none', backgroundColor: '#16A34A', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}><Play size={16} /> Importar {rows.length} {mode === 'payments' ? 'pagos' : 'comisiones'}</button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div style={{ ...card, padding: '3rem 1.5rem', textAlign: 'center' }}>
          <Loader2 size={38} color="#16A34A" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <h3 style={{ margin: '0 0 0.4rem', color: '#0F172A' }}>Importando comisiones</h3>
          <p style={{ margin: '0 0 1.25rem', color: '#64748B', fontSize: '0.85rem' }}>{progress.current} de {progress.total}</p>
          <div style={{ maxWidth: '360px', margin: '0 auto', height: '6px', backgroundColor: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#16A34A', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {step === 'done' && (
        <div style={{ ...card, padding: '2.5rem 1.5rem', textAlign: 'center' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <CheckCircle2 size={28} color="#16A34A" />
          </div>
          <h3 style={{ margin: '0 0 0.4rem', color: '#0F172A', fontSize: '1.15rem' }}>Importación completa</h3>
          <p style={{ margin: '0 0 1.5rem', color: '#64748B', fontSize: '0.9rem' }}>
            <strong style={{ color: '#16A34A' }}>{progress.ok}</strong> {mode === 'payments' ? 'pagos importados' : 'comisiones importadas'} a <strong>{targetCollection}</strong>
            {progress.errors.length > 0 && <span>, <strong style={{ color: '#DC2626' }}>{progress.errors.length}</strong> con aviso</span>}
          </p>
          {progress.errors.length > 0 && (
            <details style={{ textAlign: 'left', maxWidth: '560px', margin: '0 auto 1.5rem', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '0.9rem 1.1rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#991B1B', fontSize: '0.82rem' }}>Ver {progress.errors.length} avisos</summary>
              <div style={{ marginTop: '0.6rem', maxHeight: '200px', overflowY: 'auto' }}>
                {progress.errors.map((e, i) => <div key={i} style={{ fontSize: '0.78rem', color: '#7F1D1D', padding: '0.2rem 0' }}>Fila {e.row}: {e.msg}</div>)}
              </div>
            </details>
          )}
          <button onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#0F172A', color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}><RotateCcw size={15} /> Importar otro archivo</button>
        </div>
      )}
    </div>
  );
};