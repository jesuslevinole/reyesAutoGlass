import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import {
  ArrowRight, Calculator, Car, CalendarClock, Check, ClipboardCheck, ClipboardList,
  CreditCard, DollarSign, Eye, Pencil, Plus, Search, ShieldCheck, Tags, Trash2, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MODULE_ICONS } from '../config/moduleIcons';
import type { FieldDef, ModuleDef } from '../config/modules';
import type { Row } from '../services/firestore';
import { createRow, deleteRow, fetchAll, subscribe, updateRow } from '../services/firestore';
import { formatDate, getRelationColor, getRelationName, money, rowLabel } from '../utils/relations';
import ImportExportBar from '../components/ImportExportBar';
import './GenericModuleView.css';

interface Props {
  module: ModuleDef;
  /** Si se pasa, cada fila muestra un botón para abrir su vista de detalle. */
  onOpenRow?: (row: Row) => void;
}

type FormState = Record<string, unknown>;

const SECTION_ICONS: Record<string, LucideIcon> = {
  general: ClipboardList,
  vehiculo: Car,
  cita: CalendarClock,
  financiero: DollarSign,
  precios: Tags,
  nags: ShieldCheck,
  pago: DollarSign,
  tarjeta: CreditCard,
};

const DEFAULT_SECTION = { id: 'main', title: 'Información' };

function emptyForm(module: ModuleDef): FormState {
  const form: FormState = {};
  for (const f of module.fields) {
    if (f.type === 'boolean') form[f.key] = false;
    else if (f.type === 'fkList') form[f.key] = [];
    else if (f.type === 'enum') form[f.key] = f.options?.[0] ?? '';
    else if (f.type === 'color') form[f.key] = '#3583f6';
    else form[f.key] = '';
  }
  return form;
}

/** Un campo con showIf solo aplica cuando el campo condicionante tiene el valor esperado. */
function fieldVisible(field: FieldDef, form: FormState): boolean {
  if (!field.showIf) return true;
  return form[field.showIf.key] === field.showIf.equals;
}

function isFilled(field: FieldDef, value: unknown): boolean {
  if (field.type === 'boolean') return true;
  if (field.type === 'fkList') return Array.isArray(value) && value.length > 0;
  return value !== '' && value !== null && value !== undefined;
}

