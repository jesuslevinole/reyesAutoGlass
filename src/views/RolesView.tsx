import { useState } from 'react';
import { useEffect } from 'react';
import { Pencil, Plus, Shield, Trash2, X } from 'lucide-react';
import { DEFAULT_NAV } from '../config/modules';
import type { Row } from '../services/firestore';
import { createRow, deleteRow, subscribe, updateRow } from '../services/firestore';
import './RolesView.css';

interface RoleDoc extends Row {
  name?: string;
  modules?: string[];
}

export default function RolesView() {
  const [roles, setRoles] = useState<RoleDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RoleDoc | null | 'new'>(null);

  useEffect(() => subscribe('roles', (r) => { setRoles(r as RoleDoc[]); setLoading(false); }, () => setLoading(false)), []);

  const handleDelete = async (role: RoleDoc) => {
    if (!window.confirm(`¿Eliminar el rol «${role.name ?? ''}»?`)) return;
    await deleteRow('roles', role.id);
  };

  return (
    <section className="module-view">
      <header className="module-head">
        <div>
          <h1>Roles</h1>
          <p className="module-desc">Roles de usuario y los módulos a los que tienen acceso</p>
        </div>
        <div className="module-actions">
          <button className="btn-primary" onClick={() => setEditing('new')}>
            <Plus size={16} />
            Nuevo rol
          </button>
        </div>
      </header>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Rol</th>
              <th>Módulos con acceso</th>
              <th className="col-actions">Acciones</th>
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
                <td>
                  <span className="role-count">{role.modules?.length ?? 0} módulos</span>
                  <span className="role-modules">
                    {(role.modules ?? [])
                      .map((id) => DEFAULT_NAV.find((n) => n.id === id)?.label ?? id)
                      .join(', ') || 'Sin módulos asignados'}
                  </span>
                </td>
                <td className="col-actions">
                  <button className="btn-icon-ghost" onClick={() => setEditing(role)} aria-label="Editar">
                    <Pencil size={15} />
                  </button>
                  <button className="btn-danger-ghost" onClick={() => void handleDelete(role)} aria-label="Eliminar">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && roles.length === 0 && (
              <tr>
                <td className="empty-cell" colSpan={3}>
                  Sin roles todavía. Crea el primero — por ejemplo «Administrador» con todos los módulos.
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

/* ==================== Modal de rol con matriz de módulos ==================== */

function RoleModal({ role, onClose }: { role: RoleDoc | null; onClose: () => void }) {
  const [name, setName] = useState(role?.name ?? '');
  const [selected, setSelected] = useState<string[]>(role?.modules ?? []);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const allSelected = selected.length === DEFAULT_NAV.length;
  const toggleAll = () => setSelected(allSelected ? [] : DEFAULT_NAV.map((n) => n.id));

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data = { name: name.trim(), modules: selected };
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
            <h2>{role ? 'Editar rol' : 'Nuevo rol'}</h2>
            <p>Define el nombre y los módulos con acceso</p>
          </div>
          <button type="button" className="window-btn" onClick={onClose} aria-label="Cerrar">
            <X size={17} />
          </button>
        </header>

        <div className="role-modal-body">
          <div className="field">
            <label htmlFor="role-name">Nombre del rol *</label>
            <input
              id="role-name"
              value={name}
              placeholder="Administrador, Operaciones, Solo lectura…"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="role-matrix-head">
            <p className="role-matrix-title">Módulos con acceso ({selected.length}/{DEFAULT_NAV.length})</p>
            <button type="button" className="btn-outline role-toggle-all" onClick={toggleAll}>
              {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
            </button>
          </div>

          <ul className="fklist role-matrix">
            {DEFAULT_NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`fklist-chip${selected.includes(item.id) ? ' selected' : ''}`}
                  onClick={() => toggle(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <footer className="form-foot">
          <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-primary btn-gradient" onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving ? 'Guardando…' : role ? 'Guardar cambios' : 'Crear rol'}
          </button>
        </footer>
      </div>
    </div>
  );
}
