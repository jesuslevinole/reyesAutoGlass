import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, X } from 'lucide-react';
import { getModule } from '../config/modules';
import type { Row } from '../services/firestore';
import { createRow } from '../services/firestore';
import { cachedFetchAll, invalidateCatalog } from '../services/catalogCache';

/* ==================== Modal del mensaje: secciones + presets con nombre ==================== */




const MESSAGE_BLOCKS: { id: string; label: string }[] = [
  { id: 'header', label: 'Header (number, status, type)' },
  { id: 'customer', label: 'Customer & phones' },
  { id: 'address', label: 'Address' },
  { id: 'appointment', label: 'Appointment' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'details', label: 'Parts & Services' },
  { id: 'totals', label: 'Totals' },
  { id: 'notes', label: 'Notes' },
];

/** Campos del formulario agrupados por sección — seleccionables uno a uno. */
function messageFieldGroups() {
  const module = getModule('workorders');
  return (module.sections ?? [])
    .map((s) => ({
      section: s.title,
      fields: module.fields
        .filter((f) => f.section === s.id)
        .map((f) => ({ id: `field:${f.key}`, label: f.label })),
    }))
    .filter((g) => g.fields.length > 0);
}

interface MessagePreset extends Row { name?: string; sections?: string[] }


/** Label legible de un elemento del mensaje (bloque o campo). */
function messageItemLabel(id: string): string {
  const block = MESSAGE_BLOCKS.find((b) => b.id === id);
  if (block) return block.label;
  if (id.startsWith('field:')) {
    const key = id.slice(6);
    return getModule('workorders').fields.find((f) => f.key === key)?.label ?? key;
  }
  return id;
}

const MSG_LAST_KEY = 'gw_msg_last_selection';

