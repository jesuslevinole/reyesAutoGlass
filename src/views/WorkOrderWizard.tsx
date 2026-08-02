import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightCircle, Briefcase, Calculator, CalendarDays, Car, ClipboardList, MapPin,
  Minus, Pencil, Percent, Plus, Save, ShieldCheck, Trash2, UserRound, Wrench, X,
} from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import ServiceDetailModal from './ServiceDetailModal';
import { getModule } from '../config/modules';
import type { Row } from '../services/firestore';
import { createRow, fetchAll, updateRow } from '../services/firestore';
import { cachedFetchAll, invalidateCatalog } from '../services/catalogCache';
import { getFieldValue, money, rowLabel } from '../utils/relations';
import './WorkOrderWizard.css';

interface Props {
  initialRow: Row | null;
  onClose: () => void;
  /** 'quote': guarda en quotes, status tipo Quote y permite convertir a Work Order */
  mode?: 'workorder' | 'quote';
}

type Form = Record<string, unknown>;

type DetailDraft = Record<string, unknown>;

type DetailModalState =
  | { mode: 'draft-new' }
  | { mode: 'draft-edit'; index: number }
  | { mode: 'live-new' }
  | { mode: 'live-edit'; row: Row }
  | null;

/** Colecciones que el wizard necesita para selects y sumario. */
const CATALOGS = [
  'catalog_tag', 'catalog_company', 'catalog_zipcode', 'customers',
  'catalog_insurance', 'catalog_jobtype', 'catalog_part_number', 'team',
] as const;

/* ==================== Alta rápida de catálogos (sin salir del formulario) ==================== */

interface QuickField { key: string; label: string; type?: 'number' }
interface QuickSpec { title: string; collection: string; fields: QuickField[]; defaults?: Record<string, unknown> }

const QUICK_SPECS: Record<string, QuickSpec> = {
  catalog_tag: {
    title: 'New status',
    collection: 'catalog_tag',
    fields: [{ key: 'name', label: 'Name' }, { key: 'color', label: 'Color (Green, Red, Blue…)' }],
    defaults: { type: 'Work Order' },
  },
  catalog_company: {
    title: 'New company',
    collection: 'catalog_company',
    fields: [{ key: 'name', label: 'Name' }, { key: 'type', label: 'Type (Distributor / Agent)' }],
  },
  catalog_zipcode: {
    title: 'New zipcode',
    collection: 'catalog_zipcode',
    fields: [
      { key: 'zipcode', label: 'Zipcode' }, { key: 'city', label: 'City' },
      { key: 'state', label: 'State' }, { key: 'tax', label: 'Tax (ej. 0.0725)', type: 'number' },
      { key: 'long_trip', label: 'Long trip $', type: 'number' },
    ],
  },
  customers: {
    title: 'New customer',
    collection: 'customers',
    fields: [
      { key: 'first_name', label: 'Name' }, { key: 'last_name', label: 'Last name' },
      { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' },
      { key: 'address', label: 'Address' },
    ],
  },
  catalog_insurance: {
    title: 'New insurance company',
    collection: 'catalog_insurance',
    fields: [{ key: 'name', label: 'Name' }],
  },
  catalog_jobtype: {
    title: 'New job type',
    collection: 'catalog_jobtype',
    fields: [{ key: 'name', label: 'Name' }, { key: 'type', label: 'Type (Parts / Services)' }],
  },
  catalog_part_number: {
    title: 'New part number',
    collection: 'catalog_part_number',
    fields: [{ key: 'part_number', label: 'Part number' }, { key: 'nags_description', label: 'NAGS description' }],
  },
};

function QuickAdd({ spec, onCreated, onClose }: {
  spec: QuickSpec;
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const data: Record<string, unknown> = { ...(spec.defaults ?? {}) };
      for (const f of spec.fields) {
        const raw = values[f.key] ?? '';
        data[f.key] = f.type === 'number' ? Number(raw) || 0 : raw.trim();
      }
      const id = await createRow(spec.collection, data);
      onCreated(id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="qa-backdrop" onClick={onClose}>
      <div className="qa-card" onClick={(e) => e.stopPropagation()}>
        <header className="qa-head">
          <h3>{spec.title}</h3>
          <button type="button" className="btn-icon-ghost" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="qa-fields">
          {spec.fields.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={`qa-${f.key}`}>{f.label}</label>
              <input
                id={`qa-${f.key}`}
                type={f.type === 'number' ? 'number' : 'text'}
                step={f.type === 'number' ? '0.0001' : undefined}
                value={values[f.key] ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setValues((prev) => ({ ...prev, [f.key]: v }));
                }}
              />
            </div>
          ))}
        </div>
        <footer className="qa-foot">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-dark" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Create & use'}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ==================== Tarjeta de sección (ícono + título + rejilla) ==================== */

function SectionCard({ icon, title, children }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="wz-section">
      <header className="wz-section-head">
        <span className="wz-section-icon">{icon}</span>
        <h2>{title}</h2>
      </header>
      <div className="wz-fields">{children}</div>
    </section>
  );
}

