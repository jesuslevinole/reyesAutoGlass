import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkOrderForm } from '../components/work-order/WorkOrderForm';
import { WorkOrderSummary } from '../components/work-order/WorkOrderSummary';
import { WorkOrderTable } from '../components/work-order/WorkOrderTable';
import { WorkOrderCalendar } from '../components/work-order/WorkOrderCalendar';
import { WorkOrderMap } from '../components/work-order/WorkOrderMap';
import { workOrderService } from '../services/workOrderService'; 
import type { WorkOrderData } from '../types/workOrder';
import { X, Save, LayoutList, CalendarDays, Map, Loader2 } from 'lucide-react';

const fieldLabelsMap: Record<string, string> = {
  date: 'Fecha de Orden', company: 'Compañía', agent: 'Agente', zipcode: 'Código Postal',
  year: 'Año del Vehículo', mark: 'Marca del Vehículo', model: 'Modelo del Vehículo', body: 'Carrocería',
  vinNumber: 'Número VIN', plate: 'Placa del Vehículo', customer: 'Buscador de Cliente',
  firstName: 'Nombre del Cliente', lastName: 'Apellido del Cliente', phone: 'Teléfono Principal',
  altPhone: 'Teléfono Alternativo', email: 'Correo Electrónico', address: 'Dirección del Cliente',
  appointmentDate: 'Fecha de Cita', timeStart: 'Hora de Inicio (Cita)', timeEnd: 'Hora de Fin (Cita)',
  insuranceCarrier: 'Aseguradora', policyId: 'Número de Póliza', referral: 'Referencia (Seguro)',
  policyHolder: 'Titular de la Póliza', policyAddress: 'Dirección de la Póliza',
  deductible: 'Deducible (Aseguranza)', kitFlatRate: 'Kit Flat Rate (Aseguranza)'
};

