import { useEffect, useMemo, useState } from 'react';
import { Check, GitBranch, Pencil, Save, Search, X } from 'lucide-react';
import { getModule } from '../config/modules';
import type { StageRules, StatusRules } from '../utils/pipeline';
import { QUOTE_PIPELINE, WORKORDER_PIPELINE, loadStatusRules, saveStatusRules } from '../utils/pipeline';
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
  const [rules, setRules] = useState<StatusRules>({ quote: {}, workorder: {} });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const { groups, labelOf } = useFieldCatalog();

  useEffect(() => {
    let alive = true;
    void loadStatusRules().then((r) => {
      if (!alive) return;
      setRules(r);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const pipeline = kind === 'quote' ? QUOTE_PIPELINE : WORKORDER_PIPELINE;
  const stageRules: StageRules = rules[kind];

  const setStage = (stage: string, fieldIds: string[]) => {
    setRules((prev) => ({ ...prev, [kind]: { ...prev[kind], [stage]: fieldIds } }));
    setSaved(false);
  };

  const save = async () => {
    await saveStatusRules(rules);
    setSaved(true);
  };

  return (
    <section className="module-view">
      <header className="module-head">
        <div>
          <h1>Status Flow</h1>
          <p className="module-desc">
            CRM rules — which fields must be completed before a quote or work order can move to each stage
          </p>
        </div>
        <div className="module-actions">
          <button className="btn-primary btn-gradient" onClick={() => void save()} disabled={loading}>
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

      <ol className="sf-stages">
        {pipeline.map((stage, index) => {
          const required = stageRules[stage] ?? [];
          return (
            <li className="sf-stage" key={stage}>
              <div className="sf-stage-head">
                <span className="sf-stage-num">{index + 1}</span>
                <h2>{stage}</h2>
                <button
                  type="button"
                  className="btn-outline sf-edit"
                  onClick={() => setEditingStage(stage)}
                >
                  <Pencil size={13} />
                  Requirements
                </button>
              </div>
              {required.length === 0 ? (
                <p className="sf-none">
                  {index === 0
                    ? 'Entry stage — no requirements.'
                    : 'No requirements — anyone can move it here.'}
                </p>
              ) : (
                <ul className="sf-chips">
                  {required.map((id) => (
                    <li key={id} className="sf-chip">
                      {labelOf(id)}
                      <button
                        type="button"
                        aria-label={`Remove ${labelOf(id)}`}
                        onClick={() => setStage(stage, required.filter((r) => r !== id))}
                      >
                        <X size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {index < pipeline.length - 1 && <span className="sf-connector" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      {editingStage && (
        <RequiredFieldsModal
          stage={editingStage}
          groups={groups}
          selected={stageRules[editingStage] ?? []}
          onConfirm={(ids) => {
            setStage(editingStage, ids);
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
