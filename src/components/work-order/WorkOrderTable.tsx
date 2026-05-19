import React, { useState } from 'react';
import { Plus, Edit2, Eye, Filter, Settings2, ArrowUp, ArrowDown, EyeOff, X, Settings, GripVertical, Trash2 } from 'lucide-react';
import type { WorkOrderData } from '../../types/workOrder';

interface Props {
  data: WorkOrderData[];
  onNew: () => void;
  onEdit?: (order: WorkOrderData) => void;
  onDelete?: (id: string) => void; // Agregado para que puedas conectar la función de eliminar desde el padre
}

type ColumnId = 
  | 'actions' | 'id' | 'documentType' | 'type' | 'date' | 'status' | 'company' | 'agent' | 'zipcode' 
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

  // Columnas iniciales (Se movió 'actions' a la primera posición)
  const [columns, setColumns] = useState<ColumnConfig[]>([
    { id: 'actions', label: 'ACCIONES', isVisible: true },
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
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length} style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--color-text-muted)' }}>
                      No hay órdenes de trabajo registradas con estos filtros. Pulse "Nueva Orden" para empezar.
                    </td>
                  </tr>
                ) : (
                  filteredData.map(order => (
                    <tr 
                      key={order.id} 
                      onClick={() => setViewingOrder(order)} 
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
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#0F172A', fontSize: '1.3rem' }}>
                  <Eye size={22} color="#3B82F6" /> Detalles del Registro
                </h3>
                <p style={{ margin: '0.3rem 0 0 0', color: '#64748B', fontSize: '0.9rem' }}>
                  {viewingOrder.documentType} #{viewingOrder.id}
                </p>
              </div>
              <button onClick={() => setViewingOrder(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={24} /></button>
            </div>

            <div style={{ padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Sección de Información Mapeada Dinámicamente */}
              <div>
                <h4 style={{ color: '#0F172A', borderBottom: '2px solid #F1F5F9', paddingBottom: '0.5rem', marginBottom: '1rem', fontSize: '1rem' }}>Información Completa</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  {Object.entries(viewingOrder)
                    .filter(([key]) => key !== 'parts') // Filtramos parts para mostrarlo en otra sección si es necesario
                    .map(([key, value]) => (
                      <div key={key}>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.3rem' }}>{key}</span>
                        <div style={{ fontWeight: 500, color: '#1E293B', wordBreak: 'break-word', backgroundColor: '#F8FAFC', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                          {String(value || '-')}
                        </div>
                      </div>
                  ))}
                </div>
              </div>

              {/* Sección de Partes si existen */}
              {viewingOrder.parts && viewingOrder.parts.length > 0 && (
                <div>
                  <h4 style={{ color: '#0F172A', borderBottom: '2px solid #F1F5F9', paddingBottom: '0.5rem', marginBottom: '1rem', fontSize: '1rem' }}>Partes y Servicios</h4>
                  <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <tr>
                          <th style={{ padding: '0.8rem 1rem', fontSize: '0.8rem', color: '#475569' }}>Tipo</th>
                          <th style={{ padding: '0.8rem 1rem', fontSize: '0.8rem', color: '#475569' }}>Detalle</th>
                          <th style={{ padding: '0.8rem 1rem', fontSize: '0.8rem', color: '#475569' }}>Monto Costo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingOrder.parts.map((p: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '0.8rem 1rem', fontSize: '0.85rem', fontWeight: 500 }}>{p.type}</td>
                            <td style={{ padding: '0.8rem 1rem', fontSize: '0.85rem' }}>{p.type === 'Parts' ? `${p.partNumber} - ${p.nagsDescription}` : p.description}</td>
                            <td style={{ padding: '0.8rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>${Number(p.glassCost || p.amount || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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