import React, { useState } from 'react';
// ELIMINAMOS la importación de MainLayout, ya no es necesaria aquí
import { BookOpen } from 'lucide-react';
import { catalogsConfig } from '../constants/settingsSchemas';
import type { CatalogSchema } from '../types/settings';
import { CatalogView } from './CatalogView';

export const SettingsPage: React.FC = () => {
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogSchema | null>(null);

  // Usamos un Fragmento (<> ... </>) en lugar de <MainLayout>
  return (
    <>
      {!selectedCatalog ? (
        // VISTA 1: GRID PRINCIPAL DE TARJETAS
        <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <BookOpen size={24} color="var(--color-primary)" /> System Settings
              </h2>
              <p style={{ color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>Manage system catalogs and dynamic parameters.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {catalogsConfig.map((item) => (
                <div 
                  key={item.id} 
                  className="card" 
                  onClick={() => setSelectedCatalog(item)}
                  style={{ cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center', padding: '2rem 1rem' }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                >
                  <div style={{ color: 'var(--color-primary)' }}>{item.icon}</div>
                  <span style={{ fontWeight: 600 }}>{item.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // VISTA 2: DETALLE DEL CATÁLOGO
        <CatalogView 
          catalog={selectedCatalog} 
          onBack={() => setSelectedCatalog(null)} 
        />
      )}
    </>
  );
};