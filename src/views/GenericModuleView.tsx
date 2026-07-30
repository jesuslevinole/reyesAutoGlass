import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import {
  ArrowRightCircle,
  FileSpreadsheet,
  SlidersHorizontal,
  ArrowRight, Calculator, Car, CalendarClock, Check, ClipboardCheck, ClipboardList,
  CreditCard, DollarSign, Eye, Pencil, Plus, Search, ShieldCheck, Tags, Trash2, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MODULE_ICONS } from '../config/moduleIcons';
import type { FieldDef, ModuleDef } from '../config/modules';
import { FULL_PERM } from '../utils/uiConfig';
import type { ModulePerm } from '../utils/uiConfig';
import type { Row } from '../services/firestore';
import { createRow, deleteRow, updateRow } from '../services/firestore';
import { cachedFetchAll, invalidateCatalog, subscribeCached } from '../services/catalogCache';
import { formatDate, getFieldValue, getRelationColor, getRelationName, money, rowLabel, tagColorToHex } from '../utils/relations';
import ImportExportBar from '../components/ImportExportBar';
import { generateServiceDetailsReport, generateWorkOrderReport } from '../utils/reportExcel';
import ServiceDetailModal from './ServiceDetailModal';
import WorkOrderWizard from './WorkOrderWizard';
import SearchableSelect from '../components/SearchableSelect';
import './GenericModuleView.css';

