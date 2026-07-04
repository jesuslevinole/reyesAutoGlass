import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ChevronRight, Plus, Edit2, Trash2, X } from 'lucide-react';
import { db } from '../firebase';
import type { CatalogSchema } from '../types/settings';
import { isCurrency, isPercentage } from '../constants/settingsSchemas';
import { vehicleCatalogService } from '../services/Vehiclecatalogservice';

interface Props {
  catalog: CatalogSchema;
  onBack: () => void;
}

export const CatalogView: React.FC<Props> = ({ catalog, onBack }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [modalState, setModalState] = useState<'closed' | 'form' | 'detail'>('closed');
  const [currentRecord, setCurrentRecord] = useState<any | null>(null);
  const [formData, setFormData] = useState<any>({});

  // El catálogo de vehículos (catalog_vehicle) tiene cientos de miles de filas,
  // así que NO se carga completo: se filtra bajo demanda para limitar lecturas.
  const isVehicleCatalog = catalog.id === 'vehicle';

  // --- Estado de filtros para el catálogo de vehículos ---
  const [fYear, setFYear] = useState('');
  const [fMake, setFMake] = useState('');
  const [fModel, setFModel] = useState('');
  const [fBody, setFBody] = useState('');
  const [makeOpts, setMakeOpts] = useState<string[]>([]);
  const [modelOpts, setModelOpts] = useState<string[]>([]);
  const [bodyOpts, setBodyOpts] = useState<string[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(
    { length: currentYear + 1 - 1990 + 1 },
    (_, i) => String(currentYear + 1 - i)
  );

  const filtrosListos = !!(fYear && fMake && fModel);

  // Suscripción en tiempo real SOLO para catálogos normales (no vehículos).
  useEffect(() => {
    if (isVehicleCatalog) return;
    const collectionName = `catalog_${catalog.id}`;
    const unsubscribe = onSnapshot(collection(db, collectionName), (snapshot) => {
      const fetchedData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(fetchedData);
    });
    return () => unsubscribe();
  }, [catalog.id, isVehicleCatalog]);

  // Cascada de filtros (solo vehículos): año -> marca.
  useEffect(() => {
    if (!isVehicleCatalog) return;
    setFMake('');
    setFModel('');
    setFBody('');
    setModelOpts([]);
    setBodyOpts([]);
    if (fYear) {
      vehicleCatalogService.getMakes(fYear).then(setMakeOpts).catch(() => setMakeOpts([]));
    } else {
      setMakeOpts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVehicleCatalog, fYear]);

  // Cascada de filtros: marca -> modelo.
  useEffect(() => {
    if (!isVehicleCatalog) return;
    setFModel('');
    setFBody('');
    setBodyOpts([]);
    if (fYear && fMake) {
      vehicleCatalogService.getModels(fYear, fMake).then(setModelOpts).catch(() => setModelOpts([]));
    } else {
      setModelOpts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVehicleCatalog, fMake]);

  // Cascada de filtros: modelo -> body.
  useEffect(() => {
    if (!isVehicleCatalog) return;
    setFBody('');
    if (fYear && fMake && fModel) {
      vehicleCatalogService.getBodies(fYear, fMake, fModel).then(setBodyOpts).catch(() => setBodyOpts([]));
    } else {
      setBodyOpts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVehicleCatalog, fModel]);

  // Cargar resultados SOLO cuando hay año + marca + modelo (body es opcional).
  useEffect(() => {
    if (!isVehicleCatalog) return;
    if (!filtrosListos) {
      setRecords([]);
      return;
    }
    setLoadingVehicles(true);
    vehicleCatalogService.getVehicles(fYear, fMake, fModel, fBody || undefined)
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setLoadingVehicles(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVehicleCatalog, fYear, fMake, fModel, fBody, refreshTick]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const collectionName = `catalog_${catalog.id}`;
      if (currentRecord?.id) {
        await updateDoc(doc(db, collectionName, currentRecord.id), formData);
      } else {
        await addDoc(collection(db, collectionName), { ...formData, createdAt: new Date().toISOString() });
      }
      setModalState('closed');
      // En vehículos no hay listener en vivo: refrescamos la consulta filtrada.
      if (isVehicleCatalog && filtrosListos) setRefreshTick(t => t + 1);
    } catch (error) {
      console.error("Error saving:", error);
      alert("Error saving record.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      await deleteDoc(doc(db, `catalog_${catalog.id}`, id));
      if (isVehicleCatalog && filtrosListos) setRefreshTick(t => t + 1);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

        {/* Header Breadcrumb */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={onBack} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
              <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{catalog.icon} {catalog.title}</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Manage records for {catalog.title.toLowerCase()}</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => { setCurrentRecord(null); setFormData({}); setModalState('form'); }}>
            <Plus size={18} /> New Record
          </button>
        </div>

        {/* Barra de filtros SOLO para el catálogo de vehículos */}
        {isVehicleCatalog && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Seleccione Año, Marca y Modelo para mostrar resultados (el Body es opcional y afina la búsqueda).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Año</label>
                <select className="form-select" value={fYear} onChange={e => setFYear(e.target.value)}>
                  <option value="">Seleccione...</option>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Marca</label>
                <select className="form-select" value={fMake} onChange={e => setFMake(e.target.value)} disabled={!fYear}>
                  <option value="">{fYear ? 'Seleccione...' : 'Elija el año primero'}</option>
                  {makeOpts.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Modelo</label>
                <select className="form-select" value={fModel} onChange={e => setFModel(e.target.value)} disabled={!fMake}>
                  <option value="">{fMake ? 'Seleccione...' : 'Elija la marca primero'}</option>
                  {modelOpts.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Body</label>
                <select className="form-select" value={fBody} onChange={e => setFBody(e.target.value)} disabled={!fModel}>
                  <option value="">{fModel ? 'Todos' : 'Elija el modelo primero'}</option>
                  {bodyOpts.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="pro-table" style={{ border: 'none', borderRadius: 0 }}>
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                {catalog.fields.map(field => <th key={field.name}>{field.label}</th>)}
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isVehicleCatalog && !filtrosListos ? (
                <tr><td colSpan={catalog.fields.length + 2} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                  Seleccione Año, Marca y Modelo en los filtros para ver resultados.
                </td></tr>
              ) : isVehicleCatalog && loadingVehicles ? (
                <tr><td colSpan={catalog.fields.length + 2} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                  Buscando vehículos...
                </td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={catalog.fields.length + 2} style={{ textAlign: 'center', padding: '3rem' }}>No records found</td></tr>
              ) : (
                records.map((record, index) => (
                  <tr key={record.id} onClick={() => { setCurrentRecord(record); setFormData(record); setModalState('detail'); }}>
                    <td style={{ color: 'var(--color-text-muted)' }}>{index + 1}</td>
                    {catalog.fields.map(field => (
                      <td key={field.name}>
                        {/* Lógica de renderizado especial para Color */}
                        {field.type === 'color' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: record[field.name] || '#cccccc', border: '1px solid #E2E8F0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }} />
                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                              {record[field.name] || '-'}
                            </span>
                          </div>
                        ) : field.type === 'number' && isCurrency(field.name) ? (
                          `$${Number(record[field.name] || 0).toFixed(2)}`
                        ) : field.type === 'number' && isPercentage(field.name) ? (
                          `${Number(record[field.name] || 0)}%`
                        ) : (
                          record[field.name] || '-'
                        )}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={(e) => { e.stopPropagation(); setCurrentRecord(record); setFormData(record); setModalState('form'); }}><Edit2 size={16} /></button>
                        <button className="btn btn-danger-light" style={{ padding: '0.4rem' }} onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Simulado HTML */}
        {modalState !== 'closed' && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div className="card animate-in zoom-in-95" style={{ width: '450px', padding: '2rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: '#0F172A' }}>{modalState === 'detail' ? 'View Record' : currentRecord ? 'Edit Record' : 'New Record'}</h3>
                <button onClick={() => setModalState('closed')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}><X size={20} /></button>
              </div>

              {modalState === 'form' ? (
                <form onSubmit={handleSave}>
                  <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '1.2rem' }}>
                    {catalog.fields.map(field => (
                      <div key={field.name} className="form-group">
                        <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                          {field.label} {field.required && <span style={{ color: '#EF4444' }}>*</span>}
                        </label>

                        {/* Control de inputs según el tipo */}
                        {field.type === 'color' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <input
                              type="color"
                              value={formData[field.name] || '#000000'}
                              onChange={e => setFormData({...formData, [field.name]: e.target.value})}
                              style={{ width: '45px', height: '42px', padding: '0', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'transparent' }}
                            />
                            <input
                              type="text"
                              className="form-input"
                              value={formData[field.name] || '#000000'}
                              onChange={e => setFormData({...formData, [field.name]: e.target.value})}
                              placeholder="#000000"
                              style={{ flex: 1, fontFamily: 'monospace', textTransform: 'uppercase' }}
                              required={field.required}
                            />
                          </div>
                        ) : field.type === 'select' ? (
                          <select className="form-select" value={formData[field.name] || ''} onChange={e => setFormData({...formData, [field.name]: e.target.value})} required={field.required}>
                            <option value="">-- Select --</option>
                            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input type={field.type} className="form-input" value={formData[field.name] || ''} onChange={e => setFormData({...formData, [field.name]: e.target.value})} required={field.required} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                    <button type="button" onClick={() => setModalState('closed')} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Record</button>
                  </div>
                </form>
              ) : (
                <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '1.2rem' }}>
                  {catalog.fields.map(field => (
                    <div key={field.name} className="form-group">
                      <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>{field.label}</label>
                      <div style={{ padding: '0.8rem', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                        {field.type === 'color' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: currentRecord?.[field.name] || '#cccccc', border: '1px solid #cbd5e1' }} />
                            <span style={{ fontFamily: 'monospace' }}>{currentRecord?.[field.name] || '-'}</span>
                          </div>
                        ) : (
                          currentRecord?.[field.name] || '-'
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setModalState('form')} className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>Edit Record</button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};