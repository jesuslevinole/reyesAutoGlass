import React, { useState, useEffect, useCallback } from 'react';
import { Download, Loader2, FileSpreadsheet, RefreshCw, Database, AlertTriangle, ListChecks } from 'lucide-react';
import { workOrderService } from '../../services/workOrderService';
import {
  WORK_ORDER_HEADER_SCHEMA,
  WORK_ORDER_DETAIL_SCHEMA,
  type CollectionSchema,
  type FieldSchema,
} from '../../config/workOrderSchemas';
import type { WorkOrderData } from '../../types/workOrder';

interface Props {
  /** Permite inyectar datos ya cargados; si no, el componente los trae solo. */
  preloaded?: WorkOrderData[];
}

// ---------------------------------------------------------------------------
//  Utilidades CSV (sin dependencias)
// ---------------------------------------------------------------------------
const csvCell = (value: unknown): string => {
  const s = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
};

// Formatea un valor según el tipo del campo (para round-trip con el importador).
const formatValue = (f: FieldSchema, raw: unknown): string => {
  if (raw === undefined || raw === null) return '';
  if (f.type === 'boolean') return raw ? 'TRUE' : 'FALSE';
  return String(raw);
};

const downloadText = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Construye el CSV de encabezados (una fila por orden).
const buildHeaderCsv = (orders: WorkOrderData[], schema: CollectionSchema): string => {
  const keys = schema.fields.map((f) => f.key);
  const lines = [keys.map(csvCell).join(',')];
  for (const order of orders) {
    const row = schema.fields.map((f) => csvCell(formatValue(f, (order as any)[f.key])));
    lines.push(row.join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
};

// Construye el CSV de detalle (una fila por parte, con workOrderId + lineOrder).
const buildDetailCsv = (orders: WorkOrderData[], schema: CollectionSchema): string => {
  const keys = schema.fields.map((f) => f.key);
  const lines = [keys.map(csvCell).join(',')];
  for (const order of orders) {
    (order.parts || []).forEach((part, index) => {
      const row = schema.fields.map((f) => {
        if (f.key === 'workOrderId') return csvCell(order.id);
        if (f.key === 'lineOrder') return csvCell(index);
        return csvCell(formatValue(f, (part as any)[f.key]));
      });
      lines.push(row.join(','));
    });
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
};

const stamp = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// ---------------------------------------------------------------------------
//  Componente principal
// ---------------------------------------------------------------------------
export const DataExportView: React.FC<Props> = ({ preloaded }) => {
  const [orders, setOrders] = useState<WorkOrderData[]>(preloaded || []);
  const [loading, setLoading] = useState(!preloaded);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await workOrderService.getAll();
      setOrders(data);
    } catch (e) {
      setError('No se pudieron cargar los datos: ' + String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!preloaded) load();
  }, [preloaded, load]);

  const totalParts = orders.reduce((sum, o) => sum + (o.parts?.length || 0), 0);
  const hasData = orders.length > 0;

  const exportHeaders = () => downloadText(`export_work_orders_${stamp()}.csv`, buildHeaderCsv(orders, WORK_ORDER_HEADER_SCHEMA));
  const exportDetails = () => downloadText(`export_work_order_details_${stamp()}.csv`, buildDetailCsv(orders, WORK_ORDER_DETAIL_SCHEMA));
  const exportAll = () => { exportHeaders(); setTimeout(exportDetails, 250); };

  return (
    <div className="animate-in fade-in" style={{ padding: '2rem 2.5rem', flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box' }}>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>

      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#0F172A', fontWeight: 800 }}>Exportar Datos</h1>
          <p style={{ margin: '2px 0 0 0', color: '#64748B', fontSize: '0.85rem' }}>Descarga los registros actuales de Firestore a CSV. El formato es idéntico al de importación (round-trip).</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#334155', fontWeight: 600, fontSize: '0.85rem', cursor: loading ? 'not-allowed' : 'pointer' }}>
            <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} /> Recargar
          </button>
          <button onClick={exportAll} disabled={!hasData || loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: '8px', border: 'none', backgroundColor: hasData && !loading ? '#0F172A' : '#94A3B8', color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: hasData && !loading ? 'pointer' : 'not-allowed' }}>
            <Download size={16} /> Exportar todo
          </button>
        </div>
      </header>

      {error && (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '0.9rem 1.1rem', borderRadius: '10px', marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: '#64748B' }}>
          <Loader2 size={40} color="#2563EB" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ fontWeight: 600 }}>Cargando registros...</p>
        </div>
      ) : (
        <>
          {/* CONTADORES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.2rem 1.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#2563EB', marginBottom: '0.3rem' }}><Database size={17} /><span style={{ fontSize: '1.7rem', fontWeight: 800 }}>{orders.length}</span></div>
              <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Órdenes (work_orders)</div>
            </div>
            <div style={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.2rem 1.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#7C3AED', marginBottom: '0.3rem' }}><ListChecks size={17} /><span style={{ fontSize: '1.7rem', fontWeight: 800 }}>{totalParts}</span></div>
              <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Partes/Servicios (work_order_details)</div>
            </div>
          </div>

          {!hasData && (
            <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', padding: '1rem 1.2rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.5rem' }}>
              No hay registros para exportar todavía.
            </div>
          )}

          {/* TARJETAS DE EXPORTACIÓN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <ExportCard
              title={WORK_ORDER_HEADER_SCHEMA.label}
              collection={WORK_ORDER_HEADER_SCHEMA.collection}
              description={`${orders.length} registro(s) · ${WORK_ORDER_HEADER_SCHEMA.fields.length} columnas`}
              accent="#2563EB"
              disabled={!hasData}
              onExport={exportHeaders}
            />
            <ExportCard
              title={WORK_ORDER_DETAIL_SCHEMA.label}
              collection={WORK_ORDER_DETAIL_SCHEMA.collection}
              description={`${totalParts} registro(s) · ${WORK_ORDER_DETAIL_SCHEMA.fields.length} columnas`}
              accent="#7C3AED"
              disabled={!hasData}
              onExport={exportDetails}
            />
          </div>
        </>
      )}
    </div>
  );
};

const ExportCard: React.FC<{
  title: string; collection: string; description: string; accent: string; disabled?: boolean; onExport: () => void;
}> = ({ title, collection, description, accent, disabled, onExport }) => (
  <div style={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
    <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center' }}>
      <div style={{ padding: '0.6rem', backgroundColor: '#F1F5F9', borderRadius: '10px', color: accent, display: 'flex' }}>
        <FileSpreadsheet size={22} />
      </div>
      <div>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {title}
          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600, color: '#64748B', backgroundColor: '#F1F5F9', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>{collection}</span>
        </h3>
        <p style={{ margin: '0.3rem 0 0 0', color: '#64748B', fontSize: '0.82rem' }}>{description}</p>
      </div>
    </div>
    <button
      onClick={onExport}
      disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: disabled ? '#CBD5E1' : accent, color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <Download size={15} /> Exportar CSV
    </button>
  </div>
);