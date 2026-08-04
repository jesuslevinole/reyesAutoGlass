import { useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Sidebar from './components/Sidebar';
import CatalogsView from './views/CatalogsView';
import LoginView from './views/LoginView';
import RolesView from './views/RolesView';
import DashboardView from './views/DashboardView';
import GenericModuleView from './views/GenericModuleView';
import SettingsView from './views/SettingsView';
import StatusFlowView from './views/StatusFlowView';
import CalendarView from './views/CalendarView';
import WorkOrderDetailView from './views/WorkOrderDetailView';
import { DEFAULT_NAV, getModule } from './config/modules';
import type { ModuleDef } from './config/modules';
import type { Row } from './services/firestore';
import { subscribe } from './services/firestore';
import { FULL_PERM, applyOverrides, orderNav } from './utils/uiConfig';
import type { ModulePerm } from './utils/uiConfig';
import { clearSession, loadSession, saveSession } from './config/auth';
import { warmCatalogs } from './services/catalogCache';
import type { Session } from './config/auth';
import './App.css';

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [view, setView] = useState('dashboard');
  const [openDoc, setOpenDoc] = useState<{ kind: 'workorder' | 'quote'; id: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Pre-carga de catálogos en segundo plano → los selects abren al instante
  useEffect(() => {
    if (!session) return;
    // catalog_part_number (11k docs) NO se pre-calienta: se carga al abrir el
    // formulario de detalle y su snapshot local dura 7 días (cero lecturas después).
    warmCatalogs([
      'catalog_tag', 'catalog_company', 'catalog_zipcode', 'customers', 'team',
      'catalog_insurance', 'catalog_jobtype',
      'catalog_price_tier', 'catalog_calibration_type', 'catalog_payment_method',
    ]);
  }, [session]);

  const enter = (s: Session) => { saveSession(s); setSession(s); };
  const logout = () => { clearSession(); setSession(null); };

  // Overrides de UI (nombres, orden de columnas y menú) en vivo desde Firestore
  const [uiConfig, setUiConfig] = useState<Record<string, Row>>({});
  useEffect(() => subscribe('config_ui', (rows) => {
    setUiConfig(Object.fromEntries(rows.map((r) => [r.id, r])));
  }), []);

  /** Módulo con títulos/etiquetas/orden de columnas personalizados aplicados */
  const resolveModule = useCallback(
    (id: string): ModuleDef => applyOverrides(getModule(id), uiConfig[id]),
    [uiConfig],
  );

  const appName = useMemo(() => {
    const doc = uiConfig['_app'] as Record<string, unknown> | undefined;
    return (typeof doc?.name === 'string' && doc.name.trim()) ? doc.name.trim() : 'GlassWorks';
  }, [uiConfig]);
  const appLogo = useMemo(() => {
    const doc = uiConfig['_app'] as Record<string, unknown> | undefined;
    return typeof doc?.logo === 'string' ? doc.logo : '';
  }, [uiConfig]);

  // Sincronizar el título de la pestaña del navegador (sistema externo → effect válido)
  useEffect(() => { document.title = appName; }, [appName]);

  // Paleta de colores configurable: 2 variables CSS re-tematizan toda la app
  useEffect(() => {
    const theme = uiConfig['_theme'] as Record<string, unknown> | undefined;
    const root = document.documentElement;
    if (typeof theme?.primary === 'string' && theme.primary) {
      root.style.setProperty('--blue', theme.primary);
      root.style.setProperty('--blue-deep', typeof theme.deep === 'string' && theme.deep ? theme.deep : theme.primary);
    } else {
      root.style.removeProperty('--blue');
      root.style.removeProperty('--blue-deep');
    }
  }, [uiConfig]);

  // ===== Permisos: usuario (por email de sesión) → rol → permisos por módulo =====
  const [users, setUsers] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Row[]>([]);
  useEffect(() => subscribe('users', setUsers), []);
  useEffect(() => subscribe('roles', setRoles), []);

  const permsFor = useCallback((moduleId: string): ModulePerm => {
    // Sesión de bypass o sin usuario registrado → acceso total (admin)
    if (!session?.email) return FULL_PERM;
    const user = users.find((u) => String((u as Record<string, unknown>).email ?? '').toLowerCase() === session.email?.toLowerCase());
    const roleId = user ? String((user as Record<string, unknown>).roleId ?? '') : '';
    const role = roleId ? roles.find((r) => r.id === roleId) : undefined;
    const perms = (role as Record<string, unknown> | undefined)?.permissions as Record<string, ModulePerm> | undefined;
    return perms?.[moduleId] ?? FULL_PERM;
  }, [session, users, roles]);

  const navItems = useMemo(() => {
    const withTitles = DEFAULT_NAV.map((item) => {
      const doc = uiConfig[item.id] as Record<string, unknown> | undefined;
      return (typeof doc?.title === 'string' && doc.title)
        ? { ...item, label: doc.title }
        : item;
    });
    return orderNav(withTitles, uiConfig['_menu']).filter((item) => permsFor(item.id).view);
  }, [uiConfig, permsFor]);

  const navigate = (viewId: string) => {
    setView(viewId);
    setOpenDoc(null);
    setSidebarOpen(false);
  };

  if (!session) return <LoginView onEnter={enter} />;

  return (
    <div className="app-frame">
      <div className="app-shell">
        <Sidebar
          appName={appName}
          appLogo={appLogo}
          items={navItems}
          current={view}
          open={sidebarOpen}
          collapsed={sidebarCollapsed}
          onNavigate={navigate}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="app-main">
          <header className="app-topbar">
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <button
              className="collapse-btn"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
              title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <p className="topbar-crumb">
              {navItems.find((i) => i.id === view)?.label ?? appName}
              {openDoc && ' · Detail'}
            </p>
            <div className="topbar-user">
              <span className="user-avatar">{session.name.slice(0, 2).toUpperCase()}</span>
              <span className="user-block">
                <span className="user-name">{session.name}</span>
                <span className="user-role">ADMIN</span>
              </span>
              <button className="btn-icon-ghost" onClick={logout} aria-label="Log out" title="Log out">
                <LogOut size={16} />
              </button>
            </div>
          </header>

          <main className="app-content">
            {openDoc ? (
              <WorkOrderDetailView
                workOrderId={openDoc.id}
                kind={openDoc.kind}
                onBack={() => setOpenDoc(null)}
              />
            ) : view === 'dashboard' ? (
              <DashboardView />
            ) : view === 'catalogs' ? (
              <CatalogsView resolveModule={resolveModule} perms={permsFor('catalogs')} />
            ) : view === 'roles' ? (
              <RolesView />
            ) : view === 'statusflow' ? (
              <StatusFlowView />
            ) : view === 'calendar' ? (
              <CalendarView onOpen={(doc) => setOpenDoc(doc)} />
            ) : view === 'settings' ? (
              <SettingsView uiConfig={uiConfig} navItems={navItems} />
            ) : (
              /* key: fuerza remontar la vista genérica al cambiar de módulo */
              <GenericModuleView
                key={view}
                module={resolveModule(view)}
                perms={permsFor(view)}
                onOpenRow={view === 'workorders'
                  ? (row) => setOpenDoc({ kind: 'workorder', id: row.id })
                  : view === 'quotes'
                    ? (row) => setOpenDoc({ kind: 'quote', id: row.id })
                    : undefined}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
