import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, Car, CreditCard, Package, User } from 'lucide-react';
import type { Row } from '../services/firestore';
import { fetchAll, subscribe } from '../services/firestore';
import { formatDate, getRelationColor, getRelationName, money } from '../utils/relations';
import './WorkOrderDetailView.css';

interface Props {
  workOrderId: string;
  onBack: () => void;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return typeof v === 'string' && v ? v : '—';
}

export default function WorkOrderDetailView({ workOrderId, onBack }: Props) {
  const [order, setOrder] = useState<Row | null>(null);
  const [details, setDetails] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [catalogs, setCatalogs] = useState<Record<string, Row[]>>({});

  // Colecciones vivas: la orden y sus hijos cambian mientras el taller trabaja.
  useEffect(() => subscribe('workorders', (rows) => {
    setOrder(rows.find((r) => r.id === workOrderId) ?? null);
  }), [workOrderId]);

  useEffect(() => subscribe('servicesdetail', (rows) => {
    setDetails(rows.filter((r) => r.idWorkorder === workOrderId));
  }), [workOrderId]);

  useEffect(() => subscribe('payments', (rows) => {
    setPayments(rows.filter((r) => r.idWorkorder === workOrderId));
  }), [workOrderId]);

  // Catálogos para resolver FKs: carga única, cambian poco.
  useEffect(() => {
    const names = ['cat_status', 'customers', 'agents', 'cat_zipcode', 'insurances',
      'distributors', 'cat_jobtype', 'cat_partnumber', 'cat_paymentmethod'];
    let cancelled = false;
    void Promise.all(names.map(async (c) => [c, await fetchAll(c)] as const)).then((pairs) => {
      if (!cancelled) setCatalogs(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
  }, []);

  const cat = (name: string) => catalogs[name] ?? [];

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
        <button className="btn-outline" onClick={onBack}><ArrowLeft size={15} />Volver</button>
        <p className="wo-loading">Cargando la orden…</p>
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
              style={{ '--chip-color': getRelationColor(order.idStatus, cat('cat_status')) } as CSSProperties}
            >
              {getRelationName(order.idStatus, cat('cat_status'))}
            </span>
            <span className={`enum-badge enum-${String(order.insuranceType).toLowerCase()}`}>
              {String(order.insuranceType)}
            </span>
            <span className="wo-date">Registrada {formatDate(order.dateRegister)}</span>
          </div>
        </div>
      </header>

      <div className="wo-grid">
        {/* ===== Ficha del vehículo ===== */}
        <article className="panel">
          <h2><Car size={15} />Vehículo</h2>
          <dl className="spec-list">
            <div><dt>Marca</dt><dd>{str(order.mark)}</dd></div>
            <div><dt>Modelo</dt><dd>{str(order.model)}</dd></div>
            <div><dt>Año</dt><dd>{order.year ? String(order.year) : '—'}</dd></div>
            <div><dt>Body</dt><dd>{str(order.body)}</dd></div>
            <div><dt>VIN</dt><dd className="mono">{str(order.vinNumber)}</dd></div>
            <div><dt>Placa</dt><dd className="mono">{str(order.plate)}</dd></div>
          </dl>
        </article>

        {/* ===== Cliente y cita ===== */}
        <article className="panel">
          <h2><User size={15} />Cliente y cita</h2>
          <dl className="spec-list">
            <div><dt>Cliente</dt><dd>{getRelationName(order.idCustomer, cat('customers'))}</dd></div>
            <div><dt>Agente</dt><dd>{getRelationName(order.idAgent, cat('agents'))}</dd></div>
            <div><dt>Zona</dt><dd>{getRelationName(order.idZipcode, cat('cat_zipcode'))}</dd></div>
            <div><dt>Fecha de cita</dt><dd>{formatDate(order.appointmentDate)}</dd></div>
            <div><dt>Entrada</dt><dd>{str(order.timeIn)}</dd></div>
            <div><dt>Salida</dt><dd>{str(order.timeOut)}</dd></div>
            {isInsurance && (
              <div><dt>Aseguradora</dt><dd>{getRelationName(order.idInsurance, cat('insurances'))}</dd></div>
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
                <div><dt>Deducible</dt><dd>{money(order.deductible)}</dd></div>
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
        <h2><Package size={15} />Líneas de servicio ({details.length})</h2>
        <div className="table-wrap flush">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Job type</th>
                <th>Part number</th>
                <th>Distribuidor</th>
                <th>Order #</th>
                <th>Costo vidrio</th>
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
                  <td>{getRelationName(d.idJobtype, cat('cat_jobtype'))}</td>
                  <td>{getRelationName(d.idPartnumber, cat('cat_partnumber'))}</td>
                  <td>{getRelationName(d.idDistributor, cat('distributors'))}</td>
                  <td className="mono">{str(d.orderNumber)}</td>
                  <td className="cell-money">{money(d.glassCost)}</td>
                  {isInsurance && <td className="cell-money">{money(d.listPrice)}</td>}
                  {isInsurance && <td className="cell-money">{num(d.nagsLaborHour).toFixed(4)}</td>}
                  <td className="cell-money">{money(d.totalLabor)}</td>
                </tr>
              ))}
              {details.length === 0 && (
                <tr>
                  <td className="empty-cell" colSpan={isInsurance ? 9 : 7}>
                    Esta orden todavía no tiene líneas de servicio.
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
                <th>Método</th>
                <th>Tarjeta</th>
                <th>Titular</th>
                <th>Autorización</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{getRelationName(p.idPaymentmethod, cat('cat_paymentmethod'))}</td>
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
    </section>
  );
}
