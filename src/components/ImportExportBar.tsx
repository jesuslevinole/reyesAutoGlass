import { useRef, useState } from 'react';
import { FileDown, FileUp, Loader2 } from 'lucide-react';
import type { ModuleDef } from '../config/modules';
import type { Row } from '../services/firestore';
import { createMany } from '../services/firestore';
import { csvToObjects, parseCsv } from '../utils/csv';
import { downloadExcelTemplate } from '../utils/excel';
import './ImportExportBar.css';

interface Props {
  module: ModuleDef;
  rows: Row[];
}

/** Convierte el texto crudo del CSV al tipo correcto según la definición del campo. */
function makeConverter(module: ModuleDef) {
  return (key: string, raw: string): unknown => {
    const field = module.fields.find((f) => f.key === key);
    if (!field) return raw;
    switch (field.type) {
      case 'int': return raw === '' ? null : parseInt(raw, 10);
      case 'decimal':
      case 'percent': return raw === '' ? null : parseFloat(raw.replace(/[$%,\s]/g, ''));
      case 'boolean': return /^(true|1|sí|si|yes|y)$/i.test(raw);
      case 'fkList': return raw === '' ? [] : raw.split(/\s*,\s*/).filter(Boolean);
      default: return raw;
    }
  };
}

export default function ImportExportBar({ module, rows }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadExcelTemplate(module, rows);
    } finally {
      setExporting(false);
    }
  };

  const handleFile = async (file: File) => {
    setImporting(true);
    setMessage('');
    try {
      const text = await file.text();
      const objects = csvToObjects(parseCsv(text), makeConverter(module));
      if (objects.length === 0) {
        setMessage('El CSV no tiene filas de datos.');
        return;
      }
      const count = await createMany(module.collection, objects);
      setMessage(`${count} registros importados.`);
    } catch (err) {
      setMessage(`Error al importar: ${err instanceof Error ? err.message : 'archivo inválido'}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="import-export-bar">
      <button className="btn-outline" onClick={() => void handleExport()} disabled={exporting}>
        {exporting ? <Loader2 size={15} className="spin" /> : <FileDown size={15} />}
        Export Excel template
      </button>
      <button className="btn-outline" onClick={() => fileRef.current?.click()} disabled={importing}>
        {importing ? <Loader2 size={15} className="spin" /> : <FileUp size={15} />}
        Import CSV
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="import-file-input"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
      />
      {message && <span className="import-message">{message}</span>}
    </div>
  );
}
