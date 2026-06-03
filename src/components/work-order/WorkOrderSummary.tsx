import React from 'react';
import type { WorkOrderData } from '../../types/workOrder';
import { Save, XCircle, User, Car, CalendarClock, Shield, Receipt, Loader2 } from 'lucide-react';

interface SummaryProps {
  data: WorkOrderData;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean; // <-- NUEVO: bloquea el botón mientras se guarda
}

// AQUÍ ESTÁ LA EXPORTACIÓN CLAVE QUE BUSCA TYPESCRIPT
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

  // --- CÁLCULOS MATEMÁTICOS (Con alta precisión) ---
  const subPart = Number(data.subtotalPart) || 0;
  const subMolding = Number(data.subtotalMolding) || 0;
  const subServices = Number(data.subtotalServices) || 0;
  const totLabor = Number(data.totalLabor) || 0;
  const taxPct = Number(data.taxPercent) || 0;
  const upsell = Number(data.upsell) || 0;
  const kitFlat = Number(data.kitFlatRate) || 0;
  const deductible = Number(data.deductible) || 0;

  const totalBase = subPart + subMolding + subServices + totLabor;
  const taxAmount = totalBase * (taxPct / 100);

  // El deducible resta al total si es seguro, el kitFlat suma
  const total = totalBase + taxAmount + upsell + kitFlat - deductible;

  const balance = total - (Number(data.paid) || 0);

  return (
    <aside style={{
      width: '380px',
      backgroundColor: 'var(--bg-surface)',
      borderLeft: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column',
      height: '100%',
      boxShadow: '-4px 0 15px rgba(0,0,0,0.02)', zIndex: 5
    }}>

      {/* --- CONTENIDO DESLIZABLE (SCROLL) --- */}
      <div style={{ padding: '2rem 1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Encabezado del Resumen */}
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 0.5rem 0' }}>
            Resumen de Orden
            <span style={{
              padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
              backgroundColor: data.status === 'New' ? '#DBEAFE' : data.status === 'In Progress' ? '#FEF9C3' : '#D1FAE5',
              color: data.status === 'New' ? '#1E40AF' : data.status === 'In Progress' ? '#854D0E' : '#065F46',
              textTransform: 'uppercase'
            }}>
              {data.status || 'New'}
            </span>
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B', fontWeight: 500 }}>
            {data.documentType === 'Quote' ? 'Cotización' : 'Orden de Trabajo'} • {data.type || 'Personal'}
          </p>
        </div>

        {/* Bloque: Cliente */}
        <div style={{ backgroundColor: '#F8FAFC', padding: '1.2rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem' }}>
            <div style={{ padding: '0.4rem', backgroundColor: '#E0E7FF', borderRadius: '6px', color: '#4F46E5' }}>
              <User size={16} />
            </div>
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Datos del Cliente</h4>
          </div>
          <div style={{ paddingLeft: '2.4rem' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: customerName ? '#0F172A' : '#94A3B8' }}>
              {customerName || 'Cliente no definido'}
            </p>
            {data.phone && <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748B' }}>{data.phone}</p>}
            {data.company && <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748B' }}>{data.company}</p>}
          </div>
        </div>

        {/* Bloque: Vehículo */}
        <div style={{ backgroundColor: '#F8FAFC', padding: '1.2rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem' }}>
            <div style={{ padding: '0.4rem', backgroundColor: '#FCE7F3', borderRadius: '6px', color: '#DB2777' }}>
              <Car size={16} />
            </div>
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Información del Vehículo</h4>
          </div>
          <div style={{ paddingLeft: '2.4rem' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: vehicleName ? '#0F172A' : '#94A3B8' }}>
              {vehicleName || 'Vehículo no definido'}
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem' }}>
              {data.vinNumber && (
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600, display: 'block' }}>VIN</span>
                  <span style={{ fontSize: '0.85rem', color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase' }}>{data.vinNumber}</span>
                </div>
              )}
              {data.plate && (
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600, display: 'block' }}>PLACA</span>
                  <span style={{ fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase' }}>{data.plate}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bloque: Seguro */}
        {data.type === 'Insurance' && (
          <div style={{ backgroundColor: '#F5F3FF', padding: '1.2rem', borderRadius: '12px', border: '1px solid #DDD6FE' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem' }}>
              <div style={{ padding: '0.4rem', backgroundColor: 'white', borderRadius: '6px', color: '#8B5CF6' }}>
                <Shield size={16} />
              </div>
              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#5B21B6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Detalles de Aseguranza</h4>
            </div>
            <div style={{ paddingLeft: '2.4rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#4C1D95' }}>{data.insuranceCarrier || 'Aseguradora no especificada'}</p>
              {data.policyId && <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#6D28D9' }}>Póliza: {data.policyId}</p>}
            </div>
          </div>
        )}

        {/* Bloque: Agendamiento */}
        <div style={{ backgroundColor: '#F8FAFC', padding: '1.2rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
            <CalendarClock size={16} color="#64748B" />
            <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, textTransform: 'capitalize' }}>
              {formatDate(data.appointmentDate)}
            </span>
          </div>
          {data.timeStart && (
            <div style={{ paddingLeft: '1.8rem', fontSize: '0.85rem', color: '#64748B' }}>
              Hora: {data.timeStart} {data.timeEnd ? `- ${data.timeEnd}` : ''}
            </div>
          )}
        </div>

        {/* Bloque: Resumen Financiero */}
        <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '2px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <Receipt size={18} color="#0F172A" />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>Costos de Servicio</h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {(subPart > 0 || subMolding > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569' }}>
                <span>Partes y Vidrios</span> <span>{formatCurrency(subPart + subMolding)}</span>
              </div>
            )}

            {(totLabor > 0 || subServices > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569' }}>
                <span>Mano de Obra / Servicios</span> <span>{formatCurrency(totLabor + subServices)}</span>
              </div>
            )}

            {upsell > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569' }}>
                <span>Adicionales (Upsell)</span> <span>{formatCurrency(upsell)}</span>
              </div>
            )}

            {taxAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569' }}>
                <span>Impuestos ({data.taxPercent || 0}%)</span> <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}

            {deductible > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#DC2626', fontWeight: 600 }}>
                <span>Deducible Cliente</span> <span>-{formatCurrency(deductible)}</span>
              </div>
            )}

            {/* Total Principal */}
            <div style={{ margin: '0.5rem 0', borderTop: '1px dashed #CBD5E1' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>Total</span>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{formatCurrency(total)}</span>
            </div>

            {/* Balance Restante si hay abonos */}
            {(Number(data.paid) > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', padding: '0.8rem', backgroundColor: balance <= 0 ? '#ECFCCB' : '#FEF2F2', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: balance <= 0 ? '#4D7C0F' : '#B91C1C' }}>Balance Pendiente</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: balance <= 0 ? '#4D7C0F' : '#B91C1C' }}>{formatCurrency(balance)}</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* --- BOTONERA --- */}
      <div style={{ padding: '1.5rem', backgroundColor: '#F8FAFC', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
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