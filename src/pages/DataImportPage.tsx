import React, { useState } from 'react';
import { FileSpreadsheet, UploadCloud, Download, RefreshCw } from 'lucide-react';
import { DataTemplateGenerator } from '../components/data-import/DataTemplateGenerator';
import { DataImportView } from '../components/data-import/DataImportView';
import { DataExportView } from '../components/data-import/DataExportView';
import DataUpdateView from '../components/data-import/DataUpdateView';

type Tab = 'templates' | 'import' | 'export' | 'update';

interface Props {
  /** Se llama cuando una importación crea/actualiza órdenes (para refrescar listas). */
  onImported?: () => void;
}

export const DataImportPage: React.FC<Props> = ({ onImported }) => {
  const [tab, setTab] = useState<Tab>('templates');

  const tabBtn = (id: Tab, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setTab(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.6rem 1.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer',
        fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s',
        backgroundColor: tab === id ? 'white' : 'transparent',
        color: tab === id ? '#0F172A' : '#64748B',
        boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
      }}
    >
      {icon} {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', flex: 1, minHeight: 0, backgroundColor: '#F1F5F9', boxSizing: 'border-box' }}>
      {/* Control segmentado (Plantillas / Importar / Exportar) */}
      <div style={{ padding: '1.5rem 2.5rem 0 2.5rem', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <div className="segmented-control" style={{ backgroundColor: '#E2E8F0', padding: '4px', borderRadius: '10px', display: 'flex', gap: '4px' }}>
          {tabBtn('templates', 'Plantillas', <FileSpreadsheet size={18} />)}
          {tabBtn('import', 'Importar', <UploadCloud size={18} />)}
          {tabBtn('export', 'Exportar', <Download size={18} />)}
          {tabBtn('update', 'Actualizar', <RefreshCw size={18} />)}
        </div>
      </div>

      {/* Área acotada; cada vista maneja su propio scroll interno */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === 'templates' && <DataTemplateGenerator />}
        {tab === 'import' && <DataImportView onImported={onImported} />}
        {tab === 'export' && <DataExportView />}
        {tab === 'update' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <DataUpdateView />
          </div>
        )}
      </div>
    </div>
  );
};