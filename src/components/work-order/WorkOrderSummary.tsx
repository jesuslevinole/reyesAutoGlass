import React from 'react';
import type { WorkOrderData } from '../../types/workOrder';
import { Save, XCircle, User, Car, CalendarClock, Shield, Receipt, Loader2 } from 'lucide-react';

interface SummaryProps {
  data: WorkOrderData;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean; // bloquea el botón mientras se guarda
}

export const WorkOrderSummary: React.FC<SummaryProps> = ({ data, onSave, onCancel, isSaving = false }) => {

  // --- FORMATEO DE DATOS ---
  const customerName = data.customerType === 'Existing'
    ? data.customer
    : `${data.firstName || ''} ${data.lastName || ''}`.trim();

  const vehicleName = [data.year, data.mark, data.model].filter(Boolean).join(' ');

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Fecha sin definir';
    try {
      const date = new Date(dateStr + 'T12:00:00');
      return date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return dateStr; }
  };

  // --- CÁLCULOS MATEMÁTICOS (ESPEJO EXACTO del formulario WorkOrderForm) ---
  // ⚠️ Deben coincidir 1:1 con las fórmulas del formulario para que el Total y el
  //    Balance sean idénticos. El impuesto se calcula SOLO sobre partes + molduras;
  //    upsold, deducible y cashComeback NO entran en el total (son informativos).
  const subPart = Number(data.subtotalPart) || 0;
  const subMolding = Number(data.subtotalMolding) || 0;
  const subServices = Number(data.subtotalServices) || 0;
  const totLabor = Number(data.totalLabor) || 0;
  const taxPct = Number(data.taxPercent) || 0;
  const upsell = Number(data.upsell) || 0;
  const kitFlat = Number(data.kitFlatRate) || 0;
  const deductible = Number(data.deductible) || 0;
  const upsold = Number(data.upsold) || 0;
  const cashComeback = Number(data.cashComeback) || 0;
  const paidAmt = Number(data.paid) || 0;

  const calculatedTax = (subPart + subMolding) * (taxPct / 100);
  const calculatedTotal = subPart + subMolding + subServices + totLabor + upsell + kitFlat + calculatedTax;
  const calculatedBalance = calculatedTotal - paidAmt;

  // --- ESTILO DEL BADGE DE ESTADO ---
  const statusStyle = (() => {
    const st = (data.status || 'New').toLowerCase();
    if (st.includes('cancel')) return { bg: '#FEE2E2', color: '#991B1B' };
    if (st === 'new' || st.includes('nuev')) return { bg: '#DBEAFE', color: '#1E40AF' };
    if (st.includes('progress') || st.includes('proceso')) return { bg: '#FEF9C3', color: '#854D0E' };
    return { bg: '#D1FAE5', color: '#065F46' }; // Job Done / completado / otros
  })();

  // Encabezado reutilizable de bloque (chip de icono + eyebrow).
  const BlockHeader: React.FC<{ icon: React.ReactNode; chipBg: string; chipColor: string; label: string }> = ({ icon, chipBg, chipColor, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
      <span style={{ flexShrink: 0, width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: chipBg, borderRadius: '8px', color: chipColor }}>
        {icon}
      </span>
      <h4 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</h4>
    </div>
  );

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF', padding: '1.1rem 1.2rem', borderRadius: '12px', border: '1px solid #E2E8F0',
  };
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: '#475569' };
  const valStyle: React.CSSProperties = { fontWeight: 600, color: '#334155' };

  return (
    <aside style={{
      width: '380px',
      backgroundColor: 'var(--bg-surface, #FFFFFF)',
      borderLeft: '1px solid var(--color-border, #E2E8F0)',
      display: 'flex', flexDirection: 'column',
      height: '100%',
      boxShadow: '-4px 0 15px rgba(0,0,0,0.02)', zIndex: 5
    }}>

      {/* --- CONTENIDO DESLIZABLE (SCROLL) --- */}
      <div style={{ padding: '1.75rem 1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem', backgroundColor: '#F8FAFC' }}>

        {/* Encabezado del Resumen */}
        <div style={{ paddingBottom: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
              Resumen de Orden
            </h2>
            <span style={{
              flexShrink: 0, padding: '0.3rem 0.65rem', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700,
              backgroundColor: statusStyle.bg, color: statusStyle.color, textTransform: 'uppercase', letterSpacing: '0.03em'
            }}>
              {data.status || 'New'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B', fontWeight: 500 }}>
            {data.documentType === 'Quote' ? 'Cotización' : 'Orden de Trabajo'} • {data.type || 'Personal'}
            {data.id && <> • <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: '#334155' }}>#{data.id}</span></>}
          </p>
        </div>

        {/* Bloque: Cliente */}
        <div style={cardStyle}>
          <BlockHeader icon={<User size={16} />} chipBg="#E0E7FF" chipColor="#4F46E5" label="Datos del Cliente" />
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: customerName ? '#0F172A' : '#94A3B8' }}>
            {customerName || 'Cliente no definido'}
          </p>
          {(data.phone || data.company) && (
            <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              {data.phone && <span style={{ fontSize: '0.82rem', color: '#64748B' }}>{data.phone}</span>}
              {data.company && <span style={{ fontSize: '0.82rem', color: '#64748B' }}>{data.company}</span>}
            </div>
          )}
        </div>

        {/* Bloque: Vehículo */}
        <div style={cardStyle}>
          <BlockHeader icon={<Car size={16} />} chipBg="#FCE7F3" chipColor="#DB2777" label="Información del Vehículo" />
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: vehicleName ? '#0F172A' : '#94A3B8' }}>
            {vehicleName || 'Vehículo no definido'}
          </p>
          {(data.vinNumber || data.plate) && (
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.6rem' }}>
              {data.vinNumber && (
                <div>
                  <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>VIN</span>
                  <span style={{ fontSize: '0.82rem', color: '#475569', fontFamily: 'ui-monospace, Menlo, monospace', textTransform: 'uppercase' }}>{data.vinNumber}</span>
                </div>
              )}
              {data.plate && (
                <div>
                  <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Placa</span>
                  <span style={{ fontSize: '0.82rem', color: '#475569', textTransform: 'uppercase' }}>{data.plate}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bloque: Seguro */}
        {data.type === 'Insurance' && (
          <div style={{ ...cardStyle, backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}>
            <BlockHeader icon={<Shield size={16} />} chipBg="#FFFFFF" chipColor="#8B5CF6" label="Detalles de Aseguranza" />
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#4C1D95' }}>{data.insuranceCarrier || 'Aseguradora no especificada'}</p>
            {data.policyId && <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#6D28D9' }}>Póliza: {data.policyId}</p>}
          </div>
        )}

        {/* Bloque: Agendamiento */}
        <div style={cardStyle}>
          <BlockHeader icon={<CalendarClock size={16} />} chipBg="#F1F5F9" chipColor="#64748B" label="Agendamiento" />
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', fontWeight: 600, textTransform: 'capitalize' }}>
            {formatDate(data.appointmentDate)}
          </p>
          {data.timeStart && (
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>
              Hora: {data.timeStart} {data.timeEnd ? `- ${data.timeEnd}` : ''}
            </p>
          )}
        </div>

        {/* Bloque: Resumen Financiero */}
        <div style={{ ...cardStyle, marginTop: '0.25rem' }}>
          <BlockHeader icon={<Receipt size={16} />} chipBg="#0F172A" chipColor="#FFFFFF" label="Costos de Servicio" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {/* Filas que COMPONEN el total (mismo cálculo que el formulario) */}
            <div style={rowStyle}><span>Subtotal Partes</span><span style={valStyle}>{formatCurrency(subPart)}</span></div>
            {subMolding > 0 && <div style={rowStyle}><span>Subtotal Molduras</span><span style={valStyle}>{formatCurrency(subMolding)}</span></div>}
            <div style={rowStyle}><span>Subtotal Servicios</span><span style={valStyle}>{formatCurrency(subServices)}</span></div>
            <div style={rowStyle}><span>Labor Total (Partes)</span><span style={valStyle}>{formatCurrency(totLabor)}</span></div>
            {kitFlat > 0 && <div style={rowStyle}><span>Kit Flat Rate</span><span style={valStyle}>{formatCurrency(kitFlat)}</span></div>}
            {upsell > 0 && <div style={rowStyle}><span>Comisión Extra (Upsell)</span><span style={valStyle}>{formatCurrency(upsell)}</span></div>}
            <div style={rowStyle}><span>Impuestos ({data.taxPercent || 0}%)</span><span style={valStyle}>{formatCurrency(calculatedTax)}</span></div>

            {/* Total Principal */}
            <div style={{ margin: '0.35rem 0', borderTop: '1px dashed #CBD5E1' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>Total</span>
              <span style={{ fontSize: '1.85rem', fontWeight: 900, color: '#0F172A', lineHeight: 1, letterSpacing: '-0.02em' }}>{formatCurrency(calculatedTotal)}</span>
            </div>

            {/* Abonado + Balance (solo si hay abono) */}
            {paidAmt > 0 && (
              <>
                <div style={{ ...rowStyle, marginTop: '0.2rem' }}><span>Abonado (Paid)</span><span style={valStyle}>{formatCurrency(paidAmt)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem', padding: '0.7rem 0.85rem', backgroundColor: calculatedBalance > 0 ? '#FEF2F2' : '#ECFCCB', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: calculatedBalance > 0 ? '#B91C1C' : '#4D7C0F' }}>Balance Restante</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: calculatedBalance > 0 ? '#B91C1C' : '#4D7C0F' }}>{formatCurrency(calculatedBalance)}</span>
                </div>
              </>
            )}

            {/* Informativo: NO afecta el total (igual que en el formulario) */}
            {(deductible > 0 || upsold > 0 || cashComeback > 0) && (
              <div style={{ marginTop: '0.55rem', paddingTop: '0.55rem', borderTop: '1px dashed #E2E8F0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Informativo · no suma al total</span>
                {deductible > 0 && <div style={rowStyle}><span>Deducible</span><span style={valStyle}>{formatCurrency(deductible)}</span></div>}
                {upsold > 0 && <div style={rowStyle}><span>Venta Adicional (Upsold)</span><span style={valStyle}>{formatCurrency(upsold)}</span></div>}
                {cashComeback > 0 && <div style={rowStyle}><span>Cash Comeback</span><span style={valStyle}>{formatCurrency(cashComeback)}</span></div>}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* --- BOTONERA --- */}
      <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#FFFFFF', borderTop: '1px solid var(--color-border, #E2E8F0)', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        <button
          className="btn btn-primary"
          onClick={onSave}
          disabled={isSaving}
          style={{
            width: '100%', padding: '0.9rem', fontSize: '0.95rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            opacity: isSaving ? 0.7 : 1,
            cursor: isSaving ? 'not-allowed' : 'pointer'
          }}
        >
          {isSaving ? (
            <>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...
            </>
          ) : (
            <>
              <Save size={18} /> Confirmar y Guardar
            </>
          )}
        </button>
        <button
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={isSaving}
          style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem', backgroundColor: 'white', cursor: isSaving ? 'not-allowed' : 'pointer' }}
        >
          <XCircle size={18} color="#64748B" /> Cancelar
        </button>
      </div>
    </aside>
  );
};