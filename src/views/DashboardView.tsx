import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  ArrowDownRight, ArrowUpRight, ClipboardList, DollarSign, ShieldCheck, Wallet,
} from 'lucide-react';
import type { Row } from '../services/firestore';
import { subscribe } from '../services/firestore';
import type { CatStatus, ServicesDetail, WorkOrder } from '../types';
import { getRelationName, money } from '../utils/relations';
import './DashboardView.css';

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface MonthPoint { label: string; total: number; paid: number; }

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function DashboardView() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [details, setDetails] = useState<ServicesDetail[]>([]);
  const [statuses, setStatuses] = useState<CatStatus[]>([]);
  const [distributors, setDistributors] = useState<Row[]>([]);

  useEffect(() => subscribe('workorders', (r) => setOrders(r as unknown as WorkOrder[])), []);
  useEffect(() => subscribe('servicesdetail', (r) => setDetails(r as unknown as ServicesDetail[])), []);
  useEffect(() => subscribe('cat_status', (r) => setStatuses(r as unknown as CatStatus[])), []);
  useEffect(() => subscribe('distributors', setDistributors), []);

  const kpis = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    let total = 0, paid = 0, balance = 0;
    let ordersThisMonth = 0, ordersPrevMonth = 0;
    let revenueThisMonth = 0, revenuePrevMonth = 0;
    let insuranceCount = 0;

    for (const o of orders) {
      total += num(o.total);
      paid += num(o.paid);
      balance += num(o.balance);
      if (o.insuranceType === 'INSURANCE') insuranceCount++;
      const key = (o.dateRegister ?? '').slice(0, 7);
      if (key === monthKey) { ordersThisMonth++; revenueThisMonth += num(o.total); }
      if (key === prevKey) { ordersPrevMonth++; revenuePrevMonth += num(o.total); }
    }

    const revenueDelta = revenuePrevMonth > 0
      ? ((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100
      : null;

    return {
      total, paid, balance, ordersThisMonth, ordersPrevMonth,
      revenueThisMonth, revenueDelta,
      insurancePct: orders.length ? Math.round((insuranceCount / orders.length) * 100) : 0,
      count: orders.length,
    };
  }, [orders]);

  const monthly: MonthPoint[] = useMemo(() => {
    const now = new Date();
    const points: MonthPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const inMonth = orders.filter((o) => (o.dateRegister ?? '').slice(0, 7) === key);
      points.push({
        label: MONTHS_ES[d.getMonth()],
        total: inMonth.reduce((s, o) => s + num(o.total), 0),
        paid: inMonth.reduce((s, o) => s + num(o.paid), 0),
      });
    }
    return points;
  }, [orders]);

  const statusDist = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of orders) counts.set(o.idStatus, (counts.get(o.idStatus) ?? 0) + 1);
    return [...counts.entries()]
      .map(([id, count]) => {
        const st = statuses.find((s) => s.id === id);
        return { id, name: st?.name ?? 'Sin status', color: st?.color ?? '#94a3b8', count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [orders, statuses]);

  const topDistributors = useMemo(() => {
    const cost = new Map<string, number>();
    for (const d of details) cost.set(d.idDistributor, (cost.get(d.idDistributor) ?? 0) + num(d.glassCost));
    return [...cost.entries()]
      .filter(([id]) => id)
      .map(([id, amount]) => ({ id, name: getRelationName(id, distributors), amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [details, distributors]);

  const collectionRate = kpis.total > 0 ? Math.round((kpis.paid / kpis.total) * 100) : 0;

  return (
    <section className="dashboard">
      <header className="dash-head">
        <div>
          <h1>Dashboard gerencial</h1>
          <p className="dash-sub">Resumen ejecutivo del taller — datos en tiempo real</p>
        </div>
      </header>

      {/* ===== Tarjetas hero con gradiente (referencia visual) ===== */}
      <ul className="hero-cards">
        <li className="hero-card hero-blue">
          <div className="hero-icon"><DollarSign size={20} /></div>
          <p className="hero-label">Facturación total</p>
          <p className="hero-value">{money(kpis.total)}</p>
          <p className="hero-foot">{kpis.count} work orders registradas</p>
        </li>
        <li className="hero-card hero-sky">
          <div className="hero-icon"><Wallet size={20} /></div>
          <p className="hero-label">Cobrado</p>
          <p className="hero-value">{money(kpis.paid)}</p>
          <p className="hero-foot">Tasa de cobro {collectionRate}%</p>
        </li>
        <li className="hero-card hero-green">
          <div className="hero-icon"><ClipboardList size={20} /></div>
          <p className="hero-label">Órdenes del mes</p>
          <p className="hero-value">{kpis.ordersThisMonth}</p>
          <p className="hero-foot">
            {kpis.revenueDelta === null ? 'Sin mes anterior para comparar' : (
              <span className={`delta ${kpis.revenueDelta >= 0 ? 'up' : 'down'}`}>
                {kpis.revenueDelta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {Math.abs(kpis.revenueDelta).toFixed(1)}% vs mes anterior
              </span>
            )}
          </p>
        </li>
        <li className="hero-card hero-violet">
          <div className="hero-icon"><ShieldCheck size={20} /></div>
          <p className="hero-label">Balance por cobrar</p>
          <p className="hero-value">{money(kpis.balance)}</p>
          <p className="hero-foot">{kpis.insurancePct}% de órdenes por aseguranza</p>
        </li>
      </ul>

      <div className="dash-grid">
        {/* ===== Ingresos por mes ===== */}
        <article className="panel panel-chart">
          <h2>Ingresos últimos 6 meses</h2>
          <BarChart points={monthly} />
          <ul className="chart-legend">
            <li><span className="legend-dot dot-total" />Facturado</li>
            <li><span className="legend-dot dot-paid" />Cobrado</li>
          </ul>
        </article>

        {/* ===== Personal vs Insurance ===== */}
        <article className="panel">
          <h2>Personal vs Insurance</h2>
          <Donut pct={kpis.insurancePct} />
          <ul className="chart-legend">
            <li><span className="legend-dot dot-ins" />Insurance {kpis.insurancePct}%</li>
            <li><span className="legend-dot dot-per" />Personal {100 - kpis.insurancePct}%</li>
          </ul>
        </article>

        {/* ===== Distribución por status ===== */}
        <article className="panel">
          <h2>Órdenes por status</h2>
          {statusDist.length === 0 ? (
            <p className="panel-empty">Aún no hay órdenes registradas.</p>
          ) : (
            <ul className="status-bars">
              {statusDist.map((s) => {
                const max = statusDist[0].count;
                return (
                  <li key={s.id}>
                    <span className="status-bar-name">{s.name}</span>
                    <span
                      className="status-bar-track"
                      style={{ '--bar-w': `${(s.count / max) * 100}%`, '--bar-color': s.color } as CSSProperties}
                    >
                      <span className="status-bar-fill" />
                    </span>
                    <span className="status-bar-count">{s.count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        {/* ===== Top distribuidores ===== */}
        <article className="panel">
          <h2>Top distribuidores por costo de vidrio</h2>
          {topDistributors.length === 0 ? (
            <p className="panel-empty">Sin detalles de servicio con distribuidor todavía.</p>
          ) : (
            <ol className="top-list">
              {topDistributors.map((d, i) => (
                <li key={d.id}>
                  <span className="top-rank">{i + 1}</span>
                  <span className="top-name">{d.name}</span>
                  <span className="top-amount">{money(d.amount)}</span>
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>
    </section>
  );
}

/* ==================== Gráficas SVG (sin dependencias) ==================== */

function BarChart({ points }: { points: MonthPoint[] }) {
  const W = 560, H = 220, PAD = 34;
  const max = Math.max(...points.map((p) => p.total), 1);
  const band = (W - PAD * 2) / points.length;
  const barW = Math.min(26, band / 3);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="bar-chart" role="img" aria-label="Ingresos por mes">
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={PAD} x2={W - PAD} y1={H - 30 - t * (H - 60)} y2={H - 30 - t * (H - 60)} className="grid-line" />
      ))}
      {points.map((p, i) => {
        const cx = PAD + band * i + band / 2;
        const hTotal = (p.total / max) * (H - 60);
        const hPaid = (p.paid / max) * (H - 60);
        return (
          <g key={p.label}>
            <rect x={cx - barW - 3} y={H - 30 - hTotal} width={barW} height={Math.max(hTotal, 2)} rx="5" className="bar-total" />
            <rect x={cx + 3} y={H - 30 - hPaid} width={barW} height={Math.max(hPaid, 2)} rx="5" className="bar-paid" />
            <text x={cx} y={H - 10} textAnchor="middle" className="axis-label">{p.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ pct }: { pct: number }) {
  const R = 62, C = 2 * Math.PI * R;
  const insLen = (pct / 100) * C;
  return (
    <svg viewBox="0 0 180 180" className="donut" role="img" aria-label={`Insurance ${pct}%`}>
      <circle cx="90" cy="90" r={R} className="donut-track" />
      <circle
        cx="90" cy="90" r={R}
        className="donut-value"
        strokeDasharray={`${insLen} ${C - insLen}`}
        strokeDashoffset={C / 4}
      />
      <text x="90" y="86" textAnchor="middle" className="donut-big">{pct}%</text>
      <text x="90" y="106" textAnchor="middle" className="donut-small">Insurance</text>
    </svg>
  );
}
