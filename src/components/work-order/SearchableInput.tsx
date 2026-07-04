import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Loader2, Lock } from 'lucide-react';

interface Props {
  value: string;
  /** Se dispara al seleccionar una opción o al confirmar el texto (blur/Enter). */
  onChange: (value: string) => void;
  /** Opciones (datos traídos de la API) sobre las que se hace la búsqueda. */
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  /** Texto que se muestra como placeholder cuando el campo está bloqueado. */
  disabledMessage?: string;
  loading?: boolean;
  required?: boolean;
  maxResults?: number;
}

/**
 * Campo de búsqueda con autocompletado: el usuario escribe y se filtran
 * las opciones (provenientes de la API). Soporta estado "bloqueado".
 */
export const SearchableInput: React.FC<Props> = ({
  value,
  onChange,
  options,
  placeholder = 'Buscar...',
  disabled = false,
  disabledMessage = 'Complete el campo anterior',
  loading = false,
  required = false,
  maxResults = 50,
}) => {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Mantener el texto sincronizado con el valor externo (ej. autocompletado por VIN).
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Cerrar el desplegable al hacer clic fuera del componente.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = (q
    ? options.filter((o) => o.toLowerCase().includes(q))
    : options
  ).slice(0, maxResults);

  const commit = (val: string) => {
    onChange(val);
    setQuery(val);
    setOpen(false);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setOpen(true);
    setHighlight(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlight]) commit(filtered[highlight]);
      else commit(query);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Al perder el foco confirmamos el texto escrito (permite valores libres).
  const handleBlur = () => {
    // Pequeño retraso para permitir que el clic en una opción se registre antes.
    setTimeout(() => {
      onChange(query);
    }, 120);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div className="input-group" style={{ position: 'relative' }}>
        <input
          type="text"
          className="form-input"
          value={query}
          onChange={handleInput}
          onFocus={() => !disabled && setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          placeholder={disabled ? disabledMessage : placeholder}
          autoComplete="off"
          style={{
            width: '100%',
            paddingRight: '2rem',
            backgroundColor: disabled ? '#F1F5F9' : 'white',
            color: disabled ? '#94A3B8' : '#0F172A',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
        <span style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94A3B8', display: 'flex' }}>
          {loading ? (
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : disabled ? (
            <Lock size={14} />
          ) : (
            <ChevronDown size={16} />
          )}
        </span>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>

      {open && !disabled && filtered.length > 0 && (
        <ul
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 50,
            margin: 0,
            padding: '0.3rem',
            listStyle: 'none',
            backgroundColor: 'white',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            maxHeight: '240px',
            overflowY: 'auto',
          }}
        >
          {filtered.map((opt, idx) => (
            <li
              key={opt}
              onMouseDown={(e) => { e.preventDefault(); commit(opt); }}
              onMouseEnter={() => setHighlight(idx)}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: '#1E293B',
                backgroundColor: idx === highlight ? '#EFF6FF' : 'transparent',
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}

      {open && !disabled && !loading && filtered.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 50,
            padding: '0.6rem 0.75rem',
            backgroundColor: 'white',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            fontSize: '0.85rem',
            color: '#94A3B8',
          }}
        >
          Sin coincidencias
        </div>
      )}
    </div>
  );
};