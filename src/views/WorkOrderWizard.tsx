import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowRightCircle, ArrowUp, Briefcase, Calculator, CalendarDays, Car, Check,
  ClipboardList, Copy, Hash, MapPin, Minus, Pencil, Percent, Plus, Save, ShieldCheck,
  Trash2, UserRound, Wrench, X,
} from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import ServiceDetailModal from './ServiceDetailModal';
import { getModule } from '../config/modules';
import type { Row } from '../services/firestore';
import { createRow, fetchAll, nextConsecutive, updateRow } from '../services/firestore';
import { cachedFetchAll, invalidateCatalog } from '../services/catalogCache';
import type { KindRules } from '../utils/pipeline';
import { autoAdvanceTarget, configOf, ensureTag, loadStatusRules, missingForStage, stagesFromTags, visibleStages } from '../utils/pipeline';
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
      { key: 'phone', label: 'Primary phone' }, { key: 'alternative_phone', label: 'Secondary phone' },
      { key: 'email', label: 'Email' },
      { key: 'address', label: 'Street address' }, { key: 'apartment', label: 'Unit / Apt / Suite #' },
      { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'zipcode', label: 'Zipcode' },
      { key: 'customerSuggestedPrice', label: 'Customer Suggested Price' },
      { key: 'notes', label: 'Notes' },
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
  const [copied, setCopied] = useState(false);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [statusRules, setStatusRules] = useState<KindRules>({ order: [], stages: {} });

  useEffect(() => {
    let alive = true;
    void loadStatusRules().then((r) => {
      if (alive) setStatusRules(isQuote ? r.quote : r.workorder);
    });
    return () => { alive = false; };
    // isQuote es estable durante la vida del wizard
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /* ===== Descuento / ajuste: en % o en moneda, reflejando su equivalente ===== */
  const discountIsFixed = form.discountType === 'Fixed';
  const discountValue = num(form.discountValue);
  const discountMoney = discountIsFixed
    ? discountValue
    : Math.round(computedTotal * discountValue) / 100;
  const discountPercent = discountIsFixed
    ? (computedTotal > 0 ? Math.round((discountValue / computedTotal) * 10000) / 100 : 0)
    : discountValue;
  const adjustedTotal = computedTotal - discountMoney;

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

  /** Label de team: "First name Last name" (con respaldo al rowLabel). */
  const teamName = (t: Row): string => {
    const first = getFieldValue(t, { key: 'first_name', altKeys: ['firstName', 'name', 'FIRST NAME'] });
    const last = getFieldValue(t, { key: 'last_name', altKeys: ['lastName', 'LAST NAME'] });
    const full = [first, last].filter(Boolean).join(' ').trim();
    return full || rowLabel(t);
  };
  const teamOfType = (type: 'Agent' | 'Tech') => cat('team').filter((t) =>
    String(getFieldValue(t, { key: 'type', altKeys: ['role', 'TYPE'] }) ?? '').includes(type));

  const customer = cat('customers').find((c) => c.id === form.idCustomer) as Record<string, unknown> | undefined;
  const customerAddress = customer
    ? [
        [customer.address, customer.apartment].filter(Boolean).join(' '),
        customer.city,
        [customer.state, customer.zipcode].filter(Boolean).join(' '),
      ].filter(Boolean).join(', ')
    : '';

  /** Flujo del cliente: la quote aceptada se convierte en Work Order (con sus detalles). */
  const convertToWorkOrder = async () => {
    if (!initialRow || !isQuote) return;
    if (!window.confirm('Convert this quote into a Work Order?')) return;
    setConverting(true);
    try {
      const tags = cat('catalog_tag');
      const acceptedId = await ensureTag(tags, 'Accepted', 'Work Order');
      const data: Record<string, unknown> = {};
      for (const f of module.fields) {
        if (form[f.key] !== undefined) data[f.key] = form[f.key];
      }
      data.total = computedTotal;
      data.balance = balance;
      data.idStatus = acceptedId;
      data.quoteId = initialRow.id;
      const woNumber = await nextConsecutive('work_orders', 'Wo');
      data.workOrderNumber = woNumber;
      data.quoteNumber = String(getFieldValue(initialRow, { key: 'quoteNumber', altKeys: ['quote_number'] }) ?? '');
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
      // Marcar la quote como convertida (etapa final de su pipeline)
      const convertedId = await ensureTag(tags, 'Converted', 'Quote');
      await updateRow('quotes', initialRow.id, {
        convertedWorkOrderId: woId,
        convertedWorkOrderNumber: woNumber,
        idStatus: convertedId,
      });
      invalidateCatalog('quotes');
      invalidateCatalog('work_orders');
      onClose();
    } finally {
      setConverting(false);
    }
  };

  /** Insurance Information (fórmulas del cliente):
   *  Price Part Insurance = List Price × NAGS Rate (%)
   *  Total Labor = NAGS Labor Hour × Price For Hour
   *  Ambos alimentan los totales de la orden (subtotal parts y labor) con tax reactivo. */
  const syncInsurance = (patch: Record<string, unknown>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      const listPrice = num(next.listPrice);
      const rate = num(next.nagsRate);
      const pricePart = Math.round(listPrice * rate) / 100;
      const laborTotal = Math.round(num(next.nagsLaborHour) * num(next.priceForHour) * 100) / 100;
      next.pricePartInsurance = pricePart;
      next.subtotalPart = pricePart;
      next.totalLabor = laborTotal;
      next.taxDolar = taxFor(pricePart, num(next.taxPercent));
      return next;
    });
  };

  /** CRM: mover a una etapa del catálogo validando sus reglas del Status Flow. */
  const advanceToStage = async (stageId: string, stageName: string) => {
    const missingFields = missingForStage(
      statusRules,
      stageId,
      (key) => form[key],
      (key) => module.fields.find((f) => f.key === key)?.label ?? key,
    );
    if (missingFields.length > 0) {
      window.alert(`To move to "${stageName}", complete first: ${missingFields.join(', ')}`);
      return;
    }
    set('idStatus', stageId);
  };

  /** Valor legible de un campo del formulario para el mensaje (FK→nombre, dinero, etc.). */
  const fieldValueText = (key: string): string => {
    const field = module.fields.find((f) => f.key === key);
    const raw = form[key];
    if (raw === undefined || raw === null || raw === '') return '';
    if (!field) return String(raw);
    if (field.type === 'fk' && field.fkCollection) {
      return rowLabel(cat(field.fkCollection).find((r) => r.id === raw));
    }
    if (field.type === 'decimal') return money(num(raw));
    if (field.type === 'boolean') return raw ? 'Yes' : 'No';
    return String(raw);
  };

  /** Mensaje organizado, emitido EXACTAMENTE en el orden elegido en el modal. */
  const buildMessage = (ordered: string[]): string => {
    const list = initialRow ? liveDetails.map((r) => r as DetailDraft) : drafts;
    const blocks: string[][] = [];
    for (const id of ordered) {
      if (id === 'header') {
        blocks.push([
          `${isQuote ? 'QUOTE' : 'WORK ORDER'}${docNumber ? ` ${docNumber}` : ''}`,
          `Status: ${rowLabel(statusRow) !== '—' ? rowLabel(statusRow) : 'Pending'} · Type: ${String(form.insuranceType ?? 'Personal')}`,
        ]);
      } else if (id === 'customer' && customer) {
        const lines = [`Customer: ${rowLabel(customer as Row)}`];
        const phones = [customer.phone, customer.alternative_phone].filter(Boolean).join(' / ');
        if (phones) lines.push(`Phone: ${phones}`);
        blocks.push(lines);
      } else if (id === 'address' && customerAddress) {
        blocks.push([`Address: ${customerAddress}`]);
      } else if (id === 'appointment' && form.appointmentDate) {
        const time = form.timeIn || form.timeOut ? ` · ${form.timeIn ?? ''}–${form.timeOut ?? ''}` : '';
        blocks.push([`Appointment: ${String(form.appointmentDate)}${time}`]);
      } else if (id === 'vehicle') {
        const vehicle = [form.year, form.mark, form.model].filter(Boolean).join(' ');
        if (vehicle || form.vinNumber || form.plate) {
          const lines = [`Vehicle: ${vehicle}${form.body ? ` · ${form.body}` : ''}`];
          if (form.vinNumber) lines.push(`VIN: ${String(form.vinNumber)}`);
          if (form.plate) lines.push(`Plate: ${String(form.plate)}`);
          blocks.push(lines);
        }
      } else if (id === 'details' && list.length > 0) {
        blocks.push(['Parts & Services:', ...list.map((d) => `• ${detailLabel(d)} — ${money(detailAmount(d))}`)]);
      } else if (id === 'totals') {
        const lines = [
          `Subtotal parts: ${money(num(form.subtotalPart))} · Services: ${money(num(form.subtotalServices))} · Labor: ${money(num(form.totalLabor))}`,
          `Tax: ${money(num(form.taxDolar))} · Long trip: ${money(num(form.longTrip))}`,
        ];
        if (discountMoney > 0) lines.push(`Discount: −${money(discountMoney)} (${discountPercent.toFixed(1)}%)`);
        lines.push(`TOTAL: ${money(discountMoney > 0 ? adjustedTotal : computedTotal)}`);
        if (num(form.paid) > 0) lines.push(`Paid: ${money(num(form.paid))} · Balance: ${money(balance)}`);
        blocks.push(lines);
      } else if (id === 'notes' && form.notes) {
        blocks.push([`Notes: ${String(form.notes)}`]);
      } else if (id.startsWith('field:')) {
        const key = id.slice(6);
        const value = fieldValueText(key);
        if (value) {
          const label = module.fields.find((f) => f.key === key)?.label ?? key;
          blocks.push([`${label}: ${value}`]);
        }
      }
    }
    // Campos individuales consecutivos se agrupan sin línea en blanco entre ellos
    const out: string[] = [];
    blocks.forEach((lines, i) => {
      const isField = lines.length === 1 && !lines[0].startsWith('Parts &');
      const prevWasField = i > 0 && blocks[i - 1].length === 1;
      if (i > 0 && !(isField && prevWasField)) out.push('');
      out.push(...lines);
    });
    return out.join('\n');
  };

  const copyWithSections = async (sections: string[]) => {
    const text = buildMessage(sections);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy the message:', text);
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
      data.discount = discountMoney;
      // Mecanismo automático: si las siguientes etapas 'auto' ya cumplen requisitos, avanzar
      if (data.idStatus) {
        const target = autoAdvanceTarget(pipelineStages, statusRules, String(data.idStatus), (key) => data[key]);
        if (target) data.idStatus = target;
      }
      let woId: string;
      if (initialRow) {
        woId = initialRow.id;
        await updateRow(collection, woId, data);
      } else {
        if (isQuote) data.quoteNumber = await nextConsecutive('quotes', 'Qo');
        if (isQuote && !data.idStatus) data.idStatus = await ensureTag(cat('catalog_tag'), 'Draft', 'Quote');
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

  const docNumber = initialRow
    ? String(getFieldValue(initialRow, isQuote
        ? { key: 'quoteNumber', altKeys: ['quote_number'] }
        : { key: 'workOrderNumber', altKeys: ['work_order_number', 'wo_number'] }) ?? '')
    : '';
  const crossRef = initialRow
    ? String(getFieldValue(initialRow, isQuote
        ? { key: 'convertedWorkOrderNumber', altKeys: ['converted_work_order_number'] }
        : { key: 'quoteNumber', altKeys: ['quote_number'] }) ?? '')
    : '';

  const allStages = stagesFromTags(cat('catalog_tag'), isQuote ? 'quote' : 'workorder', statusRules.order);
  const pipelineStages = visibleStages(allStages, statusRules);
  const currentStageIndex = pipelineStages.findIndex((s) => s.id === form.idStatus);
  /** Faltantes por etapa (candado visual en la barra). */
  const stageMissing = (stageId: string): string[] => missingForStage(
    statusRules,
    stageId,
    (key) => form[key],
    (key) => module.fields.find((f) => f.key === key)?.label ?? key,
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
          <h1>
            {initialRow ? (isQuote ? 'Edit Quote' : 'Edit Work Order') : (isQuote ? 'New Quote' : 'New Work Order')}
            {docNumber && <span className="wz-doc-number">{docNumber}</span>}
          </h1>
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
                  <div className="wz-field wz-full">
                  <span className="wz-label">Pipeline</span>
                  <ol className="wz-pipeline" aria-label="Status pipeline">
                    {pipelineStages.map((stage, i) => {
                      const cfg = configOf(statusRules, stage.id);
                      const done = currentStageIndex >= 0 && i <= currentStageIndex;
                      const missing = stageMissing(stage.id);
                      const locked = missing.length > 0 && !done;
                      return (
                        <li key={stage.id} className={`wz-stage${done ? ' done' : ''}${i === currentStageIndex ? ' current' : ''}${locked ? ' locked' : ''}`}>
                          <button
                            type="button"
                            onClick={() => void advanceToStage(stage.id, stage.name)}
                            title={locked
                              ? `Missing: ${missing.join(', ')}`
                              : cfg.mechanism === 'auto'
                                ? 'Automatic — advances when its fields are filled'
                                : 'Manual — press to move here'}
                            aria-label={`Move to ${stage.name}`}
                          >
                            <span className="wz-stage-dot" />
                            {stage.name}
                            {cfg.mechanism === 'auto' && <span className="wz-stage-auto" aria-hidden="true">⚡</span>}
                            {locked && <span className="wz-stage-lock" aria-hidden="true">🔒</span>}
                          </button>
                          {i < pipelineStages.length - 1 && <span className="wz-stage-line" aria-hidden="true" />}
                        </li>
                      );
                    })}
                    {currentStageIndex === -1 && rowLabel(statusRow) !== '—' && (
                      <li className="wz-stage offpipe">{rowLabel(statusRow)}</li>
                    )}
                  </ol>
                </div>
                {catalogSelect('Status', 'idStatus', 'catalog_tag', { filtered: tagOptions, required: true })}
              </SectionCard>

              <SectionCard icon={<MapPin size={15} />} title="Company & Area">
                <div className="wz-field">
                <label htmlFor="wz-idAgent" className="wz-req">Agent * <code className="wz-key">idAgent</code></label>
                <SearchableSelect
                  inputId="wz-idAgent"
                  value={String(form.idAgent ?? '')}
                  options={teamOfType('Agent').map((r) => ({ id: r.id, label: teamName(r) }))}
                  placeholder="Search agent…"
                  onChange={(id) => {
                    const agent = cat('team').find((t) => t.id === id);
                    const companyId = agent ? String(getFieldValue(agent, {
                      key: 'companyId',
                      altKeys: ['company_id', 'id_company', 'idCompany'],
                    }) ?? '') : '';
                    // La company se deriva del agente — no se edita a mano
                    setForm((prev) => ({ ...prev, idAgent: id, idCompany: companyId }));
                  }}
                />
              </div>
              <div className="wz-field">
                <label htmlFor="wz-company-ro">Company</label>
                <input
                  id="wz-company-ro"
                  value={form.idCompany
                    ? rowLabel(cat('catalog_company').find((c) => c.id === form.idCompany))
                    : ''}
                  readOnly
                  placeholder="Set by the selected agent"
                />
              </div>
              {catalogSelect('Zipcode', 'idZipcode', 'catalog_zipcode', { onPick: onZipcode })}
                {moneyInput('Long trip', 'longTrip')}
                <div className="wz-field">
                  <label htmlFor="wz-idTech">Technician <code className="wz-key">idTech</code></label>
                  <SearchableSelect
                    inputId="wz-idTech"
                    value={String(form.idTech ?? '')}
                    options={teamOfType('Tech').map((r) => ({ id: r.id, label: teamName(r) }))}
                    placeholder="Assign a technician…"
                    onChange={(id) => set('idTech', id)}
                  />
                </div>
                {moneyInput('Tech labor', 'techLabor')}
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
                  <label htmlFor="wz-cust-phone">Primary phone</label>
                  <input id="wz-cust-phone" value={String(customer?.phone ?? '')} readOnly placeholder="Filled from the customer" />
                </div>
                <div className="wz-field">
                  <label htmlFor="wz-cust-phone2">Secondary phone</label>
                  <input id="wz-cust-phone2" value={String(customer?.alternative_phone ?? '')} readOnly placeholder="Filled from the customer" />
                </div>
                <div className="wz-field">
                  <label htmlFor="wz-cust-email">Email</label>
                  <input id="wz-cust-email" value={String(customer?.email ?? '')} readOnly placeholder="Filled from the customer" />
                </div>
                <div className="wz-field wz-full">
                  <label htmlFor="wz-cust-address">Address</label>
                  <input id="wz-cust-address" value={customerAddress} readOnly placeholder="Street, apartment, city, state, zipcode — filled from the customer" />
                </div>
                {customerAddress !== '' && (
                  <div className="wz-field wz-full wz-map">
                    <iframe
                      title="Customer location"
                      src={`https://www.google.com/maps?q=${encodeURIComponent(customerAddress)}&output=embed`}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                )}
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
            <SectionCard icon={<ShieldCheck size={15} />} title="Insurance Information">
              {catalogSelect('Insurance Company', 'idInsurance', 'catalog_insurance', { required: true })}
              <div className="wz-field">
                <label htmlFor="wz-policy">Policy Number <code className="wz-key">policyNumber</code></label>
                <input id="wz-policy" value={String(form.policyNumber ?? '')} onChange={(e) => set('policyNumber', e.target.value)} />
              </div>
              <div className="wz-field">
                <label htmlFor="wz-claim">Claim Number <code className="wz-key">claimNumber</code></label>
                <input id="wz-claim" value={String(form.claimNumber ?? '')} onChange={(e) => set('claimNumber', e.target.value)} />
              </div>

              <div className="wz-field">
                <label htmlFor="wz-ins-listprice">List Price <code className="wz-key">listPrice</code></label>
                <div className="wz-money">
                  <span>$</span>
                  <input
                    id="wz-ins-listprice"
                    type="number"
                    step="0.01"
                    value={String(form.listPrice ?? '')}
                    placeholder="0.00"
                    onChange={(e) => syncInsurance({ listPrice: e.target.value })}
                  />
                </div>
              </div>
              <div className="wz-field">
                <label htmlFor="wz-ins-rate">NAGS Rate <code className="wz-key">nagsRate</code></label>
                <div className="wz-money">
                  <span>%</span>
                  <input
                    id="wz-ins-rate"
                    type="number"
                    step="0.01"
                    value={String(form.nagsRate ?? '')}
                    placeholder="0.00"
                    onChange={(e) => syncInsurance({ nagsRate: e.target.value })}
                  />
                </div>
              </div>
              <div className="wz-field">
                <span className="wz-label">Price Part Insurance</span>
                <div className="wz-money readonly">
                  <span>$</span>
                  <input value={num(form.pricePartInsurance).toFixed(2)} readOnly aria-label="Price part insurance (computed)" />
                </div>
              </div>

              <div className="wz-field">
                <label htmlFor="wz-ins-hours">NAGS Labor Hour <code className="wz-key">nagsLaborHour</code></label>
                <div className="wz-money">
                  <span>hrs</span>
                  <input
                    id="wz-ins-hours"
                    type="number"
                    step="0.1"
                    value={String(form.nagsLaborHour ?? '')}
                    placeholder="0.0"
                    onChange={(e) => syncInsurance({ nagsLaborHour: e.target.value })}
                  />
                </div>
              </div>
              <div className="wz-field">
                <label htmlFor="wz-ins-priceh">Price For Hour <code className="wz-key">priceForHour</code></label>
                <div className="wz-money">
                  <span>$</span>
                  <input
                    id="wz-ins-priceh"
                    type="number"
                    step="0.01"
                    value={String(form.priceForHour ?? '')}
                    placeholder="0.00"
                    onChange={(e) => syncInsurance({ priceForHour: e.target.value })}
                  />
                </div>
              </div>
              <div className="wz-field">
                <span className="wz-label">Total Labor</span>
                <div className="wz-money readonly">
                  <span>$</span>
                  <input value={num(form.totalLabor).toFixed(2)} readOnly aria-label="Total labor (computed)" />
                </div>
              </div>

              {moneyInput('Flat Rate Kit', 'kitFlatRate')}
              <div className="wz-field">
                <label htmlFor="wz-deductible" className="wz-req">Deductible * <code className="wz-key">deductible</code></label>
                <div className="wz-money">
                  <span>$</span>
                  <input
                    id="wz-deductible"
                    type="number"
                    step="0.01"
                    value={String(form.deductible ?? '')}
                    placeholder="0.00"
                    onChange={(e) => set('deductible', e.target.value)}
                  />
                </div>
              </div>
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

              <SectionCard icon={<Percent size={15} />} title="Discount / Adjustment">
                <div className="wz-field">
                  <span className="wz-label">Type <code className="wz-key">discountType</code></span>
                  <div className="wz-toggle" role="radiogroup" aria-label="Discount type">
                    {[['Percentage', 'Percentage'], ['Fixed', 'Fixed Amount']].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={(form.discountType ?? 'Percentage') === value}
                        className={`wz-toggle-btn${(form.discountType ?? 'Percentage') === value ? ' active' : ''}`}
                        onClick={() => set('discountType', value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="wz-field">
                  <label htmlFor="wz-discount-value">{discountIsFixed ? 'Discount ($)' : 'Discount (%)'} <code className="wz-key">discountValue</code></label>
                  <div className="wz-money">
                    <span>{discountIsFixed ? '$' : '%'}</span>
                    <input
                      id="wz-discount-value"
                      type="number"
                      step="0.01"
                      value={String(form.discountValue ?? '')}
                      placeholder="0.00"
                      onChange={(e) => set('discountValue', e.target.value)}
                    />
                  </div>
                </div>
                <div className="wz-field">
                  <span className="wz-label">{discountIsFixed ? 'Equivalent (%)' : 'Equivalent ($)'}</span>
                  <div className="wz-money readonly">
                    <span>{discountIsFixed ? '%' : '$'}</span>
                    <input
                      value={discountIsFixed ? discountPercent.toFixed(2) : discountMoney.toFixed(2)}
                      readOnly
                      aria-label="Discount equivalent (computed)"
                    />
                  </div>
                </div>
                <div className="wz-field wz-full">
                  <label htmlFor="wz-discount-reason">Reason <code className="wz-key">discountReason</code></label>
                  <input
                    id="wz-discount-reason"
                    value={String(form.discountReason ?? '')}
                    placeholder="Why is this adjustment applied…"
                    onChange={(e) => set('discountReason', e.target.value)}
                  />
                </div>
              </SectionCard>

              <SectionCard icon={<ClipboardList size={15} />} title="Notes">
                <div className="wz-field wz-full">
                  <label htmlFor="wz-notes" className="sr-only">Notes</label>
                  <textarea
                    id="wz-notes"
                    className="wz-textarea"
                    rows={3}
                    value={String(form.notes ?? '')}
                    placeholder="Add any notes about this job…"
                    onChange={(e) => set('notes', e.target.value)}
                  />
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

          {(docNumber || crossRef) && (
            <div className="wz-sum-card">
              <p className="wz-sum-card-title"><Hash size={13} />References</p>
              <dl>
                {docNumber && <div><dt>{isQuote ? 'Quote #' : 'Work Order #'}</dt><dd>{docNumber}</dd></div>}
                {crossRef && <div><dt>{isQuote ? 'Converted to' : 'From quote'}</dt><dd className="wz-ref-badge">{crossRef}</dd></div>}
              </dl>
            </div>
          )}

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
                <div><dt>Policy #</dt><dd>{String(form.policyNumber ?? '') || '—'}</dd></div>
                <div><dt>Claim #</dt><dd>{String(form.claimNumber ?? '') || '—'}</dd></div>
                <div><dt>Price Part INS</dt><dd>{money(num(form.pricePartInsurance))}</dd></div>
                <div><dt>Deductible</dt><dd>{money(num(form.deductible))}</dd></div>
                <div><dt>Flat Rate Kit</dt><dd>{money(num(form.kitFlatRate))}</dd></div>
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
              {discountMoney > 0 && <div><dt>Discount ({discountPercent.toFixed(1)}%)</dt><dd>−{money(discountMoney)}</dd></div>}
              {discountMoney > 0 && <div><dt>Adjusted total</dt><dd>{money(adjustedTotal)}</dd></div>}
              <div><dt>Paid</dt><dd>{money(num(form.paid))}</dd></div>
            </dl>
            <div className="wz-total-box">
              <span>Order total</span>
              <strong>{money(computedTotal)}</strong>
              <em>Balance: {money(balance)}</em>
            </div>
          </div>

          <div className="wz-sum-actions">
            <button type="button" className="btn-outline wz-copy" onClick={() => setMessageModalOpen(true)}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied!' : 'Copy message'}
            </button>
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

      {messageModalOpen && (
        <MessageModal
          preview={(sections) => buildMessage(sections)}
          onCopy={(sections) => {
            void copyWithSections(sections);
            setMessageModalOpen(false);
          }}
          onClose={() => setMessageModalOpen(false)}
        />
      )}

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

function MessageModal({ preview, onCopy, onClose }: {
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
