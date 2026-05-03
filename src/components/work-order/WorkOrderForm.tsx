import React, { useState } from 'react';
import type { WorkOrderData } from '../../types/workOrder';
import { ClipboardList, Car, Plus, Layers, UserCog, CalendarClock, Shield, Phone, Settings, Receipt, Trash2, Edit2, X } from 'lucide-react';

interface Props {
  data: WorkOrderData;
  requiredFields?: Record<string, boolean>; 
  onChange: (field: keyof WorkOrderData, value: any) => void;
  onOpenSettings: () => void; 
}

export const WorkOrderForm: React.FC<Props> = ({ data, requiredFields = {}, onChange, onOpenSettings }) => {
  
  const [isAddingPart, setIsAddingPart] = useState(false);
  const [editingPartIndex, setEditingPartIndex] = useState<number | null>(null);
  
  const initialDraftPart = {
    type: 'Parts' as 'Parts' | 'Services',
    jobtype: '',
    partNumber: '',
    nagsDescription: '',
    glassCost: 0,
    hasPriceTier: false,
    priceTierName: '',
    priceTierAmount: 0,
    hasCalibration: false,
    calibrationName: '',
    calibrationAmount: 0,
    description: '',
    amount: 0,
    note: ''
  };

  const [draftPart, setDraftPart] = useState(initialDraftPart);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? parseFloat(value) || 0 : value;
    onChange(name as keyof WorkOrderData, finalValue);
  };

  const handleDraftChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? parseFloat(value) || 0 : value;
    setDraftPart(prev => ({ ...prev, [name]: finalValue }));
  };

  const toggleDraftBoolean = (field: 'hasPriceTier' | 'hasCalibration', value: boolean) => {
    setDraftPart(prev => ({ ...prev, [field]: value }));
  };

  const updatePartsAndTotals = (newParts: any[]) => {
    const newSubtotalParts = newParts.reduce((sum, p) => p.type === 'Parts' ? sum + (p.glassCost || 0) : sum, 0);
    const newSubtotalServices = newParts.reduce((sum, p) => p.type === 'Services' ? sum + (p.amount || 0) : sum, 0);
    
    onChange('parts', newParts);
    onChange('subtotalPart', newSubtotalParts);
    onChange('subtotalServices', newSubtotalServices);
  };

  const savePart = () => {
    const currentParts = data.parts || [];
    let newParts;
    
    if (editingPartIndex !== null) {
      newParts = [...currentParts];
      newParts[editingPartIndex] = draftPart;
    } else {
      newParts = [...currentParts, draftPart];
    }

    updatePartsAndTotals(newParts);
    setIsAddingPart(false);
    setEditingPartIndex(null);
    setDraftPart(initialDraftPart);
  };

  const removePart = (index: number) => {
    const currentParts = data.parts || [];
    const newParts = currentParts.filter((_, i) => i !== index);
    updatePartsAndTotals(newParts);
  };

  const editPart = (index: number) => {
    setDraftPart(data.parts![index] as any);
    setEditingPartIndex(index);
    setIsAddingPart(true);
  };

  const cancelPart = () => {
    setIsAddingPart(false);
    setEditingPartIndex(null);
    setDraftPart(initialDraftPart);
  };

  const FieldLabel = ({ text, fieldKey }: { text: string, fieldKey: string }) => (
    <label className="form-label">
      {text} {requiredFields?.[fieldKey] && <span style={{ color: 'var(--color-danger-text)', marginLeft: '2px', fontWeight: 'bold' }}>*</span>}
    </label>
  );

  const calculatedTax = ((data.subtotalPart || 0) + (data.subtotalMolding || 0)) * ((data.taxPercent || 0) / 100);
  const calculatedTotal = (data.subtotalPart || 0) + (data.subtotalMolding || 0) + (data.subtotalServices || 0) + (data.totalLabor || 0) + (data.upsell || 0) + (data.kitFlatRate || 0) + calculatedTax;
  const calculatedBalance = calculatedTotal - (data.paid || 0);

  const draftTotalLabor = (draftPart.hasPriceTier ? (draftPart.priceTierAmount || 0) : 0) + (draftPart.hasCalibration ? (draftPart.calibrationAmount || 0) : 0);

  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem', backgroundColor: '#F1F5F9' }}>
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B', letterSpacing: '-0.025em' }}>
                {data.id
                  ? `${data.documentType === 'Quote' ? 'Cotización' : 'Work Order'} #${data.id}`
                  : `Nueva ${data.documentType === 'Quote' ? 'Cotización' : 'Work Order'}`
                }
              </h2>
              <p style={{ color: 'var(--color-text-muted)', marginTop: '0.2rem', fontSize: '0.95rem' }}>
                Complete la información necesaria para procesar el documento.
              </p>
            </div>
            
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onOpenSettings} 
              title="Configurar Campos Obligatorios"
              style={{ padding: '0.7rem', backgroundColor: 'white', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              <Settings size={20} color="#64748B" />
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
            <div style={{ backgroundColor: '#F8FAFC', padding: '1.2rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <ClipboardList size={20} color="var(--color-primary)" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Detalles de la Orden</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
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
                    <option value="New">New</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Job Done">Job Done</option>
                  </select>
                </div>
                <div className="form-group">
                  <FieldLabel text="Company" fieldKey="company" />
                  <div className="input-group">
                    <input type="text" className="form-input" name="company" value={data.company} onChange={handleChange} placeholder="Buscar compañía..." required={requiredFields?.company} />
                    <button type="button" className="input-addon-btn"><Plus size={18} /></button>
                  </div>
                </div>
                <div className="form-group">
                  <FieldLabel text="Agent" fieldKey="agent" />
                  <div className="input-group">
                    <input type="text" className="form-input" name="agent" value={data.agent || ''} onChange={handleChange} placeholder="Nombre del agente..." required={requiredFields?.agent} />
                    <button type="button" className="input-addon-btn"><Plus size={18} /></button>
                  </div>
                </div>
                <div className="form-group">
                  <FieldLabel text="Zip Code" fieldKey="zipcode" />
                  <div className="input-group">
                    <select className="form-select" name="zipcode" value={data.zipcode} onChange={handleChange} required={requiredFields?.zipcode}>
                      <option value="">Seleccione...</option>
                      <option value="4001">4001</option>
                      <option value="4002">4002</option>
                    </select>
                    <button type="button" className="input-addon-btn"><Plus size={18} /></button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Long Trip</label>
                  <input type="number" step="0.01" className="form-input" name="longTrip" value={data.longTrip || ''} onChange={handleChange} placeholder="Automático" style={{ backgroundColor: '#F1F5F9', cursor: 'not-allowed' }} disabled />
                </div>

                <div className="form-group form-grid-full" style={{ marginTop: '0.5rem', paddingTop: '1.2rem', borderTop: '1px solid #F1F5F9' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem', color: '#64748B' }}>
                    <Phone size={16} /> Dirección de la Llamada
                  </label>
                  <div className="segmented-control" style={{ maxWidth: '300px' }}>
                    <label className={`segmented-item ${data.callDirection === 'IN' ? 'active' : ''}`}><input type="radio" name="callDirection" value="IN" checked={data.callDirection === 'IN'} onChange={handleChange} style={{ display: 'none' }} />IN</label>
                    <label className={`segmented-item ${data.callDirection === 'OUT' ? 'active' : ''}`}><input type="radio" name="callDirection" value="OUT" checked={data.callDirection === 'OUT'} onChange={handleChange} style={{ display: 'none' }} />OUT</label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {data.type === 'Insurance' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #E2E8F0', borderLeft: '4px solid var(--color-accent)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: '#F8FAFC', padding: '1.2rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Shield size={20} color="var(--color-accent)" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Información del Seguro</h3>
              </div>
              <div style={{ padding: '1.5rem' }}>
                <div className="form-grid">
                  <div className="form-group"><FieldLabel text="Insurance Carrier" fieldKey="insuranceCarrier" /><input type="text" className="form-input" name="insuranceCarrier" value={data.insuranceCarrier} onChange={handleChange} required={requiredFields?.insuranceCarrier} /></div>
                  <div className="form-group"><FieldLabel text="Policy ID" fieldKey="policyId" /><input type="text" className="form-input" name="policyId" value={data.policyId} onChange={handleChange} required={requiredFields?.policyId} /></div>
                  <div className="form-group"><FieldLabel text="Referral" fieldKey="referral" /><input type="text" className="form-input" name="referral" value={data.referral} onChange={handleChange} required={requiredFields?.referral} /></div>
                  <div className="form-group"><FieldLabel text="Policy Holder" fieldKey="policyHolder" /><input type="text" className="form-input" name="policyHolder" value={data.policyHolder} onChange={handleChange} required={requiredFields?.policyHolder} /></div>
                  <div className="form-group form-grid-full"><FieldLabel text="Policy Address" fieldKey="policyAddress" /><input type="text" className="form-input" name="policyAddress" value={data.policyAddress} onChange={handleChange} required={requiredFields?.policyAddress} /></div>
                </div>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
            <div style={{ backgroundColor: '#F8FAFC', padding: '1.2rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Car size={20} color="var(--color-primary)" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Información del Vehículo</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div className="form-grid">
                <div className="form-group"><FieldLabel text="Year" fieldKey="year" /><input type="text" className="form-input" name="year" value={data.year} onChange={handleChange} placeholder="2024" required={requiredFields?.year} /></div>
                <div className="form-group"><FieldLabel text="Make" fieldKey="mark" /><input type="text" className="form-input" name="mark" value={data.mark} onChange={handleChange} placeholder="Toyota" required={requiredFields?.mark} /></div>
                <div className="form-group"><FieldLabel text="Model" fieldKey="model" /><input type="text" className="form-input" name="model" value={data.model} onChange={handleChange} placeholder="Camry" required={requiredFields?.model} /></div>
                <div className="form-group"><FieldLabel text="Body" fieldKey="body" /><input type="text" className="form-input" name="body" value={data.body} onChange={handleChange} placeholder="Sedan" required={requiredFields?.body} /></div>
                <div className="form-group form-grid-full"><FieldLabel text="VIN Number" fieldKey="vinNumber" /><input type="text" className="form-input" name="vinNumber" value={data.vinNumber} onChange={handleChange} style={{ textTransform: 'uppercase' }} required={requiredFields?.vinNumber} /></div>
                <div className="form-group form-grid-full"><FieldLabel text="Plate" fieldKey="plate" /><input type="text" className="form-input" name="plate" value={data.plate} onChange={handleChange} style={{ textTransform: 'uppercase' }} required={requiredFields?.plate} /></div>
              </div>
              
              <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #E2E8F0', borderRadius: '12px', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={20} color="var(--color-primary)" />
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#334155' }}>Módulo de Selección de Vidrios</h4>
                  </div>
                  {data.parts && data.parts.length > 0 && (
                    <button type="button" className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => setIsAddingPart(true)}>
                      <Plus size={16} /> Añadir
                    </button>
                  )}
                </div>

                {data.parts && data.parts.length > 0 ? (
                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <table className="pro-table" style={{ width: '100%', fontSize: '0.85rem', backgroundColor: 'white', border: 'none', margin: 0 }}>
                      <thead style={{ backgroundColor: '#F1F5F9' }}>
                        <tr>
                          <th style={{ padding: '0.8rem 1rem' }}>Tipo</th>
                          <th style={{ padding: '0.8rem 1rem' }}>Detalle</th>
                          <th style={{ padding: '0.8rem 1rem' }}>Costo / Monto</th>
                          <th style={{ padding: '0.8rem 1rem' }}>Labor Total</th>
                          <th style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.parts.map((p: any, idx: number) => {
                          const isPart = p.type === 'Parts';
                          const costAmount = isPart ? p.glassCost : p.amount;
                          const laborTotal = isPart ? ((p.hasPriceTier ? p.priceTierAmount : 0) + (p.hasCalibration ? p.calibrationAmount : 0)) : null;
                          
                          const detailText = isPart 
                            ? `${p.partNumber || '-'} / ${p.nagsDescription || '-'}` 
                            : p.description || '-';

                          return (
                            <tr key={idx} style={{ borderTop: '1px solid #E2E8F0' }}>
                              <td style={{ padding: '0.8rem 1rem', fontWeight: 600 }}>{p.type}</td>
                              <td style={{ padding: '0.8rem 1rem' }}>{detailText}</td>
                              <td style={{ padding: '0.8rem 1rem', fontWeight: 600 }}>${(costAmount || 0).toFixed(2)}</td>
                              <td style={{ padding: '0.8rem 1rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                                {laborTotal !== null ? `$${laborTotal.toFixed(2)}` : '-'}
                              </td>
                              <td style={{ padding: '0.8rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <button type="button" onClick={() => editPart(idx)} className="btn btn-secondary" style={{ padding: '0.4rem', marginRight: '0.5rem', backgroundColor: 'white' }}>
                                  <Edit2 size={16} />
                                </button>
                                <button type="button" onClick={() => removePart(idx)} className="btn btn-danger-light" style={{ padding: '0.4rem' }}>
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1.5rem', border: '2px dashed #CBD5E1', borderRadius: '8px', backgroundColor: 'white' }}>
                    <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1rem' }}>Seleccione las partes o servicios a agregar.</p>
                    <button type="button" className="btn btn-secondary" style={{ backgroundColor: 'white' }} onClick={() => setIsAddingPart(true)}>
                      <Plus size={16} /> Añadir Parte / Servicio
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
            <div style={{ backgroundColor: '#F8FAFC', padding: '1.2rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <UserCog size={20} color="var(--color-primary)" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Cliente y Cita</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Tipo de Registro</label>
                <div className="segmented-control" style={{ maxWidth: '300px' }}>
                  <label className={`segmented-item ${data.customerType === 'Existing' ? 'active' : ''}`}><input type="radio" name="customerType" value="Existing" checked={data.customerType === 'Existing'} onChange={handleChange} style={{ display: 'none' }} /> Existente</label>
                  <label className={`segmented-item ${data.customerType === 'New' ? 'active' : ''}`}><input type="radio" name="customerType" value="New" checked={data.customerType === 'New'} onChange={handleChange} style={{ display: 'none' }} /> Nuevo</label>
                </div>
              </div>

              {data.customerType === 'Existing' ? (
                <div className="form-group form-grid-full">
                  <FieldLabel text="Buscar Cliente" fieldKey="customer" />
                  <input type="text" className="form-input" name="customer" value={data.customer} onChange={handleChange} placeholder="Nombre o teléfono..." required={requiredFields?.customer} />
                </div>
              ) : (
                <div className="form-grid">
                  <div className="form-group"><FieldLabel text="First Name" fieldKey="firstName" /><input type="text" className="form-input" name="firstName" value={data.firstName} onChange={handleChange} required={requiredFields?.firstName} /></div>
                  <div className="form-group"><FieldLabel text="Last Name" fieldKey="lastName" /><input type="text" className="form-input" name="lastName" value={data.lastName} onChange={handleChange} required={requiredFields?.lastName} /></div>
                  <div className="form-group"><FieldLabel text="Phone" fieldKey="phone" /><input type="tel" className="form-input" name="phone" value={data.phone} onChange={handleChange} required={requiredFields?.phone} /></div>
                  <div className="form-group"><FieldLabel text="Alternative Phone" fieldKey="altPhone" /><input type="tel" className="form-input" name="altPhone" value={data.altPhone} onChange={handleChange} /></div>
                  <div className="form-group form-grid-full"><FieldLabel text="Email" fieldKey="email" /><input type="email" className="form-input" name="email" value={data.email} onChange={handleChange} /></div>
                  <div className="form-group form-grid-full"><FieldLabel text="Address" fieldKey="address" /><input type="text" className="form-input" name="address" value={data.address} onChange={handleChange} /></div>
                </div>
              )}

              <div style={{ margin: '2rem 0', borderTop: '2px solid #F1F5F9' }}></div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.2rem' }}>
                <CalendarClock size={20} color="var(--color-primary)" />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>Agendamiento de Cita</h4>
              </div>
              <div className="form-grid">
                <div className="form-group form-grid-full"><FieldLabel text="Appointment Date" fieldKey="appointmentDate" /><input type="date" className="form-input" name="appointmentDate" value={data.appointmentDate} onChange={handleChange} required={requiredFields?.appointmentDate} /></div>
                <div className="form-group"><FieldLabel text="Time Start" fieldKey="timeStart" /><input type="time" className="form-input" name="timeStart" value={data.timeStart} onChange={handleChange} required={requiredFields?.timeStart} /></div>
                <div className="form-group"><FieldLabel text="Time End" fieldKey="timeEnd" /><input type="time" className="form-input" name="timeEnd" value={data.timeEnd} onChange={handleChange} required={requiredFields?.timeEnd} /></div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
            <div style={{ backgroundColor: '#F8FAFC', padding: '1.2rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Receipt size={20} color="var(--color-primary)" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Desglose Financiero</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div className="form-grid">
                <div className="form-group">
                  <FieldLabel text="Subtotal Parts" fieldKey="subtotalPart" />
                  <div className="input-group">
                    <span className="input-addon-btn" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>$</span>
                    <input type="text" className="form-input" value={(data.subtotalPart || 0).toFixed(2)} disabled style={{ backgroundColor: '#F1F5F9', color: '#64748B', cursor: 'not-allowed' }} />
                  </div>
                </div>
                
                <div className="form-group">
                  <FieldLabel text="Subtotal Services" fieldKey="subtotalServices" />
                  <div className="input-group">
                    <span className="input-addon-btn" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>$</span>
                    <input type="text" className="form-input" value={(data.subtotalServices || 0).toFixed(2)} disabled style={{ backgroundColor: '#F1F5F9', color: '#64748B', cursor: 'not-allowed' }} />
                  </div>
                </div>
                
                <div className="form-group">
                  <FieldLabel text="Total Labor" fieldKey="totalLabor" />
                  <div className="input-group">
                    <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                    <input type="number" step="0.01" className="form-input" name="totalLabor" value={data.totalLabor || ''} onChange={handleChange} />
                  </div>
                </div>
                
                {data.type === 'Insurance' && (
                  <>
                    <div className="form-group">
                      <FieldLabel text="Deductible (Aseguranza)" fieldKey="deductible" />
                      <div className="input-group">
                        <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                        <input type="number" step="0.01" className="form-input" name="deductible" value={data.deductible || ''} onChange={handleChange} />
                      </div>
                    </div>
                    <div className="form-group">
                      <FieldLabel text="Kit Flat Rate (Aseguranza)" fieldKey="kitFlatRate" />
                      <div className="input-group">
                        <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                        <input type="number" step="0.01" className="form-input" name="kitFlatRate" value={data.kitFlatRate || ''} onChange={handleChange} />
                      </div>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <FieldLabel text="Tax %" fieldKey="taxPercent" />
                  <div className="input-group">
                    <input type="number" step="0.01" className="form-input" name="taxPercent" value={data.taxPercent || ''} onChange={handleChange} />
                    <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>%</span>
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Tax $</label>
                  <div className="input-group">
                    <span className="input-addon-btn" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>$</span>
                    <input type="text" className="form-input" value={calculatedTax.toFixed(2)} disabled style={{ backgroundColor: '#F1F5F9', color: '#64748B', cursor: 'not-allowed' }} />
                  </div>
                </div>
                
                <div className="form-group">
                  <FieldLabel text="Cash Comeback" fieldKey="cashComeback" />
                  <div className="input-group">
                    <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                    <input type="number" step="0.01" className="form-input" name="cashComeback" value={data.cashComeback || ''} onChange={handleChange} />
                  </div>
                </div>
                
                <div className="form-group">
                  <FieldLabel text="Upsold" fieldKey="upsold" />
                  <div className="input-group">
                    <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                    <input type="number" step="0.01" className="form-input" name="upsold" value={data.upsold || ''} onChange={handleChange} />
                  </div>
                </div>
                
                <div className="form-group">
                  <FieldLabel text="Upsell" fieldKey="upsell" />
                  <div className="input-group">
                    <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                    <input type="number" step="0.01" className="form-input" name="upsell" value={data.upsell || ''} onChange={handleChange} />
                  </div>
                </div>
                
                <div className="form-group">
                  <FieldLabel text="Paid" fieldKey="paid" />
                  <div className="input-group">
                    <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                    <input type="number" step="0.01" className="form-input" name="paid" value={data.paid || ''} onChange={handleChange} />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Total</label>
                  <div className="input-group">
                    <span className="input-addon-btn" style={{ backgroundColor: '#E2E8F0', fontWeight: 'bold' }}>$</span>
                    <input type="text" className="form-input" value={calculatedTotal.toFixed(2)} disabled style={{ backgroundColor: '#E2E8F0', fontWeight: 'bold', color: '#1E293B', cursor: 'not-allowed' }} />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Balance</label>
                  <div className="input-group">
                    <span className="input-addon-btn" style={{ backgroundColor: '#E2E8F0', fontWeight: 'bold' }}>$</span>
                    <input type="text" className="form-input" value={calculatedBalance.toFixed(2)} disabled style={{ backgroundColor: '#E2E8F0', fontWeight: 'bold', color: calculatedBalance > 0 ? '#DC2626' : '#16A34A', cursor: 'not-allowed' }} />
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>

      {isAddingPart && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '90%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                {editingPartIndex !== null ? 'Editar Registro' : 'Nueva Parte / Servicio'}
              </h3>
              <button onClick={cancelPart} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
              <div className="form-grid">
                <div className="form-group form-grid-full">
                  <label className="form-label">Type</label>
                  <div className="segmented-control" style={{ maxWidth: '300px' }}>
                    <label className={`segmented-item ${draftPart.type === 'Parts' ? 'active' : ''}`}><input type="radio" name="type" value="Parts" checked={draftPart.type === 'Parts'} onChange={handleDraftChange} style={{ display: 'none' }} />Parts</label>
                    <label className={`segmented-item ${draftPart.type === 'Services' ? 'active' : ''}`}><input type="radio" name="type" value="Services" checked={draftPart.type === 'Services'} onChange={handleDraftChange} style={{ display: 'none' }} />Services</label>
                  </div>
                </div>

                {draftPart.type === 'Parts' && data.type === 'Personal' ? (
                  <>
                    <div className="form-group"><label className="form-label">Jobtype</label><input type="text" className="form-input" name="jobtype" value={draftPart.jobtype} onChange={handleDraftChange} /></div>
                    <div className="form-group"><label className="form-label">Part Number</label><input type="text" className="form-input" name="partNumber" value={draftPart.partNumber || ''} onChange={handleDraftChange} /></div>
                    <div className="form-group form-grid-full"><label className="form-label">Nags Description</label><input type="text" className="form-input" name="nagsDescription" value={draftPart.nagsDescription || ''} onChange={handleDraftChange} /></div>
                    <div className="form-group">
                      <label className="form-label">Glass Cost</label>
                      <div className="input-group">
                        <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                        <input type="number" step="0.01" className="form-input" name="glassCost" value={draftPart.glassCost || ''} onChange={handleDraftChange} />
                      </div>
                    </div>

                    <div className="form-group form-grid-full" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #F1F5F9' }}>
                      <label className="form-label" style={{ marginBottom: '0.8rem' }}>Price Tier</label>
                      <div className="segmented-control" style={{ maxWidth: '200px', marginBottom: '1rem' }}>
                        <label className={`segmented-item ${draftPart.hasPriceTier ? 'active' : ''}`}><input type="radio" checked={draftPart.hasPriceTier} onChange={() => toggleDraftBoolean('hasPriceTier', true)} style={{ display: 'none' }} />Sí</label>
                        <label className={`segmented-item ${!draftPart.hasPriceTier ? 'active' : ''}`}><input type="radio" checked={!draftPart.hasPriceTier} onChange={() => toggleDraftBoolean('hasPriceTier', false)} style={{ display: 'none' }} />No</label>
                      </div>
                      {draftPart.hasPriceTier && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                          <div><label className="form-label">Nombre Price Tier</label><input type="text" className="form-input" name="priceTierName" value={draftPart.priceTierName || ''} onChange={handleDraftChange} /></div>
                          <div>
                            <label className="form-label">Monto Price Tier</label>
                            <div className="input-group">
                              <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                              <input type="number" step="0.01" className="form-input" name="priceTierAmount" value={draftPart.priceTierAmount || ''} onChange={handleDraftChange} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="form-group form-grid-full" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #F1F5F9' }}>
                      <label className="form-label" style={{ marginBottom: '0.8rem' }}>Calibration Type</label>
                      <div className="segmented-control" style={{ maxWidth: '200px', marginBottom: '1rem' }}>
                        <label className={`segmented-item ${draftPart.hasCalibration ? 'active' : ''}`}><input type="radio" checked={draftPart.hasCalibration} onChange={() => toggleDraftBoolean('hasCalibration', true)} style={{ display: 'none' }} />Sí</label>
                        <label className={`segmented-item ${!draftPart.hasCalibration ? 'active' : ''}`}><input type="radio" checked={!draftPart.hasCalibration} onChange={() => toggleDraftBoolean('hasCalibration', false)} style={{ display: 'none' }} />No</label>
                      </div>
                      {draftPart.hasCalibration && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                          <div><label className="form-label">Nombre Calibración</label><input type="text" className="form-input" name="calibrationName" value={draftPart.calibrationName || ''} onChange={handleDraftChange} /></div>
                          <div>
                            <label className="form-label">Monto Calibración</label>
                            <div className="input-group">
                              <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                              <input type="number" step="0.01" className="form-input" name="calibrationAmount" value={draftPart.calibrationAmount || ''} onChange={handleDraftChange} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="form-group form-grid-full" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #E2E8F0' }}>
                      <label className="form-label" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>Total Labor (Parte)</label>
                      <div className="input-group">
                        <span className="input-addon-btn" style={{ backgroundColor: '#DBEAFE', color: '#1E40AF', fontWeight: 'bold', border: 'none' }}>$</span>
                        <input type="text" className="form-input" value={draftTotalLabor.toFixed(2)} disabled style={{ backgroundColor: '#EFF6FF', color: '#1E40AF', fontWeight: 'bold', border: 'none', cursor: 'not-allowed' }} />
                      </div>
                    </div>
                  </>
                ) : draftPart.type === 'Services' && data.type === 'Personal' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Jobtype</label>
                      <input type="text" className="form-input" name="jobtype" value={draftPart.jobtype} onChange={handleDraftChange} />
                    </div>
                    <div className="form-group form-grid-full">
                      <label className="form-label">Description</label>
                      <input type="text" className="form-input" name="description" value={draftPart.description || ''} onChange={handleDraftChange} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Amount</label>
                      <div className="input-group">
                        <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                        <input type="number" step="0.01" className="form-input" name="amount" value={draftPart.amount || ''} onChange={handleDraftChange} />
                      </div>
                    </div>
                    <div className="form-group form-grid-full">
                      <label className="form-label">Note</label>
                      <input type="text" className="form-input" name="note" value={draftPart.note || ''} onChange={handleDraftChange} />
                    </div>
                  </>
                ) : (
                  <div className="form-group form-grid-full">
                    <p style={{ fontSize: '0.85rem', color: '#64748B', fontStyle: 'italic', padding: '1rem', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
                      Los detalles específicos se habilitarán según el tipo de orden y aseguradora.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: '#F8FAFC' }}>
              <button type="button" className="btn btn-secondary" onClick={cancelPart}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={savePart}>Guardar {draftPart.type === 'Parts' ? 'Parte' : 'Servicio'}</button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};