interface Props {
  module: ModuleDef;
  /** Permisos del rol del usuario sobre este módulo (default: acceso total) */
  perms?: ModulePerm;
  /** Término inicial de búsqueda (viene del buscador global del topbar) */
  initialSearch?: string;
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

export default function GenericModuleView({ module, perms = FULL_PERM, initialSearch, onOpenRow }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [fkData, setFkData] = useState<Record<string, Row[]>>({});
  const [search, setSearch] = useState(initialSearch ?? '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(module));
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [reporting, setReporting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  /** Filtros del drawer: fk/enum → id/valor; boolean → 'true'/'false'; date → {from,to} */
  const [filters, setFilters] = useState<Record<string, unknown>>({});

  const sections = useMemo(() => module.sections ?? [DEFAULT_SECTION], [module]);
  const [activeSection, setActiveSection] = useState(sections[0].id);

  // Colección principal en tiempo real
  useEffect(() => subscribeCached(
    module.collection,
    (r) => { setRows(r); setLoadError(null); setLoading(false); },
    (error) => { setLoadError(error instanceof Error ? error.message : String(error)); setLoading(false); },
  ), [module.collection]);

  // Catálogos referenciados por FK: carga única al montar el módulo.
  useEffect(() => {
    const fkCollections = [...new Set(
      module.fields.filter((f) => f.fkCollection).map((f) => f.fkCollection as string),
    )];
    let cancelled = false;
    void Promise.all(fkCollections.map(async (c) => [c, await cachedFetchAll(c)] as const)).then((pairs) => {
      if (!cancelled) setFkData(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
  }, [module]);

  /** Campo de status (FK a catalog_tag), si el módulo lo tiene — habilita la barra de filtros */
  const statusField = useMemo(
    () => module.fields.find((f) => f.type === 'fk' && f.fkCollection === 'catalog_tag'),
    [module],
  );
  const statusTags = useMemo(() => {
    if (!statusField) return [];
    const tags = fkData['catalog_tag'] ?? [];
    const filter = statusField.fkFilter;
    return filter
      ? tags.filter((t) => {
          const v = (t as Record<string, unknown>)[filter.key];
          return typeof v === 'string' && v.includes(filter.equals);
        })
      : tags;
  }, [statusField, fkData]);
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!statusField) return counts;
    for (const row of rows) {
      const v = String(getFieldValue(row, statusField) ?? '');
      counts[v] = (counts[v] ?? 0) + 1;
    }
    return counts;
  }, [rows, statusField]);

  /** Campos que alimentan el drawer de filtros (fk, enum, boolean y fechas visibles). */
  const filterFields = useMemo(
    () => module.fields.filter((f) =>
      (f.type === 'fk' || f.type === 'enum' || f.type === 'boolean' || f.type === 'date')
      && f !== statusField),
    [module, statusField],
  );
  const activeFilterCount = useMemo(() => Object.values(filters).filter((v) => {
    if (v === undefined || v === '') return false;
    if (typeof v === 'object' && v !== null) {
      const range = v as { from?: string; to?: string };
      return Boolean(range.from || range.to);
    }
    return true;
  }).length, [filters]);

  const matchesFilters = (row: Row): boolean => {
    for (const f of filterFields) {
      const filter = filters[f.key];
      if (filter === undefined || filter === '') continue;
      const value = getFieldValue(row, f);
      if (f.type === 'date') {
        const range = filter as { from?: string; to?: string };
        const day = String(value ?? '').slice(0, 10);
        if (range.from && (!day || day < range.from)) return false;
        if (range.to && (!day || day > range.to)) return false;
      } else if (f.type === 'boolean') {
        if (String(Boolean(value)) !== filter) return false;
      } else if (String(value ?? '') !== filter) {
        return false;
      }
    }
    return true;
  };

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
    let base = statusFilter && statusField
      ? rows.filter((row) => String(getFieldValue(row, statusField) ?? '') === statusFilter)
      : rows;
    if (activeFilterCount > 0) base = base.filter(matchesFilters);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((row) =>
      module.fields.some((f) => {
        const value = getFieldValue(row, f);
        if (f.fkCollection) {
          return getRelationName(value, fkData[f.fkCollection] ?? []).toLowerCase().includes(q);
        }
        return String(value ?? '').toLowerCase().includes(q);
      }),
    );
  // matchesFilters depende de filters/filterFields (incluidos abajo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, module, fkData, statusFilter, statusField, filters, filterFields, activeFilterCount]);

  /** Idea del cliente: convertir una Quote aceptada en Work Order con un clic. */
  const convertQuote = async (quote: Row) => {
    if (!window.confirm('Convert this quote into a Work Order?')) return;
    const src = quote as Record<string, unknown>;
    const tags = fkData['catalog_tag'] ?? [];
    // Status inicial de la orden: tag "Accepted" de tipo Work Order (si existe)
    const accepted = tags.find((t) => {
      const r = t as Record<string, unknown>;
      return String(r.name ?? '').toLowerCase() === 'accepted' && String(r.type ?? '').includes('Work Order');
    });
    const { id: _id, quoteNumber, convertedWorkOrderId, idStatus, ...rest } = src as Record<string, unknown> & { id: string };
    void _id; void convertedWorkOrderId; void idStatus;
    const woId = await createRow('work_orders', {
      ...rest,
      quoteId: quote.id,
      quoteNumber: quoteNumber ?? '',
      idStatus: accepted?.id ?? '',
      dateRegister: new Date().toISOString().slice(0, 10),
    });
    // Marcar la quote como convertida (tag "Converted" tipo Quote si existe)
    const converted = tags.find((t) => {
      const r = t as Record<string, unknown>;
      return String(r.name ?? '').toLowerCase().startsWith('convert') && String(r.type ?? '').includes('Quote');
    });
    await updateRow(module.collection, quote.id, {
      convertedWorkOrderId: woId,
      ...(converted ? { idStatus: converted.id } : {}),
    });
  };

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
      const value = getFieldValue(row, f);
      if (value !== undefined) base[f.key] = value;
    }
    setForm(base);
    setActiveSection(sections[0].id);
    setModalOpen(true);
  };

  const handleDelete = async (row: Row) => {
    if (!window.confirm(`Delete this ${module.singular.toLowerCase()}? This action cannot be undone.`)) return;
    await deleteRow(module.collection, row.id);
    invalidateCatalog(module.collection);
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
      invalidateCatalog(module.collection);
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
          {filterFields.length > 0 && (
            <button className="btn-outline filter-btn" onClick={() => setDrawerOpen(true)}>
              <SlidersHorizontal size={15} />
              Filters
              {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
            </button>
          )}
          {(module.id === 'workorders' || module.id === 'servicesdetail') && (
            <button
              className="btn-outline"
              disabled={reporting}
              onClick={() => {
                setReporting(true);
                const generate = module.id === 'workorders'
                  ? generateWorkOrderReport(filtered)
                  : generateServiceDetailsReport(filtered);
                void generate.finally(() => setReporting(false));
              }}
            >
              <FileSpreadsheet size={15} />
              {reporting ? 'Generating…' : 'Excel report'}
            </button>
          )}
          <ImportExportBar module={module} rows={rows} />
          {perms.add && (<button className="btn-primary" onClick={openNew}>
            <Plus size={16} />
            New {module.singular.toLowerCase()}
          </button>)}
        </div>
      </header>

      <div className="module-toolbar">
        <div className="search-box">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${module.title.toLowerCase()}…`}
          />
        </div>
        <span className="row-count">{loading ? 'Loading records…' : `${filtered.length} records`}</span>
      </div>

      {statusField && statusTags.length > 0 && (
        <nav className="status-bar" aria-label="Filter by status">
          <ul>
            <li>
              <button
                className={`status-chip${statusFilter === '' ? ' active' : ''}`}
                onClick={() => setStatusFilter('')}
              >
                Todos
                <span className="status-count">{rows.length}</span>
              </button>
            </li>
            {statusTags.map((tag) => {
              const t = tag as Record<string, unknown>;
              const hex = tagColorToHex(t.color);
              return (
                <li key={tag.id}>
                  <button
                    className={`status-chip${statusFilter === tag.id ? ' active' : ''}`}
                    /* color del tag como variable CSS en runtime */
                    style={{ '--chip-color': hex } as CSSProperties}
                    onClick={() => setStatusFilter(statusFilter === tag.id ? '' : tag.id)}
                  >
                    <span className="status-chip-dot" />
                    {rowLabel(tag)}
                    <span className="status-count">{statusCounts[tag.id] ?? 0}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {loadError && (
        <div className="load-error" role="alert">
          <strong>Could not read collection "{module.collection}".</strong> {loadError}
          {loadError.toLowerCase().includes('permission') && (
            <span> — Firestore rules are blocking reads. Check Firebase Console → Firestore → Rules.</span>
          )}
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {listFields.map((f) => <th key={f.key}>{f.label}</th>)}
              <th className="col-actions">Actions</th>
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
              <tr
                key={row.id}
                className={onOpenRow ? 'row-clickable' : undefined}
                onClick={onOpenRow ? () => onOpenRow(row) : undefined}
              >
                {listFields.map((f) => (
                  <td key={f.key}>{renderCell(f, row, fkData)}</td>
                ))}
                <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                  {perms.add && module.id === 'quotes' && !(row as Record<string, unknown>).convertedWorkOrderId && (
                    <button
                      className="btn-icon-ghost convert-btn"
                      onClick={() => void convertQuote(row)}
                      aria-label="Convert to Work Order"
                      title="Convert to Work Order"
                    >
                      <ArrowRightCircle size={15} />
                    </button>
                  )}
                  {onOpenRow && (
                    <button className="btn-icon-ghost" onClick={() => onOpenRow(row)} aria-label="View detail">
                      <Eye size={15} />
                    </button>
                  )}
                  {perms.edit && (
                    <button className="btn-icon-ghost" onClick={() => openEdit(row)} aria-label="Edit">
                      <Pencil size={15} />
                    </button>
                  )}
                  {perms.delete && (
                    <button className="btn-danger-ghost" onClick={() => void handleDelete(row)} aria-label="Delete">
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td className="empty-cell" colSpan={listFields.length + 1}>
                  {rows.length === 0
                    ? `No records yet. Create the first ${module.singular.toLowerCase()} or import a CSV.`
                    : 'No records match your search.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {drawerOpen && (
        <FilterDrawer
          module={module}
          fields={filterFields}
          fkData={fkData}
          filters={filters}
          onChange={setFilters}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {modalOpen && module.id === 'workorders' && (
        <WorkOrderWizard
          initialRow={editing}
          onClose={() => setModalOpen(false)}
        />
      )}

      {modalOpen && module.id === 'servicesdetail' && (
        <ServiceDetailModal
          initialRow={editing}
          onClose={() => setModalOpen(false)}
        />
      )}

      {modalOpen && module.id !== 'workorders' && module.id !== 'servicesdetail' && (
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
                <h2>{editing ? `Edit ${module.singular.toLowerCase()}` : `New ${module.singular.toLowerCase()}`}</h2>
                <p>{module.description}</p>
              </div>
              <button type="button" className="window-btn" onClick={onClose} aria-label="Close">
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
              <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-dark" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : `Create ${module.singular.toLowerCase()}`}
              </button>
            </footer>
          </div>

          {/* ============ Sumario (panel derecho) ============ */}
          <aside className="form-summary">
            <div className="summary-scroll">
              <div className="summary-block progress-block">
                <p className="summary-title"><ClipboardCheck size={13} />Campos requeridos</p>
                {requiredFields.length === 0 ? (
                  <p className="summary-empty">This module has no required fields.</p>
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
                  <p className="summary-title"><Calculator size={13} />Totals</p>
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
                <p className="summary-title"><Eye size={13} />Summary capturado</p>
                {summaryFields.length === 0 ? (
                  <p className="summary-empty">The data you enter will appear here.</p>
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
    case 'boolean': return value ? 'Yes' : 'No';
    default: return String(value ?? '—');
  }
}

/* ==================== celdas del listado ==================== */

function renderCell(field: FieldDef, row: Row, fkData: Record<string, Row[]>) {
  const value = getFieldValue(row, field);
  switch (field.type) {
    case 'fk': {
      const catalog = fkData[field.fkCollection ?? ''] ?? [];
      // Los status llevan su punto de color configurable (valor de runtime → variable CSS)
      if (field.fkCollection === 'cat_status') {
        return (
          <span className="cell-status" style={{ '--chip-color': tagColorToHex(getRelationColor(value, catalog)) } as CSSProperties}>
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
    case 'boolean': return value ? 'Yes' : 'No';
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
        <SearchableSelect
          inputId={`f-${field.key}`}
          value={String(value ?? '')}
          options={(field.options ?? []).map((opt) => ({ id: opt, label: opt }))}
          required={field.required}
          onChange={onChange}
        />
      ) : field.type === 'fk' ? (
        <SearchableSelect
          inputId={`f-${field.key}`}
          value={String(value ?? '')}
          options={options.map((opt) => ({ id: opt.id, label: rowLabel(opt) }))}
          required={field.required}
          onChange={onChange}
        />
      ) : field.type === 'fkList' ? (
        <FkListInput field={field} value={value} options={options} onChange={onChange} />
      ) : field.type === 'boolean' ? (
        <label className="switch-line">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{value ? 'Yes' : 'No'}</span>
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
      {options.length === 0 && <li className="fklist-empty">No records in the referenced catalog.</li>}
    </ul>
  );
}


/* ==================== Drawer de filtros (barra lateral derecha) ==================== */

interface FilterDrawerProps {
  module: ModuleDef;
  fields: FieldDef[];
  fkData: Record<string, Row[]>;
  filters: Record<string, unknown>;
  onChange: (filters: Record<string, unknown>) => void;
  onClose: () => void;
}

function FilterDrawer({ module, fields, fkData, filters, onChange, onClose }: FilterDrawerProps) {
  const set = (key: string, value: unknown) => onChange({ ...filters, [key]: value });
  const range = (key: string): { from?: string; to?: string } =>
    (filters[key] as { from?: string; to?: string } | undefined) ?? {};

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="filter-drawer" role="dialog" aria-label={`Filters — ${module.title}`}>
        <header className="drawer-head">
          <span className="drawer-icon"><SlidersHorizontal size={15} /></span>
          <h2>Filters</h2>
          <button type="button" className="btn-icon-ghost" onClick={onClose} aria-label="Close filters">
            <X size={17} />
          </button>
        </header>

        <div className="drawer-body">
          {fields.map((f) => (
            <div className="drawer-field" key={f.key}>
              <p className="drawer-label">{f.label}</p>
              {f.type === 'fk' ? (
                <SearchableSelect
                  value={String(filters[f.key] ?? '')}
                  options={(fkData[f.fkCollection ?? ''] ?? []).map((opt) => ({ id: opt.id, label: rowLabel(opt) }))}
                  placeholder="Any"
                  onChange={(id) => set(f.key, id)}
                />
              ) : f.type === 'enum' ? (
                <div className="drawer-chips">
                  {(f.options ?? []).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`drawer-chip${filters[f.key] === opt ? ' active' : ''}`}
                      onClick={() => set(f.key, filters[f.key] === opt ? '' : opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : f.type === 'boolean' ? (
                <div className="drawer-chips">
                  {[['', 'All'], ['true', 'Yes'], ['false', 'No']].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`drawer-chip${String(filters[f.key] ?? '') === value ? ' active' : ''}`}
                      onClick={() => set(f.key, value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="drawer-range">
                  <input
                    type="date"
                    value={range(f.key).from ?? ''}
                    aria-label={`${f.label} from`}
                    onChange={(e) => set(f.key, { ...range(f.key), from: e.target.value })}
                  />
                  <span>—</span>
                  <input
                    type="date"
                    value={range(f.key).to ?? ''}
                    aria-label={`${f.label} to`}
                    onChange={(e) => set(f.key, { ...range(f.key), to: e.target.value })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <footer className="drawer-foot">
          <button type="button" className="btn-outline" onClick={() => onChange({})}>Clear all</button>
          <button type="button" className="btn-primary" onClick={onClose}>Apply</button>
        </footer>
      </aside>
    </>
  );
}
