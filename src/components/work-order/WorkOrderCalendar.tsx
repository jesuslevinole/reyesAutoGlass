import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Edit2, Trash2, CalendarDays, Clock, User, Car, Shield, Receipt, MapPin, Phone, Plus, Menu } from 'lucide-react';
import type { WorkOrderData } from '../../types/workOrder';

interface Props {
  data: WorkOrderData[];
  onNew: () => void;
  onEdit?: (order: WorkOrderData) => void;
}

// --- TIME CALCULATION HELPERS ---
const START_HOUR = 6; // El calendario empieza a las 6 AM
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
      return dailyOrders.map(order => {
        const statusColor = getStatusColor(order.status);
        const displayName = order.customerType === 'Existing' ? order.customer : `${order.firstName} ${order.lastName}`.trim();
        const displayVehicle = `${order.year} ${order.mark} ${order.model}`;

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
      });
    }

    // ESTILO SEMANA / DÍA: Posicionamiento Absoluto
    return dailyOrders.map(order => {
      const statusColor = getStatusColor(order.status);
      const displayName = order.customerType === 'Existing' ? order.customer : `${order.firstName} ${order.lastName}`.trim();
      const displayVehicle = `${order.year} ${order.mark} ${order.model}`;
      
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

      {/* --- DETAIL MODAL --- */}
      {isDetailModalOpen && selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} onClick={() => setIsDetailModalOpen(false)}>
          <div className="card animate-in zoom-in-95" style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '850px', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 2rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#F8FAFC' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  Detalles de la Cita
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', backgroundColor: getStatusColor(selectedOrder.status), color: 'white', fontWeight: 600 }}>
                    {selectedOrder.status}
                  </span>
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: '#64748B', fontSize: '0.9rem', fontWeight: 500 }}>
                  Referencia: #{selectedOrder.id || 'Sin ID'} • {selectedOrder.type}
                </p>
              </div>
              <button style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px', borderRadius: '50%', transition: 'background 0.2s' }} onClick={() => setIsDetailModalOpen(false)} onMouseOver={e => e.currentTarget.style.backgroundColor = '#E2E8F0'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                <div style={{ backgroundColor: '#F8FAFC', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}><User size={16}/> Cliente</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>{selectedOrder.customerType === 'Existing' ? selectedOrder.customer : `${selectedOrder.firstName} ${selectedOrder.lastName}`}</div>
                    {selectedOrder.phone && <div style={{ fontSize: '0.9rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Phone size={14}/> {selectedOrder.phone}</div>}
                    {selectedOrder.company && <div style={{ fontSize: '0.9rem', color: '#64748B' }}>Empresa: {selectedOrder.company}</div>}
                    {selectedOrder.address && <div style={{ fontSize: '0.9rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}><MapPin size={14}/> {selectedOrder.address}</div>}
                  </div>
                </div>

                <div style={{ backgroundColor: '#F8FAFC', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}><Car size={16}/> Vehículo</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>{selectedOrder.year} {selectedOrder.mark} {selectedOrder.model}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600, display: 'block' }}>VIN</span>
                        <span style={{ fontSize: '0.9rem', color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase' }}>{selectedOrder.vinNumber || '-'}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600, display: 'block' }}>PLACA</span>
                        <span style={{ fontSize: '0.9rem', color: '#475569', textTransform: 'uppercase' }}>{selectedOrder.plate || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}><CalendarDays size={14}/> Fecha Cita</span>
                  <span style={{ fontSize: '0.95rem', color: '#0F172A', fontWeight: 600, textTransform: 'capitalize' }}>{selectedOrder.appointmentDate ? new Date(selectedOrder.appointmentDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}><Clock size={14}/> Horario</span>
                  <span style={{ fontSize: '0.95rem', color: '#0F172A', fontWeight: 600 }}>{selectedOrder.timeStart || '-'} a {selectedOrder.timeEnd || '-'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}><Receipt size={14}/> Monto a Cobrar</span>
                  <span style={{ fontSize: '1.1rem', color: '#059669', fontWeight: 800 }}>${((Number(selectedOrder.subtotalPart) + Number(selectedOrder.subtotalServices) + Number(selectedOrder.totalLabor)) * (1 + Number(selectedOrder.taxPercent)/100)).toFixed(2)}</span>
                </div>
              </div>

              {selectedOrder.type === 'Insurance' && (
                <div style={{ backgroundColor: '#F5F3FF', padding: '1.2rem 1.5rem', borderRadius: '12px', border: '1px dashed #DDD6FE', display: 'flex', alignItems: 'center', gap: '2rem' }}>
                  <Shield size={24} color="#8B5CF6" />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#6D28D9', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>Aseguradora</span>
                    <span style={{ fontSize: '1rem', color: '#4C1D95', fontWeight: 700 }}>{selectedOrder.insuranceCarrier || 'No definida'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#6D28D9', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>Póliza / Reclamo</span>
                    <span style={{ fontSize: '1rem', color: '#4C1D95', fontWeight: 700 }}>{selectedOrder.policyId || '-'} / {selectedOrder.referral || '-'}</span>
                  </div>
                </div>
              )}

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', padding: '1.5rem 2rem', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
              <button className="btn btn-danger-light" onClick={() => { if(window.confirm('¿Eliminar cita?')) { setIsDetailModalOpen(false); } }}>
                <Trash2 size={16} /> Eliminar
              </button>
              <button className="btn btn-secondary" style={{ backgroundColor: 'white' }} onClick={() => setIsDetailModalOpen(false)}>
                Cerrar
              </button>
              <button className="btn btn-primary" onClick={() => { setIsDetailModalOpen(false); if(onEdit) onEdit(selectedOrder); }}>
                <Edit2 size={16} /> Editar Cita
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}