import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, Car, CreditCard, Package, User } from 'lucide-react';
import type { Row } from '../services/firestore';
import { fetchAll, subscribe, updateRow } from '../services/firestore';
import { invalidateCatalog } from '../services/catalogCache';
import { getModule } from '../config/modules';
import type { KindRules } from '../utils/pipeline';
import { loadStatusRules, missingForStage, stagesFromTags, visibleStages } from '../utils/pipeline';
import { subscribeCached } from '../services/catalogCache';
import { formatDate, getFieldValue, getRelationColor, getRelationName, money, tagColorToHex } from '../utils/relations';
import './WorkOrderDetailView.css';

interface Props {
  workOrderId: string;
  /** 'quote' abre el detalle de una cotización con su propio pipeline */
  kind?: 'workorder' | 'quote';
  onBack: () => void;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return typeof v === 'string' && v ? v : '—';
}

export default function WorkOrderDetailView({ workOrderId, kind = 'workorder', onBack }: Props) {
  const isQuote = kind === 'quote';
  const collection = isQuote ? 'quotes' : 'work_orders';
  const [order, setOrder] = useState<Row | null>(null);
  const [details, setDetails] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [catalogs, setCatalogs] = useState<Record<string, Row[]>>({});
  const [loaded, setLoaded] = useState(false);

  // Colecciones vivas: la orden y sus hijos cambian mientras el taller trabaja.
  useEffect(() => subscribeCached(collection, (rows) => {
    setOrder(rows.find((r) => r.id === workOrderId) ?? null);
    setLoaded(true);
  }), [workOrderId, collection]);

  useEffect(() => subscribeCached('work_order_details', (rows) => {
    setDetails(rows.filter((r) => String(getFieldValue(r, {
      key: 'idWorkorder',
      altKeys: ['work_order_id', 'id_work_order', 'workOrderId'],
    }) ?? '') === workOrderId));
  }), [workOrderId]);

  useEffect(() => subscribe('payments', (rows) => {
    setPayments(rows.filter((r) => r.idWorkorder === workOrderId));
  }), [workOrderId]);

  // Catálogos para resolver FKs: carga única, cambian poco.
  useEffect(() => {
    const names = ['catalog_tag', 'customers', 'team', 'catalog_zipcode', 'catalog_insurance',
      'catalog_company', 'catalog_jobtype', 'catalog_part_number', 'catalog_payment_method'];
    let cancelled = false;
    void Promise.all(names.map(async (c) => [c, await fetchAll(c)] as const)).then((pairs) => {
      if (!cancelled) setCatalogs(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
  }, []);

  const cat = (name: string) => catalogs[name] ?? [];

  /** Resolución financiera con altKeys (bases snake_case) */
  const fin = (() => {
    const n = (keys: string[]) => {
      const v = getFieldValue(order ?? {}, { key: keys[0], altKeys: keys.slice(1) });
      const parsed = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const subtotalPart = n(['subtotalPart', 'subtotal_part']);
    const subtotalMolding = n(['subtotalMolding', 'subtotal_molding']);
    const subtotalServices = n(['subtotalServices', 'subtotal_services']);
    const totalTax = n(['taxDolar', 'total_tax', 'tax_dolar']);
    const labor = n(['totalLabor', 'labor', 'total_labor']);
    const discount = n(['discount']);
    const longTrip = n(['longTrip', 'long_trip']);
    const upsell = n(['upsell']);
    const total = n(['total']);
    const charged = total + upsell;
    // P&L = cobrado − costo de parte − tax − labor (comisión se concilia aparte)
    const profitLoss = charged - subtotalPart - totalTax - labor;
    return { subtotalPart, subtotalMolding, subtotalServices, totalTax, labor, discount, longTrip, upsell, total, charged, profitLoss };
  })();

  /** CRM: cambiar de etapa desde el detalle, validando las reglas configuradas. */
  const [advancing, setAdvancing] = useState(false);
  const advanceToStage = async (stageId: string, stageName: string) => {
    if (!order || advancing) return;
    setAdvancing(true);
    try {
      const stageRules = kindRules;
      const module = getModule('workorders');
      const missing = missingForStage(
        stageRules,
        stageId,
        (key) => {
          const field = module.fields.find((f) => f.key === key);
          return field ? getFieldValue(order, field) : undefined;
        },
        (key) => module.fields.find((f) => f.key === key)?.label ?? key,
      );
      if (missing.length > 0) {
        window.alert(`To move to "${stageName}", complete first: ${missing.join(', ')}`);
        return;
      }
      await updateRow(collection, order.id, { idStatus: stageId });
      invalidateCatalog(collection);
    } finally {
      setAdvancing(false);
    }
  };

  const statusId = String(getFieldValue(order ?? {}, {
    key: 'idStatus',
    altKeys: ['tag_id', 'status_id', 'id_status', 'tag', 'status'],
  }) ?? '');
  const statusName = getRelationName(statusId, cat('catalog_tag'));

  /** Pipeline desde el catálogo de Status, en el orden del configurador. */
  const [kindRules, setKindRules] = useState<KindRules>({ order: [], stages: {} });
  useEffect(() => {
    let alive = true;
    void loadStatusRules().then((r) => {
      if (alive) setKindRules(isQuote ? r.quote : r.workorder);
    });
    return () => { alive = false; };
    // isQuote es estable durante la vida de la vista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pipelineStages = visibleStages(
    stagesFromTags(cat('catalog_tag'), isQuote ? 'quote' : 'workorder', kindRules.order),
    kindRules,
  );
  const pipelineIndex = pipelineStages.findIndex((s) => s.id === statusId);
  const offTrack = pipelineIndex === -1 && statusName !== '—';


  const totals = useMemo(() => {
    const paidSum = payments.reduce((s, p) => s + num(p.amount), 0);
    return {
      parts: num(order?.subtotalPart),
      molding: num(order?.subtotalMolding),
      services: num(order?.subtotalServices),
      labor: num(order?.totalLabor),
      tax: num(order?.taxDolar),
      total: num(order?.total),
      paidRegistered: paidSum,
      balance: num(order?.total) - paidSum,
    };
  }, [order, payments]);

  if (!order) {
    return (
      <section className="wo-detail">
        <button className="btn-outline" onClick={onBack}><ArrowLeft size={15} />Back</button>
        {loaded ? (
          <p className="wo-loading">Order not found — it may have been deleted.</p>
        ) : (
          <div className="wo-skeleton" aria-hidden="true">
            <span className="skeleton skel-title" />
            <div className="wo-skeleton-grid">
              <span className="skeleton skel-panel" />
              <span className="skeleton skel-panel" />
              <span className="skeleton skel-panel" />
            </div>
          </div>
        )}
      </section>
    );
  }

  const isInsurance = order.insuranceType === 'INSURANCE';

  return (
    <section className="wo-detail">
      <header className="wo-head">
        <button className="btn-outline" onClick={onBack}>
          <ArrowLeft size={15} />
          Volver a Work Orders
        </button>
        <div className="wo-title-group">
          <h1>{str(order.mark)} {str(order.model)} {order.year ? `· ${order.year}` : ''}</h1>
          <div className="wo-title-meta">
            <span
              className="status-chip"
              style={{ '--chip-color': tagColorToHex(getRelationColor(statusId, cat('catalog_tag'))) } as CSSProperties}
            >
              <span className="status-chip-dot" />
              {getRelationName(statusId, cat('catalog_tag'))}
            </span>
            <span className={`enum-badge enum-${String(order.insuranceType).toLowerCase()}`}>
              {String(order.insuranceType)}
            </span>
            <span className="wo-date">Registrada {formatDate(order.dateRegister)}</span>
          </div>
        </div>
      </header>

      {/* ===== Status tracker (pipeline del cliente) ===== */}
      <ol className="wo-stepper" aria-label="Order progress">
        {pipelineStages.map((stage, i) => {
          const done = pipelineIndex >= 0 && i <= pipelineIndex;
          return (
            <li key={stage.id} className={`wo-step${done ? ' done' : ''}${i === pipelineIndex ? ' current' : ''}`}>
              <button
                type="button"
                className="wo-step-btn"
                disabled={advancing}
                title={`Move to ${stage.name}`}
                onClick={() => void advanceToStage(stage.id, stage.name)}
              >
                <span className="wo-step-dot" />
                <span className="wo-step-label">{stage.name}</span>
              </button>
              {i < pipelineStages.length - 1 && <span className="wo-step-line" aria-hidden="true" />}
            </li>
          );
        })}
        {offTrack && (
          <li className="wo-step offtrack">
            <span
              className="wo-step-badge"
              style={{ '--chip-color': tagColorToHex(getRelationColor(statusId, cat('catalog_tag'))) } as CSSProperties}
            >
              {statusName}
            </span>
          </li>
        )}
      </ol>

      <div className="wo-grid">
        {/* ===== Ficha del vehículo ===== */}
        <article className="panel">
          <h2><Car size={15} />Vehicle</h2>
          <dl className="spec-list">
            <div><dt>Make</dt><dd>{str(order.mark)}</dd></div>
            <div><dt>Model</dt><dd>{str(order.model)}</dd></div>
            <div><dt>Year</dt><dd>{order.year ? String(order.year) : '—'}</dd></div>
            <div><dt>Body</dt><dd>{str(order.body)}</dd></div>
            <div><dt>VIN</dt><dd className="mono">{str(order.vinNumber)}</dd></div>
            <div><dt>Plate</dt><dd className="mono">{str(order.plate)}</dd></div>
          </dl>
        </article>

        {/* ===== Cliente y cita ===== */}
        <article className="panel">
          <h2><User size={15} />Customer & schedule</h2>
          <dl className="spec-list">
            <div><dt>Customer</dt><dd>{getRelationName(order.idCustomer, cat('customers'))}</dd></div>
            <div><dt>Agent</dt><dd>{getRelationName(order.idAgent, cat('team'))}</dd></div>
            <div><dt>Zona</dt><dd>{getRelationName(order.idZipcode, cat('catalog_zipcode'))}</dd></div>
            <div><dt>Fecha de cita</dt><dd>{formatDate(order.appointmentDate)}</dd></div>
            <div><dt>Entrada</dt><dd>{str(order.timeIn)}</dd></div>
            <div><dt>Salida</dt><dd>{str(order.timeOut)}</dd></div>
            {isInsurance && (
              <div><dt>Insurance carrier</dt><dd>{getRelationName(order.idInsurance, cat('catalog_insurance'))}</dd></div>
            )}
          </dl>
        </article>

        {/* ===== Resumen financiero ===== */}
        <article className="panel wo-money">
          <h2>Resumen</h2>
          <dl className="money-list">
            <div><dt>Parts</dt><dd>{money(totals.parts)}</dd></div>
            <div><dt>Molding</dt><dd>{money(totals.molding)}</dd></div>
            <div><dt>Services</dt><dd>{money(totals.services)}</dd></div>
            <div><dt>Labor</dt><dd>{money(totals.labor)}</dd></div>
            {isInsurance && (
              <>
                <div><dt>Deductible</dt><dd>{money(order.deductible)}</dd></div>
                <div><dt>Kit flat rate</dt><dd>{money(order.kitFlatRate)}</dd></div>
              </>
            )}
            {!isInsurance && <div><dt>Upsold</dt><dd>{money(order.upsold)}</dd></div>}
            <div><dt>Tax</dt><dd>{money(totals.tax)}</dd></div>
            <div className="money-total"><dt>Total</dt><dd>{money(totals.total)}</dd></div>
            <div><dt>Pagos registrados</dt><dd>{money(totals.paidRegistered)}</dd></div>
            <div className={`money-balance${totals.balance > 0 ? ' owing' : ''}`}>
              <dt>Balance</dt><dd>{money(totals.balance)}</dd>
            </div>
          </dl>
        </article>
      </div>

      {/* ===== Líneas de servicio ===== */}
      <article className="panel">
        <h2><Package size={15} />Service lines ({details.length})</h2>
        <div className="table-wrap flush">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Job type</th>
                <th>Part number</th>
                <th>Distributor</th>
                <th>Order #</th>
                <th>Part</th>
                <th>Labor</th>
                <th>Glass cost</th>
                {isInsurance && <th>List price</th>}
                {isInsurance && <th>NAGS hrs</th>}
                <th>Total labor</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span className={`enum-badge enum-${String(d.type).toLowerCase()}`}>{String(d.type)}</span>
                  </td>
                  <td>{getRelationName(d.idJobtype, cat('catalog_jobtype'))}</td>
                  <td>{getRelationName(d.idPartnumber, cat('catalog_part_number'))}</td>
                  <td>{getRelationName(d.idDistributor, cat('catalog_company'))}</td>
                  <td className="mono">{str(d.orderNumber)}</td>
                  <td className="cell-money">
                    {String(d.type) === 'Services'
                      ? money(getFieldValue(d, { key: 'amount', altKeys: ['service_amount'] }))
                      : money(getFieldValue(d, { key: 'amountPricetier', altKeys: ['amount_price_tier', 'tier_amount', 'pricePartInsurance'] }))}
                  </td>
                  <td className="cell-money">
                    {money(
                      Number(getFieldValue(d, { key: 'totalLabor', altKeys: ['total_labor', 'labor'] }) ?? 0)
                      + Number(getFieldValue(d, { key: 'totalLaborHour', altKeys: ['total_labor_hour'] }) ?? 0),
                    )}
                  </td>
                  <td className="cell-money">{money(d.glassCost)}</td>
                  {isInsurance && <td className="cell-money">{money(d.listPrice)}</td>}
                  {isInsurance && <td className="cell-money">{num(d.nagsLaborHour).toFixed(4)}</td>}
                  <td className="cell-money">{money(d.totalLabor)}</td>
                </tr>
              ))}
              {details.length === 0 && (
                <tr>
                  <td className="empty-cell" colSpan={isInsurance ? 9 : 7}>
                    This order has no service lines yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* ===== Pagos ===== */}
      <article className="panel">
        <h2><CreditCard size={15} />Pagos ({payments.length})</h2>
        <div className="table-wrap flush">
          <table className="data-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Tarjeta</th>
                <th>Titular</th>
                <th>Authorization</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{getRelationName(p.idPaymentmethod, cat('catalog_payment_method'))}</td>
                  <td className="mono">
                    {p.cardLast4 ? `${str(p.cardBrand)} ····${String(p.cardLast4)}` : '—'}
                  </td>
                  <td>{`${str(p.firstName)} ${p.lastName ?? ''}`.trim()}</td>
                  <td className="mono">{str(p.idAutorization)}</td>
                  <td className="cell-money">{money(p.amount)}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td className="empty-cell" colSpan={5}>Sin pagos registrados para esta orden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
        <article className="wo-panel wo-finance">
          <h2>Finance & P&L</h2>
          <dl className="wo-fin-grid">
            <div><dt>Subtotal parts</dt><dd>{money(fin.subtotalPart)}</dd></div>
            <div><dt>Subtotal molding</dt><dd>{money(fin.subtotalMolding)}</dd></div>
            <div><dt>Subtotal services</dt><dd>{money(fin.subtotalServices)}</dd></div>
            <div><dt>Total tax</dt><dd>{money(fin.totalTax)}</dd></div>
            <div><dt>Long trip</dt><dd>{money(fin.longTrip)}</dd></div>
            <div><dt>Discount</dt><dd>{money(fin.discount)}</dd></div>
            <div><dt>Labor</dt><dd>{money(fin.labor)}</dd></div>
            <div><dt>Upsell</dt><dd>{money(fin.upsell)}</dd></div>
            <div className="wo-fin-total"><dt>Total</dt><dd>{money(fin.total)}</dd></div>
            <div className="wo-fin-total"><dt>Charged (total + upsell)</dt><dd>{money(fin.charged)}</dd></div>
          </dl>
          <p className={`wo-pl ${fin.profitLoss >= 0 ? 'positive' : 'negative'}`}>
            Profit &amp; Loss: <strong>{money(fin.profitLoss)}</strong>
            <span className="wo-pl-note">charged − part − tax − labor</span>
          </p>
        </article>

    </section>
  );
}