/* ==================== Wizard ==================== */

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

export default function WorkOrderWizard({ initialRow, onClose, mode = 'workorder' }: Props) {
  const isQuote = mode === 'quote';
  const collection = isQuote ? 'quotes' : 'work_orders';
  const module = useMemo(() => getModule('workorders'), []);

  const [form, setForm] = useState<Form>(() => {
    const base: Form = { insuranceType: 'Personal', dateRegister: new Date().toISOString().slice(0, 10) };
    if (initialRow) {
      for (const f of module.fields) {
        const v = getFieldValue(initialRow, f);
        if (v !== undefined) base[f.key] = v;
      }
    }
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<DetailDraft[]>([]);
  const [liveDetails, setLiveDetails] = useState<Row[]>([]);
  const [detailModal, setDetailModal] = useState<DetailModalState>(null);
  const [catalogs, setCatalogs] = useState<Record<string, Row[]>>({});
  const [quickAdd, setQuickAdd] = useState<{ spec: QuickSpec; targetKey: string } | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.all(CATALOGS.map((c) => cachedFetchAll(c))).then((results) => {
      if (!alive) return;
      setCatalogs(Object.fromEntries(CATALOGS.map((c, i) => [c, results[i]])));
    });
    return () => { alive = false; };
  }, []);

  /** Al editar una orden existente, sus detalles se cargan y gestionan en vivo. */
  const workOrderId = initialRow?.id ?? null;
  const loadLiveDetails = async () => {
    if (!workOrderId) return;
    const all = await fetchAll('work_order_details');
    const mine = all.filter((d) => String(getFieldValue(d, {
      key: 'idWorkorder',
      altKeys: ['work_order_id', 'id_work_order', 'workOrderId'],
    }) ?? '') === workOrderId);
    setLiveDetails(mine);
    applyLiveTotals(mine);
  };
  useEffect(() => {
    let alive = true;
    if (!workOrderId) return;
    void fetchAll('work_order_details').then((all) => {
      if (!alive) return;
      setLiveDetails(all.filter((d) => String(getFieldValue(d, {
        key: 'idWorkorder',
        altKeys: ['work_order_id', 'id_work_order', 'workOrderId'],
      }) ?? '') === workOrderId));
    });
    return () => { alive = false; };
    // workOrderId es estable durante la vida del wizard
  }, [workOrderId]);

  const cat = (name: string) => catalogs[name] ?? [];
  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  const isInsurance = form.insuranceType === 'Insurance';

  /* ===== Cálculos en vivo con las fórmulas del cliente =====
   *  TOTAL = MOLDING + PART + SERVICES + LABOR + LONG_TRIP + TAX
   *          (+ KIT_FLAT_RATE − DEDUCTIBLE si es Insurance) */
  const subtotal = num(form.subtotalPart) + num(form.subtotalMolding) + num(form.subtotalServices);
  const computedTotal = subtotal + num(form.totalLabor) + num(form.longTrip) + num(form.taxDolar)
    + (form.insuranceType === 'Insurance' ? num(form.kitFlatRate) - num(form.deductible) : 0);
  const balance = computedTotal - num(form.paid);

  /** Zipcode del catálogo → autollenar tax % y long trip (dato del cliente). */
  const onZipcode = (id: string) => {
    set('idZipcode', id);
    const zip = cat('catalog_zipcode').find((z) => z.id === id) as Record<string, unknown> | undefined;
    if (!zip) return;
    const tax = num(getFieldValue(zip, { key: 'tax' }));
    const longTrip = num(getFieldValue(zip, { key: 'longTrip', altKeys: ['long_trip'] }));
    setForm((prev) => {
      const percent = tax < 1 ? Math.round(tax * 10000) / 100 : tax;
      return {
        ...prev,
        idZipcode: id,
        taxPercent: percent,
        taxDolar: taxFor(num(prev.subtotalPart), percent),
        longTrip,
      };
    });
  };

  /** Fórmula del cliente: TAX_DOLAR = SUBTOTAL_PART × TAX_PERCENT. */
  const taxFor = (subtotalPart: number, percent: number) =>
    Math.round(subtotalPart * percent) / 100;

  const onTaxPercent = (raw: string) => {
    setForm((prev) => ({
      ...prev,
      taxPercent: raw,
      taxDolar: taxFor(num(prev.subtotalPart), num(raw)),
    }));
  };

  /* ===== Servicios (solo al crear) ===== */
  /** Clasificación por el TYPE del jobtype (fórmula AppSheet), con fallback al type del detalle. */
  const jobtypeTypeOf = (d: DetailDraft): string => {
    const job = cat('catalog_jobtype').find((j) => j.id === d.idJobtype) as Record<string, unknown> | undefined;
    const jobType = String(job?.type ?? '');
    return jobType || String(d.type ?? '');
  };

  /** Fórmulas del cliente (AppSheet):
   *  SUBTOTAL_PART: Personal → Σ GLASS_COST (Parts) · Insurance → Σ price part insurance (Parts)
   *  SUBTOTAL_MOLDING: Σ GLASS_COST (Molding)
   *  SUBTOTAL_SERVICES: Σ AMOUNT (Services u Accesories)
   *  TOTAL_LABOR: Personal → Σ TOTAL_LABOR · Insurance → Σ TOTAL_LABOR_HOUR */
  const computeTotals = (list: DetailDraft[], insurance: boolean) => {
    const ofType = (t: string) => list.filter((d) => jobtypeTypeOf(d).includes(t));
    const parts = ofType('Parts');
    return {
      subtotalPart: insurance
        ? parts.reduce((s, d) => s + num(d.pricePartInsurance), 0)
        : parts.reduce((s, d) => s + num(d.glassCost), 0),
      subtotalMolding: ofType('Molding').reduce((s, d) => s + num(d.glassCost), 0),
      subtotalServices: list
        .filter((d) => {
          const t = jobtypeTypeOf(d);
          return t.includes('Services') || t.includes('Accesories');
        })
        .reduce((s, d) => s + num(d.amount), 0),
      totalLabor: insurance
        ? list.reduce((s, d) => s + num(d.totalLaborHour), 0)
        : list.reduce((s, d) => s + num(d.totalLabor), 0),
    };
  };

  /** Al cambiar los borradores, los subtotales se derivan con las fórmulas del cliente. */
  const applyDrafts = (next: DetailDraft[]) => {
    setDrafts(next);
    if (next.length === 0) return;
    setForm((prev) => {
      const totals = computeTotals(next, prev.insuranceType === 'Insurance');
      return { ...prev, ...totals, taxDolar: taxFor(totals.subtotalPart, num(prev.taxPercent)) };
    });
  };

  /** Al editar una orden, los totales se recalculan desde sus detalles reales. */
  const applyLiveTotals = (list: Row[]) => {
    if (list.length === 0) return;
    setForm((prev) => {
      const totals = computeTotals(list.map((r) => {
        const d: DetailDraft = {};
        for (const f of getModule('servicesdetail').fields) {
          const v = getFieldValue(r, f);
          if (v !== undefined) d[f.key] = v;
        }
        return d;
      }), prev.insuranceType === 'Insurance');
      return { ...prev, ...totals, taxDolar: taxFor(totals.subtotalPart, num(prev.taxPercent)) };
    });
  };

  const removeDraft = (index: number) => applyDrafts(drafts.filter((_, i) => i !== index));

  const removeLiveDetail = async (row: Row) => {
    if (!window.confirm('Delete this detail?')) return;
    const { deleteRow } = await import('../services/firestore');
    await deleteRow('work_order_details', row.id);
    await loadLiveDetails();
  };

  /** Etiqueta legible de un detalle para la lista del wizard. */
  const detailLabel = (d: DetailDraft): string => {
    const job = rowLabel(cat('catalog_jobtype').find((j) => j.id === d.idJobtype));
    const part = rowLabel(cat('catalog_part_number').find((p) => p.id === d.idPartnumber));
    const pieces = [String(d.type ?? ''), job !== '—' ? job : '', part !== '—' ? part : ''].filter(Boolean);
    return pieces.join(' · ') || 'Detail';
  };
  /** Monto mostrado por renglón: services → amount; partes → costo (o precio insurance) + labor. */
  const detailAmount = (d: DetailDraft): number => {
    const t = jobtypeTypeOf(d);
    if (t.includes('Services') || t.includes('Accesories')) return num(d.amount);
    const partValue = form.insuranceType === 'Insurance' ? num(d.pricePartInsurance) : num(d.glassCost);
    return partValue + num(form.insuranceType === 'Insurance' ? d.totalLaborHour : d.totalLabor);
  };

  const customer = cat('customers').find((c) => c.id === form.idCustomer) as Record<string, unknown> | undefined;

  /** Flujo del cliente: la quote aceptada se convierte en Work Order (con sus detalles). */
  const convertToWorkOrder = async () => {
    if (!initialRow || !isQuote) return;
    if (!window.confirm('Convert this quote into a Work Order?')) return;
    setConverting(true);
    try {
      const tags = cat('catalog_tag');
      const accepted = tags.find((t) => {
        const r = t as Record<string, unknown>;
        return String(r.name ?? '').toLowerCase() === 'accepted' && String(r.type ?? '').includes('Work Order');
      });
      const data: Record<string, unknown> = {};
      for (const f of module.fields) {
        if (form[f.key] !== undefined) data[f.key] = form[f.key];
      }
      data.total = computedTotal;
      data.balance = balance;
      data.idStatus = accepted?.id ?? '';
      data.quoteId = initialRow.id;
      const woId = await createRow('work_orders', data);
      // Re-apuntar los detalles de la quote hacia la nueva Work Order
      const allDetails = await fetchAll('work_order_details');
      const mine = allDetails.filter((d) => String(getFieldValue(d, {
        key: 'idWorkorder',
        altKeys: ['work_order_id', 'id_work_order', 'workOrderId'],
      }) ?? '') === initialRow.id);
      for (const d of mine) {
        await updateRow('work_order_details', d.id, { idWorkorder: woId });
      }
      // Marcar la quote como convertida
      const converted = tags.find((t) => {
        const r = t as Record<string, unknown>;
        return String(r.name ?? '').toLowerCase().startsWith('convert') && String(r.type ?? '').includes('Quote');
      });
      await updateRow('quotes', initialRow.id, {
        convertedWorkOrderId: woId,
        ...(converted ? { idStatus: converted.id } : {}),
      });
      invalidateCatalog('quotes');
      invalidateCatalog('work_orders');
      onClose();
    } finally {
      setConverting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const data: Record<string, unknown> = {};
      for (const f of module.fields) {
        if (form[f.key] !== undefined) data[f.key] = form[f.key];
      }
      data.total = computedTotal;
      data.balance = balance;
      let woId: string;
      if (initialRow) {
        woId = initialRow.id;
        await updateRow(collection, woId, data);
      } else {
        woId = await createRow(collection, data);
      }
      // Detalles capturados en el wizard (borradores) → work_order_details
      for (const d of drafts) {
        await createRow('work_order_details', { ...d, idWorkorder: woId });
      }
      invalidateCatalog(collection);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const options = (collection: string) =>
    cat(collection).map((r) => ({ id: r.id, label: rowLabel(r) }));

  const tagOptions = cat('catalog_tag')
    .filter((t) => String((t as Record<string, unknown>).type ?? '').includes(isQuote ? 'Quote' : 'Work Order'))
    .map((r) => ({ id: r.id, label: rowLabel(r) }));

  const openQuick = (collection: string, targetKey: string) => {
    const spec = QUICK_SPECS[collection];
    if (spec) setQuickAdd({ spec, targetKey });
  };

  const onQuickCreated = async (id: string) => {
    if (!quickAdd) return;
    const collection = quickAdd.spec.collection;
    invalidateCatalog(collection);
    const fresh = await cachedFetchAll(collection);
    setCatalogs((prev) => ({ ...prev, [collection]: fresh }));
    if (quickAdd.targetKey === 'idZipcode') onZipcode(id);
    else set(quickAdd.targetKey, id);
    setQuickAdd(null);
  };

  /** Select con búsqueda + botón de alta rápida al catálogo. */
  const catalogSelect = (
    label: string, key: string, collection: string,
    opts?: { filtered?: { id: string; label: string }[]; onPick?: (id: string) => void; full?: boolean; required?: boolean },
  ) => (
    <div className={`wz-field${opts?.full ? ' wz-full' : ''}`} key={key}>
      <label htmlFor={`wz-${key}`} className={opts?.required ? 'wz-req' : undefined}>
        {label}{opts?.required ? ' *' : ''} <code className="wz-key">{key}</code>
      </label>
      <div className="wz-select-row">
        <SearchableSelect
          inputId={`wz-${key}`}
          value={String(form[key] ?? '')}
          options={opts?.filtered ?? options(collection)}
          onChange={opts?.onPick ?? ((id) => set(key, id))}
        />
        <button
          type="button"
          className="wz-quick-btn"
          onClick={() => openQuick(collection, key)}
          title="Create a new catalog entry"
          aria-label={`Add to ${label}`}
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );

  const moneyInput = (label: string, key: string, readonly = false) => (
    <div className="wz-field" key={key}>
      <label htmlFor={`wz-${key}`}>{label} <code className="wz-key">{key}</code></label>
      <div className={`wz-money${readonly ? ' readonly' : ''}`}>
        <span>$</span>
        <input
          id={`wz-${key}`}
          type="number"
          step="0.01"
          value={String(form[key] ?? '')}
          placeholder="0.00"
          readOnly={readonly}
          onChange={(e) => set(key, e.target.value)}
        />
      </div>
    </div>
  );

  const statusRow = form.idStatus ? cat('catalog_tag').find((t) => t.id === form.idStatus) : undefined;
  const missing: string[] = [];
  if (!form.idStatus) missing.push('Status');
  if (!form.idCustomer) missing.push('Customer');
  if (isInsurance && !form.idInsurance) missing.push('Insurance Carrier');

  return (
    <div className="wizard">
      {/* ===== Header ===== */}
      <header className="wz-head">
        <div className="wz-head-text">
          <h1>{initialRow ? (isQuote ? 'Edit Quote' : 'Edit Work Order') : (isQuote ? 'New Quote' : 'New Quote → Work Order')}</h1>
          <p>{isQuote ? 'Fill out the form — convert it to a Work Order when accepted' : 'Fill out the form to register the order'}</p>
        </div>
        <button type="button" className="btn-icon-ghost" onClick={onClose} aria-label="Close">
          <X size={19} />
        </button>
      </header>

      {/* ===== Cuerpo: tarjetas de sección + sidebar de sumario ===== */}
      <div className="wz-body">
        <div className="wz-main">
          {(
            <>
              <SectionCard icon={<Briefcase size={15} />} title="Order Type & Dates">
                <div className="wz-field wz-full">
                  <span className="wz-label">Insurance <code className="wz-key">insuranceType</code></span>
                  <div className="wz-toggle" role="radiogroup" aria-label="Order type">
                    {['Personal', 'Insurance'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        role="radio"
                        aria-checked={form.insuranceType === opt}
                        className={`wz-toggle-btn${form.insuranceType === opt ? ' active' : ''}`}
                        onClick={() => set('insuranceType', opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="wz-field">
                  <label htmlFor="wz-date">Date <code className="wz-key">dateRegister</code></label>
                  <input id="wz-date" type="date" value={String(form.dateRegister ?? '')} readOnly aria-label="Registration date (auto)" />
                </div>
                {catalogSelect('Status', 'idStatus', 'catalog_tag', { filtered: tagOptions, required: true })}
              </SectionCard>

              <SectionCard icon={<MapPin size={15} />} title="Company & Area">
                {catalogSelect('Company', 'idCompany', 'catalog_company', {
                filtered: cat('catalog_company')
                  .filter((c) => String((c as Record<string, unknown>).type ?? '').includes('Agent'))
                  .map((r) => ({ id: r.id, label: rowLabel(r) })),
                onPick: (id) => setForm((prev) => ({ ...prev, idCompany: id, idAgent: '' })),
              })}
              {Boolean(form.idCompany) && (
                <div className="wz-field">
                  <label htmlFor="wz-idAgent">Agent <code className="wz-key">idAgent</code></label>
                  <SearchableSelect
                    inputId="wz-idAgent"
                    value={String(form.idAgent ?? '')}
                    options={cat('team')
                      .filter((t) => String(getFieldValue(t, { key: 'companyId', altKeys: ['company_id', 'id_company'] }) ?? '') === form.idCompany)
                      .map((r) => ({ id: r.id, label: rowLabel(r) }))}
                    placeholder="Agents of this company…"
                    onChange={(id) => set('idAgent', id)}
                  />
                </div>
              )}
                {catalogSelect('Zipcode', 'idZipcode', 'catalog_zipcode', { onPick: onZipcode })}
                {moneyInput('Long trip', 'longTrip')}
              </SectionCard>
            </>
          )}

          {(
            <>
              <SectionCard icon={<Car size={15} />} title="Vehicle Information">
                <div className="wz-field">
                  <label htmlFor="wz-year">Year <code className="wz-key">year</code></label>
                  <input id="wz-year" type="number" value={String(form.year ?? '')} onChange={(e) => set('year', e.target.value)} />
                </div>
                <div className="wz-field">
                  <label htmlFor="wz-mark">Make <code className="wz-key">mark</code></label>
                  <input id="wz-mark" value={String(form.mark ?? '')} onChange={(e) => set('mark', e.target.value)} />
                </div>
                <div className="wz-field">
                  <label htmlFor="wz-model">Model <code className="wz-key">model</code></label>
                  <input id="wz-model" value={String(form.model ?? '')} onChange={(e) => set('model', e.target.value)} />
                </div>
                <div className="wz-field">
                  <label htmlFor="wz-body">Body <code className="wz-key">body</code></label>
                  <input id="wz-body" value={String(form.body ?? '')} onChange={(e) => set('body', e.target.value)} />
                </div>
                <div className="wz-field">
                  <label htmlFor="wz-vin">Vin number <code className="wz-key">vinNumber</code></label>
                  <input id="wz-vin" value={String(form.vinNumber ?? '')} onChange={(e) => set('vinNumber', e.target.value)} />
                </div>
                <div className="wz-field">
                  <label htmlFor="wz-plate">Plate <code className="wz-key">plate</code></label>
                  <input id="wz-plate" value={String(form.plate ?? '')} onChange={(e) => set('plate', e.target.value)} />
                </div>
              </SectionCard>

              <SectionCard icon={<Wrench size={15} />} title="Services part">
                <div className="wz-services wz-full">
                  <div className="wz-services-head">
                    <span className="wz-label">Parts and services for this order</span>
                    <button
                      type="button"
                      className="wz-new-btn"
                      onClick={() => setDetailModal(initialRow ? { mode: 'live-new' } : { mode: 'draft-new' })}
                    >
                      <Plus size={14} />
                      New
                    </button>
                  </div>
                  <ul className="wz-detail-list">
                    {(initialRow ? liveDetails : drafts).map((d, index) => (
                      <li key={initialRow ? (d as Row).id : index} className="wz-detail-row">
                        <span className="wz-detail-name">{detailLabel(d as DetailDraft)}</span>
                        <span className="wz-detail-amount">{money(detailAmount(d as DetailDraft))}</span>
                        <span className="wz-detail-actions">
                          <button
                            type="button"
                            className="btn-icon-ghost"
                            aria-label="Edit detail"
                            onClick={() => setDetailModal(initialRow
                              ? { mode: 'live-edit', row: d as Row }
                              : { mode: 'draft-edit', index })}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-danger-ghost"
                            aria-label="Remove detail"
                            onClick={() => initialRow ? void removeLiveDetail(d as Row) : removeDraft(index)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </span>
                      </li>
                    ))}
                    {(initialRow ? liveDetails : drafts).length === 0 && (
                      <li className="wz-service-empty">No parts added yet.</li>
                    )}
                  </ul>
                </div>
              </SectionCard>
            </>
          )}

          {(
            <>
              <SectionCard icon={<UserRound size={15} />} title="Customer">
                {catalogSelect('Customer', 'idCustomer', 'customers', { required: true })}
                <div className="wz-field">
                  <label htmlFor="wz-cust-address">Address</label>
                  <input id="wz-cust-address" value={String(customer?.address ?? '')} readOnly placeholder="Filled from the customer" />
                </div>
                <div className="wz-field">
                  <label htmlFor="wz-cust-phone">Phone</label>
                  <input id="wz-cust-phone" value={String(customer?.phone ?? '')} readOnly placeholder="Filled from the customer" />
                </div>
                <div className="wz-field">
                  <label htmlFor="wz-cust-email">Email</label>
                  <input id="wz-cust-email" value={String(customer?.email ?? '')} readOnly placeholder="Filled from the customer" />
                </div>
              </SectionCard>

              <SectionCard icon={<CalendarDays size={15} />} title="Schedule">
                <div className="wz-field">
                  <label htmlFor="wz-appt">Appoiment date <code className="wz-key">appointmentDate</code></label>
                  <input id="wz-appt" type="date" value={String(form.appointmentDate ?? '')} onChange={(e) => set('appointmentDate', e.target.value)} />
                </div>
                <div className="wz-field">
                  <label htmlFor="wz-time-in">Time start</label>
                  <input id="wz-time-in" type="time" value={String(form.timeIn ?? '')} onChange={(e) => set('timeIn', e.target.value)} />
                </div>
                <div className="wz-field">
                  <label htmlFor="wz-time-out">Time end</label>
                  <input id="wz-time-out" type="time" value={String(form.timeOut ?? '')} onChange={(e) => set('timeOut', e.target.value)} />
                </div>
              </SectionCard>
            </>
          )}

          {isInsurance && (
            <SectionCard icon={<ShieldCheck size={15} />} title="Insurance">
              {catalogSelect('Insurance Carrier', 'idInsurance', 'catalog_insurance', { required: true })}
              {moneyInput('Deductible', 'deductible')}
              {moneyInput('Kit Flat Rate', 'kitFlatRate')}
              <div className="wz-field">
                <label htmlFor="wz-auth">ID Autorization <code className="wz-key">idAutorization</code></label>
                <input id="wz-auth" value={String(form.idAutorization ?? '')} onChange={(e) => set('idAutorization', e.target.value)} />
              </div>
            </SectionCard>
          )}

          {(
            <>
              <SectionCard icon={<Calculator size={15} />} title="Subtotals">
                <div className="wz-field" key="subtotalPart">
                  <label htmlFor="wz-subtotalPart">Subtotal part <code className="wz-key">subtotalPart</code></label>
                  <div className="wz-money">
                    <span>$</span>
                    <input
                      id="wz-subtotalPart"
                      type="number"
                      step="0.01"
                      value={String(form.subtotalPart ?? '')}
                      placeholder="0.00"
                      onChange={(e) => {
                        const raw = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          subtotalPart: raw,
                          taxDolar: taxFor(num(raw), num(prev.taxPercent)),
                        }));
                      }}
                    />
                  </div>
                </div>
                {moneyInput('Subtotal molding', 'subtotalMolding')}
                {moneyInput('Subtotal services', 'subtotalServices')}
                {moneyInput('Total labor', 'totalLabor')}
              </SectionCard>

              <SectionCard icon={<Percent size={15} />} title="Taxes & Adjustments">
                <div className="wz-field">
                  <span className="wz-label">Upsell <code className="wz-key">upsell</code></span>
                  <div className="wz-stepper">
                    <span>$</span>
                    <input
                      type="number"
                      step="1"
                      value={String(form.upsell ?? '')}
                      placeholder="0"
                      aria-label="Upsell"
                      onChange={(e) => set('upsell', e.target.value)}
                    />
                    <button type="button" onClick={() => set('upsell', num(form.upsell) - 1)} aria-label="Decrease">
                      <Minus size={14} />
                    </button>
                    <button type="button" onClick={() => set('upsell', num(form.upsell) + 1)} aria-label="Increase">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div className="wz-field">
                  <label htmlFor="wz-taxp">Tax Percent <code className="wz-key">taxPercent</code></label>
                  <div className="wz-money">
                    <span>%</span>
                    <input
                      id="wz-taxp"
                      type="number"
                      step="0.0001"
                      value={String(form.taxPercent ?? '')}
                      placeholder="0.0000"
                      onChange={(e) => onTaxPercent(e.target.value)}
                    />
                  </div>
                </div>
                {moneyInput('Tax $', 'taxDolar')}
                {moneyInput('Cash comeback', 'cashComeback')}
                <div className="wz-field" key="upsold">
                  <label htmlFor="wz-upsold">Upsold <code className="wz-key">upsold</code></label>
                  <div className="wz-money">
                    <span>$</span>
                    <input
                      id="wz-upsold"
                      type="number"
                      step="0.01"
                      value={String(form.upsold ?? '')}
                      placeholder="0.00"
                      onChange={(e) => {
                        const raw = e.target.value;
                        // Fórmula del cliente: UPSELL (valor inicial) = UPSOLD − TOTAL
                        setForm((prev) => ({
                          ...prev,
                          upsold: raw,
                          upsell: Math.round((num(raw) - computedTotal) * 100) / 100,
                        }));
                      }}
                    />
                  </div>
                </div>
                {moneyInput('Paid', 'paid')}
                <div className="wz-field wz-full wz-order-total">
                  <span className="wz-label">Order Total</span>
                  <div className="wz-money readonly">
                    <span>$</span>
                    <input value={computedTotal.toFixed(2)} readOnly aria-label="Order total (computed)" />
                  </div>
                </div>
              </SectionCard>
            </>
          )}
        </div>

        {/* ===== Sidebar de sumario (tarjetas apiladas) ===== */}
        <aside className="wz-summary">
          <div className={`wz-sum-card wz-alert${missing.length === 0 ? ' ok' : ''}`}>
            <p className="wz-sum-card-title"><ClipboardList size={13} />Status</p>
            {missing.length > 0 ? (
              <p className="wz-alert-text">
                To complete this order, please select: <strong>{missing.join(' and ')}</strong>.
              </p>
            ) : (
              <p className="wz-alert-text ok">
                Order ready to save — status: <strong>{rowLabel(statusRow)}</strong>
              </p>
            )}
          </div>

          <div className="wz-sum-card">
            <p className="wz-sum-card-title"><UserRound size={13} />Customer & Schedule</p>
            <dl>
              <div><dt>Customer</dt><dd>{customer ? rowLabel(customer as Row) : 'No customer'}</dd></div>
              <div><dt>Appointment</dt><dd>{String(form.appointmentDate ?? '') || '—'}</dd></div>
              <div><dt>Time</dt><dd>{form.timeIn || form.timeOut ? `${form.timeIn ?? ''} – ${form.timeOut ?? ''}` : '—'}</dd></div>
            </dl>
          </div>

          <div className="wz-sum-card">
            <p className="wz-sum-card-title"><Car size={13} />Vehicle & Area</p>
            <dl>
              <div><dt>Vehicle</dt><dd>{[form.year, form.mark, form.model].filter(Boolean).join(' ') || '—'}</dd></div>
              <div><dt>Body / Plate</dt><dd>{[form.body, form.plate].filter(Boolean).join(' · ') || '—'}</dd></div>
              <div><dt>VIN</dt><dd>{String(form.vinNumber ?? '') || '—'}</dd></div>
              <div><dt>Zipcode</dt><dd>{form.idZipcode ? rowLabel(cat('catalog_zipcode').find((z) => z.id === form.idZipcode)) : '—'}</dd></div>
              <div><dt>Parts</dt><dd>{initialRow ? liveDetails.length : drafts.length}</dd></div>
            </dl>
          </div>

          {isInsurance && (
            <div className="wz-sum-card">
              <p className="wz-sum-card-title"><ShieldCheck size={13} />Insurance</p>
              <dl>
                <div><dt>Carrier</dt><dd>{form.idInsurance ? rowLabel(cat('catalog_insurance').find((i) => i.id === form.idInsurance)) : '—'}</dd></div>
                <div><dt>Deductible</dt><dd>{money(num(form.deductible))}</dd></div>
                <div><dt>Kit Flat Rate</dt><dd>{money(num(form.kitFlatRate))}</dd></div>
              </dl>
            </div>
          )}

          <div className="wz-sum-card">
            <p className="wz-sum-card-title"><Calculator size={13} />Financial</p>
            <dl>
              <div><dt>Subtotal parts</dt><dd>{money(num(form.subtotalPart))}</dd></div>
              <div><dt>Molding</dt><dd>{money(num(form.subtotalMolding))}</dd></div>
              <div><dt>Services</dt><dd>{money(num(form.subtotalServices))}</dd></div>
              <div><dt>Labor</dt><dd>{money(num(form.totalLabor))}</dd></div>
              <div><dt>Tax ({String(form.taxPercent ?? 0) || 0}%)</dt><dd>{money(num(form.taxDolar))}</dd></div>
              <div><dt>Long trip</dt><dd>{money(num(form.longTrip))}</dd></div>
              {isInsurance && <div><dt>Kit flat rate</dt><dd>{money(num(form.kitFlatRate))}</dd></div>}
              {isInsurance && <div><dt>Deductible</dt><dd>−{money(num(form.deductible))}</dd></div>}
              <div><dt>Upsell</dt><dd>{money(num(form.upsell))}</dd></div>
              <div><dt>Paid</dt><dd>{money(num(form.paid))}</dd></div>
            </dl>
            <div className="wz-total-box">
              <span>Order total</span>
              <strong>{money(computedTotal)}</strong>
              <em>Balance: {money(balance)}</em>
            </div>
          </div>

          <div className="wz-sum-actions">
            {isQuote && initialRow && !(initialRow as Record<string, unknown>).convertedWorkOrderId && (
              <button type="button" className="btn-primary wz-convert" onClick={() => void convertToWorkOrder()} disabled={converting}>
                <ArrowRightCircle size={16} />
                {converting ? 'Converting…' : 'Convert to Work Order'}
              </button>
            )}
            {isQuote && initialRow && Boolean((initialRow as Record<string, unknown>).convertedWorkOrderId) && (
              <p className="wz-converted-note">Already converted to a Work Order.</p>
            )}
            <button type="button" className="btn-dark wz-save" onClick={() => void save()} disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving…' : isQuote ? 'Save Quote' : 'Save Work Order'}
            </button>
            <button type="button" className="btn-outline wz-cancel" onClick={onClose}>
              <X size={15} />
              Cancelar
            </button>
          </div>
        </aside>
      </div>

      {detailModal && (
        <ServiceDetailModal
          initialRow={detailModal.mode === 'live-edit' ? detailModal.row : null}
          inheritedInsurance={String(form.insuranceType ?? 'Personal')}
          fixedWorkOrderId={initialRow && (detailModal.mode === 'live-new' || detailModal.mode === 'live-edit') ? initialRow.id : undefined}
          draft={!initialRow ? {
            initial: detailModal.mode === 'draft-edit' ? drafts[detailModal.index] : undefined,
            onSave: (data) => {
              if (detailModal.mode === 'draft-edit') {
                applyDrafts(drafts.map((d, i) => (i === detailModal.index ? data : d)));
              } else {
                applyDrafts([...drafts, data]);
              }
            },
          } : undefined}
          onClose={() => {
            setDetailModal(null);
            if (initialRow) void loadLiveDetails();
          }}
        />
      )}

      {quickAdd && (
        <QuickAdd
          spec={quickAdd.spec}
          onCreated={(id) => void onQuickCreated(id)}
          onClose={() => setQuickAdd(null)}
        />
      )}
    </div>
  );
}
