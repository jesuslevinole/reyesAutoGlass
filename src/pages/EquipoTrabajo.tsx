import React, { useState } from 'react';
import { Users, UserPlus, Pencil, Trash2, X, Save, Building, Phone, Mail, MapPin, Briefcase, Settings } from 'lucide-react';

// --- TIPOS ---
export interface MiembroEquipo {
  id: string;
  company: string;
  type: 'Agent' | 'Distributor' | 'Tech' | '';
  firstName: string;
  lastName: string;
  phone: string;
  altPhone: string;
  email: string;
  address: string;
}

export const EquipoTrabajo = () => {
  // Estado local para almacenar la lista (luego puedes pasarlo a tu AppContext o Firebase)
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  
  // Estados para el Modal y Formulario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  
  const estadoInicialFormulario: MiembroEquipo = {
    id: '',
    company: '',
    type: '',
    firstName: '',
    lastName: '',
    phone: '',
    altPhone: '',
    email: '',
    address: ''
  };
  
  const [formData, setFormData] = useState<MiembroEquipo>(estadoInicialFormulario);

  // --- MANEJADORES ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const abrirModalNuevo = () => {
    setFormData(estadoInicialFormulario);
    setEditandoId(null);
    setIsModalOpen(true);
  };

  const abrirModalEditar = (miembro: MiembroEquipo) => {
    setFormData(miembro);
    setEditandoId(miembro.id);
    setIsModalOpen(true);
  };

  const cerrarModal = () => {
    setIsModalOpen(false);
    setEditandoId(null);
    setFormData(estadoInicialFormulario);
  };

  const guardarMiembro = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación básica
    if (!formData.firstName || !formData.lastName || !formData.type) {
      alert("Por favor, complete los campos obligatorios (Nombre, Apellido y Tipo).");
      return;
    }

    if (editandoId) {
      setEquipo(prev => prev.map(m => m.id === editandoId ? { ...formData } : m));
    } else {
      setEquipo(prev => [...prev, { ...formData, id: crypto.randomUUID() }]);
    }
    
    cerrarModal();
  };

  const eliminarMiembro = (id: string) => {
    if (window.confirm("¿Está seguro de eliminar a este miembro del equipo?")) {
      setEquipo(prev => prev.filter(m => m.id !== id));
    }
  };

  return (
    <div className="animate-in fade-in" style={{ padding: '2.5rem', flex: 1, overflowY: 'auto', backgroundColor: '#F1F5F9' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* ENCABEZADO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.8rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <Users size={28} color="var(--color-primary, #1d8cf8)" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#1E293B', letterSpacing: '-0.025em' }}>
                Equipo de Trabajo
              </h2>
              <p style={{ color: '#64748B', marginTop: '0.2rem', fontSize: '0.95rem' }}>
                Gestión de agentes, distribuidores y técnicos del sistema.
              </p>
            </div>
          </div>
          
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={abrirModalNuevo}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600, boxShadow: '0 4px 6px -1px rgba(29, 140, 248, 0.3)' }}
          >
            <UserPlus size={18} /> Añadir Miembro
          </button>
        </div>

        {/* TABLA DE EQUIPO */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: 'white' }}>
              <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <tr>
                  <th style={{ padding: '1rem 1.5rem', color: '#475569', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' }}>Nombre Completo</th>
                  <th style={{ padding: '1rem 1.5rem', color: '#475569', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' }}>Rol / Tipo</th>
                  <th style={{ padding: '1rem 1.5rem', color: '#475569', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' }}>Compañía</th>
                  <th style={{ padding: '1rem 1.5rem', color: '#475569', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' }}>Contacto</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'right', color: '#475569', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {equipo.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748B' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <Users size={48} color="#CBD5E1" />
                        <p style={{ fontSize: '1.1rem', margin: 0 }}>No hay miembros registrados</p>
                        <span style={{ fontSize: '0.9rem' }}>Haz clic en "Añadir Miembro" para comenzar.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  equipo.map((miembro) => (
                    <tr key={miembro.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#F8FAFC'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ fontWeight: 700, color: '#1E293B' }}>{miembro.firstName} {miembro.lastName}</div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                          backgroundColor: miembro.type === 'Tech' ? '#DBEAFE' : miembro.type === 'Agent' ? '#FEF9C3' : '#F3E8FF',
                          color: miembro.type === 'Tech' ? '#1E40AF' : miembro.type === 'Agent' ? '#854D0E' : '#6B21A8'
                        }}>
                          {miembro.type === 'Tech' ? <Settings size={12} /> : miembro.type === 'Agent' ? <Briefcase size={12} /> : <Building size={12} />}
                          {miembro.type || 'No definido'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: '#475569', fontSize: '0.9rem' }}>
                        {miembro.company || <span style={{ fontStyle: 'italic', color: '#94A3B8' }}>Independiente</span>}
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
                          {miembro.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569' }}><Phone size={12} /> {miembro.phone}</div>}
                          {miembro.email && <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569' }}><Mail size={12} /> {miembro.email}</div>}
                          {!miembro.phone && !miembro.email && <span style={{ fontStyle: 'italic', color: '#94A3B8' }}>Sin datos</span>}
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => abrirModalEditar(miembro)} style={{ background: 'white', border: '1px solid #E2E8F0', color: 'var(--color-primary, #1d8cf8)', cursor: 'pointer', padding: '0.5rem', borderRadius: '6px', marginRight: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => eliminarMiembro(miembro.id)} style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', color: '#DC2626', cursor: 'pointer', padding: '0.5rem', borderRadius: '6px' }} title="Eliminar">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL FORMULARIO */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card animate-in zoom-in-95" style={{ width: '90%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <UserPlus size={22} color="var(--color-primary, #1d8cf8)" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1E293B' }}>
                  {editandoId ? 'Editar Miembro del Equipo' : 'Nuevo Miembro del Equipo'}
                </h3>
              </div>
              <button onClick={cerrarModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0.4rem', borderRadius: '50%', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#E2E8F0'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={guardarMiembro} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '2rem', overflowY: 'auto' }}>
                
                <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                  Información Profesional
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Briefcase size={14} /> Rol / Tipo <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <select className="form-control" name="type" value={formData.type} onChange={handleChange} required style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.7rem', width: '100%' }}>
                      <option value="" disabled>Seleccione un tipo...</option>
                      <option value="Agent">Agent (Agente)</option>
                      <option value="Distributor">Distributor (Distribuidor)</option>
                      <option value="Tech">Tech (Técnico)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Building size={14} /> Company (Compañía)
                    </label>
                    <input type="text" className="form-control" name="company" value={formData.company} onChange={handleChange} placeholder="Nombre de la empresa..." style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.7rem', width: '100%' }} />
                  </div>
                </div>

                <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                  Datos Personales y Contacto
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">First Name (Nombre) <span style={{ color: '#DC2626' }}>*</span></label>
                    <input type="text" className="form-control" name="firstName" value={formData.firstName} onChange={handleChange} required placeholder="Ej. Juan" style={{ borderRadius: '8px', padding: '0.7rem', width: '100%', border: '1px solid #CBD5E1' }} />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Last Name (Apellido) <span style={{ color: '#DC2626' }}>*</span></label>
                    <input type="text" className="form-control" name="lastName" value={formData.lastName} onChange={handleChange} required placeholder="Ej. Pérez" style={{ borderRadius: '8px', padding: '0.7rem', width: '100%', border: '1px solid #CBD5E1' }} />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Phone size={14} /> Phone (Teléfono Principal)
                    </label>
                    <input type="tel" className="form-control" name="phone" value={formData.phone} onChange={handleChange} placeholder="(000) 000-0000" style={{ borderRadius: '8px', padding: '0.7rem', width: '100%', border: '1px solid #CBD5E1' }} />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Phone size={14} /> Alternative Phone
                    </label>
                    <input type="tel" className="form-control" name="altPhone" value={formData.altPhone} onChange={handleChange} placeholder="(000) 000-0000" style={{ borderRadius: '8px', padding: '0.7rem', width: '100%', border: '1px solid #CBD5E1' }} />
                  </div>

                  <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Mail size={14} /> Email Address
                    </label>
                    <input type="email" className="form-control" name="email" value={formData.email} onChange={handleChange} placeholder="correo@ejemplo.com" style={{ borderRadius: '8px', padding: '0.7rem', width: '100%', border: '1px solid #CBD5E1' }} />
                  </div>

                  <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MapPin size={14} /> Physical Address (Dirección Física)
                    </label>
                    <input type="text" className="form-control" name="address" value={formData.address} onChange={handleChange} placeholder="Avenida principal, Ciudad, Estado, Zip..." style={{ borderRadius: '8px', padding: '0.7rem', width: '100%', border: '1px solid #CBD5E1' }} />
                  </div>
                </div>

              </div>

              <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: '#F8FAFC' }}>
                <button type="button" className="btn btn-secondary" onClick={cerrarModal} style={{ padding: '0.6rem 1.5rem', backgroundColor: 'white', border: '1px solid #CBD5E1', color: '#475569', fontWeight: 600 }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem', boxShadow: '0 4px 6px -1px rgba(29, 140, 248, 0.3)', fontWeight: 600 }}>
                  <Save size={18} /> {editandoId ? 'Guardar Cambios' : 'Registrar Miembro'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};