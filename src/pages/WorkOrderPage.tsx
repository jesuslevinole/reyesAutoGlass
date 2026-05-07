import React, { useState } from 'react';
import { WorkOrderForm } from '../components/work-order/WorkOrderForm';
import { WorkOrderSummary } from '../components/work-order/WorkOrderSummary';
import { WorkOrderTable } from '../components/work-order/WorkOrderTable';
import type { WorkOrderData } from '../types/workOrder';
import { X, Save } from 'lucide-react';

const fieldLabelsMap: Record<string, string> = {
  date: 'Fecha de Orden',
  company: 'Compañía',
  agent: 'Agente',
  zipcode: 'Código Postal',
  year: 'Año del Vehículo',
  mark: 'Marca del Vehículo',
  model: 'Modelo del Vehículo',
  body: 'Carrocería',
  vinNumber: 'Número VIN',
  plate: 'Placa del Vehículo',
  customer: 'Buscador de Cliente',
  firstName: 'Nombre del Cliente',
  lastName: 'Apellido del Cliente',
  phone: 'Teléfono Principal',
  altPhone: 'Teléfono Alternativo',
  email: 'Correo Electrónico',
  address: 'Dirección del Cliente',
  appointmentDate: 'Fecha de Cita',
  timeStart: 'Hora de Inicio (Cita)',
  timeEnd: 'Hora de Fin (Cita)',
  insuranceCarrier: 'Aseguradora',
  policyId: 'Número de Póliza',
  referral: 'Referencia (Seguro)',
  policyHolder: 'Titular de la Póliza',
  policyAddress: 'Dirección de la Póliza',
  deductible: 'Deducible (Aseguranza)',
  kitFlatRate: 'Kit Flat Rate (Aseguranza)'
};

export const WorkOrderPage: React.FC = () => {
  // Cambio clave aquí: Iniciamos en 'list' en lugar de 'create'
  const [activeView, setActiveView] = useState<'list' | 'create'>('list');
  const [workOrdersList, setWorkOrdersList] = useState<WorkOrderData[]>([]);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [requiredFields, setRequiredFields] = useState<Record<string, boolean>>({
    date: true, company: false, agent: false, zipcode: true,
    year: true, mark: true, model: true, body: false, vinNumber: false, plate: false,
    customer: true, firstName: true, lastName: true, phone: true, altPhone: false, email: false, address: false,
    appointmentDate: false, timeStart: false, timeEnd: false,
    insuranceCarrier: true, policyId: false, referral: false, policyHolder: false, policyAddress: false, deductible: false
  });

  const handleToggleRequired = (fieldKey: string) => {
    setRequiredFields(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const initialWorkOrderState: WorkOrderData = {
    id: '', documentType: 'Work Order', type: 'Personal', date: '', status: 'New', 
    company: '', zipcode: '', longTrip: 0, year: '', mark: '', model: '', body: '', 
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

  const handleSave = () => {
    // 1. VALIDACIÓN: Buscamos si faltan campos obligatorios
    const missingFields: string[] = [];
    for (const key of Object.keys(requiredFields)) {
      if (requiredFields[key]) {
        const val = currentWorkOrder[key as keyof WorkOrderData];
        if (val === undefined || val === null || val === '') {
          missingFields.push(fieldLabelsMap[key] || key);
        }
      }
    }

    // 2. Si faltan campos, detenemos la ejecución y mostramos la alerta
    if (missingFields.length > 0) {
      alert(`⚠️ No se puede guardar el documento.\nFaltan los siguientes campos obligatorios:\n\n- ${missingFields.join('\n- ')}`);
      return;
    }

    const customerDisplayName = currentWorkOrder.customerType === 'New' 
      ? `${currentWorkOrder.firstName} ${currentWorkOrder.lastName}`.trim() 
      : currentWorkOrder.customer;

    const newWoWithId: WorkOrderData = {
      ...currentWorkOrder,
      customer: customerDisplayName,
      id: `WO-00${workOrdersList.length + 1}`
    };
    
    setWorkOrdersList(prev => [newWoWithId, ...prev]);
    setCurrentWorkOrder(initialWorkOrderState);
    setActiveView('list');
    alert('¡Registro guardado exitosamente!');
  };

  const handleCancel = () => {
    setCurrentWorkOrder(initialWorkOrderState);
    setActiveView('list');
  };

  return (
    <>
      {activeView === 'list' && (
        <WorkOrderTable data={workOrdersList} onNew={() => setActiveView('create')} />
      )}
      
      {activeView === 'create' && (
        <div style={{ display: 'flex', width: '100%', height: '100%' }}>
          <WorkOrderForm 
            data={currentWorkOrder} 
            requiredFields={requiredFields}
            onChange={handleFieldChange} 
            onOpenSettings={() => setIsSettingsModalOpen(true)}
          />
          <WorkOrderSummary data={currentWorkOrder} onSave={handleSave} onCancel={handleCancel} />
        </div>
      )}

      {isSettingsModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Configuración de Formulario</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Seleccione los campos que serán obligatorios.</p>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
              {Object.keys(requiredFields).map(key => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '6px', backgroundColor: requiredFields[key] ? '#EFF6FF' : 'transparent', border: '1px solid', borderColor: requiredFields[key] ? '#BFDBFE' : 'var(--color-border)', transition: 'all 0.2s' }}>
                  <input 
                    type="checkbox" 
                    checked={requiredFields[key]} 
                    onChange={() => handleToggleRequired(key)} 
                    style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                  />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500, color: requiredFields[key] ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                    {fieldLabelsMap[key] || key}
                  </span>
                </label>
              ))}
            </div>

            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#F8FAFC' }}>
              <button className="btn btn-primary" onClick={() => setIsSettingsModalOpen(false)}>
                <Save size={18} /> Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};