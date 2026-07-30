import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import type { Row } from '../services/firestore';
import { createRow, updateRow } from '../services/firestore';
import { cachedFetchAll, invalidateCatalog } from '../services/catalogCache';
import { getModule } from '../config/modules';
import { getFieldValue, money, rowLabel } from '../utils/relations';
import './ServiceDetailModal.css';

interface Props {
  initialRow: Row | null;
  onClose: () => void;
  /** Orden ya existente: oculta el select de WO y guarda directo ligado a ella */
  fixedWorkOrderId?: string;
  /** Orden aún no creada: no toca Firestore, entrega el borrador al wizard */
  draft?: { initial?: Record<string, unknown>; onSave: (data: Record<string, unknown>) => void };
  /** Tipo de la orden (Personal/Insurance) — el detalle lo hereda, no se pregunta */
  inheritedInsurance?: string;
}

type Form = Record<string, unknown>;

const CATALOGS = [
  'work_orders', 'catalog_jobtype', 'catalog_part_number',
  'catalog_company', 'catalog_price_tier', 'catalog_calibration_type',
] as const;

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

/** Etiqueta legible de una work order para el select (número, vehículo o id). */
function woLabel(wo: Row): string {
  const r = wo as Record<string, unknown>;
  const number = getFieldValue(r, { key: 'workOrderNumber', altKeys: ['work_order_number', 'wo_number', 'work_order'] });
  if (typeof number === 'string' && number) return number;
  const mark = getFieldValue(r, { key: 'mark', altKeys: ['make'] });
  const model = getFieldValue(r, { key: 'model' });
  const vehicle = [mark, model].filter(Boolean).join(' ');
  return vehicle || `WO ${wo.id.slice(0, 6)}`;
}

