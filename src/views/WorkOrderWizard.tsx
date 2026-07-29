import { useEffect, useMemo, useState } from 'react';
import {
  Calculator, Car, Check, ChevronLeft, ChevronRight, ClipboardList,
  FileText, Minus, Plus, ShieldCheck, Trash2, UserRound, X,
} from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { getModule } from '../config/modules';
import type { Row } from '../services/firestore';
import { createRow, fetchAll, updateRow } from '../services/firestore';
import { getFieldValue, money, rowLabel } from '../utils/relations';
import './WorkOrderWizard.css';

interface Props {
  initialRow: Row | null;
  onClose: () => void;
}

type Form = Record<string, unknown>;

interface ServiceRow {
  idJobtype: string;
  idPartnumber: string;
  price: number;
}

/** Colecciones que el wizard necesita para selects y sumario. */
const CATALOGS = [
  'catalog_tag', 'catalog_company', 'catalog_zipcode', 'customers',
  'catalog_insurance', 'catalog_jobtype', 'catalog_part_number',
] as const;

/* ==================== Alta rápida de catálogos (sin salir del formulario) ==================== */

interface QuickField { key: string; label: string; type?: 'number' }
interface QuickSpec { title: string; collection: string; fields: QuickField[]; defaults?: Record<string, unknown> }

