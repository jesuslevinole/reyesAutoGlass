import { useEffect, useState } from 'react';
import { Pencil, Plus, Shield, Trash2, X } from 'lucide-react';
import { DEFAULT_NAV } from '../config/modules';
import type { Row } from '../services/firestore';
import { createRow, deleteRow, subscribe, updateRow } from '../services/firestore';
import type { ModulePerm } from '../utils/uiConfig';
import './RolesView.css';

interface RoleDoc extends Row {
  name?: string;
  permissions?: Record<string, ModulePerm>;
  /** Formato anterior (lista simple de módulos con acceso) */
  modules?: string[];
}

const ACTIONS = ['view', 'add', 'edit', 'delete'] as const;
const ACTION_LABELS: Record<(typeof ACTIONS)[number], string> = {
  view: 'View', add: 'Add', edit: 'Edit', delete: 'Delete',
};

/** Normaliza un rol al formato de permisos (migra el formato viejo modules[]). */
function permsOf(role: RoleDoc | null): Record<string, ModulePerm> {
  const base: Record<string, ModulePerm> = {};
  for (const item of DEFAULT_NAV) {
    const legacy = role?.modules?.includes(item.id) ?? false;
    const saved = role?.permissions?.[item.id];
    base[item.id] = saved
      ? { view: !!saved.view, add: !!saved.add, edit: !!saved.edit, delete: !!saved.delete }
      : { view: legacy, add: legacy, edit: legacy, delete: legacy };
  }
  return base;
}

export default function RolesView() {
  const [roles, setRoles] = useState<RoleDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RoleDoc | null | 'new'>(null);

  useEffect(() => subscribe('roles', (r) => { setRoles(r as RoleDoc[]); setLoading(false); }, () => setLoading(false)), []);

  const handleDelete = async (role: RoleDoc) => {
    if (!window.confirm(`Delete role "${role.name ?? ''}"?`)) return;
    await deleteRow('roles', role.id);
  };

  const summaryOf = (role: RoleDoc): string => {
    const perms = permsOf(role);
    const visible = DEFAULT_NAV.filter((n) => perms[n.id].view);
    if (visible.length === 0) return 'No access';
    if (visible.length === DEFAULT_NAV.length) return 'Full access to all modules';
    return visible.map((n) => n.label).join(', ');
  };

  return (
    <section className="module-view">
      <header className="module-head">
        <div>
          <h1>Roles</h1>
          <p className="module-desc">User roles and per-module permissions (view / add / edit / delete)</p>
        </div>
        <div className="module-actions">
          <button className="btn-primary" onClick={() => setEditing('new')}>
            <Plus size={16} />
            New role
          </button>
        </div>
      </header>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Access</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 3 }, (_, i) => (
              <tr key={`skel-${i}`} aria-hidden="true">
                <td><span className="skeleton skel-cell skel-w1" /></td>
                <td><span className="skeleton skel-cell skel-w2" /></td>
                <td className="col-actions"><span className="skeleton skel-dot" /></td>
              </tr>
            ))}
            {!loading && roles.map((role) => (
              <tr key={role.id}>
                <td className="role-name"><Shield size={14} />{role.name ?? '—'}</td>
                <td><span className="role-modules">{summaryOf(role)}</span></td>
                <td className="col-actions">
                  <button className="btn-icon-ghost" onClick={() => setEditing(role)} aria-label="Edit">
                    <Pencil size={15} />
                  </button>
                  <button className="btn-danger-ghost" onClick={() => void handleDelete(role)} aria-label="Delete">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && roles.length === 0 && (
              <tr>
                <td className="empty-cell" colSpan={3}>
                  No roles yet. Create the first one — e.g. "Administrator" with full access.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <RoleModal
          role={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

/* ==================== Role modal: permissions matrix ==================== */

function RoleModal({ role, onClose }: { role: RoleDoc | null; onClose: () => void }) {
  const [name, setName] = useState(role?.name ?? '');
  const [perms, setPerms] = useState<Record<string, ModulePerm>>(() => permsOf(role));
  const [saving, setSaving] = useState(false);

  const toggle = (moduleId: string, action: (typeof ACTIONS)[number]) => {
    setPerms((prev) => {
      const current = { ...prev[moduleId], [action]: !prev[moduleId][action] };
      // Sin "view" las demás acciones no tienen sentido; con add/edit/delete se enciende view
      if (action === 'view' && !current.view) {
        current.add = false; current.edit = false; current.delete = false;
      }
      if (action !== 'view' && current[action]) current.view = true;
      return { ...prev, [moduleId]: current };
    });
  };

  /** Enciende/apaga una acción completa (columna) para todos los módulos. */
  const toggleColumn = (action: (typeof ACTIONS)[number]) => {
    setPerms((prev) => {
      const allOn = DEFAULT_NAV.every((n) => prev[n.id][action]);
      const next: Record<string, ModulePerm> = {};
      for (const n of DEFAULT_NAV) {
        const current = { ...prev[n.id], [action]: !allOn };
        if (action === 'view' && allOn) {
          current.add = false; current.edit = false; current.delete = false;
        }
        if (action !== 'view' && !allOn) current.view = true;
        next[n.id] = current;
      }
      return next;
    });
  };

  /** Enciende/apaga todo el renglón (módulo). */
  const toggleRow = (moduleId: string) => {
    setPerms((prev) => {
      const allOn = ACTIONS.every((a) => prev[moduleId][a]);
      return {
        ...prev,
        [moduleId]: { view: !allOn, add: !allOn, edit: !allOn, delete: !allOn },
      };
    });
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        permissions: perms,
        // compatibilidad con el formato anterior
        modules: DEFAULT_NAV.filter((n) => perms[n.id].view).map((n) => n.id),
      };
      if (role) await updateRow('roles', role.id, data);
      else await createRow('roles', data);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card role-modal" onClick={(e) => e.stopPropagation()}>
        <header className="form-header">
          <span className="form-header-icon"><Shield size={21} /></span>
          <div className="form-header-text">
            <h2>{role ? 'Edit role' : 'New role'}</h2>
            <p>Set the name and per-module permissions</p>
          </div>
          <button type="button" className="window-btn" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </header>

        <div className="role-modal-body">
          <div className="field">
            <label htmlFor="role-name">Role name *</label>
            <input
              id="role-name"
              value={name}
              placeholder="Administrator, Operations, Read only…"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <table className="perm-table">
            <thead>
              <tr>
                <th className="perm-module-col">Module</th>
                {ACTIONS.map((a) => (
                  <th key={a}>
                    <button type="button" className="perm-col-toggle" onClick={() => toggleColumn(a)} title={`Toggle ${ACTION_LABELS[a]} for all`}>
                      {ACTION_LABELS[a]}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEFAULT_NAV.map((item) => (
                <tr key={item.id}>
                  <td className="perm-module-col">
                    <button type="button" className="perm-row-toggle" onClick={() => toggleRow(item.id)} title="Toggle all for this module">
                      {item.label}
                    </button>
                  </td>
                  {ACTIONS.map((a) => (
                    <td key={a}>
                      <input
                        type="checkbox"
                        checked={perms[item.id][a]}
                        aria-label={`${ACTION_LABELS[a]} ${item.label}`}
                        onChange={() => toggle(item.id, a)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="form-foot">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-dark" onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : role ? 'Save changes' : 'Create role'}
          </button>
        </footer>
      </div>
    </div>
  );
}
