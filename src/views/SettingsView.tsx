import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowDown, ArrowUp, Check, ListOrdered, Loader2, Palette, PanelLeft, Save, ScanSearch, Sparkles, Type } from 'lucide-react';
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
          <h1>Settings</h1>
          <p className="module-desc">
            Customize names, ordering, branding and colors. Changes are saved to Firestore and apply to everyone.
          </p>
        </div>
      </header>

      <AppNameCard uiConfig={uiConfig} />
      <AppearanceCard uiConfig={uiConfig} />
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
  const currentLogo = typeof appDoc?.logo === 'string' ? appDoc.logo : '';
  // key: al llegar el valor guardado desde Firestore se remonta con él
  return <AppNameEditor key={`${currentName}|${currentLogo.length}`} currentName={currentName} currentLogo={currentLogo} />;
}

function AppNameEditor({ currentName, currentLogo }: { currentName: string; currentLogo: string }) {
  const [name, setName] = useState(currentName);
  const [logo, setLogo] = useState(currentLogo);
  const [saved, setSaved] = useState(false);

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 300 * 1024) {
      window.alert('Logo must be under 300 KB (it is stored in Firestore). Please use a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogo(String(reader.result ?? ''));
      setSaved(false);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    await setRowMerged('config_ui', '_app', { name: name.trim(), logo });
    setSaved(true);
  };

  return (
    <article className="settings-card">
      <header className="settings-card-head">
        <span className="settings-card-icon"><Sparkles size={15} /></span>
        <h2>Application identity</h2>
        <button className="btn-primary btn-gradient" onClick={() => void save()}>
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? 'Saved' : 'Save identity'}
        </button>
      </header>
      <div className="settings-toolbar identity-grid">
        <div className="field">
          <label htmlFor="set-appname">App name — shown in the sidebar and the browser tab</label>
          <input
            id="set-appname"
            value={name}
            placeholder="GlassWorks"
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
          />
        </div>
        <div className="field">
          <label htmlFor="set-logo">Logo (PNG/SVG, max 300 KB)</label>
          <div className="logo-row">
            {logo ? <img className="logo-preview" src={logo} alt="App logo" /> : <span className="logo-empty">No logo</span>}
            <input
              id="set-logo"
              type="file"
              accept="image/*"
              onChange={(e) => onLogoFile(e.target.files?.[0])}
            />
            {logo && (
              <button type="button" className="btn-outline" onClick={() => { setLogo(''); setSaved(false); }}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ==================== Appearance (color palette) ==================== */

const THEME_PRESETS = [
  { name: 'Blue', primary: '#3583f6', deep: '#2568d8' },
  { name: 'Green', primary: '#16a34a', deep: '#15803d' },
  { name: 'Purple', primary: '#7c3aed', deep: '#6d28d9' },
  { name: 'Orange', primary: '#ea580c', deep: '#c2410c' },
  { name: 'Teal', primary: '#0d9488', deep: '#0f766e' },
  { name: 'Slate', primary: '#475569', deep: '#334155' },
];

function AppearanceCard({ uiConfig }: { uiConfig: Record<string, Row> }) {
  const themeDoc = uiConfig['_theme'] as Record<string, unknown> | undefined;
  const cur = {
    primary: typeof themeDoc?.primary === 'string' ? themeDoc.primary : '#3583f6',
    deep: typeof themeDoc?.deep === 'string' ? themeDoc.deep : '#2568d8',
  };
  return <AppearanceEditor key={`${cur.primary}|${cur.deep}`} current={cur} />;
}

function AppearanceEditor({ current }: { current: { primary: string; deep: string } }) {
  const [primary, setPrimary] = useState(current.primary);
  const [deep, setDeep] = useState(current.deep);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await setRowMerged('config_ui', '_theme', { primary, deep });
    setSaved(true);
  };

  return (
    <article className="settings-card">
      <header className="settings-card-head">
        <span className="settings-card-icon"><Palette size={15} /></span>
        <h2>Appearance — color palette</h2>
        <button className="btn-primary btn-gradient" onClick={() => void save()}>
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? 'Saved' : 'Save palette'}
        </button>
      </header>
      <p className="settings-hint">
        The primary color drives buttons, links, active menu items and highlights across the whole app, for every user.
      </p>
      <ul className="theme-presets">
        {THEME_PRESETS.map((p) => (
          <li key={p.name}>
            <button
              type="button"
              className={`theme-preset${primary === p.primary ? ' active' : ''}`}
              /* color del preset como variable CSS en runtime */
              style={{ '--preset': p.primary } as CSSProperties}
              onClick={() => { setPrimary(p.primary); setDeep(p.deep); setSaved(false); }}
            >
              <span className="theme-swatch" />
              {p.name}
            </button>
          </li>
        ))}
      </ul>
      <div className="settings-toolbar identity-grid">
        <div className="field">
          <label htmlFor="set-color-primary">Primary color</label>
          <input
            id="set-color-primary"
            type="color"
            value={primary}
            onChange={(e) => { setPrimary(e.target.value); setSaved(false); }}
          />
        </div>
        <div className="field">
          <label htmlFor="set-color-deep">Primary dark (hover / emphasis)</label>
          <input
            id="set-color-deep"
            type="color"
            value={deep}
            onChange={(e) => { setDeep(e.target.value); setSaved(false); }}
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
        <h2>Sidebar menu order</h2>
        <button className="btn-primary btn-gradient" onClick={() => void save()}>
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? 'Saved' : 'Save order'}
        </button>
      </header>
      <ol className="order-list">
        {order.map((id, index) => (
          <li key={id}>
            <span className="order-num">{index + 1}</span>
            <span className="order-label">{labelOf(id)}</span>
            <span className="order-arrows">
              <button className="btn-icon-ghost" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                <ArrowUp size={15} />
              </button>
              <button className="btn-icon-ghost" onClick={() => move(index, 1)} disabled={index === order.length - 1} aria-label="Move down">
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
          <label htmlFor="set-module">Module to customize</label>
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
  const [formOrder, setFormOrder] = useState<string[]>(() => {
    const allKeys = module.fields.map((f) => f.key);
    const savedOrder = Array.isArray(configDoc?.formOrder) ? configDoc.formOrder as string[] : null;
    return savedOrder && savedOrder.length > 0
      ? [...savedOrder.filter((k) => allKeys.includes(k)), ...allKeys.filter((k) => !savedOrder.includes(k))]
      : allKeys;
  });
  const [saved, setSaved] = useState(false);

  const moveColumn = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= columnOrder.length) return;
    setColumnOrder((prev) => swap(prev, index, j));
    setSaved(false);
  };

  const moveFormField = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= formOrder.length) return;
    setFormOrder((prev) => swap(prev, index, j));
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
      formOrder,
    });
    setSaved(true);
  };

  const fieldLabel = (key: string) => module.fields.find((f) => f.key === key)?.label ?? key;

  return (
    <>
      <header className="settings-card-head">
        <span className="settings-card-icon"><Type size={15} /></span>
        <h2>Names & ordering · {module.title}</h2>
        <button className="btn-primary btn-gradient" onClick={() => void save()}>
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? 'Saved' : 'Save module'}
        </button>
      </header>

      <div className="settings-toolbar">
        <div className="field">
          <label htmlFor="set-title">Module name (menu & header)</label>
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
          <h3><Type size={13} />Field names</h3>
          <p className="settings-hint">Leave a field empty to use the original name.</p>
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
          <h3><ListOrdered size={13} />Table column order</h3>
          <p className="settings-hint">Set the order of the list columns.</p>
          <ol className="order-list compact">
            {columnOrder.map((key, index) => (
              <li key={key}>
                <span className="order-num">{index + 1}</span>
                <span className="order-label">{labels[key]?.trim() || fieldLabel(key)}</span>
                <span className="order-arrows">
                  <button className="btn-icon-ghost" onClick={() => moveColumn(index, -1)} disabled={index === 0} aria-label="Move up">
                    <ArrowUp size={15} />
                  </button>
                  <button className="btn-icon-ghost" onClick={() => moveColumn(index, 1)} disabled={index === columnOrder.length - 1} aria-label="Move down">
                    <ArrowDown size={15} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="settings-block">
          <h3><ListOrdered size={13} />Form field order</h3>
          <p className="settings-hint">Set the order of the fields inside the form.</p>
          <ol className="order-list compact">
            {formOrder.map((key, index) => (
              <li key={key}>
                <span className="order-num">{index + 1}</span>
                <span className="order-label">{labels[key]?.trim() || fieldLabel(key)}</span>
                <span className="order-arrows">
                  <button className="btn-icon-ghost" onClick={() => moveFormField(index, -1)} disabled={index === 0} aria-label="Move up">
                    <ArrowUp size={15} />
                  </button>
                  <button className="btn-icon-ghost" onClick={() => moveFormField(index, 1)} disabled={index === formOrder.length - 1} aria-label="Move down">
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
        <h2>Collection inspector (Firebase)</h2>
        <button className="btn-primary btn-gradient" onClick={() => void run()} disabled={busy}>
          {busy ? <Loader2 size={15} className="spin" /> : <ScanSearch size={15} />}
          {busy ? 'Analyzing…' : 'Analyze collections'}
        </button>
      </header>
      <p className="settings-hint">
        Reads 1 sample document per collection and shows its real fields — useful to map the existing database.
      </p>
      {result && (
        <ul className="inspector-list">
          {INSPECT_COLLECTIONS.filter((c) => result[c] !== undefined).map((name) => {
            const r = result[name];
            return (
              <li key={name}>
                <strong className="inspector-name">{name}</strong>
                {r === 'empty' ? (
                  <span className="inspector-empty">(empty or missing)</span>
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
