import React from 'react';
import type { WorkOrderData } from '../../types/workOrder';
import { ClipboardList, Car, Plus, Layers, UserCog, CalendarClock, Shield, Phone, Settings } from 'lucide-react';

interface Props {
  data: WorkOrderData;
  requiredFields?: Record<string, boolean>; 
  onChange: (field: keyof WorkOrderData, value: any) => void;
  onOpenSettings: () => void; 
}

export const WorkOrderForm: React.FC<Props> = ({ data, requiredFields = {}, onChange, onOpenSettings }) => {
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? parseFloat(value) || 0 : value;
    onChange(name as keyof WorkOrderData, finalValue);
  };

  const FieldLabel = ({ text, fieldKey }: { text: string, fieldKey: string }) => (
    <label className="form-label">
      {text} {requiredFields?.[fieldKey] && <span style={{ color: 'var(--color-danger-text)', marginLeft: '2px', fontWeight: 'bold' }}>*</span>}
    </label>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem' }}>
      <div style={{ maxWidth: '850px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
          <div>
            <h2>
              {data.id
                ? `${data.documentType === 'Quote' ? 'Cotización' : 'Work Order'} #${data.id}`
                : `Nueva ${data.documentType === 'Quote' ? 'Cotización' : 'Work Order'}`
              }
            </h2>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>
              Ingrese los detalles para crear {data.documentType === 'Quote' ? 'una nueva cotización' : 'una nueva orden de servicio'}.
            </p>
          </div>
          
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onOpenSettings} 
            title="Configurar Campos Obligatorios"
            style={{ padding: '0.6rem', color: 'var(--color-text-muted)' }}
          >
            <Settings size={20} />
          </button>
        </div>

        <div className="card">
          <h3 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', marginBottom: '1.8rem' }}>
            <ClipboardList size={20} color="var(--color-text-muted)" /> Detalles de la Orden
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Documento</label>
              <div className="segmented-control">
                <label className={`segmented-item ${data.documentType === 'Quote' ? 'active' : ''}`}><input type="radio" name="documentType" value="Quote" checked={data.documentType === 'Quote'} onChange={handleChange} style={{ display: 'none' }} />Cotización</label>
                <label className={`segmented-item ${data.documentType === 'Work Order' ? 'active' : ''}`}><input type="radio" name="documentType" value="Work Order" checked={data.documentType === 'Work Order'} onChange={handleChange} style={{ display: 'none' }} />Work Order</label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de Pago</label>
              <div className="segmented-control">
                <label className={`segmented-item ${data.type === 'Personal' ? 'active' : ''}`}><input type="radio" name="type" value="Personal" checked={data.type === 'Personal'} onChange={handleChange} style={{ display: 'none' }} />Personal</label>
                <label className={`segmented-item ${data.type === 'Insurance' ? 'active' : ''}`}><input type="radio" name="type" value="Insurance" checked={data.type === 'Insurance'} onChange={handleChange} style={{ display: 'none' }} />Insurance</label>
              </div>
            </div>

            <div className="form-group">
              <FieldLabel text="Fecha" fieldKey="date" />
              <input type="date" className="form-input" name="date" value={data.date} onChange={handleChange} required={requiredFields?.date} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" name="status" value={data.status} onChange={handleChange} required>
                <option value="">Select status...</option>
                <option value="New">New</option>
                <option value="In Progress">In Progress</option>
                <option value="Job Done">Job Done</option>
              </select>
            </div>
            <div className="form-group">
              <FieldLabel text="Company" fieldKey="company" />
              <div className="input-group">
                <input type="text" className="form-input" name="company" value={data.company} onChange={handleChange} placeholder="Buscar o ingresar compañía..." required={requiredFields?.company} />
                <button type="button" className="input-addon-btn"><Plus size={18} /></button>
              </div>
            </div>
            <div className="form-group">
              <FieldLabel text="Agent" fieldKey="agent" />
              <div className="input-group">
                <input type="text" className="form-input" name="agent" value={data.agent || ''} onChange={handleChange} placeholder="Agente de la compañía..." required={requiredFields?.agent} />
                <button type="button" className="input-addon-btn"><Plus size={18} /></button>
              </div>
            </div>
            <div className="form-group">
              <FieldLabel text="Zip Code" fieldKey="zipcode" />
              <div className="input-group">
                <select className="form-select" name="zipcode" value={data.zipcode} onChange={handleChange} required={requiredFields?.zipcode}>
                  <option value="">Seleccione Zip...</option>
                  <option value="4001">4001</option>
                  <option value="4002">4002</option>
                </select>
                <button type="button" className="input-addon-btn"><Plus size={18} /></button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Long Trip</label>
              <input type="number" step="0.01" className="form-input" name="longTrip" value={data.longTrip || ''} onChange={handleChange} placeholder="Calculado automáticamente..." style={{ backgroundColor: '#F8FAFC' }} disabled />
            </div>

            <div className="form-group form-grid-full" style={{ marginTop: '0.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <Phone size={16} color="var(--color-text-muted)" /> Dirección de la Llamada
              </label>
              <div className="segmented-control">
                <label className={`segmented-item ${data.callDirection === 'IN' ? 'active' : ''}`}>
                  <input type="radio" name="callDirection" value="IN" checked={data.callDirection === 'IN'} onChange={handleChange} style={{ display: 'none' }} />
                  IN (Entrante)
                </label>
                <label className={`segmented-item ${data.callDirection === 'OUT' ? 'active' : ''}`}>
                  <input type="radio" name="callDirection" value="OUT" checked={data.callDirection === 'OUT'} onChange={handleChange} style={{ display: 'none' }} />
                  OUT (Saliente)
                </label>
              </div>
            </div>

          </div>
        </div>

        {data.type === 'Insurance' && (
          <div className="card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
            <h3 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', marginBottom: '1.8rem', color: 'var(--color-accent)' }}>
              <Shield size={20} /> Información del Seguro
            </h3>
            <div className="form-grid">
              <div className="form-group"><FieldLabel text="Insurance Carrier" fieldKey="insuranceCarrier" /><input type="text" className="form-input" name="insuranceCarrier" value={data.insuranceCarrier} onChange={handleChange} placeholder="Aseguradora..." required={requiredFields?.insuranceCarrier} /></div>
              <div className="form-group"><FieldLabel text="Policy ID" fieldKey="policyId" /><input type="text" className="form-input" name="policyId" value={data.policyId} onChange={handleChange} placeholder="Número de Póliza" required={requiredFields?.policyId} /></div>
              <div className="form-group"><FieldLabel text="Referral" fieldKey="referral" /><input type="text" className="form-input" name="referral" value={data.referral} onChange={handleChange} placeholder="Referencia" required={requiredFields?.referral} /></div>
              <div className="form-group"><FieldLabel text="Deductible ($)" fieldKey="deductible" /><input type="number" step="0.01" className="form-input" name="deductible" value={data.deductible || ''} onChange={handleChange} placeholder="0.00" required={requiredFields?.deductible} /></div>
              <div className="form-group"><FieldLabel text="Policy Holder" fieldKey="policyHolder" /><input type="text" className="form-input" name="policyHolder" value={data.policyHolder} onChange={handleChange} placeholder="Nombre del titular" required={requiredFields?.policyHolder} /></div>
              <div className="form-group form-grid-full"><FieldLabel text="Policy Address" fieldKey="policyAddress" /><input type="text" className="form-input" name="policyAddress" value={data.policyAddress} onChange={handleChange} placeholder="Dirección registrada en la póliza" required={requiredFields?.policyAddress} /></div>
            </div>
          </div>
        )}

        <div className="card">
          <h3 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', marginBottom: '1.8rem' }}>
            <Car size={20} color="var(--color-text-muted)" /> Información del Vehículo
          </h3>
          <div className="form-grid">
            <div className="form-group"><FieldLabel text="Year" fieldKey="year" /><input type="text" className="form-input" name="year" value={data.year} onChange={handleChange} placeholder="Ej. 2023" required={requiredFields?.year} /></div>
            <div className="form-group"><FieldLabel text="Make" fieldKey="mark" /><input type="text" className="form-input" name="mark" value={data.mark} onChange={handleChange} placeholder="Ej. Toyota..." required={requiredFields?.mark} /></div>
            <div className="form-group"><FieldLabel text="Model" fieldKey="model" /><input type="text" className="form-input" name="model" value={data.model} onChange={handleChange} placeholder="Ej. Corolla..." required={requiredFields?.model} /></div>
            <div className="form-group"><FieldLabel text="Body" fieldKey="body" /><input type="text" className="form-input" name="body" value={data.body} onChange={handleChange} placeholder="Ej. Sedan..." required={requiredFields?.body} /></div>
            <div className="form-group form-grid-full"><FieldLabel text="VIN Number" fieldKey="vinNumber" /><input type="text" className="form-input" name="vinNumber" value={data.vinNumber} onChange={handleChange} placeholder="17-character VIN" style={{ textTransform: 'uppercase' }} required={requiredFields?.vinNumber} /></div>
            <div className="form-group form-grid-full"><FieldLabel text="Plate" fieldKey="plate" /><input type="text" className="form-input" name="plate" value={data.plate} onChange={handleChange} placeholder="License Plate" style={{ textTransform: 'uppercase' }} required={requiredFields?.plate} /></div>
          </div>
          <div style={{ marginTop: '2.5rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.8rem' }}>Auto Glass Needed</label>
            <div style={{ border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: '#F8FAFC', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', gap: '0.5rem' }}>
              <Layers size={32} color="var(--color-border)" />
              <p style={{ fontWeight: 600 }}>Módulo de Selección de Vidrios</p>
              <button type="button" className="btn btn-secondary" style={{ marginTop: '1rem' }} disabled><Plus size={16} /> Añadir Parte</button>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', marginBottom: '1.8rem' }}>
            <UserCog size={20} color="var(--color-text-muted)" /> Cliente y Cita
          </h3>

          <div style={{ marginBottom: '2rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.6rem' }}>Registro del Cliente</label>
            <div className="segmented-control">
              <label className={`segmented-item ${data.customerType === 'Existing' ? 'active' : ''}`}>
                <input type="radio" name="customerType" value="Existing" checked={data.customerType === 'Existing'} onChange={handleChange} style={{ display: 'none' }} /> Existente
              </label>
              <label className={`segmented-item ${data.customerType === 'New' ? 'active' : ''}`}>
                <input type="radio" name="customerType" value="New" checked={data.customerType === 'New'} onChange={handleChange} style={{ display: 'none' }} /> Nuevo
              </label>
            </div>
          </div>

          {data.customerType === 'Existing' ? (
            <div className="form-grid">
              <div className="form-group form-grid-full">
                <FieldLabel text="Buscar Cliente" fieldKey="customer" />
                <input type="text" className="form-input" name="customer" value={data.customer} onChange={handleChange} placeholder="Buscar..." required={requiredFields?.customer} />
              </div>
            </div>
          ) : (
            <div className="form-grid">
              <div className="form-group"><FieldLabel text="First Name" fieldKey="firstName" /><input type="text" className="form-input" name="firstName" value={data.firstName} onChange={handleChange} required={requiredFields?.firstName} /></div>
              <div className="form-group"><FieldLabel text="Last Name" fieldKey="lastName" /><input type="text" className="form-input" name="lastName" value={data.lastName} onChange={handleChange} required={requiredFields?.lastName} /></div>
              <div className="form-group"><FieldLabel text="Phone" fieldKey="phone" /><input type="tel" className="form-input" name="phone" value={data.phone} onChange={handleChange} required={requiredFields?.phone} /></div>
              <div className="form-group"><FieldLabel text="Alternative Phone" fieldKey="altPhone" /><input type="tel" className="form-input" name="altPhone" value={data.altPhone} onChange={handleChange} required={requiredFields?.altPhone} /></div>
              <div className="form-group form-grid-full"><FieldLabel text="Email" fieldKey="email" /><input type="email" className="form-input" name="email" value={data.email} onChange={handleChange} required={requiredFields?.email} /></div>
              <div className="form-group form-grid-full"><FieldLabel text="Address" fieldKey="address" /><input type="text" className="form-input" name="address" value={data.address} onChange={handleChange} required={requiredFields?.address} /></div>
            </div>
          )}

          <div style={{ margin: '2.5rem 0 1.5rem 0', borderTop: '1px solid var(--color-border)' }}></div>

          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.2rem' }}>
            <CalendarClock size={18} color="var(--color-primary)" /> Agendamiento de Cita
          </h4>
          <div className="form-grid">
            <div className="form-group form-grid-full"><FieldLabel text="Appointment Date" fieldKey="appointmentDate" /><input type="date" className="form-input" name="appointmentDate" value={data.appointmentDate} onChange={handleChange} required={requiredFields?.appointmentDate} /></div>
            <div className="form-group"><FieldLabel text="Time Start" fieldKey="timeStart" /><input type="time" className="form-input" name="timeStart" value={data.timeStart} onChange={handleChange} required={requiredFields?.timeStart} /></div>
            <div className="form-group"><FieldLabel text="Time End" fieldKey="timeEnd" /><input type="time" className="form-input" name="timeEnd" value={data.timeEnd} onChange={handleChange} required={requiredFields?.timeEnd} /></div>
          </div>
          
        </div>

        <div style={{ display: 'none' }}></div>
      </div>
    </div>
  );
};