import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  ArrowDownRight, ArrowUpRight, ClipboardList, DollarSign, ShieldCheck, Wallet,
} from 'lucide-react';
import type { Row } from '../services/firestore';
import { subscribe } from '../services/firestore';
import type { CatStatus, ServicesDetail, WorkOrder } from '../types';
import { getFieldValue, getRelationName, money, tagColorToHex } from '../utils/relations';
import './DashboardView.css';

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface MonthPoint { label: string; total: number; paid: number; }

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Lee un campo probando varias keys (camelCase de la app y snake_case del AppSheet). */
function alt(row: Record<string, unknown>, keys: string[]): unknown {
  return getFieldValue(row, { key: keys[0], altKeys: keys.slice(1) });
}

function altNum(row: Record<string, unknown>, keys: string[]): number {
  return num(alt(row, keys));
}

/** Normaliza fecha a 'YYYY-MM-DD' desde string ISO o serial. */
function dayKey(v: unknown): string {
  if (typeof v !== 'string' || !v) return '';
  return v.slice(0, 10);
}

function dateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DashboardView() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [details, setDetails] = useState<ServicesDetail[]>([]);
  const [statuses, setStatuses] = useState<CatStatus[]>([]);
  const [distributors, setDistributors] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribe(
    'work_orders',
    (r) => { setOrders(r as unknown as WorkOrder[]); setLoading(false); },
    () => setLoading(false),
  ), []);
  useEffect(() => subscribe('work_order_details', (r) => setDetails(r as unknown as ServicesDetail[])), []);
  useEffect(() => subscribe('catalog_tag', (r) => setStatuses(r as unknown as CatStatus[])), []);
  useEffect(() => subscribe('catalog_company', setDistributors), []);

  const kpis = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    let total = 0, paid = 0, balance = 0;
    let ordersThisMonth = 0, ordersPrevMonth = 0;
    let revenueThisMonth = 0, revenuePrevMonth = 0;
    let insuranceCount = 0;
    let jobsToday = 0, jobsTomorrow = 0, jobsWeek = 0;
    const today = dateStr(0);
    const tomorrow = dateStr(1);
    const weekEnd = dateStr(7);

    for (const o of orders) {
      const row = o as unknown as Record<string, unknown>;
      const oTotal = altNum(row, ['total']);
      total += oTotal;
      paid += altNum(row, ['paid']);
      balance += altNum(row, ['balance']);
      const insType = String(alt(row, ['insuranceType', 'insurrance', 'insurance', 'insurance_type']) ?? '');
      if (insType.toLowerCase() === 'insurance') insuranceCount++;
      const key = String(alt(row, ['dateRegister', 'date_register', 'created_at', 'date']) ?? '').slice(0, 7);
      if (key === monthKey) { ordersThisMonth++; revenueThisMonth += oTotal; }
      if (key === prevKey) { ordersPrevMonth++; revenuePrevMonth += oTotal; }
      const appt = dayKey(alt(row, ['appointmentDate', 'appointment_date', 'appoiment_date']));
      if (appt) {
        if (appt === today) jobsToday++;
        if (appt === tomorrow) jobsTomorrow++;
        if (appt >= today && appt <= weekEnd) jobsWeek++;
      }
    }

    const revenueDelta = revenuePrevMonth > 0
      ? ((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100
      : null;

    return {
      total, paid, balance, ordersThisMonth, ordersPrevMonth,
      revenueThisMonth, revenueDelta,
      insurancePct: orders.length ? Math.round((insuranceCount / orders.length) * 100) : 0,
      count: orders.length,
      jobsToday, jobsTomorrow, jobsWeek,
    };
  }, [orders]);

  const monthly: MonthPoint[] = useMemo(() => {
    const now = new Date();
    const points: MonthPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const inMonth = orders.filter((o) => String(alt(o as unknown as Record<string, unknown>, ['dateRegister', 'date_register', 'created_at', 'date']) ?? '').slice(0, 7) === key);
      points.push({
        label: MONTHS_ES[d.getMonth()],
        total: inMonth.reduce((s, o) => s + altNum(o as unknown as Record<string, unknown>, ['total']), 0),
        paid: inMonth.reduce((s, o) => s + altNum(o as unknown as Record<string, unknown>, ['paid']), 0),
      });
    }
    return points;
  }, [orders]);

  const statusDist = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of orders) {
      const id = String(alt(o as unknown as Record<string, unknown>, ['idStatus', 'tag_id', 'status_id', 'id_status', 'tag', 'status']) ?? '');
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => {
        const st = statuses.find((s) => s.id === id);
        return { id, name: st?.name ?? 'No status', color: tagColorToHex(st?.color), count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [orders, statuses]);

  const topDistributors = useMemo(() => {
    const cost = new Map<string, number>();
    for (const det of details) {
      const row = det as unknown as Record<string, unknown>;
      const id = String(alt(row, ['idDistributor', 'distributor_id', 'id_distributor']) ?? '');
      cost.set(id, (cost.get(id) ?? 0) + altNum(row, ['glassCost', 'glass_cost', 'cost', 'part_cost']));
    }
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
          <h1>Executive Dashboard</h1>
          <p className="dash-sub">Shop overview — real-time data</p>
        </div>
      </header>

      {/* ===== Jobs por cita (idea del cliente) ===== */}
      <p className="dash-section-label">Jobs &amp; Status</p>
      <ul className="jobs-row">
        <li>
          <p className="jobs-label">Jobs today</p>
          <p className="jobs-value">{loading ? <span className="skeleton skel-cell skel-w3" /> : kpis.jobsToday}</p>
        </li>
        <li>
          <p className="jobs-label">Jobs tomorrow</p>
          <p className="jobs-value">{loading ? <span className="skeleton skel-cell skel-w3" /> : kpis.jobsTomorrow}</p>
        </li>
        <li>
          <p className="jobs-label">Jobs next 7 days</p>
          <p className="jobs-value">{loading ? <span className="skeleton skel-cell skel-w3" /> : kpis.jobsWeek}</p>
        </li>
        <li>
          <p className="jobs-label">Outstanding balance</p>
          <p className="jobs-value">{loading ? <span className="skeleton skel-cell skel-w3" /> : money(kpis.balance)}</p>
        </li>
      </ul>

      <p className="dash-section-label">Revenue</p>
      <ul className="hero-cards">
        <li className="hero-card hero-blue">
          <div className="hero-icon"><DollarSign size={20} /></div>
          <p className="hero-label">Total revenue</p>
          <p className="hero-value">{loading ? <span className="skeleton skel-hero" /> : money(kpis.total)}</p>
          <p className="hero-foot">{kpis.count} work orders registered</p>
        </li>
        <li className="hero-card hero-sky">
          <div className="hero-icon"><Wallet size={20} /></div>
          <p className="hero-label">Collected</p>
          <p className="hero-value">{loading ? <span className="skeleton skel-hero" /> : money(kpis.paid)}</p>
          <p className="hero-foot">Collection rate {collectionRate}%</p>
        </li>
        <li className="hero-card hero-green">
          <div className="hero-icon"><ClipboardList size={20} /></div>
          <p className="hero-label">Orders this month</p>
          <p className="hero-value">{loading ? <span className="skeleton skel-hero" /> : kpis.ordersThisMonth}</p>
          <p className="hero-foot">
            {kpis.revenueDelta === null ? 'No previous month to compare' : (
              <span className={`delta ${kpis.revenueDelta >= 0 ? 'up' : 'down'}`}>
                {kpis.revenueDelta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {Math.abs(kpis.revenueDelta).toFixed(1)}% vs previous month
              </span>
            )}
          </p>
        </li>
        <li className="hero-card hero-violet">
          <div className="hero-icon"><ShieldCheck size={20} /></div>
          <p className="hero-label">Outstanding balance</p>
          <p className="hero-value">{loading ? <span className="skeleton skel-hero" /> : money(kpis.balance)}</p>
          <p className="hero-foot">{kpis.insurancePct}% insurance orders</p>
        </li>
      </ul>

      <div className="dash-grid">
        {/* ===== Ingresos por mes ===== */}
        <article className="panel panel-chart">
          <h2>Revenue — last 6 months</h2>
          {loading ? <span className="skeleton skel-chart" /> : <BarChart points={monthly} />}
          <ul className="chart-legend">
            <li><span className="legend-dot dot-total" />Billed</li>
            <li><span className="legend-dot dot-paid" />Collected</li>
          </ul>
        </article>

        {/* ===== Personal vs Insurance ===== */}
        <article className="panel">
          <h2>Personal vs Insurance</h2>
          {loading ? <span className="skeleton skel-donut" /> : <Donut pct={kpis.insurancePct} />}
          <ul className="chart-legend">
            <li><span className="legend-dot dot-ins" />Insurance {kpis.insurancePct}%</li>
            <li><span className="legend-dot dot-per" />Personal {100 - kpis.insurancePct}%</li>
          </ul>
        </article>

        {/* ===== Distribución por status ===== */}
        <article className="panel">
          <h2>Orders by status</h2>
          {loading ? (
            <SkeletonLines />
          ) : statusDist.length === 0 ? (
            <p className="panel-empty">No orders registered yet.</p>
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
          <h2>Top distributors by glass cost</h2>
          {loading ? (
            <SkeletonLines />
          ) : topDistributors.length === 0 ? (
            <p className="panel-empty">No service details with a distributor yet.</p>
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

function SkeletonLines() {
  return (
    <ul className="skel-lines" aria-hidden="true">
      <li><span className="skeleton skel-cell skel-w2" /></li>
      <li><span className="skeleton skel-cell skel-w1" /></li>
      <li><span className="skeleton skel-cell skel-w3" /></li>
      <li><span className="skeleton skel-cell skel-w2" /></li>
    </ul>
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
