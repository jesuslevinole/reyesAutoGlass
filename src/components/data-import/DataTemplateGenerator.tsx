import React, { useState } from 'react';
import { Download, FileSpreadsheet, Info, Table2, ListChecks, KeyRound } from 'lucide-react';
import {
  IMPORT_SCHEMAS,
  type CollectionSchema,
  type FieldSchema,
} from '../../config/workOrderSchemas';

// ---------------------------------------------------------------------------
//  Utilidades CSV (sin dependencias externas)
// ---------------------------------------------------------------------------

// Escapa un valor para CSV (comillas, comas y saltos de línea).
const csvCell = (value: unknown): string => {
  const s = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
};

// Valor de ejemplo formateado por tipo (para la fila de muestra).
const exampleValue = (f: FieldSchema): string => {
  if (f.example !== undefined) {
    if (f.type === 'boolean') return f.example ? 'TRUE' : 'FALSE';
    return String(f.example);
  }
  return '';
};

// Construye el contenido CSV de una colección.
// includeExample: agrega una fila de muestra (marcada para borrar).
const buildCsv = (schema: CollectionSchema, includeExample: boolean): string => {
  const headers = schema.fields.map((f) => f.key);
  const lines: string[] = [];
  lines.push(headers.map(csvCell).join(','));
  if (includeExample) {
    const row = schema.fields.map((f) => csvCell(exampleValue(f)));
    lines.push(row.join(','));
  }
  // BOM para que Excel abra los acentos correctamente.
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
};

