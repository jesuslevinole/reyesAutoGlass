import React, { useState } from 'react';
import { Plus, Edit2, Eye, Filter, Settings2, ArrowUp, ArrowDown, EyeOff, X, Settings, GripVertical, Trash2, User, Car, CalendarDays, Clock, Shield, Receipt, Phone, MapPin, Mail, Building2, Hash, Package } from 'lucide-react';
import type { WorkOrderData } from '../../types/workOrder';
import { workOrderService } from '../../services/workOrderService';

// --- Helpers de presentación para el modal de detalle ---
const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const longDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return dateStr; }
};

const statusStyle = (status?: string): { bg: string; color: string } => {
  switch (status) {
    case 'New': return { bg: '#DBEAFE', color: '#1E40AF' };
    case 'In Progress': return { bg: '#FEF9C3', color: '#854D0E' };
    case 'Job Done': return { bg: '#D1FAE5', color: '#065F46' };
    case 'Cancelled': return { bg: '#FEE2E2', color: '#991B1B' };
    default: return { bg: '#E2E8F0', color: '#475569' };
  }
};

// Fila etiqueta/valor dentro de una tarjeta.
const Field: React.FC<{ label: string; value?: React.ReactNode; icon?: React.ReactNode; mono?: boolean; upper?: boolean }> = ({ label, value, icon, mono, upper }) => {
  const empty = value === undefined || value === null || value === '' || value === '-';
  return (
    <div style={{ minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.25rem' }}>{icon}{label}</span>
      <span style={{ fontSize: '0.9rem', color: empty ? '#CBD5E1' : '#0F172A', fontWeight: 600, wordBreak: 'break-word', fontFamily: mono ? 'monospace' : undefined, textTransform: upper ? 'uppercase' : undefined }}>{empty ? '—' : value}</span>
    </div>
  );
};

// Línea del resumen financiero (etiqueta izquierda, monto derecha) sobre fondo oscuro.
const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CBD5E1' }}>
    <span>{label}</span><span style={{ fontWeight: 600, color: 'white' }}>{value}</span>
  </div>
);

// Tarjeta contenedora con título e icono.
const InfoCard: React.FC<{ title: string; icon: React.ReactNode; accent: string; children: React.ReactNode; bg?: string; border?: string }> = ({ title, icon, accent, children, bg = '#F8FAFC', border = '#E2E8F0' }) => (
  <div style={{ backgroundColor: bg, borderRadius: '12px', border: `1px solid ${border}`, padding: '1.25rem 1.4rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '1rem' }}>
      <div style={{ padding: '0.4rem', borderRadius: '8px', backgroundColor: 'white', color: accent, display: 'flex', border: '1px solid #E2E8F0' }}>{icon}</div>
      <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h4>
    </div>
    {children}
  </div>
);

interface Props {
  data: WorkOrderData[];
  onNew: () => void;
  onEdit?: (order: WorkOrderData) => void;
  onDelete?: (id: string) => void; // Agregado para que puedas conectar la función de eliminar desde el padre
}

type ColumnId = 
  | 'actions' | 'correlativo' | 'id' | 'documentType' | 'type' | 'date' | 'status' | 'company' | 'agent' | 'zipcode' 
  | 'longTrip' | 'callDirection' | 'insuranceCarrier' | 'policyId' | 'referral' 
  | 'policyHolder' | 'policyAddress' | 'year' | 'mark' | 'model' | 'body' 
  | 'vinNumber' | 'plate' | 'customer' | 'phone' | 'altPhone' | 'email' 
  | 'address' | 'appointmentDate' | 'timeStart' | 'timeEnd' 
  | 'subtotalPart' | 'subtotalServices' | 'totalLabor' | 'tax' | 'total' | 'paid' | 'balance' | 'vehicle';

interface ColumnConfig {
  id: ColumnId;
  label: string;
  isVisible: boolean;
}

export const WorkOrderTable: React.FC<Props> = ({ data, onNew, onEdit, onDelete }) => {
  const [docFilter, setDocFilter] = useState<'All' | 'Quote' | 'Work Order'>('All');
  const [payFilter, setPayFilter] = useState<'All' | 'Personal' | 'Insurance'>('All');
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  
  // Estado para controlar qué orden de trabajo se está viendo en el modal de detalle
  const [viewingOrder, setViewingOrder] = useState<WorkOrderData | null>(null);
  const [loadingParts, setLoadingParts] = useState(false);

  // Abre el modal de detalle mostrando la cabecera al instante y cargando las
  // partes bajo demanda (getAll ya no las trae, para que la lista cargue rápido).
  const openViewOrder = async (order: WorkOrderData) => {
    setViewingOrder(order);
    if (!order.id) return;
    setLoadingParts(true);
    try {
      const parts = await workOrderService.getParts(order.id);
      setViewingOrder(prev => (prev && prev.id === order.id ? { ...prev, parts } : prev));
    } catch (error) {
      console.error('No se pudieron cargar las partes:', error);
    } finally {
      setLoadingParts(false);
    }
  };

  // Columnas iniciales (Se movió 'actions' a la primera posición)
  const [columns, setColumns] = useState<ColumnConfig[]>([
    { id: 'actions', label: 'ACCIONES', isVisible: true },
    { id: 'correlativo', label: 'CORRELATIVO', isVisible: true },
    { id: 'id', label: 'ID', isVisible: true },
    { id: 'customer', label: 'CLIENTE', isVisible: true },
    { id: 'company', label: 'COMPAÑÍA', isVisible: true },
    { id: 'vehicle', label: 'VEHÍCULO (A/M/M)', isVisible: true },
    { id: 'date', label: 'FECHA', isVisible: true },
    { id: 'status', label: 'ESTADO', isVisible: true },
    { id: 'total', label: 'TOTAL', isVisible: true },
    { id: 'documentType', label: 'DOC. TYPE', isVisible: false },
    { id: 'type', label: 'TIPO PAGO', isVisible: false },
    { id: 'agent', label: 'AGENTE', isVisible: false },
    { id: 'phone', label: 'TELÉFONO', isVisible: false },
    { id: 'email', label: 'EMAIL', isVisible: false },
    { id: 'vinNumber', label: 'VIN', isVisible: false },
    { id: 'plate', label: 'PLATE', isVisible: false },
    { id: 'insuranceCarrier', label: 'INS. CARRIER', isVisible: false },
    { id: 'policyId', label: 'POLIZA #', isVisible: false },
    { id: 'referral', label: 'REFERRAL', isVisible: false },
    { id: 'appointmentDate', label: 'FECHA CITA', isVisible: false },
    { id: 'timeStart', label: 'HORA INICIO', isVisible: false },
    { id: 'callDirection', label: 'CALL IN/OUT', isVisible: false },
    { id: 'zipcode', label: 'ZIP CODE', isVisible: false },
    { id: 'address', label: 'DIRECCIÓN', isVisible: false },
    { id: 'subtotalPart', label: 'SUB. PARTS', isVisible: false },
    { id: 'subtotalServices', label: 'SUB. SERVICES', isVisible: false },
    { id: 'totalLabor', label: 'TOT. LABOR', isVisible: false },
    { id: 'tax', label: 'TAX $', isVisible: false },
    { id: 'paid', label: 'PAID', isVisible: false },
    { id: 'balance', label: 'BALANCE', isVisible: false },
  ]);

  const filteredData = data.filter(item => {
    const matchDoc = docFilter === 'All' || item.documentType === docFilter;
    const matchPay = payFilter === 'All' || item.type === payFilter;
    return matchDoc && matchPay;
  });

  // Número del consecutivo (ej. "Wo-3371" -> 3371). Sin consecutivo -> -1 (va al final).
  const correlativoNum = (o: WorkOrderData) => {
    const digits = String((o as any).consecutivo ?? '').replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : -1;
  };

  // Orden: 1) Fecha DESCENDENTE (más reciente primero); 2) Correlativo DESCENDENTE.
  // Para invertir el correlativo a ascendente, cambia "correlativoNum(b) - correlativoNum(a)"
  // por "correlativoNum(a) - correlativoNum(b)".
  const sortedData = [...filteredData].sort((a, b) => {
    const da = a.date || '';
    const dbb = b.date || '';
    if (da !== dbb) return dbb.localeCompare(da); // fecha descendente
    return correlativoNum(b) - correlativoNum(a); // correlativo descendente
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr + 'T12:00:00');
      return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return dateStr; }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) return;

    const newColumns = [...columns];
    const draggedItem = newColumns[draggedItemIndex];
    newColumns.splice(draggedItemIndex, 1);
    newColumns.splice(targetIndex, 0, draggedItem);
    setDraggedItemIndex(targetIndex);
    setColumns(newColumns);
  };

  const handleDragEnd = () => setDraggedItemIndex(null);

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newColumns = [...columns];
    if (direction === 'up' && index > 0) {
      [newColumns[index - 1], newColumns[index]] = [newColumns[index], newColumns[index - 1]];
    } else if (direction === 'down' && index < newColumns.length - 1) {
      [newColumns[index + 1], newColumns[index]] = [newColumns[index], newColumns[index + 1]];
    }
    setColumns(newColumns);
  };

  const renderCell = (colId: ColumnId, order: WorkOrderData) => {
    const totalBase = (Number(order.subtotalPart) || 0) + (Number(order.subtotalMolding) || 0) + (Number(order.subtotalServices) || 0) + (Number(order.totalLabor) || 0);
    const tax = totalBase * (Number(order.taxPercent) || 0) / 100;
    const finalTotal = totalBase + tax + (Number(order.upsell) || 0) + (Number(order.kitFlatRate) || 0);
    const balance = finalTotal - (Number(order.paid) || 0);

    switch (colId) {
      case 'actions': return (
        <td key={colId} style={{ width: '80px', padding: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {/* Se agregó e.stopPropagation() para que no se abra el modal al presionar los botones */}
            <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); onEdit && onEdit(order); }} style={{ padding: '0.4rem' }} title="Editar">
              <Edit2 size={16} />
            </button>
            <button className="btn-danger-light" onClick={(e) => { 
              e.stopPropagation(); 
              if(window.confirm('¿Está seguro de que desea eliminar este registro?')) {
                onDelete ? onDelete(order.id || '') : alert('Función de eliminar en construcción...');
              }
            }} style={{ padding: '0.4rem', color: '#EF4444', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '6px', cursor: 'pointer' }} title="Eliminar">
              <Trash2 size={16} />
            </button>
          </div>
        </td>
      );
      case 'id': return <td key={colId} style={{ fontWeight: 700, color: order.documentType === 'Quote' ? '#EF4444' : '#3B82F6', whiteSpace: 'nowrap' }}>{order.id}</td>;
      case 'correlativo': return <td key={colId} style={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>{(order as any).consecutivo || '-'}</td>;
      case 'customer': return <td key={colId} style={{ fontWeight: 600 }}>{order.customer || `${order.firstName || ''} ${order.lastName || ''}`}</td>;
      case 'company': return <td key={colId} style={{ color: 'var(--color-text-muted)' }}>{order.company || '-'}</td>;
      case 'vehicle': return <td key={colId}>{order.year} {order.mark} {order.model}</td>;
      case 'date': return <td key={colId}>{formatDate(order.date)}</td>;
      case 'status': return (
        <td key={colId}>
          <span className={`badge ${order.status === 'New' ? 'badge-success' : order.status === 'In Progress' ? 'badge-warning' : 'badge-purple'}`}>
            {order.status || 'New'}
          </span>
        </td>
      );
      case 'total': return <td key={colId} style={{ fontWeight: 700 }}>${finalTotal.toFixed(2)}</td>;
      case 'documentType': return <td key={colId}>{order.documentType}</td>;
      case 'type': return <td key={colId}>{order.type}</td>;
      case 'agent': return <td key={colId}>{order.agent || '-'}</td>;
      case 'phone': return <td key={colId}>{order.phone || '-'}</td>;
      case 'email': return <td key={colId}>{order.email || '-'}</td>;
      case 'vinNumber': return <td key={colId} style={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>{order.vinNumber || '-'}</td>;
      case 'plate': return <td key={colId} style={{ textTransform: 'uppercase' }}>{order.plate || '-'}</td>;
      case 'insuranceCarrier': return <td key={colId}>{order.insuranceCarrier || '-'}</td>;
      case 'policyId': return <td key={colId}>{order.policyId || '-'}</td>;
      case 'appointmentDate': return <td key={colId}>{formatDate(order.appointmentDate)}</td>;
      case 'paid': return <td key={colId}>${(Number(order.paid) || 0).toFixed(2)}</td>;
      case 'balance': return <td key={colId} style={{ color: balance > 0 ? 'var(--color-danger-text)' : 'var(--color-success)' }}>${balance.toFixed(2)}</td>;
      default: return <td key={colId}>{(order as any)[colId] || '-'}</td>;
    }
  };

  const visibleColumns = columns.filter(c => c.isVisible);

  return (
    <div style={{ flex: 1, padding: '2.5rem', overflowY: 'auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ width: '100%' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Work Orders Historial</h2>
          <div style={{ display: 'flex', gap: '0.8rem' }}>
             <button className="btn btn-secondary" onClick={() => setShowColumnSettings(true)} style={{ backgroundColor: 'white' }}>
               <Settings size={18} /> Configurar Tabla
             </button>
             <button className="btn btn-primary" onClick={onNew}><Plus size={18} /> Nueva Orden</button>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)' }}>
              <Filter size={18} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filtros</span>
            </div>
            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span className="form-label" style={{ margin: 0 }}>Documento:</span>
              <div className="segmented-control">
                {['All', 'Quote', 'Work Order'].map(f => (
                  <div key={f} className={`segmented-item ${docFilter === f ? 'active' : ''}`} onClick={() => setDocFilter(f as any)}>{f === 'All' ? 'Todos' : f}</div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span className="form-label" style={{ margin: 0 }}>Pago:</span>
              <div className="segmented-control">
                {['All', 'Personal', 'Insurance'].map(f => (
                  <div key={f} className={`segmented-item ${payFilter === f ? 'active' : ''}`} onClick={() => setPayFilter(f as any)}>{f === 'All' ? 'Todos' : f}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="pro-table">
              <thead>
                <tr>
                  {visibleColumns.map(col => (
                    <th key={col.id} style={{ textAlign: 'left' }}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length} style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--color-text-muted)' }}>
                      No hay órdenes de trabajo registradas con estos filtros. Pulse "Nueva Orden" para empezar.
                    </td>
                  </tr>
                ) : (
                  sortedData.map(order => (
                    <tr 
                      key={order.id} 
                      onClick={() => openViewOrder(order)} 
                      style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {visibleColumns.map(col => renderCell(col.id, order))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- MODAL PARA VISUALIZAR DETALLE DEL REGISTRO --- */}
      {viewingOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card animate-in zoom-in-95" style={{ width: '90%', maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.7rem', color: '#0F172A', fontSize: '1.3rem', fontWeight: 800 }}>
                  <span style={{ display: 'flex', padding: '0.4rem', borderRadius: '8px', backgroundColor: '#EFF6FF', color: '#2563EB' }}><Eye size={20} /></span>
                  Detalles del Registro
                  <span style={{ padding: '0.25rem 0.7rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: statusStyle(viewingOrder.status).bg, color: statusStyle(viewingOrder.status).color, textTransform: 'uppercase' }}>
                    {viewingOrder.status || 'New'}
                  </span>
                </h3>
                <p style={{ margin: '0.4rem 0 0 0', color: '#64748B', fontSize: '0.88rem', fontWeight: 500 }}>
                  {viewingOrder.documentType === 'Quote' ? 'Cotización' : 'Orden de Trabajo'} • {viewingOrder.type} • <span style={{ fontFamily: 'monospace', color: '#334155' }}>#{viewingOrder.id}</span>
                </p>
              </div>
              <button onClick={() => setViewingOrder(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0.3rem', borderRadius: '50%', display: 'flex' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#E2E8F0'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}><X size={24} /></button>
            </div>

            <div style={{ padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {(() => {
                const o = viewingOrder;
                const subPart = Number(o.subtotalPart) || 0;
                const subMold = Number(o.subtotalMolding) || 0;
                const subServ = Number(o.subtotalServices) || 0;
                const labor = Number(o.totalLabor) || 0;
                const taxPct = Number(o.taxPercent) || 0;
                const upsell = Number(o.upsell) || 0;
                const kitFlat = Number(o.kitFlatRate) || 0;
                const deductible = Number(o.deductible) || 0;
                const paid = Number(o.paid) || 0;
                const base = subPart + subMold + subServ + labor;
                const tax = base * taxPct / 100;
                const total = base + tax + upsell + kitFlat;
                const balance = total - paid;
                const customerName = o.customer || `${o.firstName || ''} ${o.lastName || ''}`.trim();
                const vehicle = [o.year, o.mark, o.model, o.body].filter(Boolean).join(' ');
                const isIns = o.type === 'Insurance';

                return (
                  <>
                    {/* CLIENTE + VEHÍCULO */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                      <InfoCard title="Cliente" icon={<User size={16} />} accent="#4F46E5">
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: customerName ? '#0F172A' : '#CBD5E1', marginBottom: '0.9rem' }}>{customerName || 'Sin nombre'}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                          <Field label="Teléfono" value={o.phone} icon={<Phone size={12} />} />
                          <Field label="Tel. Alt." value={o.altPhone} icon={<Phone size={12} />} />
                          <Field label="Email" value={o.email} icon={<Mail size={12} />} />
                          <Field label="Compañía" value={o.company} icon={<Building2 size={12} />} />
                          <div style={{ gridColumn: '1 / -1' }}><Field label="Dirección" value={o.address} icon={<MapPin size={12} />} /></div>
                        </div>
                      </InfoCard>

                      <InfoCard title="Vehículo" icon={<Car size={16} />} accent="#DB2777">
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: vehicle ? '#0F172A' : '#CBD5E1', marginBottom: '0.9rem' }}>{vehicle || 'Sin vehículo'}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                          <Field label="VIN" value={o.vinNumber} icon={<Hash size={12} />} mono upper />
                          <Field label="Placa" value={o.plate} upper />
                          <Field label="Carrocería" value={o.body} />
                          <Field label="Código Postal" value={o.zipcode} />
                        </div>
                      </InfoCard>
                    </div>

                    {/* AGENDAMIENTO / META */}
                    <InfoCard title="Agendamiento y Detalles" icon={<CalendarDays size={16} />} accent="#0EA5E9">
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        <Field label="Fecha de Orden" value={longDate(o.date)} icon={<CalendarDays size={12} />} />
                        <Field label="Fecha de Cita" value={longDate(o.appointmentDate)} icon={<CalendarDays size={12} />} />
                        <Field label="Horario" value={o.timeStart ? `${o.timeStart}${o.timeEnd ? ' – ' + o.timeEnd : ''}` : '-'} icon={<Clock size={12} />} />
                        <Field label="Agente" value={o.agent} />
                        <Field label="Llamada" value={o.callDirection} />
                        <Field label="Referencia" value={o.referral} />
                      </div>
                    </InfoCard>

                    {/* SEGURO */}
                    {isIns && (
                      <InfoCard title="Aseguranza" icon={<Shield size={16} />} accent="#8B5CF6" bg="#F5F3FF" border="#DDD6FE">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                          <Field label="Aseguradora" value={o.insuranceCarrier} />
                          <Field label="Póliza #" value={o.policyId} mono />
                          <Field label="Reclamo / Ref." value={o.referral} />
                          <Field label="Titular" value={o.policyHolder} />
                          <Field label="Deducible" value={deductible ? money(deductible) : '-'} />
                          <Field label="Kit Flat Rate" value={kitFlat ? money(kitFlat) : '-'} />
                          <div style={{ gridColumn: '1 / -1' }}><Field label="Dirección de Póliza" value={o.policyAddress} icon={<MapPin size={12} />} /></div>
                        </div>
                      </InfoCard>
                    )}

                    {/* RESUMEN FINANCIERO */}
                    <div style={{ backgroundColor: '#0F172A', borderRadius: '12px', padding: '1.4rem 1.6rem', color: 'white' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '1rem' }}>
                        <Receipt size={17} color="#93C5FD" />
                        <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#CBD5E1' }}>Resumen Financiero</h4>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.88rem' }}>
                        {(subPart + subMold) > 0 && <Row label="Partes y Vidrios" value={money(subPart + subMold)} />}
                        {(labor + subServ) > 0 && <Row label="Mano de Obra / Servicios" value={money(labor + subServ)} />}
                        {upsell > 0 && <Row label="Adicionales (Upsell)" value={money(upsell)} />}
                        {kitFlat > 0 && <Row label="Kit Flat Rate" value={money(kitFlat)} />}
                        {tax > 0 && <Row label={`Impuesto (${taxPct}%)`} value={money(tax)} />}
                        <div style={{ height: 1, backgroundColor: '#334155', margin: '0.4rem 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 700 }}>Total</span>
                          <span style={{ fontSize: '1.8rem', fontWeight: 900, lineHeight: 1 }}>{money(total)}</span>
                        </div>
                        {paid > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem', padding: '0.7rem 0.9rem', borderRadius: '8px', backgroundColor: balance <= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: balance <= 0 ? '#6EE7B7' : '#FCA5A5' }}>Balance Pendiente (pagado {money(paid)})</span>
                            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: balance <= 0 ? '#6EE7B7' : '#FCA5A5' }}>{money(balance)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PARTES Y SERVICIOS */}
                    {loadingParts && (!o.parts || o.parts.length === 0) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94A3B8', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                        <Package size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cargando partes…
                      </div>
                    )}
                    {o.parts && o.parts.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
                          <Package size={16} color="#475569" />
                          <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Partes y Servicios ({o.parts.length})</h4>
                        </div>
                        <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ backgroundColor: '#F8FAFC' }}>
                              <tr>
                                <th style={{ padding: '0.7rem 1rem', fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Tipo</th>
                                <th style={{ padding: '0.7rem 1rem', fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Descripción</th>
                                <th style={{ padding: '0.7rem 1rem', fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Monto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {o.parts.map((p: any, idx: number) => {
                                const isPart = p.type === 'Parts';
                                const lineTotal = isPart
                                  ? (Number(p.glassCost) || 0) + (p.hasPriceTier ? (Number(p.priceTierAmount) || 0) : 0) + (p.hasCalibration ? (Number(p.calibrationAmount) || 0) : 0)
                                  : (Number(p.amount) || 0);
                                const desc = isPart ? `${p.partNumber || '-'}${p.nagsDescription ? ' · ' + p.nagsDescription : ''}` : (p.description || '-');
                                const extras = [p.jobtype, p.hasPriceTier ? p.priceTierName : '', p.hasCalibration ? p.calibrationName : ''].filter(Boolean);
                                return (
                                  <tr key={idx} style={{ borderTop: '1px solid #F1F5F9' }}>
                                    <td style={{ padding: '0.7rem 1rem' }}>
                                      <span style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: isPart ? '#EFF6FF' : '#F0FDF4', color: isPart ? '#1D4ED8' : '#15803D' }}>{isPart ? 'Parte' : 'Servicio'}</span>
                                    </td>
                                    <td style={{ padding: '0.7rem 1rem', fontSize: '0.85rem', color: '#0F172A', fontWeight: 500 }}>
                                      {desc}
                                      {extras.length > 0 && <div style={{ marginTop: '0.2rem', fontSize: '0.75rem', color: '#94A3B8' }}>{extras.join(' · ')}</div>}
                                    </td>
                                    <td style={{ padding: '0.7rem 1rem', fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', textAlign: 'right', whiteSpace: 'nowrap' }}>{money(lineTotal)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--color-border)', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
               <button className="btn btn-secondary" onClick={() => setViewingOrder(null)}>Cerrar Detalle</button>
               <button className="btn btn-primary" onClick={() => { setViewingOrder(null); onEdit && onEdit(viewingOrder); }}>
                 <Edit2 size={16} style={{ marginRight: '0.4rem' }}/> Editar Registro
               </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN DE TABLA */}
      {showColumnSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '95%', maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Settings2 size={22} color="var(--color-primary)" />
                <h3 style={{ margin: 0 }}>Configurar Visualización de Tabla</h3>
              </div>
              <X size={24} onClick={() => setShowColumnSettings(false)} style={{ cursor: 'pointer', color: '#94A3B8' }} />
            </div>

            <div style={{ padding: '2rem', overflowY: 'auto' }}>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>Seleccione los campos que desea ver y arrástrelos usando el icono <GripVertical size={14} style={{ display: 'inline', verticalAlign: 'middle' }}/> para cambiar su orden.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {columns.map((col, idx) => (
                  <div key={col.id} draggable onDragStart={(e) => handleDragStart(e, idx)} onDragEnter={(e) => handleDragEnter(e, idx)} onDragEnd={handleDragEnd} onDragOver={(e) => e.preventDefault()}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 1rem', border: draggedItemIndex === idx ? '2px dashed var(--color-accent)' : '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: col.isVisible ? 'white' : '#F1F5F9', opacity: draggedItemIndex === idx ? 0.4 : col.isVisible ? 1 : 0.6, cursor: 'grab', transition: 'all 0.2s', transform: draggedItemIndex === idx ? 'scale(0.98)' : 'scale(1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', overflow: 'hidden' }}>
                      <GripVertical size={18} color="#CBD5E1" style={{ cursor: 'grab' }} />
                      {col.isVisible ? <Eye size={18} color="var(--color-accent)" onClick={() => { const newCols = [...columns]; newCols[idx].isVisible = false; setColumns(newCols); }} style={{ cursor: 'pointer' }} /> : <EyeOff size={18} color="#94A3B8" onClick={() => { const newCols = [...columns]; newCols[idx].isVisible = true; setColumns(newCols); }} style={{ cursor: 'pointer' }} />}
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{col.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <ArrowUp size={14} onClick={() => moveColumn(idx, 'up')} style={{ cursor: 'pointer', color: idx === 0 ? '#CBD5E1' : '#475569' }} />
                      <ArrowDown size={14} onClick={() => moveColumn(idx, 'down')} style={{ cursor: 'pointer', color: idx === columns.length - 1 ? '#CBD5E1' : '#475569' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--color-border)', textAlign: 'right', backgroundColor: '#F8FAFC' }}>
              <button className="btn btn-primary" onClick={() => setShowColumnSettings(false)}>Aplicar Configuración</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};