export const WorkOrderPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState<'list' | 'calendar' | 'map' | 'create'>(() => {
    if (location.pathname.includes('/calendar')) return 'calendar';
    if (location.pathname.includes('/map')) return 'map';
    return 'list';
  });

  const [workOrdersList, setWorkOrdersList] = useState<WorkOrderData[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  const [requiredFields, setRequiredFields] = useState<Record<string, boolean>>({
    date: true, company: false, agent: false, zipcode: true,
    year: true, mark: true, model: true, body: false, vinNumber: false, plate: false,
    customer: true, firstName: true, lastName: true, phone: true, altPhone: false, email: false, address: false,
    appointmentDate: false, timeStart: false, timeEnd: false,
    insuranceCarrier: true, policyId: false, referral: false, policyHolder: false, policyAddress: false, deductible: false
  });

  // --- CARGAR DATOS DE FIREBASE AL INICIAR ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await workOrderService.getAll();
        setWorkOrdersList(data);
      } catch (error) {
        console.error("Error cargando Firebase:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // --- ESCUCHAR LA URL PARA CAMBIAR VISTAS ---
  useEffect(() => {
    if (location.pathname.includes('/calendar')) {
      setActiveView('calendar');
    } else if (location.pathname.includes('/map')) {
      setActiveView('map');
    } else if (location.pathname.includes('/work-orders')) {
      setActiveView('list');
    }
  }, [location.pathname]);

  const handleViewChange = (view: 'list' | 'calendar' | 'map') => {
    setActiveView(view);
    if (view === 'calendar') navigate('/calendar');
    else if (view === 'map') navigate('/map');
    else navigate('/work-orders');
  };

  const handleToggleRequired = (fieldKey: string) => {
    setRequiredFields(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const initialWorkOrderState: WorkOrderData = {
    id: '', documentType: 'Work Order', type: 'Personal', date: new Date().toISOString().split('T')[0], 
    status: 'New', company: '', zipcode: '', longTrip: 0, year: '', mark: '', model: '', body: '', 
    vinNumber: '', plate: '', customerType: 'Existing', customer: '', firstName: '', 
    lastName: '', phone: '', altPhone: '', email: '', address: '', appointmentDate: '', 
    timeStart: '', timeEnd: '', insuranceCarrier: '', policyId: '', referral: '', 
    policyHolder: '', policyAddress: '', agent: '', subtotalPart: 0, subtotalMolding: 0, 
    subtotalServices: 0, totalLabor: 0, deductible: 0, kitFlatRate: 0, upsell: 0, 
    taxPercent: 7, callDirection: 'IN', parts: []
  };

  const [currentWorkOrder, setCurrentWorkOrder] = useState<WorkOrderData>(initialWorkOrderState);

  const handleFieldChange = (field: keyof WorkOrderData, value: any) => {
    setCurrentWorkOrder((prev: WorkOrderData) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const missingFields: string[] = [];
    for (const key of Object.keys(requiredFields)) {
      if (requiredFields[key]) {
        const val = currentWorkOrder[key as keyof WorkOrderData];
        if (val === undefined || val === null || val === '') {
          missingFields.push(fieldLabelsMap[key] || key);
        }
      }
    }

    if (missingFields.length > 0) {
      alert(`⚠️ No se puede guardar el documento.\nFaltan los siguientes campos obligatorios:\n\n- ${missingFields.join('\n- ')}`);
      return;
    }

    const customerDisplayName = currentWorkOrder.customerType === 'New' 
      ? `${currentWorkOrder.firstName} ${currentWorkOrder.lastName}`.trim() 
      : currentWorkOrder.customer;

    setIsLoading(true);
    try {
      const isNew = !currentWorkOrder.id;
      let finalData = { ...currentWorkOrder, customer: customerDisplayName };

      if (isNew) {
        const lastNum = await workOrderService.getLastNumber();
        const nextNum = lastNum + 1;
        const prefix = currentWorkOrder.documentType === 'Quote' ? 'Quote' : 'WO';
        finalData.id = `${prefix}-${String(nextNum).padStart(3, '0')}`;
        
        await workOrderService.create(finalData);
      } else {
        await workOrderService.update(currentWorkOrder.id, finalData);
      }

      const updatedList = await workOrderService.getAll();
      setWorkOrdersList(updatedList);
      
      setCurrentWorkOrder(initialWorkOrderState);
      setActiveView('list');
      navigate('/work-orders'); 
      alert('¡Sincronizado con Firebase exitosamente!');
    } catch (error) {
      console.error(error);
      alert('Error al conectar con la base de datos.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setCurrentWorkOrder(initialWorkOrderState);
    if (location.pathname.includes('calendar')) setActiveView('calendar');
    else if (location.pathname.includes('map')) setActiveView('map');
    else setActiveView('list');
  };

  const handleEditOrder = (order: WorkOrderData) => {
    setCurrentWorkOrder(order);
    setActiveView('create');
  };

  // --- PANTALLA DE CARGA ---
  if (isLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', height: '100%', width: '100%' }}>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={48} color="#2563eb" style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: '1.5rem', fontWeight: 600, color: '#475569', fontSize: '1.1rem' }}>Sincronizando con ReyesAutoGlass Cloud...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', flex: 1, backgroundColor: '#F1F5F9', boxSizing: 'border-box' }}>
      
      {activeView !== 'create' && (
        <div style={{ padding: '1.5rem 2.5rem 0 2.5rem', display: 'flex', justifyContent: 'center' }}>
          <div className="segmented-control" style={{ backgroundColor: '#E2E8F0', padding: '4px', borderRadius: '10px' }}>
            <button 
              onClick={() => handleViewChange('list')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s', backgroundColor: activeView === 'list' ? 'white' : 'transparent', color: activeView === 'list' ? '#0F172A' : '#64748B', boxShadow: activeView === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
            >
              <LayoutList size={18} /> Lista
            </button>
            <button 
              onClick={() => handleViewChange('calendar')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s', backgroundColor: activeView === 'calendar' ? 'white' : 'transparent', color: activeView === 'calendar' ? '#0F172A' : '#64748B', boxShadow: activeView === 'calendar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
            >
              <CalendarDays size={18} /> Calendario
            </button>
            <button 
              onClick={() => handleViewChange('map')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s', backgroundColor: activeView === 'map' ? 'white' : 'transparent', color: activeView === 'map' ? '#0F172A' : '#64748B', boxShadow: activeView === 'map' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
            >
              <Map size={18} /> Mapa
            </button>
          </div>
        </div>
      )}

      {activeView === 'list' && (
        <WorkOrderTable data={workOrdersList} onNew={() => setActiveView('create')} onEdit={handleEditOrder} />
      )}

      {activeView === 'calendar' && (
        <WorkOrderCalendar data={workOrdersList} onNew={() => setActiveView('create')} onEdit={handleEditOrder} />
      )}

      {activeView === 'map' && (
        <WorkOrderMap data={workOrdersList} onNew={() => setActiveView('create')} onEdit={handleEditOrder} />
      )}
      
      {activeView === 'create' && (
        <div style={{ display: 'flex', width: '100%', height: '100%', flex: 1, overflow: 'hidden' }}>
          <WorkOrderForm 
            data={currentWorkOrder} 
            requiredFields={requiredFields}
            onChange={handleFieldChange} 
            onOpenSettings={() => setIsSettingsModalOpen(true)}
          />
          <WorkOrderSummary 
            data={currentWorkOrder} 
            onSave={handleSave} 
            onCancel={handleCancel} 
          />
        </div>
      )}

      {isSettingsModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card animate-in zoom-in-95" style={{ width: '90%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1E293B' }}>Configuración de Formulario</h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748B' }}>Seleccione qué campos serán de llenado obligatorio al guardar la orden.</p>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0.4rem', borderRadius: '50%', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#E2E8F0'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}><X size={24} /></button>
            </div>

            <div style={{ padding: '2rem 1.5rem', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.2rem' }}>
              {Object.keys(requiredFields).map(key => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: requiredFields[key] ? '#EFF6FF' : 'white', border: '1px solid', borderColor: requiredFields[key] ? '#BFDBFE' : '#E2E8F0', transition: 'all 0.2s' }}>
                  <input type="checkbox" checked={requiredFields[key]} onChange={() => handleToggleRequired(key)} style={{ width: '18px', height: '18px', accentColor: '#2563EB', cursor: 'pointer' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: requiredFields[key] ? '#1E40AF' : '#475569' }}>{fieldLabelsMap[key] || key}</span>
                </label>
              ))}
            </div>

            <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#F8FAFC' }}>
              <button className="btn btn-primary" onClick={() => setIsSettingsModalOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem', boxShadow: '0 4px 6px -1px rgba(29, 140, 248, 0.3)' }}><Save size={18} /> Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};