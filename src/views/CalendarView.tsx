import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getModule } from '../config/modules';
import type { Row } from '../services/firestore';
import { subscribeCached } from '../services/catalogCache';
import { getFieldValue, getRelationColor, getRelationName, rowLabel, tagColorToHex } from '../utils/relations';
import './CalendarView.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface CalEvent {
  id: string;
  kind: 'workorder' | 'quote';
  time: string;
  title: string;
  color: string;
  done: boolean;
}

/** Fecha de cita → clave YYYY-MM-DD tolerante a ISO, DD/MM/YYYY y MM/DD/YYYY. */
function dateKey(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    // Heurística: si el primer número no puede ser mes, es DD/MM
    const [day, month] = a > 12 ? [a, b] : b > 12 ? [b, a] : [b, a]; // default MM/DD
    return `${dmy[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return '';
}

function keyOf(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Mes reutilizable estilo Google — vive solo (vista Calendar) o embebido (Dashboard). */
export function MonthCalendar({ onOpen, compact = false }: {
  onOpen?: (doc: { kind: 'workorder' | 'quote'; id: string }) => void;
  compact?: boolean;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [orders, setOrders] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [tags, setTags] = useState<Row[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => subscribeCached('work_orders', setOrders), []);
  useEffect(() => subscribeCached('customers', setCustomers), []);
  useEffect(() => subscribeCached('catalog_tag', setTags), []);

  const module = getModule('workorders');
  const field = (key: string) => module.fields.find((f) => f.key === key) ?? { key, type: 'text' as const, label: key };

  /** Eventos agrupados por día (trabajos realizados y por realizar). */
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const order of orders) {
      const key = dateKey(getFieldValue(order, field('appointmentDate')));
      if (!key) continue;
      const statusId = String(getFieldValue(order, field('idStatus')) ?? '');
      const statusName = getRelationName(statusId, tags).toLowerCase();
      const customerId = String(getFieldValue(order, field('idCustomer')) ?? '');
      const customer = customers.find((c) => c.id === customerId);
      const vehicle = [
        getFieldValue(order, field('mark')),
        getFieldValue(order, field('model')),
      ].filter(Boolean).join(' ');
      const number = String(getFieldValue(order, field('workOrderNumber')) ?? '');
      const event: CalEvent = {
        id: order.id,
        kind: 'workorder',
        time: String(getFieldValue(order, field('timeIn')) ?? ''),
        title: [number, customer ? rowLabel(customer) : vehicle].filter(Boolean).join(' · ') || 'Work order',
        color: tagColorToHex(getRelationColor(statusId, tags)),
        done: ['complied', 'job done', 'paid'].some((s) => statusName.includes(s)),
      };
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
    // field es derivación estable del módulo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, customers, tags]);

  /* Rejilla del mes: 6 semanas × 7 días con desbordes del mes anterior/siguiente */
  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    const cells: { date: Date; inMonth: boolean; key: string }[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      cells.push({
        date,
        inMonth: date.getMonth() === month,
        key: keyOf(date.getFullYear(), date.getMonth(), date.getDate()),
      });
    }
    return cells;
  }, [year, month]);

  const todayKey = keyOf(today.getFullYear(), today.getMonth(), today.getDate());

  const navigate = (dir: -1 | 1) => {
    const next = new Date(year, month + dir, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setExpandedDay(null);
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setExpandedDay(null);
  };

  const monthEvents = grid.filter((c) => c.inMonth).reduce((acc, c) => acc + (eventsByDay.get(c.key)?.length ?? 0), 0);

  return (
    <div className={`cal-wrap${compact ? ' cal-compact' : ''}`}>
      <div className="cal-toolbar">
        <p className="cal-count">{monthEvents} job{monthEvents === 1 ? '' : 's'} this month</p>
        <div className="cal-nav">
          <button className="btn-outline cal-today" onClick={goToday}>Today</button>
          <button className="btn-icon-ghost" onClick={() => navigate(-1)} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <h2 className="cal-month">{MONTHS[month]} {year}</h2>
          <button className="btn-icon-ghost" onClick={() => navigate(1)} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="cal-card">
        <div className="cal-weekdays">
          {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="cal-grid">
          {grid.map((cell) => {
            const events = eventsByDay.get(cell.key) ?? [];
            const expanded = expandedDay === cell.key;
            const visible = expanded ? events : events.slice(0, 3);
            const hidden = events.length - visible.length;
            return (
              <div
                key={cell.key}
                className={`cal-day${cell.inMonth ? '' : ' out'}${cell.key === todayKey ? ' today' : ''}${expanded ? ' expanded' : ''}`}
              >
                <span className="cal-day-num">{cell.date.getDate()}</span>
                <div className="cal-events">
                  {visible.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`cal-event${event.done ? ' done' : ''}`}
                      /* color de status en runtime → variable CSS */
                      style={{ '--event-color': event.color } as React.CSSProperties}
                      title={`${event.time ? `${event.time} · ` : ''}${event.title}`}
                      onClick={() => onOpen?.({ kind: event.kind, id: event.id })}
                    >
                      <span className="cal-event-dot" />
                      {event.time && <span className="cal-event-time">{event.time}</span>}
                      <span className="cal-event-title">{event.title}</span>
                    </button>
                  ))}
                  {hidden > 0 && (
                    <button type="button" className="cal-more" onClick={() => setExpandedDay(cell.key)}>
                      +{hidden} more
                    </button>
                  )}
                  {expanded && events.length > 3 && (
                    <button type="button" className="cal-more" onClick={() => setExpandedDay(null)}>
                      Show less
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Vista completa del menú Calendar. */
export default function CalendarView({ onOpen }: {
  onOpen?: (doc: { kind: 'workorder' | 'quote'; id: string }) => void;
}) {
  return (
    <section className="module-view">
      <header className="module-head">
        <div>
          <h1>Calendar</h1>
          <p className="module-desc">Jobs done and scheduled — colored by their status</p>
        </div>
      </header>
      <MonthCalendar onOpen={onOpen} />
    </section>
  );
}
