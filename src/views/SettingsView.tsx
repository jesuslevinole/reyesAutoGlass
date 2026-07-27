import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ListOrdered, Loader2, PanelLeft, Save, ScanSearch, Sparkles, Type } from 'lucide-react';
import { MODULES } from '../config/modules';
import type { ModuleDef, NavItem } from '../config/modules';
import type { Row } from '../services/firestore';
import { fetchSample, setRowMerged } from '../services/firestore';
import './SettingsView.css';

interface Props {
  /** Documentos actuales de config_ui, por id (en vivo desde App) */
  uiConfig: Record<string, Row>;
  /** Menú efectivo actual (ya ordenado), para partir de él al reordenar */
  navItems: NavItem[];
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

export default function SettingsView({ uiConfig, navItems }: Props) {
  return (
    <section className="settings-view">
      <header className="module-head">
        <div>
          <h1>Configuración</h1>
          <p className="module-desc">
            Personaliza nombres, orden de columnas y menú. Los cambios se guardan en Firestore y aplican para todos los usuarios.
          </p>
        </div>
      </header>

      <AppNameCard uiConfig={uiConfig} />
      <MenuOrderCard navItems={navItems} />
      <ModuleCustomizer uiConfig={uiConfig} />
      <CollectionInspector />
    </section>
  );
}

/* ==================== Nombre de la aplicación ==================== */

function AppNameCard({ uiConfig }: { uiConfig: Record<string, Row> }) {
  const appDoc = uiConfig['_app'] as Record<string, unknown> | undefined;
  const currentName = typeof appDoc?.name === 'string' ? appDoc.name : '';
  // key: al llegar el valor guardado desde Firestore se remonta con él
  return <AppNameEditor key={currentName} currentName={currentName} />;
}

function AppNameEditor({ currentName }: { currentName: string }) {
  const [name, setName] = useState(currentName);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await setRowMerged('config_ui', '_app', { name: name.trim() });
    setSaved(true);
  };

  return (
    <article className="settings-card">
      <header className="settings-card-head">
        <span className="settings-card-icon"><Sparkles size={15} /></span>
        <h2>Nombre de la aplicación</h2>
        <button className="btn-primary btn-gradient" onClick={() => void save()}>
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? 'Guardado' : 'Guardar nombre'}
        </button>
      </header>
      <div className="settings-toolbar">
        <div className="field">
          <label htmlFor="set-appname">Se muestra en el menú lateral y en la pestaña del navegador</label>
          <input
            id="set-appname"
            value={name}
            placeholder="GlassWorks"
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
          />
        </div>
      </div>
    </article>
  );
}

/* ==================== Orden del menú lateral ==================== */

