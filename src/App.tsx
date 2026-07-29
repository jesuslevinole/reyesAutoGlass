import { useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import Sidebar from './components/Sidebar';
import CatalogsView from './views/CatalogsView';
import LoginView from './views/LoginView';
import RolesView from './views/RolesView';
import DashboardView from './views/DashboardView';
import GenericModuleView from './views/GenericModuleView';
import SettingsView from './views/SettingsView';
import WorkOrderDetailView from './views/WorkOrderDetailView';
import { DEFAULT_NAV, getModule } from './config/modules';
import type { ModuleDef } from './config/modules';
import type { Row } from './services/firestore';
import { subscribe } from './services/firestore';
import { applyOverrides, orderNav } from './utils/uiConfig';
import { clearSession, loadSession, saveSession } from './config/auth';
import type { Session } from './config/auth';
import './App.css';

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [view, setView] = useState('dashboard');
  const [openWorkOrderId, setOpenWorkOrderId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Búsqueda global del topbar: al enviar salta a Work Orders con el término aplicado
  const [quickSearch, setQuickSearch] = useState('');
  const [searchNonce, setSearchNonce] = useState(0);

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

  // Sincronizar el título de la pestaña del navegador (sistema externo → effect válido)
  useEffect(() => { document.title = appName; }, [appName]);

  const navItems = useMemo(() => {
    const withTitles = DEFAULT_NAV.map((item) => {
      const doc = uiConfig[item.id] as Record<string, unknown> | undefined;
      return (typeof doc?.title === 'string' && doc.title)
        ? { ...item, label: doc.title }
        : item;
    });
    return orderNav(withTitles, uiConfig['_menu']);
  }, [uiConfig]);

  const navigate = (viewId: string) => {
    setView(viewId);
    setOpenWorkOrderId(null);
    setSidebarOpen(false);
  };

  if (!session) return <LoginView onEnter={enter} />;

  return (
    <div className="app-frame">
      <div className="app-shell">
        <Sidebar
          appName={appName}
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
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            <button
              className="collapse-btn"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
              title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <form
              className="topbar-search"
              onSubmit={(e) => {
                e.preventDefault();
                setView('workorders');
                setOpenWorkOrderId(null);
                setSearchNonce((n) => n + 1);
              }}
            >
              <Search size={15} />
              <input
                value={quickSearch}
                placeholder="Buscar en work orders…"
                onChange={(e) => setQuickSearch(e.target.value)}
                aria-label="Búsqueda global"
              />
            </form>
            <label className="topbar-view">
              <span className="sr-only">Cambiar de vista</span>
              <select value={view} onChange={(e) => navigate(e.target.value)}>
                {navItems.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
              </select>
            </label>
            <div className="topbar-user">
              <span className="user-avatar">{session.name.slice(0, 2).toUpperCase()}</span>
              <span className="user-block">
                <span className="user-name">{session.name}</span>
                <span className="user-role">ADMIN</span>
              </span>
              <button className="btn-icon-ghost" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
                <LogOut size={16} />
              </button>
            </div>
          </header>

          <main className="app-content">
            {openWorkOrderId ? (
              <WorkOrderDetailView
                workOrderId={openWorkOrderId}
                onBack={() => setOpenWorkOrderId(null)}
              />
            ) : view === 'dashboard' ? (
              <DashboardView />
            ) : view === 'catalogs' ? (
              <CatalogsView resolveModule={resolveModule} />
            ) : view === 'roles' ? (
              <RolesView />
            ) : view === 'settings' ? (
              <SettingsView uiConfig={uiConfig} navItems={navItems} />
            ) : (
              /* key: fuerza remontar la vista genérica al cambiar de módulo */
              <GenericModuleView
                key={`${view}-${searchNonce}`}
                module={resolveModule(view)}
                initialSearch={view === 'workorders' && searchNonce > 0 ? quickSearch : ''}
                onOpenRow={view === 'workorders' ? (row) => setOpenWorkOrderId(row.id) : undefined}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