// Dispara la descarga de un archivo de texto en el navegador.
const downloadText = (filename: string, content: string, mime = 'text/csv;charset=utf-8;') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Diccionario de campos en CSV (referencia: key, label, tipo, requerido, ejemplo).
const buildDictionaryCsv = (schema: CollectionSchema): string => {
  const header = ['campo', 'etiqueta', 'tipo', 'requerido', 'valores_permitidos', 'ejemplo', 'nota'];
  const lines = [header.map(csvCell).join(',')];
  for (const f of schema.fields) {
    lines.push(
      [
        f.key,
        f.label,
        f.type,
        f.required ? 'SÍ' : 'no',
        f.enumValues ? f.enumValues.join(' | ') : '',
        exampleValue(f),
        f.note || '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
};

// ---------------------------------------------------------------------------
//  Estilos reutilizables (paleta slate/blue del proyecto)
// ---------------------------------------------------------------------------
const typeBadge: Record<string, { bg: string; color: string }> = {
  string: { bg: '#F1F5F9', color: '#475569' },
  number: { bg: '#ECFDF5', color: '#047857' },
  boolean: { bg: '#FEF3C7', color: '#92400E' },
  date: { bg: '#EFF6FF', color: '#1D4ED8' },
  time: { bg: '#EEF2FF', color: '#4338CA' },
  enum: { bg: '#F5F3FF', color: '#6D28D9' },
};

// ---------------------------------------------------------------------------
//  Componente principal
// ---------------------------------------------------------------------------
export const DataTemplateGenerator: React.FC = () => {
  const [openKey, setOpenKey] = useState<string | null>(IMPORT_SCHEMAS[0]?.collection ?? null);

  const handleDownloadTemplate = (schema: CollectionSchema, withExample: boolean) => {
    const suffix = withExample ? 'con_ejemplo' : 'vacia';
    downloadText(`plantilla_${schema.collection}_${suffix}.csv`, buildCsv(schema, withExample));
  };

  const handleDownloadDictionary = (schema: CollectionSchema) => {
    downloadText(`diccionario_${schema.collection}.csv`, buildDictionaryCsv(schema));
  };

  const handleDownloadAll = () => {
    // Descarga una plantilla con ejemplo por cada colección.
    IMPORT_SCHEMAS.forEach((schema, i) => {
      // Pequeño desfase para que el navegador no bloquee descargas múltiples.
      setTimeout(() => handleDownloadTemplate(schema, true), i * 250);
    });
  };

  return (
    <div className="animate-in fade-in" style={{ padding: '2rem 2.5rem', flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box' }}>
      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px', width: '100%' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#0F172A', fontWeight: 800 }}>Generador de Plantillas</h1>
          <p style={{ margin: '2px 0 0 0', color: '#64748B', fontSize: '0.85rem' }}>Descarga las plantillas CSV, llénalas con los datos de AppSheet y luego impórtalas.</p>
        </div>
        <button
          onClick={handleDownloadAll}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: '8px', border: 'none', backgroundColor: '#0F172A', color: 'white', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
        >
          <Download size={16} /> Descargar todas
        </button>
      </header>

      {/* PANEL DE INSTRUCCIONES */}
      <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Info size={18} color="#1D4ED8" />
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1E3A8A' }}>Cómo mapear los datos de AppSheet</h3>
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#1E40AF', fontSize: '0.85rem', lineHeight: 1.7 }}>
          <li>La <strong>primera fila</strong> del CSV son los nombres exactos de los campos en Firestore. No la modifiques.</li>
          <li>Fechas en formato <strong>YYYY-MM-DD</strong> (ej. 2026-01-15). Horas en <strong>HH:MM</strong> (ej. 09:00).</li>
          <li>Valores booleanos como <strong>TRUE</strong> / <strong>FALSE</strong>. Montos como número sin símbolo <strong>$</strong> ni comas de miles.</li>
          <li>El <strong>detalle</strong> se enlaza con el encabezado por la columna <strong>workOrderId</strong> = <strong>id</strong> de la orden.</li>
          <li>Borra la fila de ejemplo antes de importar (o descarga la plantilla vacía).</li>
        </ul>
      </div>

      {/* TARJETAS POR COLECCIÓN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {IMPORT_SCHEMAS.map((schema) => {
          const isOpen = openKey === schema.collection;
          const requiredCount = schema.fields.filter((f) => f.required).length;
          return (
            <div key={schema.collection} style={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {/* Cabecera de la tarjeta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', padding: '1.25rem 1.5rem', borderBottom: isOpen ? '1px solid #E2E8F0' : 'none', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start' }}>
                  <div style={{ padding: '0.6rem', backgroundColor: '#EFF6FF', borderRadius: '10px', color: '#2563EB', display: 'flex' }}>
                    <FileSpreadsheet size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      {schema.label}
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600, color: '#64748B', backgroundColor: '#F1F5F9', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>{schema.collection}</span>
                    </h3>
                    <p style={{ margin: '0.3rem 0 0 0', color: '#64748B', fontSize: '0.82rem', maxWidth: '640px' }}>{schema.description}</p>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}><Table2 size={14} /> {schema.fields.length} campos</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}><ListChecks size={14} /> {requiredCount} obligatorios</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}><KeyRound size={14} /> ID: {schema.idStrategy === 'field-id' ? 'campo "id"' : 'automático'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleDownloadTemplate(schema, true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563EB', color: 'white', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    <Download size={15} /> CSV con ejemplo
                  </button>
                  <button
                    onClick={() => handleDownloadTemplate(schema, false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#334155', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    <Download size={15} /> Vacía
                  </button>
                  <button
                    onClick={() => handleDownloadDictionary(schema)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#334155', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    Diccionario
                  </button>
                </div>
              </div>

              {/* Botón para expandir/colapsar el detalle de campos */}
              <button
                onClick={() => setOpenKey(isOpen ? null : schema.collection)}
                style={{ width: '100%', textAlign: 'left', padding: isOpen ? '0.9rem 1.5rem 0.4rem' : '0', border: 'none', background: 'transparent', color: '#2563EB', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
              >
                {isOpen ? '▾ Ocultar campos' : ''}
              </button>

              {/* Tabla de campos */}
              {isOpen && (
                <div style={{ padding: '0.5rem 1.5rem 1.5rem', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#64748B' }}>
                        <th style={{ padding: '0.5rem 0.6rem', borderBottom: '2px solid #E2E8F0', fontWeight: 700 }}>Campo (CSV)</th>
                        <th style={{ padding: '0.5rem 0.6rem', borderBottom: '2px solid #E2E8F0', fontWeight: 700 }}>Etiqueta</th>
                        <th style={{ padding: '0.5rem 0.6rem', borderBottom: '2px solid #E2E8F0', fontWeight: 700 }}>Tipo</th>
                        <th style={{ padding: '0.5rem 0.6rem', borderBottom: '2px solid #E2E8F0', fontWeight: 700 }}>Oblig.</th>
                        <th style={{ padding: '0.5rem 0.6rem', borderBottom: '2px solid #E2E8F0', fontWeight: 700 }}>Ejemplo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schema.fields.map((f) => {
                        const badge = typeBadge[f.type] || typeBadge.string;
                        return (
                          <tr key={f.key}>
                            <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #F1F5F9', fontFamily: 'monospace', color: '#0F172A', fontWeight: 600 }}>{f.key}</td>
                            <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #F1F5F9', color: '#475569' }}>{f.label}</td>
                            <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #F1F5F9' }}>
                              <span style={{ backgroundColor: badge.bg, color: badge.color, padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                                {f.type}
                                {f.enumValues ? `: ${f.enumValues.join(' / ')}` : ''}
                              </span>
                            </td>
                            <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #F1F5F9', textAlign: 'center' }}>
                              {f.required ? <span style={{ color: '#DC2626', fontWeight: 700 }}>Sí</span> : <span style={{ color: '#94A3B8' }}>—</span>}
                            </td>
                            <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #F1F5F9', color: '#64748B', fontFamily: 'monospace' }}>{exampleValue(f) || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};