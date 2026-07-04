import React, { useState, useEffect } from 'react';
import { Users, UserPlus, X, Edit2, Trash2 } from 'lucide-react';
// IMPORTANTE: Cambiamos getDocs por onSnapshot para que sea en tiempo real
import { collection, query, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const EquipoTrabajo: React.FC = () => {
  const [miembros, setMiembros] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [companyOptions, setCompanyOptions] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // NUEVO: Estado para prevenir múltiples clics al guardar
  const [isSaving, setIsSaving] = useState(false);

  const [newMember, setNewMember] = useState({
    company: '',
    type: 'Agent',
    firstName: '',
    lastName: '',
    phone: '',
    altPhone: '',
    email: '',
    address: '',
    aftermarket: '',
    recommend: '',
    oem: '',
    insurance: '',
    services: '',
    salary: ''
  });

  // Cargar compañías
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const q = query(collection(db, 'catalog_company'));
        const snapshot = await getDocs(q);
        const options = snapshot.docs.map(doc => doc.data().name || doc.data().value || doc.id);
        setCompanyOptions(options);
      } catch (error) {
        console.error(error);
      }
    };
    loadCompanies();
  }, []);

  // Cargar miembros en TIEMPO REAL (Soluciona el problema de no actualizar al momento)
  useEffect(() => {
    const q = query(collection(db, 'team'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMembers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMiembros(loadedMembers);
    }, (error) => {
      console.error("Error al escuchar cambios en el equipo:", error);
    });

    return () => unsubscribe(); // Limpiamos el listener al desmontar
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewMember({ ...newMember, [e.target.name]: e.target.value });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const cleaned = value.replace(/\D/g, ''); 
    let formatted = cleaned;
    
    if (cleaned.length > 0) {
      if (cleaned.length < 4) {
        formatted = `(${cleaned}`;
      } else if (cleaned.length < 7) {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
      } else {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
      }
    }
    setNewMember({ ...newMember, [name]: formatted });
  };

  const handleTypeChange = (typeStr: string) => {
    setNewMember({ ...newMember, type: typeStr });
  };

  const handleSaveMember = async () => {
    if (!newMember.firstName.trim() || !newMember.lastName.trim()) {
      alert("Por favor, ingresa al menos el First Name y Last Name.");
      return;
    }

    if (isSaving) return; // Si ya está guardando, ignorar clics adicionales
    setIsSaving(true); // Bloquear botón

    const payloadToSave: any = { ...newMember };
    
    if (payloadToSave.type !== 'Agent') {
      delete payloadToSave.aftermarket;
      delete payloadToSave.recommend;
      delete payloadToSave.oem;
      delete payloadToSave.insurance;
      delete payloadToSave.services;
    }
    if (payloadToSave.type !== 'Tech') {
      delete payloadToSave.salary;
    }

    try {
      if (editingId) {
        const memberRef = doc(db, 'team', editingId);
        await updateDoc(memberRef, payloadToSave);
        // onSnapshot actualizará la UI automáticamente
      } else {
        await addDoc(collection(db, 'team'), payloadToSave);
        // onSnapshot actualizará la UI automáticamente
      }
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Hubo un error al guardar el miembro.");
    } finally {
      setIsSaving(false); // Desbloquear botón pase lo que pase
    }
  };

  const handleEditClick = (miembro: any) => {
    setEditingId(miembro.id);
    setNewMember({
      company: miembro.company || '',
      type: miembro.type || 'Agent',
      firstName: miembro.firstName || '',
      lastName: miembro.lastName || '',
      phone: miembro.phone || '',
      altPhone: miembro.altPhone || '',
      email: miembro.email || '',
      address: miembro.address || '',
      aftermarket: miembro.aftermarket || '',
      recommend: miembro.recommend || '',
      oem: miembro.oem || '',
      insurance: miembro.insurance || '',
      services: miembro.services || '',
      salary: miembro.salary || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este miembro del equipo?")) {
      try {
        await deleteDoc(doc(db, 'team', id));
        // Ya no necesitamos actualizar manualmente con filter, onSnapshot se encarga
      } catch (error) {
        console.error(error);
        alert("Hubo un error al eliminar el miembro.");
      }
    }
  };

  const openNewModal = () => {
    setEditingId(null);
    setNewMember({ company: '', type: 'Agent', firstName: '', lastName: '', phone: '', altPhone: '', email: '', address: '', aftermarket: '', recommend: '', oem: '', insurance: '', services: '', salary: '' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setIsSaving(false);
    setNewMember({ company: '', type: 'Agent', firstName: '', lastName: '', phone: '', altPhone: '', email: '', address: '', aftermarket: '', recommend: '', oem: '', insurance: '', services: '', salary: '' });
  };

  const renderCurrencyInput = (name: string, label: string, value: string) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>{label}</label>
      <div style={{ position: 'relative', width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'white' }}>
        <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontWeight: 600 }}>$</span>
        <input 
          type="number" 
          name={name} 
          value={value} 
          onChange={handleInputChange} 
          placeholder="0.00"
          step="0.01"
          style={{ width: '100%', padding: '0.7rem 1rem 0.7rem 2rem', border: 'none', outline: 'none', fontSize: '0.95rem', color: '#0F172A', boxSizing: 'border-box' }} 
        />
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in" style={{ padding: '2rem 2.5rem', flex: 1, display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', backgroundColor: '#F1F5F9' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Users size={28} color="#0F172A" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0F172A', fontWeight: 800 }}>Equipo de Trabajo</h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '0.95rem' }}>Gestión de agentes, distribuidores y técnicos del sistema.</p>
          </div>
        </div>
        
        <button 
          className="btn btn-primary" 
          onClick={openNewModal}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#0F172A', color: 'white', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
        >
          <UserPlus size={18} /> Añadir Miembro
        </button>
      </header>

      <div className="card" style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
              <tr>
                <th style={{ padding: '1.2rem 1.5rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre Completo</th>
                <th style={{ padding: '1.2rem 1.5rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rol / Tipo</th>
                <th style={{ padding: '1.2rem 1.5rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Compañía</th>
                <th style={{ padding: '1.2rem 1.5rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contacto</th>
                <th style={{ padding: '1.2rem 1.5rem', color: '#475569', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {miembros.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '6rem 2rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <Users size={56} color="#CBD5E1" strokeWidth={1.5} />
                      <div>
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#475569', fontSize: '1.15rem', fontWeight: 600 }}>No hay miembros registrados</h3>
                        <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.95rem' }}>Haz clic en "Añadir Miembro" para comenzar.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                miembros.map((miembro) => (
                  <tr key={miembro.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#F8FAFC'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '1rem 1.5rem', color: '#0F172A', fontWeight: 600, fontSize: '0.9rem' }}>
                      {miembro.firstName} {miembro.lastName}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: '#475569', fontSize: '0.9rem' }}>
                      <span style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.3rem 0.6rem', borderRadius: '6px', fontWeight: 500 }}>
                        {miembro.type}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: '#475569', fontSize: '0.9rem' }}>
                      {miembro.company || '-'}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: '#475569', fontSize: '0.9rem' }}>
                      {miembro.phone || miembro.email || '-'}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button 
                          onClick={() => handleEditClick(miembro)}
                          style={{ padding: '0.4rem', background: 'white', border: '1px solid #E2E8F0', color: '#475569', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(miembro.id)}
                          style={{ padding: '0.4rem', background: '#FEF2F2', border: '1px solid #FEE2E2', color: '#EF4444', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="animate-in zoom-in-95" style={{ width: '90%', maxWidth: '1000px', maxHeight: '90vh', backgroundColor: 'white', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0F172A' }}>
                {editingId ? 'Editar Miembro' : 'Nuevo Miembro'}
              </h3>
              <button onClick={closeModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', padding: 0 }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '2rem', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
              
              {/* Type reubicado al inicio y ocupando todo el ancho de la primera fila */}
              <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                <label style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Type</label>
                <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <button 
                    type="button"
                    onClick={() => handleTypeChange('Distributor')}
                    style={{ flex: 1, padding: '0.7rem 0', border: 'none', borderRight: '1px solid #E2E8F0', backgroundColor: newMember.type === 'Distributor' ? '#0F172A' : 'white', fontWeight: 600, color: newMember.type === 'Distributor' ? 'white' : '#475569', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}
                  >
                    Distributor
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleTypeChange('Agent')}
                    style={{ flex: 1, padding: '0.7rem 0', border: 'none', borderRight: '1px solid #E2E8F0', backgroundColor: newMember.type === 'Agent' ? '#0F172A' : 'white', fontWeight: 600, color: newMember.type === 'Agent' ? 'white' : '#475569', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}
                  >
                    Agent
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleTypeChange('Tech')}
                    style={{ flex: 1, padding: '0.7rem 0', border: 'none', backgroundColor: newMember.type === 'Tech' ? '#0F172A' : 'white', fontWeight: 600, color: newMember.type === 'Tech' ? 'white' : '#475569', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}
                  >
                    Tech
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>First Name</label>
                <input type="text" name="firstName" value={newMember.firstName} onChange={handleInputChange} style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none', boxSizing: 'border-box', fontSize: '0.95rem', color: '#0F172A' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Last Name</label>
                <input type="text" name="lastName" value={newMember.lastName} onChange={handleInputChange} style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none', boxSizing: 'border-box', fontSize: '0.95rem', color: '#0F172A' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Email</label>
                <input type="email" name="email" value={newMember.email} onChange={handleInputChange} style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none', boxSizing: 'border-box', fontSize: '0.95rem', color: '#0F172A' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Phone</label>
                <input type="tel" name="phone" value={newMember.phone} onChange={handlePhoneChange} maxLength={14} style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none', boxSizing: 'border-box', fontSize: '0.95rem', color: '#0F172A' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Alternative Phone</label>
                <input type="tel" name="altPhone" value={newMember.altPhone} onChange={handlePhoneChange} maxLength={14} style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none', boxSizing: 'border-box', fontSize: '0.95rem', color: '#0F172A' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Company</label>
                <select name="company" value={newMember.company} onChange={handleInputChange} style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none', color: '#0F172A', backgroundColor: 'white', fontSize: '0.95rem' }}>
                  <option value=""></option>
                  {companyOptions.map((comp, idx) => (
                    <option key={idx} value={comp}>{comp}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 3' }}>
                <label style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Address</label>
                <input type="text" name="address" value={newMember.address} onChange={handleInputChange} style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none', boxSizing: 'border-box', fontSize: '0.95rem', color: '#0F172A' }} />
              </div>

              {newMember.type === 'Agent' && (
                <>
                  <div style={{ gridColumn: '1 / -1', height: '1px', backgroundColor: '#E2E8F0', margin: '0.5rem 0' }} />
                  <h4 style={{ gridColumn: '1 / -1', margin: 0, color: '#0F172A', fontSize: '1rem', fontWeight: 600 }}>Configuración de Comisiones</h4>
                  {renderCurrencyInput('aftermarket', 'Aftermarket', newMember.aftermarket)}
                  {renderCurrencyInput('recommend', 'Recommend', newMember.recommend)}
                  {renderCurrencyInput('oem', 'OEM', newMember.oem)}
                  {renderCurrencyInput('insurance', 'Insurance', newMember.insurance)}
                  {renderCurrencyInput('services', 'Services', newMember.services)}
                </>
              )}

              {newMember.type === 'Tech' && (
                <>
                  <div style={{ gridColumn: '1 / -1', height: '1px', backgroundColor: '#E2E8F0', margin: '0.5rem 0' }} />
                  <h4 style={{ gridColumn: '1 / -1', margin: 0, color: '#0F172A', fontSize: '1rem', fontWeight: 600 }}>Configuración Salarial</h4>
                  {renderCurrencyInput('salary', 'Salary', newMember.salary)}
                </>
              )}

            </div>

            <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: '#ffffff' }}>
              <button 
                onClick={closeModal} 
                style={{ padding: '0.6rem 1.5rem', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveMember}
                disabled={isSaving}
                style={{ padding: '0.6rem 1.5rem', backgroundColor: '#0F172A', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '0.9rem', opacity: isSaving ? 0.7 : 1 }}
              >
                {isSaving ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Guardar Miembro')}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default EquipoTrabajo;