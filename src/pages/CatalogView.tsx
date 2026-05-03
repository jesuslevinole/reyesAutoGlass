import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ChevronRight, Plus, Edit2, Trash2, X } from 'lucide-react';
import { db } from '../firebase'; // Importación basada en tu imagen
import type { CatalogSchema } from '../types/settings';
import { isCurrency, isPercentage } from '../constants/settingsSchemas';

interface Props {
  catalog: CatalogSchema;
  onBack: () => void;
}

export const CatalogView: React.FC<Props> = ({ catalog, onBack }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [modalState, setModalState] = useState<'closed' | 'form' | 'detail'>('closed');
  const [currentRecord, setCurrentRecord] = useState<any | null>(null);
  const [formData, setFormData] = useState<any>({});

  // Suscripción a Firebase
  useEffect(() => {
    const collectionName = `catalog_${catalog.id}`;
    const unsubscribe = onSnapshot(collection(db, collectionName), (snapshot) => {
      const fetchedData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(fetchedData);
    });
    return () => unsubscribe();
  }, [catalog.id]);

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
    } catch (error) {
      console.error("Error saving:", error);
      alert("Error saving record.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      await deleteDoc(doc(db, `catalog_${catalog.id}`, id));
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
              {records.length === 0 ? (
                <tr><td colSpan={catalog.fields.length + 2} style={{ textAlign: 'center', padding: '3rem' }}>No records found</td></tr>
              ) : (
                records.map((record, index) => (
                  <tr key={record.id} onClick={() => { setCurrentRecord(record); setFormData(record); setModalState('detail'); }}>
                    <td style={{ color: 'var(--color-text-muted)' }}>{index + 1}</td>
                    {catalog.fields.map(field => (
                      <td key={field.name}>
                        {field.type === 'number' && isCurrency(field.name) ? `$${Number(record[field.name] || 0).toFixed(2)}` 
                        : field.type === 'number' && isPercentage(field.name) ? `${Number(record[field.name] || 0)}%` 
                        : record[field.name] || '-'}
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
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ width: '450px', padding: '2rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3>{modalState === 'detail' ? 'View Record' : currentRecord ? 'Edit Record' : 'New Record'}</h3>
                <button onClick={() => setModalState('closed')} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              {modalState === 'form' ? (
                <form onSubmit={handleSave}>
                  <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    {catalog.fields.map(field => (
                      <div key={field.name} className="form-group">
                        <label className="form-label">{field.label} {field.required && '*'}</label>
                        {field.type === 'select' ? (
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
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '2rem' }}>Save Record</button>
                </form>
              ) : (
                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                  {catalog.fields.map(field => (
                    <div key={field.name} className="form-group">
                      <label className="form-label">{field.label}</label>
                      <div style={{ padding: '0.8rem', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                        {currentRecord?.[field.name] || '-'}
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