export default function GenericModuleView({ module, onOpenRow }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [fkData, setFkData] = useState<Record<string, Row[]>>({});
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(module));
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sections = useMemo(() => module.sections ?? [DEFAULT_SECTION], [module]);
  const [activeSection, setActiveSection] = useState(sections[0].id);

  // Colección principal en tiempo real
  useEffect(() => subscribe(
    module.collection,
    (r) => { setRows(r); setLoadError(null); setLoading(false); },
    (error) => { setLoadError(error.message); setLoading(false); },
  ), [module.collection]);

  // Catálogos referenciados por FK: carga única al montar el módulo.
  useEffect(() => {
    const fkCollections = [...new Set(
      module.fields.filter((f) => f.fkCollection).map((f) => f.fkCollection as string),
    )];
    let cancelled = false;
    void Promise.all(fkCollections.map(async (c) => [c, await fetchAll(c)] as const)).then((pairs) => {
      if (!cancelled) setFkData(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
  }, [module]);

  const listFields = useMemo(() => {
    const inList = module.fields.filter((f) => f.inList);
    if (!module.columnOrder) return inList;
    // Orden personalizado desde Configuración; columnas no listadas van al final
    const order = module.columnOrder;
    return [...inList].sort((a, b) => {
      const ia = order.indexOf(a.key);
      const ib = order.indexOf(b.key);
      return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
    });
  }, [module]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      module.fields.some((f) => {
        const value = row[f.key];
        if (f.fkCollection) {
          return getRelationName(value, fkData[f.fkCollection] ?? []).toLowerCase().includes(q);
        }
        return String(value ?? '').toLowerCase().includes(q);
      }),
    );
  }, [rows, search, module, fkData]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm(module));
    setActiveSection(sections[0].id);
    setModalOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    const base = emptyForm(module);
    for (const f of module.fields) {
      if (row[f.key] !== undefined) base[f.key] = row[f.key];
    }
    setForm(base);
    setActiveSection(sections[0].id);
    setModalOpen(true);
  };

  const handleDelete = async (row: Row) => {
    if (!window.confirm(`¿Eliminar este ${module.singular.toLowerCase()}? Esta acción no se puede deshacer.`)) return;
    await deleteRow(module.collection, row.id);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Solo persistimos campos visibles según el camino elegido (Personal/Insurance).
      const data: Record<string, unknown> = {};
      for (const f of module.fields) {
        if (fieldVisible(f, form)) data[f.key] = normalize(f, form[f.key]);
      }
      if (editing) await updateRow(module.collection, editing.id, data);
      else await createRow(module.collection, data);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="module-view">
      <header className="module-head">
        <div>
          <h1>{module.title}</h1>
          <p className="module-desc">{module.description}</p>
        </div>
        <div className="module-actions">
          <ImportExportBar module={module} rows={rows} />
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} />
            Nuevo {module.singular.toLowerCase()}
          </button>
        </div>
      </header>

      <div className="module-toolbar">
        <div className="search-box">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar en ${module.title.toLowerCase()}…`}
          />
        </div>
        <span className="row-count">{loading ? 'Cargando registros…' : `${filtered.length} registros`}</span>
      </div>

      {loadError && (
        <div className="load-error" role="alert">
          <strong>No se pudo leer la colección «{module.collection}».</strong> {loadError}
          {loadError.toLowerCase().includes('permission') && (
            <span> — Las reglas de Firestore están bloqueando la lectura. Revisa Firebase Console → Firestore → Reglas.</span>
          )}
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {listFields.map((f) => <th key={f.key}>{f.label}</th>)}
              <th className="col-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 6 }, (_, rowIdx) => (
              <tr key={`skel-${rowIdx}`} aria-hidden="true">
                {listFields.map((f, colIdx) => (
                  <td key={f.key}>
                    {/* anchos variados de un conjunto finito → clases modificadoras */}
                    <span className={`skeleton skel-cell skel-w${((rowIdx + colIdx) % 3) + 1}`} />
                  </td>
                ))}
                <td className="col-actions">
                  <span className="skeleton skel-dot" />
                  <span className="skeleton skel-dot" />
                </td>
              </tr>
            ))}
            {!loading && filtered.map((row) => (
              <tr key={row.id}>
                {listFields.map((f) => (
                  <td key={f.key}>{renderCell(f, row, fkData)}</td>
                ))}
                <td className="col-actions">
                  {onOpenRow && (
                    <button className="btn-icon-ghost" onClick={() => onOpenRow(row)} aria-label="Ver detalle">
                      <Eye size={15} />
                    </button>
                  )}
                  <button className="btn-icon-ghost" onClick={() => openEdit(row)} aria-label="Editar">
                    <Pencil size={15} />
                  </button>
                  <button className="btn-danger-ghost" onClick={() => void handleDelete(row)} aria-label="Eliminar">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td className="empty-cell" colSpan={listFields.length + 1}>
                  {rows.length === 0
                    ? `Sin registros todavía. Crea el primer ${module.singular.toLowerCase()} o importa un CSV.`
                    : 'Ningún registro coincide con la búsqueda.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <FormModal
          module={module}
          sections={sections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          editing={editing}
          form={form}
          setForm={setForm}
          fkData={fkData}
          saving={saving}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </section>
  );
}

/* ==================== Modal de formulario con sumario ==================== */

interface FormModalProps {
  module: ModuleDef;
  sections: { id: string; title: string }[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  editing: Row | null;
  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
  fkData: Record<string, Row[]>;
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => Promise<void>;
}

function FormModal({
  module, sections, activeSection, onSectionChange,
  editing, form, setForm, fkData, saving, onClose, onSubmit,
}: FormModalProps) {
  const hasTabs = sections.length > 1;
  const ModuleIcon = MODULE_ICONS[module.id] ?? ClipboardList;

  const fieldsOf = (sectionId: string) =>
    module.fields.filter((f) =>
      fieldVisible(f, form) && (f.section ?? sections[0].id) === sectionId);

  // La sección activa puede quedarse sin campos al cambiar de camino (ej. NAGS en PERSONAL)
  const visibleSections = sections.filter((s) => fieldsOf(s.id).length > 0);
  const currentSection = visibleSections.some((s) => s.id === activeSection)
    ? activeSection
    : visibleSections[0]?.id;

  // ===== Sumario: requeridos y valores capturados =====
  const requiredFields = module.fields.filter((f) => f.required && fieldVisible(f, form));
  const requiredDone = requiredFields.filter((f) => isFilled(f, form[f.key]));

  const summaryFields = module.fields.filter((f) =>
    fieldVisible(f, form) && isFilled(f, form[f.key]) &&
    (f.inList || f.type === 'decimal' || f.type === 'fk' || f.type === 'enum'));

  const isWorkOrder = module.id === 'workorders';
  const numVal = (key: string): number => {
    const n = Number(form[key]);
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-form" onClick={(e) => e.stopPropagation()}>
        <form className="form-shell" onSubmit={(e) => void onSubmit(e)}>
          {/* ============ Panel izquierdo ============ */}
          <div className="form-left">
            <header className="form-header">
              <span className="form-header-icon"><ModuleIcon size={21} /></span>
              <div className="form-header-text">
                <h2>{editing ? `Editar ${module.singular.toLowerCase()}` : `Nuevo ${module.singular.toLowerCase()}`}</h2>
                <p>{module.description}</p>
              </div>
              <button type="button" className="window-btn" onClick={onClose} aria-label="Cerrar">
                <X size={17} />
              </button>
            </header>

            {hasTabs && (
              <nav className="form-tabs" aria-label="Secciones del formulario">
                {visibleSections.map((s) => {
                  const Icon = SECTION_ICONS[s.id] ?? ClipboardList;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`form-tab accent-${s.id}${currentSection === s.id ? ' active' : ''}`}
                      onClick={() => onSectionChange(s.id)}
                    >
                      <Icon size={14} />
                      {s.title}
                    </button>
                  );
                })}
              </nav>
            )}

            <div className="form-scroll">
              {visibleSections
                .filter((s) => !hasTabs || s.id === currentSection)
                .map((s) => {
                  const Icon = SECTION_ICONS[s.id] ?? ClipboardList;
                  return (
                    <section className={`section-card accent-${s.id}`} key={s.id}>
                      <header className="section-card-head">
                        <span className="section-card-icon"><Icon size={15} /></span>
                        <h3>{s.title}</h3>
                      </header>
                      <div className="form-grid">
                        {fieldsOf(s.id).map((f) => (
                          <FieldInput
                            key={f.key}
                            field={f}
                            value={form[f.key]}
                            options={f.fkCollection ? fkData[f.fkCollection] ?? [] : []}
                            onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
            </div>

            <footer className="form-foot">
              <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn-primary btn-gradient" disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : `Crear ${module.singular.toLowerCase()}`}
              </button>
            </footer>
          </div>

          {/* ============ Sumario (panel derecho) ============ */}
          <aside className="form-summary">
            <div className="summary-scroll">
              <div className="summary-block progress-block">
                <p className="summary-title"><ClipboardCheck size={13} />Campos requeridos</p>
                {requiredFields.length === 0 ? (
                  <p className="summary-empty">Este módulo no tiene campos obligatorios.</p>
                ) : (
                  <>
                    <p className="progress-count">
                      <strong>{requiredDone.length}</strong> de {requiredFields.length} completos
                    </p>
                    <span className="progress-track" role="progressbar" aria-valuenow={requiredDone.length} aria-valuemax={requiredFields.length}>
                      <span
                        className="progress-fill"
                        style={{ '--progress': `${(requiredDone.length / requiredFields.length) * 100}%` } as CSSProperties}
                      />
                    </span>
                    <ul className="check-list">
                      {requiredFields.map((f) => {
                        const done = isFilled(f, form[f.key]);
                        return (
                          <li key={f.key} className={done ? 'done' : ''}>
                            {done ? <Check size={13} /> : <ArrowRight size={13} />}
                            {f.label}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>

              {isWorkOrder && (
                <div className="summary-block totals-block">
                  <p className="summary-title"><Calculator size={13} />Totales</p>
                  <dl className="sum-list">
                    <div><dt>Parts</dt><dd>{money(numVal('subtotalPart'))}</dd></div>
                    <div><dt>Molding</dt><dd>{money(numVal('subtotalMolding'))}</dd></div>
                    <div><dt>Services</dt><dd>{money(numVal('subtotalServices'))}</dd></div>
                    <div><dt>Labor</dt><dd>{money(numVal('totalLabor'))}</dd></div>
                    <div><dt>Tax</dt><dd>{money(numVal('taxDolar'))}</dd></div>
                    <div className="sum-total"><dt>Total</dt><dd>{money(numVal('total'))}</dd></div>
                    <div><dt>Pagado</dt><dd>{money(numVal('paid'))}</dd></div>
                    <div className={`sum-balance${numVal('balance') > 0 ? ' owing' : ''}`}>
                      <dt>Balance</dt><dd>{money(numVal('balance'))}</dd>
                    </div>
                  </dl>
                </div>
              )}

              <div className="summary-block">
                <p className="summary-title"><Eye size={13} />Resumen capturado</p>
                {summaryFields.length === 0 ? (
                  <p className="summary-empty">Los datos que captures aparecerán aquí.</p>
                ) : (
                  <dl className="sum-list">
                    {summaryFields.map((f) => (
                      <div key={f.key}>
                        <dt>{f.label}</dt>
                        <dd>{summaryValue(f, form[f.key], fkData)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

function summaryValue(field: FieldDef, value: unknown, fkData: Record<string, Row[]>): string {
  switch (field.type) {
    case 'fk': return getRelationName(value, fkData[field.fkCollection ?? ''] ?? []);
    case 'fkList': {
      const ids = Array.isArray(value) ? value : [];
      const catalog = fkData[field.fkCollection ?? ''] ?? [];
      return ids.map((id) => getRelationName(id, catalog)).join(', ') || '—';
    }
    case 'decimal': return money(value);
    case 'percent': return `${value}%`;
    case 'date': return formatDate(value);
    case 'boolean': return value ? 'Sí' : 'No';
    default: return String(value ?? '—');
  }
}

/* ==================== celdas del listado ==================== */

function renderCell(field: FieldDef, row: Row, fkData: Record<string, Row[]>) {
  const value = row[field.key];
  switch (field.type) {
    case 'fk': {
      const catalog = fkData[field.fkCollection ?? ''] ?? [];
      // Los status llevan su punto de color configurable (valor de runtime → variable CSS)
      if (field.fkCollection === 'cat_status') {
        return (
          <span className="status-chip" style={{ '--chip-color': getRelationColor(value, catalog) } as CSSProperties}>
            {getRelationName(value, catalog)}
          </span>
        );
      }
      return getRelationName(value, catalog);
    }
    case 'fkList': {
      const catalog = fkData[field.fkCollection ?? ''] ?? [];
      const ids = Array.isArray(value) ? value : [];
      if (ids.length === 0) return '—';
      return ids.map((id) => getRelationName(id, catalog)).join(', ');
    }
    case 'decimal': return <span className="cell-money">{money(value)}</span>;
    case 'percent': return value === '' || value === null || value === undefined ? '—' : `${value}%`;
    case 'date': return formatDate(value);
    case 'boolean': return value ? 'Sí' : 'No';
    case 'color':
      return <span className="color-dot" style={{ '--dot-color': String(value || '#94a3b8') } as CSSProperties} />;
    case 'enum': return <span className={`enum-badge enum-${String(value).toLowerCase().replace(/\s/g, '-')}`}>{String(value || '—')}</span>;
    default: return String(value ?? '') || '—';
  }
}

/* ==================== inputs del formulario ==================== */

interface FieldInputProps {
  field: FieldDef;
  value: unknown;
  options: Row[];
  onChange: (value: unknown) => void;
}

function normalize(field: FieldDef, value: unknown): unknown {
  if (field.type === 'int') return value === '' ? null : parseInt(String(value), 10);
  if (field.type === 'decimal' || field.type === 'percent') {
    return value === '' ? null : parseFloat(String(value));
  }
  return value;
}

function FieldInput({ field, value, options, onChange }: FieldInputProps) {
  const wide = field.type === 'longtext' || field.type === 'fkList';
  return (
    <div className={`field${wide ? ' field-wide' : ''}`}>
      <label htmlFor={`f-${field.key}`}>{field.label}{field.required ? ' *' : ''}</label>
      {field.type === 'longtext' ? (
        <textarea
          id={`f-${field.key}`}
          value={String(value ?? '')}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === 'enum' ? (
        <select id={`f-${field.key}`} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : field.type === 'fk' ? (
        <select id={`f-${field.key}`} value={String(value ?? '')} required={field.required} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Seleccionar —</option>
          {options.map((opt) => <option key={opt.id} value={opt.id}>{rowLabel(opt)}</option>)}
        </select>
      ) : field.type === 'fkList' ? (
        <FkListInput field={field} value={value} options={options} onChange={onChange} />
      ) : field.type === 'boolean' ? (
        <label className="switch-line">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{value ? 'Sí' : 'No'}</span>
        </label>
      ) : (
        <input
          id={`f-${field.key}`}
          type={inputType(field)}
          step={field.type === 'decimal' || field.type === 'percent' ? '0.01' : undefined}
          value={String(value ?? '')}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function inputType(field: FieldDef): string {
  switch (field.type) {
    case 'int':
    case 'decimal':
    case 'percent': return 'number';
    case 'date': return 'date';
    case 'time': return 'time';
    case 'email': return 'email';
    case 'phone': return 'tel';
    case 'color': return 'color';
    default: return 'text';
  }
}

/** Selector múltiple para FKs tipo ENUMLIST (relación N:M). */
function FkListInput({ field, value, options, onChange }: FieldInputProps) {
  const selected = Array.isArray(value) ? (value as string[]) : [];
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };
  return (
    <ul className="fklist" aria-label={field.label}>
      {options.map((opt) => (
        <li key={opt.id}>
          <button
            type="button"
            className={`fklist-chip${selected.includes(opt.id) ? ' selected' : ''}`}
            onClick={() => toggle(opt.id)}
          >
            {rowLabel(opt)}
          </button>
        </li>
      ))}
      {options.length === 0 && <li className="fklist-empty">Sin registros en el catálogo referenciado.</li>}
    </ul>
  );
}