const QUICK_SPECS: Record<string, QuickSpec> = {
  catalog_tag: {
    title: 'Nuevo status',
    collection: 'catalog_tag',
    fields: [{ key: 'name', label: 'Nombre' }, { key: 'color', label: 'Color (Green, Red, Blue…)' }],
    defaults: { type: 'Work Order' },
  },
  catalog_company: {
    title: 'Nueva company',
    collection: 'catalog_company',
    fields: [{ key: 'name', label: 'Nombre' }, { key: 'type', label: 'Tipo (Distributor / Agent)' }],
  },
  catalog_zipcode: {
    title: 'Nuevo zipcode',
    collection: 'catalog_zipcode',
    fields: [
      { key: 'zipcode', label: 'Zipcode' }, { key: 'city', label: 'Ciudad' },
      { key: 'state', label: 'Estado' }, { key: 'tax', label: 'Tax (ej. 0.0725)', type: 'number' },
      { key: 'long_trip', label: 'Long trip $', type: 'number' },
    ],
  },
  customers: {
    title: 'Nuevo cliente',
    collection: 'customers',
    fields: [
      { key: 'first_name', label: 'Nombre' }, { key: 'last_name', label: 'Apellido' },
      { key: 'phone', label: 'Teléfono' }, { key: 'email', label: 'Email' },
      { key: 'address', label: 'Dirección' },
    ],
  },
  catalog_insurance: {
    title: 'Nueva aseguradora',
    collection: 'catalog_insurance',
    fields: [{ key: 'name', label: 'Nombre' }],
  },
  catalog_jobtype: {
    title: 'Nuevo job type',
    collection: 'catalog_jobtype',
    fields: [{ key: 'name', label: 'Nombre' }, { key: 'type', label: 'Tipo (Parts / Services)' }],
  },
  catalog_part_number: {
    title: 'Nuevo part number',
    collection: 'catalog_part_number',
    fields: [{ key: 'part_number', label: 'Part number' }, { key: 'nags_description', label: 'Descripción NAGS' }],
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
          <button type="button" className="btn-icon-ghost" onClick={onClose} aria-label="Cerrar">
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
          <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-dark" onClick={() => void save()} disabled={saving}>
            {saving ? 'Guardando…' : 'Crear y usar'}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ==================== Wizard ==================== */

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

export default function WorkOrderWizard({ initialRow, onClose }: Props) {
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
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [catalogs, setCatalogs] = useState<Record<string, Row[]>>({});
  const [quickAdd, setQuickAdd] = useState<{ spec: QuickSpec; targetKey: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all(CATALOGS.map((c) => fetchAll(c))).then((results) => {
      if (!alive) return;
      setCatalogs(Object.fromEntries(CATALOGS.map((c, i) => [c, results[i]])));
    });
    return () => { alive = false; };
  }, []);

  const cat = (name: string) => catalogs[name] ?? [];
  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  const isInsurance = form.insuranceType === 'Insurance';
  const steps = useMemo(
    () => ['Work Order', 'Vehículo', 'Cliente', ...(isInsurance ? ['Insurance'] : []), 'Totales'],
    [isInsurance],
  );
  const lastStep = step === steps.length - 1;
  const stepName = steps[step];

  /* ===== Cálculos en vivo (subtotales → tax → total) ===== */
  const subtotal = num(form.subtotalPart) + num(form.subtotalMolding) + num(form.subtotalServices);
  const computedTotal = subtotal + num(form.totalLabor) + num(form.taxDolar) + num(form.longTrip) + num(form.upsell) - num(form.discount);
  const balance = computedTotal - num(form.paid);

  /** Zipcode del catálogo → autollenar tax % y long trip (dato del cliente). */
  const onZipcode = (id: string) => {
    set('idZipcode', id);
    const zip = cat('catalog_zipcode').find((z) => z.id === id) as Record<string, unknown> | undefined;
    if (!zip) return;
    const tax = num(getFieldValue(zip, { key: 'tax' }));
    const longTrip = num(getFieldValue(zip, { key: 'longTrip', altKeys: ['long_trip'] }));
    setForm((prev) => ({
      ...prev,
      idZipcode: id,
      taxPercent: tax < 1 ? Math.round(tax * 10000) / 100 : tax,
      longTrip,
    }));
  };

  const recomputeTax = (percent: number, base: number) =>
    Math.round(base * percent) / 100;

  const onTaxPercent = (raw: string) => {
    const pct = num(raw);
    setForm((prev) => ({
      ...prev,
      taxPercent: raw,
      taxDolar: recomputeTax(pct, num(prev.subtotalPart) + num(prev.subtotalMolding) + num(prev.subtotalServices)),
    }));
  };

  /* ===== Servicios (solo al crear) ===== */
  /** Al cambiar los servicios, el subtotal de parts se sincroniza en el mismo handler. */
  const applyServices = (next: ServiceRow[]) => {
    setServices(next);
    if (next.length > 0) {
      const sum = next.reduce((s, r) => s + num(r.price), 0);
      setForm((prev) => ({ ...prev, subtotalPart: sum }));
    }
  };
  const addService = () => applyServices([...services, { idJobtype: '', idPartnumber: '', price: 0 }]);
  const updateService = (index: number, patch: Partial<ServiceRow>) => {
    applyServices(services.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };
  const removeService = (index: number) => applyServices(services.filter((_, i) => i !== index));

  const customer = cat('customers').find((c) => c.id === form.idCustomer) as Record<string, unknown> | undefined;

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
        await updateRow('work_orders', woId, data);
      } else {
        woId = await createRow('work_orders', data);
      }
      // Servicios capturados en el wizard → work_order_details
      for (const s of services) {
        if (!s.idJobtype && !s.idPartnumber) continue;
        await createRow('work_order_details', {
          idWorkorder: woId,
          idJobtype: s.idJobtype,
          idPartnumber: s.idPartnumber,
          price: num(s.price),
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const options = (collection: string) =>
    cat(collection).map((r) => ({ id: r.id, label: rowLabel(r) }));

  const tagOptions = cat('catalog_tag')
    .filter((t) => String((t as Record<string, unknown>).type ?? '').includes('Work Order'))
    .map((r) => ({ id: r.id, label: rowLabel(r) }));

  const openQuick = (collection: string, targetKey: string) => {
    const spec = QUICK_SPECS[collection];
    if (spec) setQuickAdd({ spec, targetKey });
  };

  const onQuickCreated = async (id: string) => {
    if (!quickAdd) return;
    const collection = quickAdd.spec.collection;
    const fresh = await fetchAll(collection);
    setCatalogs((prev) => ({ ...prev, [collection]: fresh }));
    if (quickAdd.targetKey === 'idZipcode') onZipcode(id);
    else set(quickAdd.targetKey, id);
    setQuickAdd(null);
  };

  /** Select con búsqueda + botón de alta rápida al catálogo. */
  const catalogSelect = (
    label: string, key: string, collection: string,
    opts?: { filtered?: { id: string; label: string }[]; onPick?: (id: string) => void; full?: boolean },
  ) => (
    <div className={`wz-field${opts?.full ? ' wz-full' : ''}`} key={key}>
      <label htmlFor={`wz-${key}`}>{label}</label>
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
          title="Crear nuevo en el catálogo"
          aria-label={`Agregar a ${label}`}
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );

  const moneyInput = (label: string, key: string, readonly = false) => (
    <div className="wz-field" key={key}>
      <label htmlFor={`wz-${key}`}>{label}</label>
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

  return (
    <div className="wizard">
      {/* ===== Header ===== */}
      <header className="wz-head">
        <button type="button" className="btn-icon-ghost" onClick={onClose} aria-label="Cerrar">
          <X size={19} />
        </button>
        <h1>{initialRow ? 'Editar Work Order' : 'Nueva Work Order'}</h1>
        <div className="wz-head-actions">
          {step > 0 && (
            <button type="button" className="btn-outline" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft size={15} />
              Prev
            </button>
          )}
          <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
          {lastStep ? (
            <button type="button" className="btn-dark" onClick={() => void save()} disabled={saving}>
              {saving ? 'Guardando…' : 'Confirmar y guardar'}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => setStep((s) => s + 1)}>
              Next
              <ChevronRight size={15} />
            </button>
          )}
        </div>
      </header>

      {/* ===== Pasos numerados ===== */}
      <ol className="wz-steps" aria-label="Pasos del formulario">
        {steps.map((name, i) => (
          <li key={name} className={`wz-step${i === step ? ' current' : ''}${i < step ? ' done' : ''}`}>
            <button type="button" className="wz-step-circle" onClick={() => setStep(i)} aria-label={`Ir al paso ${name}`}>
              {i < step ? <Check size={14} /> : i + 1}
            </button>
            <span className="wz-step-name">{name}</span>
            {i < steps.length - 1 && <span className="wz-step-connector" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {/* ===== Cuerpo: tarjeta del paso + sumario ===== */}
      <div className="wz-body">
        <section className="wz-card">
          <h2>{stepName}</h2>

          {stepName === 'Work Order' && (
            <div className="wz-fields">
              <div className="wz-field wz-full">
                <span className="wz-label">Insurance</span>
                <div className="wz-toggle" role="radiogroup" aria-label="Tipo de orden">
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
                <label htmlFor="wz-date">Date</label>
                <input
                  id="wz-date"
                  type="date"
                  value={String(form.dateRegister ?? '')}
                  onChange={(e) => set('dateRegister', e.target.value)}
                />
              </div>
              {catalogSelect('Status', 'idStatus', 'catalog_tag', { filtered: tagOptions })}
              {catalogSelect('Company', 'idCompany', 'catalog_company')}
              {catalogSelect('Zipcode', 'idZipcode', 'catalog_zipcode', { onPick: onZipcode })}
              {moneyInput('Long trip', 'longTrip')}
            </div>
          )}

          {stepName === 'Vehículo' && (
            <div className="wz-fields">
              <div className="wz-field">
                <label htmlFor="wz-year">Year</label>
                <input id="wz-year" type="number" value={String(form.year ?? '')} onChange={(e) => set('year', e.target.value)} />
              </div>
              <div className="wz-field">
                <label htmlFor="wz-vin">Vin number</label>
                <input id="wz-vin" value={String(form.vinNumber ?? '')} onChange={(e) => set('vinNumber', e.target.value)} />
              </div>
              <div className="wz-field">
                <label htmlFor="wz-plate">Plate</label>
                <input id="wz-plate" value={String(form.plate ?? '')} onChange={(e) => set('plate', e.target.value)} />
              </div>

              {!initialRow && (
                <div className="wz-services wz-full">
                  <div className="wz-services-head">
                    <span className="wz-label">Services part</span>
                    <button type="button" className="wz-new-btn" onClick={addService}>
                      <Plus size={14} />
                      New
                    </button>
                  </div>
                  <ul className="wz-service-list">
                    {services.map((s, index) => (
                      <li key={index} className="wz-service-row">
                        <SearchableSelect
                          value={s.idJobtype}
                          options={options('catalog_jobtype')}
                          placeholder="Job type…"
                          onChange={(id) => updateService(index, { idJobtype: id })}
                        />
                        <SearchableSelect
                          value={s.idPartnumber}
                          options={options('catalog_part_number')}
                          placeholder="Part number…"
                          onChange={(id) => updateService(index, { idPartnumber: id })}
                        />
                        <div className="wz-money">
                          <span>$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={String(s.price || '')}
                            placeholder="0.00"
                            aria-label="Precio"
                            onChange={(e) => updateService(index, { price: num(e.target.value) })}
                          />
                        </div>
                        <button type="button" className="btn-danger-ghost" onClick={() => removeService(index)} aria-label="Quitar">
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                    {services.length === 0 && <li className="wz-service-empty">Sin partes agregadas todavía.</li>}
                  </ul>
                </div>
              )}
            </div>
          )}

          {stepName === 'Cliente' && (
            <div className="wz-fields">
              {catalogSelect('Customer', 'idCustomer', 'customers', { full: true })}
              <div className="wz-field">
                <label htmlFor="wz-cust-address">Address</label>
                <input id="wz-cust-address" value={String(customer?.address ?? '')} readOnly placeholder="—" />
              </div>
              <div className="wz-field">
                <label htmlFor="wz-cust-phone">Phone</label>
                <input id="wz-cust-phone" value={String(customer?.phone ?? '')} readOnly placeholder="—" />
              </div>
              <div className="wz-field">
                <label htmlFor="wz-cust-email">Email</label>
                <input id="wz-cust-email" value={String(customer?.email ?? '')} readOnly placeholder="—" />
              </div>
              <div className="wz-field">
                <label htmlFor="wz-appt">Appoiment date</label>
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
            </div>
          )}

          {stepName === 'Insurance' && (
            <div className="wz-fields">
              {catalogSelect('Aseguradora', 'idInsurance', 'catalog_insurance')}
              {moneyInput('Deducible', 'deductible')}
              <div className="wz-field">
                <label htmlFor="wz-auth">ID Autorization</label>
                <input id="wz-auth" value={String(form.idAutorization ?? '')} onChange={(e) => set('idAutorization', e.target.value)} />
              </div>
            </div>
          )}

          {stepName === 'Totales' && (
            <div className="wz-fields">
              {moneyInput('Subtotal part', 'subtotalPart')}
              {moneyInput('Subtotal molding', 'subtotalMolding')}
              {moneyInput('Subtotal services', 'subtotalServices')}
              {moneyInput('Total labor', 'totalLabor')}
              <div className="wz-field">
                <span className="wz-label">Upsell</span>
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
                  <button type="button" onClick={() => set('upsell', num(form.upsell) - 1)} aria-label="Restar">
                    <Minus size={14} />
                  </button>
                  <button type="button" onClick={() => set('upsell', num(form.upsell) + 1)} aria-label="Sumar">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="wz-field">
                <label htmlFor="wz-taxp">Tax Percent</label>
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
              <div className="wz-field">
                <span className="wz-label">Total</span>
                <div className="wz-money readonly">
                  <span>$</span>
                  <input value={computedTotal.toFixed(2)} readOnly aria-label="Total calculado" />
                </div>
              </div>
              {moneyInput('Upsold', 'upsold')}
              {moneyInput('Paid', 'paid')}
            </div>
          )}
        </section>

        {/* ===== Sumario en vivo ===== */}
        <aside className="wz-summary">
          <header className="wz-sum-head">
            <span className="wz-sum-head-icon"><ClipboardList size={15} /></span>
            <h3>Sumario de la orden</h3>
            <span className={`wz-type-pill ${isInsurance ? 'ins' : 'per'}`}>{String(form.insuranceType)}</span>
          </header>

          <div className="wz-total-banner">
            <span>Total de la orden</span>
            <strong>{money(computedTotal)}</strong>
            <em>Balance pendiente: {money(balance)}</em>
          </div>

          <section className="wz-sum-section">
            <h4><FileText size={13} />Work Order</h4>
            <dl>
              <div><dt>Fecha</dt><dd>{String(form.dateRegister ?? '') || '—'}</dd></div>
              <div><dt>Status</dt><dd>{form.idStatus ? rowLabel(cat('catalog_tag').find((t) => t.id === form.idStatus)) : '—'}</dd></div>
              <div><dt>Company</dt><dd>{form.idCompany ? rowLabel(cat('catalog_company').find((c) => c.id === form.idCompany)) : '—'}</dd></div>
              <div><dt>Zipcode</dt><dd>{form.idZipcode ? rowLabel(cat('catalog_zipcode').find((z) => z.id === form.idZipcode)) : '—'}</dd></div>
            </dl>
          </section>

          <section className="wz-sum-section">
            <h4><Car size={13} />Vehículo</h4>
            <dl>
              <div><dt>Year</dt><dd>{String(form.year ?? '') || '—'}</dd></div>
              <div><dt>VIN</dt><dd>{String(form.vinNumber ?? '') || '—'}</dd></div>
              <div><dt>Plate</dt><dd>{String(form.plate ?? '') || '—'}</dd></div>
              {!initialRow && <div><dt>Partes capturadas</dt><dd>{services.length}</dd></div>}
            </dl>
          </section>

          <section className="wz-sum-section">
            <h4><UserRound size={13} />Cliente</h4>
            <dl>
              <div><dt>Customer</dt><dd>{customer ? rowLabel(customer as Row) : '—'}</dd></div>
              <div><dt>Cita</dt><dd>{String(form.appointmentDate ?? '') || '—'}</dd></div>
              <div><dt>Horario</dt><dd>{form.timeIn || form.timeOut ? `${form.timeIn ?? ''} – ${form.timeOut ?? ''}` : '—'}</dd></div>
            </dl>
          </section>

          {isInsurance && (
            <section className="wz-sum-section">
              <h4><ShieldCheck size={13} />Insurance</h4>
              <dl>
                <div><dt>Aseguradora</dt><dd>{form.idInsurance ? rowLabel(cat('catalog_insurance').find((i) => i.id === form.idInsurance)) : '—'}</dd></div>
                <div><dt>Deducible</dt><dd>{money(num(form.deductible))}</dd></div>
                <div><dt>ID Autorization</dt><dd>{String(form.idAutorization ?? '') || '—'}</dd></div>
              </dl>
            </section>
          )}

          <section className="wz-sum-section">
            <h4><Calculator size={13} />Totales</h4>
            <div className="wz-sum-money">
              <dl>
                <div><dt>Subtotal parts</dt><dd>{money(num(form.subtotalPart))}</dd></div>
                <div><dt>Subtotal molding</dt><dd>{money(num(form.subtotalMolding))}</dd></div>
                <div><dt>Subtotal services</dt><dd>{money(num(form.subtotalServices))}</dd></div>
                <div><dt>Labor</dt><dd>{money(num(form.totalLabor))}</dd></div>
                <div><dt>Tax ({String(form.taxPercent ?? 0) || 0}%)</dt><dd>{money(num(form.taxDolar))}</dd></div>
                <div><dt>Long trip</dt><dd>{money(num(form.longTrip))}</dd></div>
                <div><dt>Upsell</dt><dd>{money(num(form.upsell))}</dd></div>
                {num(form.discount) > 0 && <div className="negative"><dt>Descuento</dt><dd>−{money(num(form.discount))}</dd></div>}
                <div className="wz-sum-grand"><dt>Total</dt><dd>{money(computedTotal)}</dd></div>
                <div><dt>Pagado</dt><dd>{money(num(form.paid))}</dd></div>
                <div className="wz-sum-balance"><dt>Balance</dt><dd>{money(balance)}</dd></div>
              </dl>
            </div>
          </section>
        </aside>
      </div>

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
