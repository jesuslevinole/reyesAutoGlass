import React, { useState } from 'react';
import { X, Edit2, Trash2, MapPin, Search, CalendarDays, Clock, User, Car, Shield, Receipt, Phone, Plus } from 'lucide-react';
import type { WorkOrderData } from '../../types/workOrder';

interface Props {
  data: WorkOrderData[];
  onNew: () => void;
  onEdit?: (order: WorkOrderData) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'New': return '#3b82f6';
    case 'In Progress': return '#eab308';
    case 'Job Done': return '#10b981';
    default: return '#94a3b8';
  }
};

export const WorkOrderMap: React.FC<Props> = ({ data, onNew, onEdit }) => {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrderData | null>(null);

  return (
    <div className="animate-in fade-in" style={{ padding: '2rem 2.5rem', flex: 1, display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box' }}>
      
      {/* HEADER TIPO GOOGLE MAPS */}aaa
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px', width: '100%' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#0F172A', fontWeight: 800 }}>Mapa de Servicios</h1>
          <p style={{ margin: '2px 0 0 0', color: '#64748B', fontSize: '0.85rem' }}>Visualización geográfica de Cotizaciones y Órdenes</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 1rem', width: '250px' }}>
            <Search size={16} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Buscar dirección..." 
              style={{ border: 'none', outline: 'none', width: '100%', marginLeft: '0.5rem', fontSize: '0.85rem', color: '#1e293b' }} 
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
              <MapPin size={14} color="#3B82F6" fill="#3B82F6" /> Órdenes
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
              <MapPin size={14} color="#EF4444" fill="#EF4444" /> Cotizaciones
            </div>
          </div>

          <button className="btn btn-primary" onClick={onNew} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: '#0F172A', color: 'white', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <Plus size={16} /> Nueva Cita
          </button>
        </div>
      </header>

      {/* CONTENEDOR DEL MAPA */}
      <div style={{ flex: 1, backgroundColor: '#E2E8F0', borderRadius: '12px', border: '1px solid #CBD5E1', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        
        {/* MAPA REAL DE FONDO (OpenStreetMap centrado en el Sur de California) */}
        <iframe 
          width="100%" 
          height="100%" 
          src="https://www.openstreetmap.org/export/embed.html?bbox=-117.6,33.4,-116.8,34.1&layer=mapnik" 
          style={{ position: 'absolute', top: 0, left: 0, border: 'none', pointerEvents: 'none', filter: 'opacity(0.85) contrast(1.1)' }}
          title="Fondo de Mapa"
        />

        {/* Marcadores sobre el mapa */}
        {data.map((order, index) => {
          const isQuote = order.documentType === 'Quote';
          const pinColor = isQuote ? '#EF4444' : '#3B82F6';
          const displayName = order.customerType === 'Existing' ? order.customer : `${order.firstName} ${order.lastName}`.trim();
          
          // Coordenadas simuladas para distribuir los pines en la pantalla
          const topPos = `${25 + ((index * 23) % 50)}%`;
          const leftPos = `${30 + ((index * 37) % 40)}%`;

          return (
            <div 
              key={order.id} 
              style={{ position: 'absolute', top: topPos, left: leftPos, cursor: 'pointer', transform: 'translate(-50%, -100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.2s', zIndex: 10 }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translate(-50%, -105%) scale(1.1)'; e.currentTarget.style.zIndex = '20'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translate(-50%, -100%) scale(1)'; e.currentTarget.style.zIndex = '10'; }}
              onClick={() => { setSelectedOrder(order); setIsDetailModalOpen(true); }}
            >
              <div style={{ backgroundColor: 'white', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, color: '#1E293B', boxShadow: '0 4px 6px rgba(0,0,0,0.15)', marginBottom: '4px', whiteSpace: 'nowrap', border: `2px solid ${pinColor}` }}>
                {displayName || 'Sin Nombre'}
              </div>
              <MapPin size={38} color={pinColor} fill={pinColor} strokeWidth={1.5} style={{ filter: 'drop-shadow(0px 4px 3px rgba(0,0,0,0.3))' }} />
            </div>
          );
        })}

        {/* Controles del mapa flotantes (Simulación UI) */}
        <div style={{ position: 'absolute', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button style={{ width: '40px', height: '40px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>+</button>
          <button style={{ width: '40px', height: '40px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>-</button>
        </div>
      </div>

      {/* --- DETAIL MODAL --- */}
      {isDetailModalOpen && selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} onClick={() => setIsDetailModalOpen(false)}>
          <div className="card animate-in zoom-in-95" style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '850px', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 2rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#F8FAFC' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  Detalles de Ubicación
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', backgroundColor: getStatusColor(selectedOrder.status), color: 'white', fontWeight: 600 }}>{selectedOrder.status}</span>
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: '#64748B', fontSize: '0.9rem', fontWeight: 500 }}>Referencia: #{selectedOrder.id || 'Sin ID'} • {selectedOrder.documentType} ({selectedOrder.type})</p>
              </div>
              <button style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px', borderRadius: '50%', transition: 'background 0.2s' }} onClick={() => setIsDetailModalOpen(false)} onMouseOver={e => e.currentTarget.style.backgroundColor = '#E2E8F0'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}><X size={24} /></button>
            </div>

            <div style={{ padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                <div style={{ backgroundColor: '#F8FAFC', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}><User size={16}/> Cliente</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>{selectedOrder.customerType === 'Existing' ? selectedOrder.customer : `${selectedOrder.firstName} ${selectedOrder.lastName}`}</div>
                    {selectedOrder.phone && <div style={{ fontSize: '0.9rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Phone size={14}/> {selectedOrder.phone}</div>}
                    {selectedOrder.address && <div style={{ fontSize: '0.9rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}><MapPin size={14}/> {selectedOrder.address}</div>}
                  </div>
                </div>

                <div style={{ backgroundColor: '#F8FAFC', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}><Car size={16}/> Vehículo</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>{selectedOrder.year} {selectedOrder.mark} {selectedOrder.model}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                      <div><span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600, display: 'block' }}>VIN</span><span style={{ fontSize: '0.9rem', color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase' }}>{selectedOrder.vinNumber || '-'}</span></div>
                      <div><span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600, display: 'block' }}>PLACA</span><span style={{ fontSize: '0.9rem', color: '#475569', textTransform: 'uppercase' }}>{selectedOrder.plate || '-'}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                <div><span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}><CalendarDays size={14}/> Fecha Cita</span><span style={{ fontSize: '0.95rem', color: '#0F172A', fontWeight: 600, textTransform: 'capitalize' }}>{selectedOrder.appointmentDate ? new Date(selectedOrder.appointmentDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</span></div>
                <div><span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}><Clock size={14}/> Horario</span><span style={{ fontSize: '0.95rem', color: '#0F172A', fontWeight: 600 }}>{selectedOrder.timeStart || '-'} a {selectedOrder.timeEnd || '-'}</span></div>
                <div><span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}><Receipt size={14}/> Monto a Cobrar</span><span style={{ fontSize: '1.1rem', color: '#059669', fontWeight: 800 }}>${((Number(selectedOrder.subtotalPart) + Number(selectedOrder.subtotalServices) + Number(selectedOrder.totalLabor)) * (1 + Number(selectedOrder.taxPercent)/100)).toFixed(2)}</span></div>
              </div>

              {selectedOrder.type === 'Insurance' && (
                <div style={{ backgroundColor: '#F5F3FF', padding: '1.2rem 1.5rem', borderRadius: '12px', border: '1px dashed #DDD6FE', display: 'flex', alignItems: 'center', gap: '2rem' }}>
                  <Shield size={24} color="#8B5CF6" />
                  <div><span style={{ fontSize: '0.75rem', color: '#6D28D9', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>Aseguradora</span><span style={{ fontSize: '1rem', color: '#4C1D95', fontWeight: 700 }}>{selectedOrder.insuranceCarrier || 'No definida'}</span></div>
                  <div><span style={{ fontSize: '0.75rem', color: '#6D28D9', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>Póliza / Reclamo</span><span style={{ fontSize: '1rem', color: '#4C1D95', fontWeight: 700 }}>{selectedOrder.policyId || '-'} / {selectedOrder.referral || '-'}</span></div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', padding: '1.5rem 2rem', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
              <button className="btn btn-danger-light" onClick={() => { if(window.confirm('¿Eliminar cita?')) { setIsDetailModalOpen(false); } }}><Trash2 size={16} /> Eliminar</button>
              <button className="btn btn-secondary" style={{ backgroundColor: 'white' }} onClick={() => setIsDetailModalOpen(false)}>Cerrar</button>
              <button className="btn btn-primary" onClick={() => { setIsDetailModalOpen(false); if(onEdit) onEdit(selectedOrder); }}><Edit2 size={16} /> Editar Cita</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};