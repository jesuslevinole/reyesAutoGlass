// src/components/work-order/WorkOrderSummary.tsx
import React from 'react';
import type { WorkOrderData } from '../../types/workOrder';
import { Save, XCircle } from 'lucide-react';

interface SummaryProps { data: WorkOrderData; onSave: () => void; onCancel: () => void; }

export const WorkOrderSummary: React.FC<SummaryProps> = ({ data, onSave, onCancel }) => {
  // Cálculos matemáticos en tiempo real
  const subtotal = data.subtotalPart + data.subtotalMolding + data.subtotalServices + data.totalLabor + data.kitFlatRate + data.longTrip + data.upsell;
  const taxAmount = subtotal * (data.taxPercent / 100);
  const total = subtotal + taxAmount - data.deductible;
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  return (
    // ASIDE FULL HEIGHT: Ocupa todo el alto vertical restante
    <aside style={{ 
      width: '360px', 
      backgroundColor: 'var(--bg-surface)', 
      borderLeft: '1px solid var(--color-border)', 
      display: 'flex', flexDirection: 'column', 
      height: '100%', /* 100% del contenedor padre (main) */
      boxShadow: '-4px 0 15px rgba(0,0,0,0.02)', zIndex: 5
    }}>
      
      {/* Contenido Superior */}
      <div style={{ padding: '2.5rem 2rem', flex: 1, overflowY: 'auto' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>Resumen de Totales</h2>
        
        {/* Caja de Información de Contexto */}
        <div style={{ backgroundColor: '#F8FAFC', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Cliente / Vehículo</p>
          <p style={{ fontSize: '0.9rem', fontStyle: data.customer ? 'normal' : 'italic', color: data.customer ? 'var(--color-text-main)' : '#94A3B8' }}>
            {data.customer || 'No seleccionado'}
          </p>
        </div>

        {/* Desglose */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            <span>Subtotal</span> <span>{formatCurrency(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            <span>Tax ({data.taxPercent}%)</span> <span>{formatCurrency(taxAmount)}</span>
          </div>
          
          <div style={{ margin: '0.5rem 0', borderTop: '1px solid var(--color-border)' }}></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Total</span> 
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* Botones Apilados Exactamente como en la Imagen */}
      <div style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', borderTop: '1px solid var(--color-border)' }}>
        <button className="btn btn-success" onClick={onSave} style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem' }}>
          <Save size={18} /> Guardar Orden
        </button>
        <button className="btn btn-danger-light" onClick={onCancel} style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem' }}>
          <XCircle size={18} /> Cancelar y Salir
        </button>
      </div>
    </aside>
  );
};