export function MessageModal({ preview, onCopy, onClose }: {
  preview: (sections: string[]) => string;
  onCopy: (sections: string[]) => void;
  onClose: () => void;
}) {
  // Selección ORDENADA: el orden del array es el orden del mensaje
  const [selection, setSelection] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(MSG_LAST_KEY);
      const parsed = raw ? JSON.parse(raw) as string[] : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* selección por defecto */ }
    return MESSAGE_BLOCKS.map((s) => s.id);
  });
  const [fieldSearch, setFieldSearch] = useState('');
  const fieldGroups = useMemo(() => messageFieldGroups(), []);
  const [presets, setPresets] = useState<MessagePreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);

  useEffect(() => {
    let alive = true;
    void cachedFetchAll('message_presets').then((rows) => {
      if (alive) setPresets(rows as MessagePreset[]);
    });
    return () => { alive = false; };
  }, []);

  const toggle = (id: string) => {
    setSelection((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    setSelection((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const applyPreset = (preset: MessagePreset) =>
    setSelection(preset.sections ?? []);

  const savePreset = async () => {
    if (!presetName.trim()) return;
    setSavingPreset(true);
    try {
      await createRow('message_presets', { name: presetName.trim(), sections: selection });
      invalidateCatalog('message_presets');
      setPresets(await cachedFetchAll('message_presets') as MessagePreset[]);
      setPresetName('');
    } finally {
      setSavingPreset(false);
    }
  };

  const removePreset = async (preset: MessagePreset) => {
    if (!window.confirm(`Delete preset "${preset.name ?? ''}"?`)) return;
    const { deleteRow } = await import('../services/firestore');
    await deleteRow('message_presets', preset.id);
    invalidateCatalog('message_presets');
    setPresets(await cachedFetchAll('message_presets') as MessagePreset[]);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card msg-modal" onClick={(e) => e.stopPropagation()}>
        <header className="msg-head">
          <span className="msg-icon"><Copy size={15} /></span>
          <div className="msg-title">
            <h3>Copy message</h3>
            <p>Choose what to include — save it as a preset for the people you always message.</p>
          </div>
          <button type="button" className="btn-icon-ghost" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </header>

        {presets.length > 0 && (
          <div className="msg-presets">
            <p className="msg-presets-label">Saved presets</p>
            <ul>
              {presets.map((preset) => (
                <li key={preset.id}>
                  <button type="button" className="msg-preset" onClick={() => applyPreset(preset)}>
                    {preset.name ?? 'Preset'}
                  </button>
                  <button
                    type="button"
                    className="msg-preset-del"
                    aria-label={`Delete ${preset.name ?? 'preset'}`}
                    onClick={() => void removePreset(preset)}
                  >
                    <X size={11} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="msg-body">
          <div className="msg-group-row">
            <p className="msg-group-label">Message blocks</p>
            <span className="msg-quick">
              <button type="button" onClick={() => setSelection((prev) => [...prev, ...MESSAGE_BLOCKS.filter((b) => !prev.includes(b.id)).map((b) => b.id)])}>All</button>
              <button type="button" onClick={() => setSelection((prev) => prev.filter((s) => s.startsWith('field:')))}>None</button>
            </span>
          </div>
          <ul className="msg-sections">
            {MESSAGE_BLOCKS.map((section) => {
              const checked = selection.includes(section.id);
              return (
                <li key={section.id}>
                  <label className={`msg-section${checked ? ' checked' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(section.id)} />
                    {section.label}
                  </label>
                </li>
              );
            })}
          </ul>

          <p className="msg-group-label">Individual form fields</p>
          <input
            className="msg-field-search"
            value={fieldSearch}
            placeholder="Search field…"
            onChange={(e) => setFieldSearch(e.target.value)}
          />
          {fieldGroups
            .map((group) => ({
              ...group,
              fields: fieldSearch.trim()
                ? group.fields.filter((f) => f.label.toLowerCase().includes(fieldSearch.trim().toLowerCase()))
                : group.fields,
            }))
            .filter((group) => group.fields.length > 0)
            .map((group) => (
              <section key={group.section} className="msg-field-group">
                <h4>{group.section}</h4>
                <ul className="msg-sections">
                  {group.fields.map((field) => {
                    const checked = selection.includes(field.id);
                    return (
                      <li key={field.id}>
                        <label className={`msg-section${checked ? ' checked' : ''}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggle(field.id)} />
                          {field.label}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

          <p className="msg-group-label">Send order ({selection.length})</p>
          {selection.length === 0 ? (
            <p className="msg-order-empty">Nothing selected yet.</p>
          ) : (
            <ol className="msg-order">
              {selection.map((id, index) => (
                <li key={id}>
                  <span className="msg-order-num">{index + 1}</span>
                  <span className="msg-order-label">{messageItemLabel(id)}</span>
                  <span className="msg-order-actions">
                    <button className="btn-icon-ghost" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label="Move up">
                      <ArrowUp size={13} />
                    </button>
                    <button className="btn-icon-ghost" onClick={() => moveItem(index, 1)} disabled={index === selection.length - 1} aria-label="Move down">
                      <ArrowDown size={13} />
                    </button>
                    <button className="btn-danger-ghost" onClick={() => toggle(id)} aria-label="Remove">
                      <X size={13} />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}

          <p className="msg-group-label">Preview</p>
          <pre className="msg-preview">{preview(selection) || '— Nothing selected —'}</pre>
        </div>

        <div className="msg-save-preset">
          <input
            value={presetName}
            placeholder="Preset name (e.g. Technician, Customer)…"
            onChange={(e) => setPresetName(e.target.value)}
          />
          <button
            type="button"
            className="btn-outline"
            disabled={savingPreset || !presetName.trim()}
            onClick={() => void savePreset()}
          >
            {savingPreset ? 'Saving…' : 'Save preset'}
          </button>
        </div>

        <footer className="msg-foot">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-dark"
            disabled={selection.length === 0}
            onClick={() => {
              try {
                localStorage.setItem(MSG_LAST_KEY, JSON.stringify(selection));
              } catch { /* sin storage */ }
              onCopy(selection);
            }}
          >
            <Copy size={15} />
            Copy message
          </button>
        </footer>
      </div>
    </div>
  );
}
