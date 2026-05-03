import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Eye, Filter } from 'lucide-react';
import type { WorkOrderData } from '../../types/workOrder';

interface Props {
  data: WorkOrderData[];
  onNew: () => void;
}

export const WorkOrderTable: React.FC<Props> = ({ data, onNew }) => {
  const [docFilter, setDocFilter] = useState<'All' | 'Quote' | 'Work Order'>('All');
  const [payFilter, setPayFilter] = useState<'All' | 'Personal' | 'Insurance'>('All');

  const filteredData = data.filter(item => {
    const matchDoc = docFilter === 'All' || item.documentType === docFilter;
    const matchPay = payFilter === 'All' || item.type === payFilter;
    return matchDoc && matchPay;
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr + 'T12:00:00');
      return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div style={{ flex: 1, padding: '2.5rem', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>Work Orders Historial</h2>
          <button className="btn btn-primary" onClick={onNew}>
            <Plus size={18} /> Nueva Orden de Trabajo
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', marginBottom: '1.5rem', backgroundColor: '#FFFFFF', padding: '1rem 1.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--color-text-main)', fontWeight: 600, fontSize: '0.95rem' }}>
            <Filter size={18} color="var(--color-primary)" />
            <span>Filtros de Búsqueda</span>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Documento</span>
              <div className="segmented-control" style={{ margin: 0 }}>
                <div className={`segmented-item ${docFilter === 'All' ? 'active' : ''}`} onClick={() => setDocFilter('All')}>Todos</div>
                <div className={`segmented-item ${docFilter === 'Quote' ? 'active' : ''}`} onClick={() => setDocFilter('Quote')}>Cotización</div>
                <div className={`segmented-item ${docFilter === 'Work Order' ? 'active' : ''}`} onClick={() => setDocFilter('Work Order')}>Work Order</div>
              </div>
            </div>
            
            <div style={{ width: '1px', height: '28px', backgroundColor: 'var(--color-border)', display: 'block' }}></div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pago</span>
              <div className="segmented-control" style={{ margin: 0 }}>
                <div className={`segmented-item ${payFilter === 'All' ? 'active' : ''}`} onClick={() => setPayFilter('All')}>Todos</div>
                <div className={`segmented-item ${payFilter === 'Personal' ? 'active' : ''}`} onClick={() => setPayFilter('Personal')}>Personal</div>
                <div className={`segmented-item ${payFilter === 'Insurance' ? 'active' : ''}`} onClick={() => setPayFilter('Insurance')}>Aseguranza</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="pro-table" style={{ border: 'none', borderRadius: 0, width: '100%', minWidth: '900px' }}>
              <thead>
                <tr>
                  <th>CLIENTE Y EMPRESA</th>
                  <th>VEHÍCULO</th>
                  <th>FECHA</th>
                  <th>ESTADO</th>
                  <th>TIPO / ASEGURADORA</th>
                  <th>TOTAL</th>
                  <th style={{ textAlign: 'right' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--color-text-muted)' }}>
                      No hay órdenes de trabajo registradas con estos filtros. Pulse "Nueva Orden de Trabajo" arriba a la derecha para empezar.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((order) => {
                    const total = (order.subtotalPart || 0) + (order.subtotalMolding || 0) + (order.subtotalServices || 0) + (order.totalLabor || 0);
                    const finalTotal = total + (total * (order.taxPercent || 0) / 100);
                    
                    return (
                      <tr key={order.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{order.customer || '-'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{order.company || '-'}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{order.year} {order.mark} {order.model}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{order.vinNumber || '-'}</div>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                          {formatDate(order.date)}
                        </td>
                        <td>
                          <span style={{ 
                            padding: '0.3rem 0.6rem', 
                            borderRadius: '20px', 
                            fontSize: '0.75rem', 
                            fontWeight: 600,
                            backgroundColor: order.status === 'New' ? '#DBEAFE' : order.status === 'In Progress' ? '#FEF9C3' : '#D1FAE5',
                            color: order.status === 'New' ? '#1E40AF' : order.status === 'In Progress' ? '#854D0E' : '#065F46'
                          }}>
                            {order.status || 'New'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{order.type}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{order.type === 'Insurance' ? order.insuranceCarrier : '-'}</div>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          ${finalTotal.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button className="btn btn-secondary" style={{ padding: '0.4rem' }}><Eye size={16} /></button>
                            <button className="btn btn-secondary" style={{ padding: '0.4rem' }}><Edit2 size={16} /></button>
                            <button className="btn btn-danger-light" style={{ padding: '0.4rem' }}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};