import React, { useState } from 'react';
import { Plus, Edit2, Eye, Filter, Settings2, ArrowUp, ArrowDown, EyeOff, X, Settings, GripVertical } from 'lucide-react';
import type { WorkOrderData } from '../../types/workOrder';

interface Props {
  data: WorkOrderData[];
  onNew: () => void;
}

// Identificadores para TODOS los campos del formulario
type ColumnId = 
  | 'documentType' | 'type' | 'date' | 'status' | 'company' | 'agent' | 'zipcode' 
  | 'longTrip' | 'callDirection' | 'insuranceCarrier' | 'policyId' | 'referral' 
  | 'policyHolder' | 'policyAddress' | 'year' | 'mark' | 'model' | 'body' 
  | 'vinNumber' | 'plate' | 'customer' | 'phone' | 'altPhone' | 'email' 
  | 'address' | 'appointmentDate' | 'timeStart' | 'timeEnd' 
  | 'subtotalPart' | 'subtotalServices' | 'totalLabor' | 'tax' | 'total' | 'paid' | 'balance' | 'actions' | 'vehicle';

interface ColumnConfig {
  id: ColumnId;
  label: string;
  isVisible: boolean;
}

export const WorkOrderTable: React.FC<Props> = ({ data, onNew }) => {
  const [docFilter, setDocFilter] = useState<'All' | 'Quote' | 'Work Order'>('All');
  const [payFilter, setPayFilter] = useState<'All' | 'Personal' | 'Insurance'>('All');
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  
  // Estado para controlar el elemento que se está arrastrando
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // Configuración de TODOS los campos
  const [columns, setColumns] = useState<ColumnConfig[]>([
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
    { id: 'actions', label: 'ACCIONES', isVisible: true },
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

  // --- LÓGICAS DE DRAG AND DROP ---
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
    
    // Eliminar el item arrastrado de su posición original
    newColumns.splice(draggedItemIndex, 1);
    // Insertarlo en la nueva posición
    newColumns.splice(targetIndex, 0, draggedItem);

    setDraggedItemIndex(targetIndex);
    setColumns(newColumns);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newColumns = [...columns];
    if (direction === 'up' && index > 0) {
      [newColumns[index - 1], newColumns[index]] = [newColumns[index], newColumns[index - 1]];
    } else if (direction === 'down' && index < newColumns.length - 1) {
      [newColumns[index + 1], newColumns[index]] = [newColumns[index], newColumns[index + 1]];
    }
    setColumns(newColumns);
  };

  // RENDERIZADO DINÁMICO DE CELDAS SEGÚN SELECCIÓN
  const renderCell = (colId: ColumnId, order: WorkOrderData) => {
    const totalBase = (Number(order.subtotalPart) || 0) + (Number(order.subtotalMolding) || 0) + (Number(order.subtotalServices) || 0) + (Number(order.totalLabor) || 0);
    const tax = totalBase * (Number(order.taxPercent) || 0) / 100;
    const finalTotal = totalBase + tax + (Number(order.upsell) || 0) + (Number(order.kitFlatRate) || 0);
    const balance = finalTotal - (Number(order.paid) || 0);

    switch (colId) {
      case 'customer': return <td key={colId} style={{ fontWeight: 600 }}>{order.customer || `${order.firstName} ${order.lastName}`}</td>;
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
      case 'actions': return (
        <td key={colId} style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
            <button className="btn-secondary" style={{ padding: '0.3rem' }}><Eye size={14} /></button>
            <button className="btn-secondary" style={{ padding: '0.3rem' }}><Edit2 size={14} /></button>
          </div>
        </td>
      );
      default: return <td key={colId}>{(order as any)[colId] || '-'}</td>;
    }
  };

  const visibleColumns = columns.filter(c => c.isVisible);

  return (
    <div style={{ flex: 1, padding: '2.5rem', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Work Orders Historial</h2>
          <div style={{ display: 'flex', gap: '0.8rem' }}>
             <button className="btn btn-secondary" onClick={() => setShowColumnSettings(true)} style={{ backgroundColor: 'white' }}>
               <Settings size={18} /> Configurar Tabla
             </button>
             <button className="btn btn-primary" onClick={onNew}><Plus size={18} /> Nueva Orden</button>
          </div>
        </div>

        {/* BARRA DE FILTROS */}
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

        {/* TABLA PRINCIPAL */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="pro-table">
              <thead>
                <tr>
                  {visibleColumns.map(col => (
                    <th key={col.id} style={{ textAlign: col.id === 'actions' ? 'right' : 'left' }}>{col.label}</th>
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
                    <tr key={order.id}>{visibleColumns.map(col => renderCell(col.id, order))}</tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL DE CONFIGURACIÓN DE COLUMNAS CON DRAG & DROP */}
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
              
              {/* GRID DE 3 COLUMNAS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {columns.map((col, idx) => (
                  <div 
                    key={col.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragEnter={(e) => handleDragEnter(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '0.7rem 1rem', 
                      border: draggedItemIndex === idx ? '2px dashed var(--color-accent)' : '1px solid var(--color-border)', 
                      borderRadius: '8px', 
                      backgroundColor: col.isVisible ? 'white' : '#F1F5F9', 
                      opacity: draggedItemIndex === idx ? 0.4 : col.isVisible ? 1 : 0.6,
                      cursor: 'grab',
                      transition: 'all 0.2s',
                      transform: draggedItemIndex === idx ? 'scale(0.98)' : 'scale(1)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', overflow: 'hidden' }}>
                      <GripVertical size={18} color="#CBD5E1" style={{ cursor: 'grab' }} />
                      
                      {col.isVisible ? 
                        <Eye size={18} color="var(--color-accent)" onClick={() => {
                          const newCols = [...columns];
                          newCols[idx].isVisible = false;
                          setColumns(newCols);
                        }} style={{ cursor: 'pointer' }} /> : 
                        <EyeOff size={18} color="#94A3B8" onClick={() => {
                          const newCols = [...columns];
                          newCols[idx].isVisible = true;
                          setColumns(newCols);
                        }} style={{ cursor: 'pointer' }} />
                      }
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