/** Formulario "New Glass" del cliente: detalle de servicio con toggles condicionales. */
export default function ServiceDetailModal({ initialRow, onClose, fixedWorkOrderId, draft, inheritedInsurance }: Props) {
  const module = useMemo(() => getModule('servicesdetail'), []);

  const [form, setForm] = useState<Form>(() => {
    const base: Form = { type: 'Parts', insurance: inheritedInsurance ?? 'Personal', pricetier: false, calibrationType: false };
    const source = draft?.initial ?? initialRow;
    if (source) {
      for (const f of module.fields) {
        const v = getFieldValue(source, f);
        if (v !== undefined) base[f.key] = v;
      }
      base.pricetier = Boolean(base.pricetier);
      base.calibrationType = Boolean(base.calibrationType);
    }
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [nagsDraft, setNagsDraft] = useState('');
  const [nagsSaving, setNagsSaving] = useState(false);
  const [catalogs, setCatalogs] = useState<Record<string, Row[]>>({});

  useEffect(() => {
    let alive = true;
    void Promise.all(CATALOGS.map((c) => cachedFetchAll(c))).then((results) => {
      if (!alive) return;
      setCatalogs(Object.fromEntries(CATALOGS.map((c, i) => [c, results[i]])));
    });
    return () => { alive = false; };
  }, []);

  const cat = (name: string) => catalogs[name] ?? [];
  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  /** Total Labor = price tier amount + calibration amount (editable después). */
  const syncLabor = (patch: Form) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      next.totalLabor = num(next.pricetier ? next.amountPricetier : 0)
        + num(next.calibrationType ? next.amountCalibrationtype : 0);
      return next;
    });
  };

  /** Cálculos NAGS (camino Insurance): precio con descuento y labor por hora. */
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const syncNags = (patch: Form) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      const listPrice = num(next.listPrice);
      const discountRate = num(next.nagsDiscountRate);
      next.pricePartInsurance = round2(listPrice * (1 - discountRate / 100));
      next.totalLaborHour = round2(num(next.nagsLaborHour) * num(next.priceForHour));
      return next;
    });
  };

  /** Elegir tier/calibración autollena su Amount desde el catálogo. */
  const pickTier = (id: string) => {
    const tier = cat('catalog_price_tier').find((t) => t.id === id) as Record<string, unknown> | undefined;
    syncLabor({ idPricetier: id, amountPricetier: num(getFieldValue(tier ?? {}, { key: 'amount', altKeys: ['price'] })) });
  };
  const pickCalibration = (id: string) => {
    const cal = cat('catalog_calibration_type').find((c) => c.id === id) as Record<string, unknown> | undefined;
    syncLabor({ idCalibrationType: id, amountCalibrationtype: num(getFieldValue(cal ?? {}, { key: 'amount', altKeys: ['price'] })) });
  };

  // Jobtype filtrado por el Type elegido (Parts/Services); Molding muestra todos
  const jobtypeOptions = useMemo(() => {
    const all = catalogs['catalog_jobtype'] ?? [];
    const type = String(form.type ?? '');
    const filtered = (type === 'Parts' || type === 'Services')
      ? all.filter((j) => String((j as Record<string, unknown>).type ?? '').includes(type))
      : all;
    return (filtered.length > 0 ? filtered : all).map((r) => ({ id: r.id, label: rowLabel(r) }));
  }, [catalogs, form.type]);

  const distributorOptions = useMemo(() =>
    (catalogs['catalog_company'] ?? [])
      .filter((c) => String((c as Record<string, unknown>).type ?? '').includes('Distributor'))
      .map((r) => ({ id: r.id, label: rowLabel(r) })),
  [catalogs]);

  const selectedPart = form.idPartnumber
    ? cat('catalog_part_number').find((p) => p.id === form.idPartnumber)
    : undefined;
  const partNags = selectedPart
    ? String(getFieldValue(selectedPart, { key: 'nagsDescription', altKeys: ['nags_description', 'description'] }) ?? '')
    : '';

  /** El part number no tiene descripción NAGS → agregarla al registro del catálogo. */
  const saveNags = async () => {
    if (!selectedPart || !nagsDraft.trim()) return;
    setNagsSaving(true);
    try {
      await updateRow('catalog_part_number', selectedPart.id, { nags_description: nagsDraft.trim() });
      invalidateCatalog('catalog_part_number');
      const fresh = await cachedFetchAll('catalog_part_number');
      setCatalogs((prev) => ({ ...prev, catalog_part_number: fresh }));
      setNagsDraft('');
    } finally {
      setNagsSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const data: Form = {};
      for (const f of module.fields) {
        if (form[f.key] !== undefined) data[f.key] = form[f.key];
      }
      // Sin el toggle activo, no se persisten selección ni monto
      if (!form.pricetier) { data.idPricetier = ''; data.amountPricetier = 0; }
      if (!form.calibrationType) { data.idCalibrationType = ''; data.amountCalibrationtype = 0; }

      if (draft) {
        // Orden nueva: el detalle queda como borrador en el wizard
        delete data.idWorkorder;
        draft.onSave(data);
        onClose();
        return;
      }
      if (fixedWorkOrderId) data.idWorkorder = fixedWorkOrderId;
      if (initialRow) await updateRow('work_order_details', initialRow.id, data);
      else await createRow('work_order_details', data);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const yesNo = (key: string, onChange?: (value: boolean) => void) => (
    <div className="sd-toggle" role="radiogroup">
      {[false, true].map((value) => (
        <button
          key={String(value)}
          type="button"
          role="radio"
          aria-checked={Boolean(form[key]) === value}
          className={`sd-toggle-btn${Boolean(form[key]) === value ? ' active' : ''}`}
          onClick={() => (onChange ? onChange(value) : set(key, value))}
        >
          {value ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  );

  const jobtypeName = form.idJobtype ? rowLabel(cat('catalog_jobtype').find((j) => j.id === form.idJobtype)) : '—';
  const partName = form.idPartnumber ? rowLabel(selectedPart) : '—';
  const distributorName = form.idDistributor ? rowLabel(cat('catalog_company').find((c) => c.id === form.idDistributor)) : '—';
  const isServices = form.type === 'Services';
  const isPartsInsurance = form.type === 'Parts' && form.insurance === 'Insurance';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card sd-card" onClick={(e) => e.stopPropagation()}>
        <header className="sd-head">
          <button type="button" className="btn-icon-ghost" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
          <h2>{initialRow ? 'Edit Glass' : 'New Glass'}</h2>
          <div className="sd-head-actions">
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </header>

        <div className="sd-layout">
          <div className="sd-body">
            {!fixedWorkOrderId && !draft && (
              <div className="sd-row sd-full">
                <span className="sd-label">Work Order *</span>
                <SearchableSelect
                  value={String(form.idWorkorder ?? '')}
                  options={cat('work_orders').map((wo) => ({ id: wo.id, label: woLabel(wo) }))}
                  required
                  onChange={(id) => {
                    const wo = cat('work_orders').find((r) => r.id === id);
                    const woInsurance = wo ? String(getFieldValue(wo, {
                      key: 'insuranceType',
                      altKeys: ['insurrance', 'insurance', 'insurance_type'],
                    }) ?? 'Personal') : 'Personal';
                    setForm((prev) => ({ ...prev, idWorkorder: id, insurance: woInsurance }));
                  }}
                />
              </div>
            )}

            {/* ============ Detail ============ */}
            <p className="sd-section-title sd-full">Detail</p>
            <div className="sd-row sd-full">
              <span className="sd-label">Type</span>
              <div className="sd-toggle" role="radiogroup" aria-label="Detail type">
                {['Parts', 'Services', 'Molding'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={form.type === opt}
                    className={`sd-toggle-btn${form.type === opt ? ' active' : ''}`}
                    onClick={() => set('type', opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="sd-row">
              <span className="sd-label">Jobtype</span>
              <SearchableSelect
                value={String(form.idJobtype ?? '')}
                options={jobtypeOptions}
                onChange={(id) => set('idJobtype', id)}
              />
            </div>
            <div className="sd-row">
              <span className="sd-label">Part Number</span>
              <SearchableSelect
                value={String(form.idPartnumber ?? '')}
                options={cat('catalog_part_number').map((r) => ({ id: r.id, label: rowLabel(r) }))}
                onChange={(id) => set('idPartnumber', id)}
              />
            </div>
            {selectedPart && (
              <div className="sd-row sd-full sd-sub sd-nags">
                <span className="sd-label">NAGS description</span>
                {partNags ? (
                  <p className="sd-nags-text">{partNags}</p>
                ) : (
                  <div className="sd-nags-add">
                    <input
                      className="sd-input"
                      value={nagsDraft}
                      placeholder="This part has no NAGS description — add it here…"
                      aria-label="NAGS description"
                      onChange={(e) => setNagsDraft(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={nagsSaving || !nagsDraft.trim()}
                      onClick={() => void saveNags()}
                    >
                      {nagsSaving ? 'Saving…' : 'Add'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {isServices && (
              <>
                <div className="sd-row">
                  <span className="sd-label">Description</span>
                  <input
                    className="sd-input"
                    value={String(form.description ?? '')}
                    aria-label="Service description"
                    onChange={(e) => set('description', e.target.value)}
                  />
                </div>
                <div className="sd-row">
                  <span className="sd-label">Amount</span>
                  <div className="sd-money">
                    <span>$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={String(form.amount ?? '')}
                      placeholder="0.00"
                      aria-label="Service amount"
                      onChange={(e) => set('amount', e.target.value)}
                    />
                  </div>
                </div>
                <div className="sd-row sd-full">
                  <span className="sd-label">Note</span>
                  <input
                    className="sd-input"
                    value={String(form.note ?? '')}
                    aria-label="Service note"
                    onChange={(e) => set('note', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* ============ Sourcing ============ */}
            <p className="sd-section-title sd-full">Sourcing</p>
            <div className="sd-row">
              <span className="sd-label">Glass Cost</span>
              <div className="sd-money">
                <span>$</span>
                <input
                  type="number"
                  step="0.01"
                  value={String(form.glassCost ?? '')}
                  placeholder="0.00"
                  aria-label="Glass cost"
                  onChange={(e) => set('glassCost', e.target.value)}
                />
              </div>
            </div>
            <div className="sd-row">
              <span className="sd-label">Distributor</span>
              <SearchableSelect
                value={String(form.idDistributor ?? '')}
                options={distributorOptions}
                onChange={(id) => set('idDistributor', id)}
              />
            </div>
            <div className="sd-row">
              <span className="sd-label">Order number</span>
              <input
                className="sd-input"
                value={String(form.orderNumber ?? '')}
                aria-label="Order number"
                onChange={(e) => set('orderNumber', e.target.value)}
              />
            </div>

            {isPartsInsurance && (
              <>
                <p className="sd-section-title sd-full">Insurance / NAGS pricing</p>
                <div className="sd-row">
                  <span className="sd-label">List Price</span>
                  <div className="sd-money">
                    <span>$</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={String(form.listPrice ?? '')}
                      placeholder="0.0000"
                      aria-label="List price"
                      onChange={(e) => syncNags({ listPrice: e.target.value })}
                    />
                  </div>
                </div>
                <div className="sd-row">
                  <span className="sd-label">Nags Discount Rate</span>
                  <div className="sd-money">
                    <span>%</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={String(form.nagsDiscountRate ?? '')}
                      placeholder="0.0000"
                      aria-label="NAGS discount rate"
                      onChange={(e) => syncNags({ nagsDiscountRate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="sd-row">
                  <span className="sd-label">Price Part Insurance</span>
                  <div className="sd-money readonly">
                    <span>$</span>
                    <input value={String(form.pricePartInsurance ?? '0.00')} readOnly aria-label="Price part insurance (computed)" />
                  </div>
                </div>
                <div className="sd-row">
                  <span className="sd-label">Nags Labor Hour</span>
                  <input
                    className="sd-input"
                    type="number"
                    step="0.0001"
                    value={String(form.nagsLaborHour ?? '')}
                    placeholder="0.0000"
                    aria-label="NAGS labor hours"
                    onChange={(e) => syncNags({ nagsLaborHour: e.target.value })}
                  />
                </div>
                <div className="sd-row">
                  <span className="sd-label">Price For Hour</span>
                  <div className="sd-money">
                    <span>$</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={String(form.priceForHour ?? '')}
                      placeholder="0.0000"
                      aria-label="Price per hour"
                      onChange={(e) => syncNags({ priceForHour: e.target.value })}
                    />
                  </div>
                </div>
                <div className="sd-row">
                  <span className="sd-label">Total Labor Hour</span>
                  <div className="sd-money readonly">
                    <span>$</span>
                    <input value={String(form.totalLaborHour ?? '0.00')} readOnly aria-label="Total labor hour (computed)" />
                  </div>
                </div>
              </>
            )}

            {/* ============ Pricing & labor ============ */}
            <p className="sd-section-title sd-full">Pricing &amp; labor</p>
            <div className="sd-row">
              <span className="sd-label">Price tier</span>
              {yesNo('pricetier', (value) => syncLabor({ pricetier: value }))}
            </div>
            <div className="sd-row">
              <span className="sd-label">Calibration type</span>
              {yesNo('calibrationType', (value) => syncLabor({ calibrationType: value }))}
            </div>
            {Boolean(form.pricetier) && (
              <div className="sd-row sd-full sd-sub sd-composite">
                <span className="sd-label">Tier</span>
                <div className="sd-composite-controls">
                  <div className="sd-toggle" role="radiogroup" aria-label="Price tier">
                    {cat('catalog_price_tier').map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        role="radio"
                        aria-checked={form.idPricetier === tier.id}
                        className={`sd-toggle-btn${form.idPricetier === tier.id ? ' active' : ''}`}
                        onClick={() => pickTier(tier.id)}
                      >
                        {rowLabel(tier)}
                      </button>
                    ))}
                  </div>
                  <div className="sd-money">
                    <span>$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={String(form.amountPricetier ?? '')}
                      placeholder="0.00"
                      aria-label="Price tier amount"
                      onChange={(e) => syncLabor({ amountPricetier: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}
            {Boolean(form.calibrationType) && (
              <div className="sd-row sd-full sd-sub sd-composite">
                <span className="sd-label">Calibration</span>
                <div className="sd-composite-controls">
                  <div className="sd-toggle" role="radiogroup" aria-label="Calibration type">
                    {cat('catalog_calibration_type').map((cal) => (
                      <button
                        key={cal.id}
                        type="button"
                        role="radio"
                        aria-checked={form.idCalibrationType === cal.id}
                        className={`sd-toggle-btn${form.idCalibrationType === cal.id ? ' active' : ''}`}
                        onClick={() => pickCalibration(cal.id)}
                      >
                        {rowLabel(cal)}
                      </button>
                    ))}
                  </div>
                  <div className="sd-money">
                    <span>$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={String(form.amountCalibrationtype ?? '')}
                      placeholder="0.00"
                      aria-label="Calibration amount"
                      onChange={(e) => syncLabor({ amountCalibrationtype: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="sd-row sd-full sd-total">
              <span className="sd-label">Total Labor</span>
              <div className="sd-money">
                <span>$</span>
                <input
                  type="number"
                  step="0.01"
                  value={String(form.totalLabor ?? '')}
                  placeholder="0"
                  aria-label="Total labor"
                  onChange={(e) => set('totalLabor', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ============ Sumario ============ */}
          <aside className="sd-summary">
            <p className="sd-sum-title">Summary</p>
            <span className={`sd-type-pill t-${String(form.type).toLowerCase()}`}>{String(form.type)}</span>
            <dl>
              <div><dt>Jobtype</dt><dd>{jobtypeName}</dd></div>
              <div><dt>Part number</dt><dd>{partName}</dd></div>
              <div><dt>Distributor</dt><dd>{distributorName}</dd></div>
              <div><dt>Insurance</dt><dd>{String(form.insurance ?? '—')} <em className="sd-inherited">(from order)</em></dd></div>
            </dl>
            <div className="sd-sum-money">
              <dl>
                <div><dt>Glass cost</dt><dd>{money(num(form.glassCost))}</dd></div>
                {isServices && <div><dt>Service amount</dt><dd>{money(num(form.amount))}</dd></div>}
                {Boolean(form.pricetier) && <div><dt>Tier amount</dt><dd>{money(num(form.amountPricetier))}</dd></div>}
                {Boolean(form.calibrationType) && <div><dt>Calibration</dt><dd>{money(num(form.amountCalibrationtype))}</dd></div>}
                {isPartsInsurance && <div><dt>Price part INS</dt><dd>{money(num(form.pricePartInsurance))}</dd></div>}
                {isPartsInsurance && <div><dt>Labor hour</dt><dd>{money(num(form.totalLaborHour))}</dd></div>}
              </dl>
            </div>
            <div className="sd-labor-box">
              <span>Total labor</span>
              <strong>{money(num(form.totalLabor))}</strong>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
