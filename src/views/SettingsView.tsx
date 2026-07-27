import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ListOrdered, PanelLeft, Save, Type } from 'lucide-react';
import { MODULES } from '../config/modules';
import type { ModuleDef, NavItem } from '../config/modules';
import type { Row } from '../services/firestore';
import { setRowMerged } from '../services/firestore';
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

      <MenuOrderCard navItems={navItems} />
      <ModuleCustomizer uiConfig={uiConfig} />
    </section>
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
