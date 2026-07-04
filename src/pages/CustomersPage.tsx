import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Users, Plus, Edit2, Trash2, X, Search, Phone, Mail, MapPin } from 'lucide-react';
import { db } from '../firebase';
import type { CustomerData } from '../types/customer';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<CustomerData | null>(null);
  const [formData, setFormData] = useState<CustomerData>({
    firstName: '', lastName: '', phone: '', altPhone: '', email: '', address: ''
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const fetchedData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerData));
      setCustomers(fetchedData);
    });
    return () => unsubscribe();
  }, []);

  const filteredCustomers = customers.filter(c => 
    `${c.firstName} ${c.lastName} ${c.phone} ${c.email}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentCustomer?.id) {
        await updateDoc(doc(db, 'customers', currentCustomer.id), { ...formData });
      } else {
        const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = new Date().toLocaleDateString('es-ES', dateOptions);
        await addDoc(collection(db, 'customers'), { ...formData, createdAt: formattedDate });
      }
      setIsModalOpen(false);
    } catch (error) {
      alert("Error al guardar el cliente.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este cliente?')) {
      await deleteDoc(doc(db, 'customers', id));
    }
  };

  const openModal = (customer?: CustomerData) => {
    if (customer) {
      setCurrentCustomer(customer);
      setFormData(customer);
    } else {
      setCurrentCustomer(null);
      setFormData({ firstName: '', lastName: '', phone: '', altPhone: '', email: '', address: '' });
    }
    setIsModalOpen(true);
  };

  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Users size={24} color="var(--color-primary)" /> Directorio de Clientes
              </h2>
              <p style={{ color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>
                Gestione la información de contacto de sus clientes.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => openModal()}>
              <Plus size={18} /> Nuevo Cliente
            </button>
          </div>

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', backgroundColor: '#F8FAFC' }}>
              <div className="input-group" style={{ maxWidth: '400px' }}>
                <span className="input-addon-btn" style={{ borderRight: 'none', backgroundColor: 'white' }}><Search size={18} /></span>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Buscar por nombre, teléfono o correo..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ borderLeft: 'none' }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="pro-table" style={{ border: 'none', borderRadius: 0 }}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Contacto Principal</th>
                    <th>Dirección</th>
                    <th>Registro</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>No se encontraron clientes.</td></tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr key={customer.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{customer.firstName} {customer.lastName}</div>
                          {customer.email && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}><Mail size={12}/> {customer.email}</div>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={14} color="var(--color-text-muted)" /> {customer.phone}</div>
                          {customer.altPhone && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Alt: {customer.altPhone}</div>}
                        </td>
                        <td>
                          {customer.address ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}><MapPin size={14} color="var(--color-text-muted)"/> {customer.address}</div>
                          ) : '-'}
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                          {customer.createdAt || '-'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={() => openModal(customer)}><Edit2 size={16} /></button>
                            <button className="btn btn-danger-light" style={{ padding: '0.4rem' }} onClick={() => customer.id && handleDelete(customer.id)}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '90%', maxWidth: '600px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <h3 style={{ margin: 0 }}>{currentCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ padding: '1.5rem' }}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input type="text" className="form-input" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input type="text" className="form-input" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input type="tel" className="form-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alternative Phone</label>
                    <input type="tel" className="form-input" value={formData.altPhone} onChange={e => setFormData({...formData, altPhone: e.target.value})} />
                  </div>
                  <div className="form-group form-grid-full">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="form-group form-grid-full">
                    <label className="form-label">Address</label>
                    <input type="text" className="form-input" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                  </div>
                </div>
              </div>

              <div style={{ padding: '1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: '#F8FAFC' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cliente</button>
              </div>
            </form>

          </div>
        </div>
      )}
    </>
  );
};