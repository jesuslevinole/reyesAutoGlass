import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Edit2, Trash2, Plus, Menu, Eye, Clock } from 'lucide-react';
import type { WorkOrderData } from '../../types/workOrder';

interface Props {
  data: WorkOrderData[];
  onNew: () => void;
  onEdit?: (order: WorkOrderData) => void;
}

// --- TIME CALCULATION HELPERS ---
const START_HOUR = 6; // El calendario empieza a las 6 AM
const MAX_MONTH_EVENTS = 5; // Máximo de eventos visibles por celda en la vista de mes (igual que Precise)
const PIXELS_PER_HOUR = 60; // 1 hora = 60px de alto

const parseTimeToMinutes = (timeStr: string) => {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'New': return '#3b82f6'; // Azul
    case 'In Progress': return '#eab308'; // Amarillo/Naranja
    case 'Job Done': return '#10b981'; // Verde
    default: return '#94a3b8'; // Gris
  }
};

export const WorkOrderCalendar: React.FC<Props> = ({ data, onNew, onEdit }) => {
  
  // --- UI STATES ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  // --- MODAL STATES ---
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrderData | null>(null);
  const [dayDetailDate, setDayDetailDate] = useState<Date | null>(null); // Modal "todos los trabajos del día"

  // --- CALENDAR LOGIC ---
  const prevTime = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
    if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
    if (viewMode === 'day') newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };
  
  const nextTime = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
    if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
    if (viewMode === 'day') newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day;
    return new Date(date.setDate(diff));
  };

  const getDaysInWeek = (date: Date) => {
    const start = getStartOfWeek(date);
    return Array.from({ length: 7 }).map((_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  };

  const calendarDays = getDaysInMonth(currentDate);
  const weekDaysDates = getDaysInWeek(currentDate);
  const hoursOfDay = Array.from({ length: 18 }).map((_, i) => i + START_HOUR);

  const getHeaderTitle = () => {
    if (viewMode === 'month') return currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    if (viewMode === 'day') return currentDate.toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    if (viewMode === 'week') {
      const start = weekDaysDates[0];
      const end = weekDaysDates[6];
      return `${start.getDate()} ${start.toLocaleString('es-ES', {month: 'short'})} - ${end.getDate()} ${end.toLocaleString('es-ES', {month: 'short', year: 'numeric'})}`;
    }
    return '';
  };
  const headerTitle = getHeaderTitle();
  const weekDaysLabels = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

  // --- RENDERIZADO DE EVENTOS ---
  const renderEventBlocks = (date: Date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    const dateString = localDate.toISOString().split('T')[0];

    const dailyOrders = data.filter(order => order.appointmentDate === dateString);

    if (viewMode === 'month') {
      const visibleOrders = dailyOrders.slice(0, MAX_MONTH_EVENTS);
      const hiddenCount = dailyOrders.length - visibleOrders.length;
      return (
        <>
        {visibleOrders.map(order => {
        const statusColor = getStatusColor(order.status);
        const displayName = order.customerType === 'Existing' ? order.customer : `${order.firstName || ''} ${order.lastName || ''}`.trim();
        const displayVehicle = `${order.year || ''} ${order.mark || ''} ${order.model || ''}`;

        return (
          <div 
            key={order.id} 
            className="calendar-event-month"
            style={{ backgroundColor: `${statusColor}15`, color: '#1e293b', borderLeft: `3px solid ${statusColor}` }}
            onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setIsDetailModalOpen(true); }}
          >
            <span style={{ fontWeight: 700 }}>{order.timeStart || 'S/H'}</span> 
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName || displayVehicle}</span>
          </div>
        );
      })}
        {hiddenCount > 0 && (
          <button
            type="button"
            className="cv-show-more-btn"
            onClick={(e) => { e.stopPropagation(); setDayDetailDate(date); }}
          >
            Ver más (+{hiddenCount})
          </button>
        )}
        </>
      );
    }

    // ESTILO SEMANA / DÍA: Posicionamiento Absoluto
    return dailyOrders.map(order => {
      const statusColor = getStatusColor(order.status);
      const displayName = order.customerType === 'Existing' ? order.customer : `${order.firstName || ''} ${order.lastName || ''}`.trim();
      const displayVehicle = `${order.year || ''} ${order.mark || ''} ${order.model || ''}`;
      
      const startMin = parseTimeToMinutes(order.timeStart) || (8 * 60); 
      let endMin = parseTimeToMinutes(order.timeEnd);
      
      if (!endMin || endMin <= startMin) endMin = startMin + 60; 
      
      const topOffset = ((startMin - (START_HOUR * 60)) / 60) * PIXELS_PER_HOUR;
      const height = ((endMin - startMin) / 60) * PIXELS_PER_HOUR;

      return (
        <div 
          key={order.id} 
          className="calendar-event-absolute"
          style={{ 
            top: `${topOffset}px`, 
            height: `${height}px`,
            backgroundColor: `${statusColor}15`, 
            border: `1px solid ${statusColor}40`,
            borderLeft: `4px solid ${statusColor}`
          }}
          onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setIsDetailModalOpen(true); }}
        >
          <div className="event-title">{displayName || 'Sin Nombre'}</div>
          <div className="event-subtitle">{displayVehicle}</div>
          <div className="event-time">{order.timeStart || '?'} - {order.timeEnd || '?'}</div>
        </div>
      );
    });
  };

  return (
    // FORZAMOS ANCHO COMPLETO EN EL CONTENEDOR RAÍZ
    <div className="animate-in fade-in" style={{ padding: '2rem 2.5rem', flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minWidth: '100%', alignSelf: 'stretch', boxSizing: 'border-box' }}>
      
      <style>{`
        .calendar-wrapper { display: flex; flex-direction: column; flex: 1; background: white; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; width: 100%; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        
        .view-toggles { display: flex; background: #f8fafc; border-radius: 8px; padding: 4px; border: 1px solid #e2e8f0; }
        .view-btn { padding: 6px 16px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; border: none; cursor: pointer; color: #64748b; background: transparent; transition: all 0.2s; }
        .view-btn.active { background: white; color: #0f172a; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

        /* Las cuadrículas usan minmax para estirarse al 100% de la pantalla de manera uniforme */
        .calendar-header-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-bottom: 1px solid #e2e8f0; background-color: #ffffff; width: 100%; }
        .calendar-header-cell { padding: 16px 12px; text-align: center; font-weight: 600; font-size: 0.75rem; color: #64748b; text-transform: uppercase; }
        .calendar-body-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); flex: 1; background-color: #e2e8f0; gap: 1px; width: 100%; }
        
        .calendar-day-cell { background-color: #ffffff; min-height: 140px; padding: 12px; display: flex; flex-direction: column; gap: 4px; transition: background-color 0.2s; }
        .calendar-day-cell:hover { background-color: #fcfcfc; }
        .calendar-day-cell.empty { background-color: #ffffff; cursor: default; }
        .calendar-date-number { font-weight: 500; font-size: 0.95rem; color: #1e293b; margin-bottom: 8px; display: flex; justify-content: flex-start; }
        
        .calendar-event-month { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; border: 1px solid transparent; }
        .calendar-event-month:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.05); filter: brightness(0.95); border-color: rgba(0,0,0,0.1); }
        .cv-show-more-btn { margin-top: 2px; padding: 3px 8px; border: none; background: transparent; color: #2563eb; font-size: 0.72rem; font-weight: 700; text-align: left; cursor: pointer; border-radius: 4px; }
        .cv-show-more-btn:hover { background-color: #EFF6FF; }

        .week-scroll-container { display: flex; flex-direction: column; flex: 1; overflow-x: auto; overflow-y: hidden; width: 100%; }
        .week-grid-inner { display: flex; flex-direction: column; flex: 1; min-height: 0; width: 100%; }
        .week-view-active { min-width: 900px; } 
        .day-view-active { min-width: 100%; }

        .time-grid-container { display: flex; flex: 1; overflow-y: auto; position: relative; width: 100%; }
        .time-axis { width: 60px; flex-shrink: 0; background: white; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; }
        .time-label { height: 60px; padding-right: 8px; text-align: right; font-size: 0.75rem; color: #64748b; font-weight: 500; border-bottom: 1px solid #f1f5f9; box-sizing: border-box; display: flex; align-items: flex-start; justify-content: flex-end; padding-top: 6px;}
        
        .day-columns-wrapper { display: flex; flex: 1; flex-direction: row; width: 100%; }
        .day-column-time { flex: 1; border-right: 1px solid #e5e7eb; position: relative; min-width: 0; }
        .day-column-time:last-child { border-right: none; }
        .hour-grid-line { height: 60px; border-bottom: 1px solid #f1f5f9; box-sizing: border-box; width: 100%; }
        
        .calendar-event-absolute { position: absolute; left: 4px; right: 4px; border-radius: 4px; padding: 6px 8px; overflow: hidden; z-index: 10; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 2px; }
        .calendar-event-absolute:hover { z-index: 20; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); filter: brightness(0.95); }
        .calendar-event-absolute .event-title { font-weight: 600; color: #0f172a; font-size: 0.8rem; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;}
        .calendar-event-absolute .event-subtitle { font-weight: 500; color: #475569; font-size: 0.75rem; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;}
        .calendar-event-absolute .event-time { font-size: 0.7rem; color: #64748b; margin-top: 2px; font-weight: 500; }
      `}</style>

      {/* HEADER AL 100% DEL ANCHO */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px', width: '100%' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button style={{ background: 'white', border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', color: '#475569' }}>
            <Menu size={20} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0F172A', fontWeight: 800 }}>Calendar</h1>
            <p style={{ margin: '2px 0 0 0', color: '#64748B', fontSize: '0.85rem' }}>Schedule & Planning</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          <div className="view-toggles">
            <button className={`view-btn ${viewMode === 'day' ? 'active' : ''}`} onClick={() => setViewMode('day')}>Day</button>
            <button className={`view-btn ${viewMode === 'week' ? 'active' : ''}`} onClick={() => setViewMode('week')}>Week</button>
            <button className={`view-btn ${viewMode === 'month' ? 'active' : ''}`} onClick={() => setViewMode('month')}>Month</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', padding: '4px 8px', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '240px' }}>
            <button onClick={prevTime} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', color: '#64748b', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#0f172a'} onMouseOut={e => e.currentTarget.style.color = '#64748b'}><ChevronLeft size={18}/></button>
            <span style={{ fontWeight: 600, color: '#0f172a', textAlign: 'center', textTransform: 'capitalize', fontSize: '0.9rem' }}>{headerTitle}</span>
            <button onClick={nextTime} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', color: '#64748b', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#0f172a'} onMouseOut={e => e.currentTarget.style.color = '#64748b'}><ChevronRight size={18}/></button>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={onNew} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: '#0F172A', color: 'white', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
          >
            <Plus size={16} /> Nueva Cita
          </button>
        </div>
      </header>

      {/* CONTENEDOR DEL CALENDARIO AL 100% */}
      <div className="calendar-wrapper" style={{ width: '100%' }}>
        
        {viewMode === 'month' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%' }}>
            <div className="calendar-header-grid">
              {weekDaysLabels.map(day => <div key={day} className="calendar-header-cell">{day}</div>)}
            </div>
            <div className="calendar-body-grid">
              {calendarDays.map((date, index) => {
                if (!date) return <div key={`empty-${index}`} className="calendar-day-cell empty"></div>;
                const isToday = new Date().toDateString() === date.toDateString();
                return (
                  <div key={date.toISOString()} className="calendar-day-cell">
                    <div className="calendar-date-number">
                      <span style={{ 
                        color: isToday ? '#2563eb' : 'inherit',
                        fontWeight: isToday ? 700 : 500
                      }}>
                        {date.getDate()}
                      </span>
                    </div>
                    {renderEventBlocks(date)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(viewMode === 'week' || viewMode === 'day') && (
          <div className="week-scroll-container">
            <div className={`week-grid-inner ${viewMode === 'week' ? 'week-view-active' : 'day-view-active'}`}>
              
              <div style={{ paddingLeft: '60px', display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white', width: '100%' }}>
                {(viewMode === 'week' ? weekDaysDates : [currentDate]).map((date, i) => {
                  const isToday = new Date().toDateString() === date.toDateString();
                  return (
                    <div key={i} style={{ flex: 1, padding: '16px 12px', textAlign: 'center', borderRight: '1px solid #e5e7eb', position: 'relative' }}>
                      <div style={{ fontSize: '0.75rem', color: isToday ? '#2563eb' : '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{weekDaysLabels[date.getDay()]}</div>
                      <div style={{ fontSize: '1.4rem', color: isToday ? '#2563eb' : '#1e293b', fontWeight: isToday ? 800 : 500, marginTop: '2px' }}>{date.getDate()}</div>
                    </div>
                  )
                })}
              </div>

              <div className="time-grid-container">
                <div className="time-axis">
                  {hoursOfDay.map(h => (
                    <div key={`h-${h}`} className="time-label">
                      {h > 12 ? `${h-12} PM` : h === 12 ? '12 PM' : `${h} AM`}
                    </div>
                  ))}
                </div>

                <div className="day-columns-wrapper">
                  {(viewMode === 'week' ? weekDaysDates : [currentDate]).map((date, i) => (
                    <div key={`day-${i}`} className="day-column-time">
                      {hoursOfDay.map(h => <div key={`bg-${h}`} className="hour-grid-line"></div>)}
                      {renderEventBlocks(date)}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* --- DETAIL MODAL REESTRUCTURADO --- */}
      {/* --- MODAL: TODOS LOS TRABAJOS DEL DÍA (igual que Precise) --- */}
      {dayDetailDate && (() => {
        const offset = dayDetailDate.getTimezoneOffset();
        const localDate = new Date(dayDetailDate.getTime() - (offset * 60 * 1000));
        const dateString = localDate.toISOString().split('T')[0];
        const dayOrders = data
          .filter(order => order.appointmentDate === dateString)
          .sort((a, b) => String(a.timeStart || '99:99').localeCompare(String(b.timeStart || '99:99')));
        const rawTitle = dayDetailDate.toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const dayTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
        return (
          <div onClick={() => setDayDetailDate(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '1rem' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '14px', width: '100%', maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <header style={{ padding: '1.15rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', flexShrink: 0 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>{dayTitle}</h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748B' }}>{dayOrders.length} {dayOrders.length === 1 ? 'trabajo' : 'trabajos'}</span>
                </div>
                <button onClick={() => setDayDetailDate(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0.3rem' }}><X size={22} /></button>
              </header>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.9rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {dayOrders.map(order => {
                  const statusColor = getStatusColor(order.status);
                  const displayName = order.customerType === 'Existing' ? order.customer : `${order.firstName || ''} ${order.lastName || ''}`.trim();
                  const displayVehicle = `${order.year || ''} ${order.mark || ''} ${order.model || ''}`.trim();
                  return (
                    <div
                      key={order.id}
                      onClick={() => { setSelectedOrder(order); setIsDetailModalOpen(true); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 0.9rem', border: '1px solid #E2E8F0', borderLeft: `4px solid ${statusColor}`, borderRadius: '10px', cursor: 'pointer', transition: 'background-color 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, width: '112px', fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                        <Clock size={14} color="#64748B" />
                        {order.timeStart || '--:--'}{order.timeEnd ? ` - ${order.timeEnd}` : ''}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName || 'Sin nombre'}</div>
                        {displayVehicle && <div style={{ fontSize: '0.78rem', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayVehicle}</div>}
                      </div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0, fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: statusColor, display: 'inline-block' }}></span>
                        {order.status || '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <footer style={{ padding: '0.9rem 1.5rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#F8FAFC', flexShrink: 0 }}>
                <button className="btn btn-secondary" style={{ backgroundColor: 'white' }} onClick={() => setDayDetailDate(null)}>Cerrar</button>
              </footer>
            </div>
          </div>
        );
      })()}

      {isDetailModalOpen && selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} onClick={() => setIsDetailModalOpen(false)}>
          <div className="card animate-in zoom-in-95" style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '850px', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 2rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#F8FAFC' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <Eye size={22} color="#3B82F6" /> Detalles de la Orden
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', backgroundColor: getStatusColor(selectedOrder.status), color: 'white', fontWeight: 600 }}>
                    {selectedOrder.status}
                  </span>
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: '#64748B', fontSize: '0.9rem', fontWeight: 500 }}>
                  Referencia: #{selectedOrder.id || 'Sin ID'} • {selectedOrder.documentType} • {selectedOrder.type}
                </p>
              </div>
              <button style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px', borderRadius: '50%', transition: 'background 0.2s' }} onClick={() => setIsDetailModalOpen(false)} onMouseOver={e => e.currentTarget.style.backgroundColor = '#E2E8F0'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* --- MAPEO DINÁMICO DE TODOS LOS CAMPOS --- */}
              <div>
                <h4 style={{ color: '#0F172A', borderBottom: '2px solid #F1F5F9', paddingBottom: '0.5rem', marginBottom: '1rem', fontSize: '1rem' }}>Información Completa</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  {Object.entries(selectedOrder)
                    // Filtramos campos que ya están en el encabezado o que requieren renderizado especial
                    .filter(([key, value]) => !['id', 'status', 'documentType', 'parts'].includes(key) && value !== undefined && value !== '')
                    .map(([key, value]) => {
                      // Hacemos el texto de la llave un poco más legible (ej. "insuranceCarrier" -> "Insurance Carrier")
                      const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                      return (
                        <div key={key}>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.3rem' }}>{formattedKey}</span>
                          <div style={{ fontWeight: 500, color: '#1E293B', wordBreak: 'break-word', backgroundColor: '#F8FAFC', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                            {String(value)}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* --- SECCIÓN DE PARTES Y SERVICIOS --- */}
              {selectedOrder.parts && selectedOrder.parts.length > 0 && (
                <div>
                  <h4 style={{ color: '#0F172A', borderBottom: '2px solid #F1F5F9', paddingBottom: '0.5rem', marginBottom: '1rem', fontSize: '1rem' }}>Partes y Servicios</h4>
                  <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <tr>
                          <th style={{ padding: '0.8rem 1rem', fontSize: '0.8rem', color: '#475569' }}>Tipo</th>
                          <th style={{ padding: '0.8rem 1rem', fontSize: '0.8rem', color: '#475569' }}>Detalle</th>
                          <th style={{ padding: '0.8rem 1rem', fontSize: '0.8rem', color: '#475569' }}>Monto Base</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.parts.map((p: any, idx: number) => {
                          const detailText = p.type === 'Parts' ? `${p.partNumber || '-'} - ${p.nagsDescription || '-'}` : p.description || '-';
                          const cost = p.type === 'Parts' ? Number(p.glassCost || 0) : Number(p.amount || 0);
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '0.8rem 1rem', fontSize: '0.85rem', fontWeight: 500 }}>{p.type}</td>
                              <td style={{ padding: '0.8rem 1rem', fontSize: '0.85rem' }}>{detailText}</td>
                              <td style={{ padding: '0.8rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>${cost.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', padding: '1.5rem 2rem', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
              <button className="btn btn-danger-light" onClick={() => { if(window.confirm('¿Eliminar registro?')) { setIsDetailModalOpen(false); } }}>
                <Trash2 size={16} /> Eliminar
              </button>
              <button className="btn btn-secondary" style={{ backgroundColor: 'white' }} onClick={() => setIsDetailModalOpen(false)}>
                Cerrar
              </button>
              <button className="btn btn-primary" onClick={() => { setIsDetailModalOpen(false); if(onEdit) onEdit(selectedOrder); }}>
                <Edit2 size={16} /> Editar Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}