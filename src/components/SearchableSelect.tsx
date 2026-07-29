import { useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import './SearchableSelect.css';

export interface SelectOption {
  id: string;
  label: string;
}

interface Props {
  inputId?: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  onChange: (id: string) => void;
}

const MAX_VISIBLE = 100;

/** Select con búsqueda: escribe para filtrar, clic para elegir.
 *  Patrón de lookup con cierre diferido en blur (permite el clic en la opción). */
export default function SearchableSelect({ inputId, value, options, placeholder, required, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const blurTimer = useRef<number | null>(null);

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    return { visible: list.slice(0, MAX_VISIBLE), total: list.length };
  }, [options, search]);

  const openDropdown = () => {
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    setSearch('');
    setOpen(true);
  };

  const scheduleClose = () => {
    blurTimer.current = window.setTimeout(() => setOpen(false), 160);
  };

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="sselect">
      <div className="sselect-control">
        <input
          id={inputId}
          type="text"
          className="sselect-input"
          value={open ? search : selected?.label ?? ''}
          placeholder={selected ? selected.label : placeholder ?? 'Type to search…'}
          onFocus={openDropdown}
          onBlur={scheduleClose}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          autoComplete="off"
        />
        {value ? (
          <button type="button" className="sselect-clear" onClick={() => onChange('')} aria-label="Clear selection" tabIndex={-1}>
            <X size={14} />
          </button>
        ) : (
          <span className="sselect-chevron"><ChevronDown size={15} /></span>
        )}
        {/* Proxy invisible para que `required` participe en la validación del formulario */}
        {required && (
          <input
            className="sselect-required-proxy"
            value={value}
            required
            onChange={() => undefined}
            tabIndex={-1}
            aria-hidden="true"
          />
        )}
      </div>

      {open && (
        <ul className="sselect-menu" role="listbox">
          {filtered.visible.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                role="option"
                aria-selected={opt.id === value}
                className={`sselect-option${opt.id === value ? ' selected' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); pick(opt.id); }}
              >
                {opt.label}
              </button>
            </li>
          ))}
          {filtered.total === 0 && <li className="sselect-empty">No results for "{search}"</li>}
          {filtered.total > MAX_VISIBLE && (
            <li className="sselect-more">Showing {MAX_VISIBLE} of {filtered.total} — type to narrow down</li>
          )}
        </ul>
      )}
    </div>
  );
}
