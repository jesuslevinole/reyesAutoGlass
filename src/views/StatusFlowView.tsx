import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, GitBranch, Hand, Pencil, Save, Search, X, Zap } from 'lucide-react';
import { getModule } from '../config/modules';
import type { Row } from '../services/firestore';
import { cachedFetchAll } from '../services/catalogCache';
import { tagColorToHex } from '../utils/relations';
import type { KindRules, StatusRules } from '../utils/pipeline';
import { configOf, loadStatusRules, saveStatusRules, stagesFromTags } from '../utils/pipeline';
import './StatusFlowView.css';

type Kind = 'quote' | 'workorder';

/** Catálogo de campos del formulario, agrupados por sección (patrón Roelca). */
function useFieldCatalog() {
  return useMemo(() => {
    const module = getModule('workorders');
    const sections = module.sections ?? [];
    const groups = sections.map((s) => ({
      section: s.title,
      fields: module.fields
        .filter((f) => f.section === s.id)
        .map((f) => ({ id: f.key, label: f.label })),
    })).filter((g) => g.fields.length > 0);
    const flat = groups.flatMap((g) => g.fields);
    const labelOf = (id: string) => flat.find((f) => f.id === id)?.label ?? id;
    return { groups, labelOf };
  }, []);
}

export default function StatusFlowView() {
  const [kind, setKind] = useState<Kind>('quote');
  const [tags, setTags] = useState<Row[]>([]);
  const [rules, setRules] = useState<StatusRules>({
    quote: { order: [], stages: {} },
    workorder: { order: [], stages: {} },
  });
  const [saved, setSaved] = useState(false);
  const [editingStage, setEditingStage] = useState<{ id: string; name: string } | null>(null);
  const { groups, labelOf } = useFieldCatalog();

  useEffect(() => {
    let alive = true;
    void Promise.all([cachedFetchAll('catalog_tag'), loadStatusRules()]).then(([t, r]) => {
      if (!alive) return;
      setTags(t);
      setRules(r);
    });
    return () => { alive = false; };
  }, []);

  const kindRules: KindRules = rules[kind];
  const stages = useMemo(
    () => stagesFromTags(tags, kind, kindRules.order),
    [tags, kind, kindRules.order],
  );

  const patchKind = (patch: Partial<KindRules>) => {
    setRules((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));
    setSaved(false);
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= stages.length) return;
    const ids = stages.map((s) => s.id);
    [ids[index], ids[j]] = [ids[j], ids[index]];
    patchKind({ order: ids });
  };

  const setMechanism = (stageId: string, mechanism: 'auto' | 'manual') => {
    patchKind({
      stages: { ...kindRules.stages, [stageId]: { ...configOf(kindRules, stageId), mechanism } },
    });
  };

  const toggleHidden = (stageId: string) => {
    const cfg = configOf(kindRules, stageId);
    patchKind({
      stages: { ...kindRules.stages, [stageId]: { ...cfg, hidden: !cfg.hidden } },
    });
  };

  const setRequired = (stageId: string, required: string[]) => {
    patchKind({
      stages: { ...kindRules.stages, [stageId]: { ...configOf(kindRules, stageId), required } },
    });
  };

  const save = async () => {
    // Persistir el orden visible actual de ambos pipelines
    await saveStatusRules({
      ...rules,
      [kind]: { ...kindRules, order: stages.map((s) => s.id) },
    });
    setSaved(true);
  };

  return (
    <section className="module-view">
      <header className="module-head">
        <div>
          <h1>Status Flow</h1>
          <p className="module-desc">
            Stages come from the Status catalog. Set their order, how each one is reached
            (automatic when its fields are filled, or a manual button), and what is required.
          </p>
        </div>
        <div className="module-actions">
          <button className="btn-primary btn-gradient" onClick={() => void save()}>
            {saved ? <Check size={15} /> : <Save size={15} />}
            {saved ? 'Saved' : 'Save rules'}
          </button>
        </div>
      </header>

      <nav className="sf-kinds" aria-label="Pipeline">
        {([['quote', 'Quote pipeline'], ['workorder', 'Work Order pipeline']] as [Kind, string][]).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`sf-kind${kind === value ? ' active' : ''}`}
            onClick={() => setKind(value)}
          >
            <GitBranch size={14} />
            {label}
          </button>
        ))}
      </nav>

      {stages.length === 0 && (
        <p className="sf-none">No statuses of this type in the catalog yet — create them in Catalogs → Status (Tags).</p>
      )}

      <ol className="sf-stages">
        {stages.map((stage, index) => {
          const cfg = configOf(kindRules, stage.id);
          return (
            <li className="sf-stage" key={stage.id}>
              <div className="sf-stage-head">
                <span className="sf-stage-num">{index + 1}</span>
                <span
                  className="sf-stage-color"
                  /* color real del tag del catálogo */
                  style={{ '--stage-color': tagColorToHex(stage.color) } as React.CSSProperties}
                />
                <h2>{stage.name}</h2>
                <span className="sf-mech" role="radiogroup" aria-label="Mechanism">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={cfg.mechanism === 'auto'}
                    className={`sf-mech-btn auto${cfg.mechanism === 'auto' ? ' active' : ''}`}
                    title="Moves here automatically when its required fields are filled"
                    onClick={() => setMechanism(stage.id, 'auto')}
                  >
                    <Zap size={12} />
                    Auto
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={cfg.mechanism === 'manual'}
                    className={`sf-mech-btn manual${cfg.mechanism === 'manual' ? ' active' : ''}`}
                    title="Moves here only when someone presses the stage button"
                    onClick={() => setMechanism(stage.id, 'manual')}
                  >
                    <Hand size={12} />
                    Manual
                  </button>
                </span>
                <button
                  type="button"
                  className={`sf-visibility${cfg.hidden ? ' off' : ''}`}
                  title={cfg.hidden
                    ? 'Hidden from the pipeline bar — reachable only via the Status select'
                    : 'Shown as a stage in the pipeline bar'}
                  onClick={() => toggleHidden(stage.id)}
                >
                  {cfg.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  {cfg.hidden ? 'Off pipeline' : 'In pipeline'}
                </button>
                <span className="sf-order">
                  <button className="btn-icon-ghost" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                    <ArrowUp size={14} />
                  </button>
                  <button className="btn-icon-ghost" onClick={() => move(index, 1)} disabled={index === stages.length - 1} aria-label="Move down">
                    <ArrowDown size={14} />
                  </button>
                </span>
                <button
                  type="button"
                  className="btn-outline sf-edit"
                  onClick={() => setEditingStage({ id: stage.id, name: stage.name })}
                >
                  <Pencil size={13} />
                  Requirements
                </button>
              </div>
              {cfg.required.length === 0 ? (
                <p className="sf-none">
                  {cfg.mechanism === 'auto'
                    ? 'Auto with no required fields — it will advance immediately. Add requirements.'
                    : 'No requirements — anyone can move it here.'}
                </p>
              ) : (
                <ul className="sf-chips">
                  {cfg.required.map((id) => (
                    <li key={id} className="sf-chip">
                      {labelOf(id)}
                      <button
                        type="button"
                        aria-label={`Remove ${labelOf(id)}`}
                        onClick={() => setRequired(stage.id, cfg.required.filter((r) => r !== id))}
                      >
                        <X size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {index < stages.length - 1 && <span className="sf-connector" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      {editingStage && (
        <RequiredFieldsModal
          stage={editingStage.name}
          groups={groups}
          selected={configOf(kindRules, editingStage.id).required}
          onConfirm={(ids) => {
            setRequired(editingStage.id, ids);
            setEditingStage(null);
          }}
          onClose={() => setEditingStage(null)}
        />
      )}
    </section>
  );
}

/* ============================================================
   Modal de campos requeridos (réplica del patrón Roelca, paleta clara):
   secciones con contador, buscador, marcar todos / limpiar por sección.
============================================================ */

function RequiredFieldsModal({ stage, groups, selected, onConfirm, onClose }: {
  stage: string;
  groups: { section: string; fields: { id: string; label: string }[] }[];
  selected: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [selection, setSelection] = useState<Set<string>>(() => new Set(selected));
  const [search, setSearch] = useState('');

  const toggle = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const markSection = (fields: { id: string }[]) =>
    setSelection((prev) => new Set([...prev, ...fields.map((f) => f.id)]));
  const clearSection = (fields: { id: string }[]) =>
    setSelection((prev) => {
      const next = new Set(prev);
      for (const f of fields) next.delete(f.id);
      return next;
    });

  const filter = search.trim().toLowerCase();
  const visibleGroups = filter
    ? groups
        .map((g) => ({
          ...g,
          fields: g.fields.filter((f) =>
            f.label.toLowerCase().includes(filter) || f.id.toLowerCase().includes(filter)),
        }))
        .filter((g) => g.fields.length > 0)
    : groups;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card sf-modal" onClick={(e) => e.stopPropagation()}>
        <header className="sf-modal-head">
          <span className="sf-modal-icon"><GitBranch size={16} /></span>
          <div className="sf-modal-title">
            <h3>Required to enter “{stage}”</h3>
            <p>Check the fields that must be filled before moving here.</p>
          </div>
          <button type="button" className="btn-icon-ghost" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </header>
        <div className="sf-search">
          <Search size={14} />
          <input
            autoFocus
            value={search}
            placeholder="Search field…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="sf-modal-body">
          {visibleGroups.length === 0 && <p className="sf-none">No fields match your search.</p>}
          {visibleGroups.map((group) => {
            const marked = group.fields.filter((f) => selection.has(f.id)).length;
            return (
              <section className="sf-group" key={group.section}>
                <header className="sf-group-head">
                  <h4>
                    {group.section}
                    <span className="sf-group-count">{marked}/{group.fields.length}</span>
                  </h4>
                  <span className="sf-group-actions">
                    <button type="button" onClick={() => markSection(group.fields)}>Mark all</button>
                    <button type="button" onClick={() => clearSection(group.fields)}>Clear</button>
                  </span>
                </header>
                <ul className="sf-field-grid">
                  {group.fields.map((field) => {
                    const checked = selection.has(field.id);
                    return (
                      <li key={field.id}>
                        <label className={`sf-field${checked ? ' checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(field.id)}
                          />
                          {field.label}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <footer className="sf-modal-foot">
          <button type="button" className="btn-outline" onClick={() => setSelection(new Set())}>Clear all</button>
          <span className="sf-foot-spacer" />
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-dark" onClick={() => onConfirm([...selection])}>
            Apply ({selection.size})
          </button>
        </footer>
      </div>
    </div>
  );
}