function MenuOrderCard({ navItems }: { navItems: NavItem[] }) {
  // null = seguir el orden vivo de Firestore; con ediciones locales se vuelve un array propio
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);

  const order = localOrder ?? navItems.map((i) => i.id);
  const labelOf = (id: string) => navItems.find((i) => i.id === id)?.label ?? id;

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= order.length) return;
    setLocalOrder(swap(order, index, j));
    setSaved(false);
  };

  const save = async () => {
    await setRowMerged('config_ui', '_menu', { order });
    // Vuelve a seguir el orden vivo (que ya coincide con lo guardado)
    setLocalOrder(null);
    setSaved(true);
  };

  return (
    <article className="settings-card">
      <header className="settings-card-head">
        <span className="settings-card-icon"><PanelLeft size={15} /></span>
        <h2>Orden del menú lateral</h2>
        <button className="btn-primary btn-gradient" onClick={() => void save()}>
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? 'Guardado' : 'Guardar orden'}
        </button>
      </header>
      <ol className="order-list">
        {order.map((id, index) => (
          <li key={id}>
            <span className="order-num">{index + 1}</span>
            <span className="order-label">{labelOf(id)}</span>
            <span className="order-arrows">
              <button className="btn-icon-ghost" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Subir">
                <ArrowUp size={15} />
              </button>
              <button className="btn-icon-ghost" onClick={() => move(index, 1)} disabled={index === order.length - 1} aria-label="Bajar">
                <ArrowDown size={15} />
              </button>
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}

/* ==================== Personalización por módulo ==================== */

function ModuleCustomizer({ uiConfig }: { uiConfig: Record<string, Row> }) {
  const [moduleId, setModuleId] = useState(MODULES[0].id);
  const module = useMemo(() => MODULES.find((m) => m.id === moduleId) as ModuleDef, [moduleId]);
  const configDoc = uiConfig[moduleId] as Record<string, unknown> | undefined;

  return (
    <article className="settings-card">
      <div className="settings-toolbar">
        <div className="field">
          <label htmlFor="set-module">Módulo a personalizar</label>
          <select id="set-module" value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            {MODULES.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </div>
      </div>
      {/* key: al cambiar de módulo se remonta el editor con los overrides de ese módulo */}
      <ModuleEditor key={moduleId} module={module} configDoc={configDoc} />
    </article>
  );
}

interface EditorProps {
  module: ModuleDef;
  configDoc: Record<string, unknown> | undefined;
}

function ModuleEditor({ module, configDoc }: EditorProps) {
  const [title, setTitle] = useState(() =>
    typeof configDoc?.title === 'string' ? configDoc.title : '');
  const [labels, setLabels] = useState<Record<string, string>>(() =>
    (configDoc?.labels && typeof configDoc.labels === 'object')
      ? { ...(configDoc.labels as Record<string, string>) }
      : {});
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const defaultCols = module.fields.filter((f) => f.inList).map((f) => f.key);
    const savedOrder = Array.isArray(configDoc?.columnOrder) ? configDoc.columnOrder as string[] : null;
    return savedOrder && savedOrder.length > 0
      ? [...savedOrder.filter((k) => defaultCols.includes(k)), ...defaultCols.filter((k) => !savedOrder.includes(k))]
      : defaultCols;
  });
  const [saved, setSaved] = useState(false);

  const moveColumn = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= columnOrder.length) return;
    setColumnOrder((prev) => swap(prev, index, j));
    setSaved(false);
  };

  const save = async () => {
    // Solo se persisten etiquetas realmente personalizadas (vacío = usar la default)
    const cleanLabels: Record<string, string> = {};
    for (const [key, value] of Object.entries(labels)) {
      if (value.trim()) cleanLabels[key] = value.trim();
    }
    await setRowMerged('config_ui', module.id, {
      title: title.trim(),
      labels: cleanLabels,
      columnOrder,
    });
    setSaved(true);
  };

  const fieldLabel = (key: string) => module.fields.find((f) => f.key === key)?.label ?? key;

  return (
    <>
      <header className="settings-card-head">
        <span className="settings-card-icon"><Type size={15} /></span>
        <h2>Nombres y columnas · {module.title}</h2>
        <button className="btn-primary btn-gradient" onClick={() => void save()}>
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? 'Guardado' : 'Guardar módulo'}
        </button>
      </header>

      <div className="settings-toolbar">
        <div className="field">
          <label htmlFor="set-title">Nombre del módulo (menú y encabezado)</label>
          <input
            id="set-title"
            value={title}
            placeholder={module.title}
            onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
          />
        </div>
      </div>

      <div className="settings-columns">
        <div className="settings-block">
          <h3><Type size={13} />Nombres de los campos</h3>
          <p className="settings-hint">Deja un campo vacío para usar el nombre original.</p>
          <ul className="label-list">
            {module.fields.map((f) => (
              <li key={f.key}>
                <span className="label-default" title={f.key}>{f.label}</span>
                <input
                  value={labels[f.key] ?? ''}
                  placeholder={f.label}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLabels((prev) => ({ ...prev, [f.key]: value }));
                    setSaved(false);
                  }}
                />
              </li>
            ))}
          </ul>
        </div>

        <div className="settings-block">
          <h3><ListOrdered size={13} />Orden de columnas de la tabla</h3>
          <p className="settings-hint">Define en qué orden aparecen las columnas del listado.</p>
          <ol className="order-list compact">
            {columnOrder.map((key, index) => (
              <li key={key}>
                <span className="order-num">{index + 1}</span>
                <span className="order-label">{labels[key]?.trim() || fieldLabel(key)}</span>
                <span className="order-arrows">
                  <button className="btn-icon-ghost" onClick={() => moveColumn(index, -1)} disabled={index === 0} aria-label="Subir">
                    <ArrowUp size={15} />
                  </button>
                  <button className="btn-icon-ghost" onClick={() => moveColumn(index, 1)} disabled={index === columnOrder.length - 1} aria-label="Bajar">
                    <ArrowDown size={15} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}

/* ==================== Inspector de colecciones ==================== */

/** Colecciones a inspeccionar: las que usa la app + las detectadas en Firebase Console. */
const INSPECT_COLLECTIONS = [
  'work_orders', 'work_order_details', 'customers', 'team',
  'agent_commissions', 'commission_payments',
  'catalog_tag', 'catalog_zipcode', 'catalog_company',
  'catalog_jobtype', 'catalog_calibration_type', 'catalog_price_tier',
  'catalog_part_number', 'catalog_payment_method', 'catalog_insurance',
  'catalog_molding', 'catalog_expenses', 'catalog_vehicle',
];

type InspectResult = Record<string, { fields: [string, string][] } | 'empty' | { error: string }>;

function preview(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.length} items]`;
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return s.length > 34 ? `${s.slice(0, 34)}…` : s;
}

function CollectionInspector() {
  const [result, setResult] = useState<InspectResult | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const out: InspectResult = {};
    for (const name of INSPECT_COLLECTIONS) {
      try {
        // limit(1): seguro incluso para colecciones enormes como catalog_vehicle
        const [doc] = await fetchSample(name, 1);
        out[name] = doc
          ? { fields: Object.entries(doc).filter(([k]) => k !== 'id').map(([k, val]) => [k, preview(val)] as [string, string]) }
          : 'empty';
      } catch (err) {
        out[name] = { error: err instanceof Error ? err.message : 'error' };
      }
      setResult({ ...out });
    }
    setBusy(false);
  };

  return (
    <article className="settings-card">
      <header className="settings-card-head">
        <span className="settings-card-icon"><ScanSearch size={15} /></span>
        <h2>Inspector de colecciones (Firebase)</h2>
        <button className="btn-primary btn-gradient" onClick={() => void run()} disabled={busy}>
          {busy ? <Loader2 size={15} className="spin" /> : <ScanSearch size={15} />}
          {busy ? 'Analizando…' : 'Analizar colecciones'}
        </button>
      </header>
      <p className="settings-hint">
        Lee 1 documento de muestra por colección y muestra sus campos reales — útil para mapear la base de datos existente.
      </p>
      {result && (
        <ul className="inspector-list">
          {INSPECT_COLLECTIONS.filter((c) => result[c] !== undefined).map((name) => {
            const r = result[name];
            return (
              <li key={name}>
                <strong className="inspector-name">{name}</strong>
                {r === 'empty' ? (
                  <span className="inspector-empty">(vacía o no existe)</span>
                ) : 'error' in (r as object) ? (
                  <span className="inspector-error">{(r as { error: string }).error}</span>
                ) : (
                  <ul className="inspector-fields">
                    {(r as { fields: [string, string][] }).fields.map(([key, val]) => (
                      <li key={key}><code>{key}</code><span>{val}</span></li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
