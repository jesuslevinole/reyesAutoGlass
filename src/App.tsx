import { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import CatalogsView from './views/CatalogsView';
import DashboardView from './views/DashboardView';
import GenericModuleView from './views/GenericModuleView';
import SettingsView from './views/SettingsView';
import WorkOrderDetailView from './views/WorkOrderDetailView';
import { DEFAULT_NAV, getModule } from './config/modules';
import type { ModuleDef } from './config/modules';
import type { Row } from './services/firestore';
import { subscribe } from './services/firestore';
import { applyOverrides, orderNav } from './utils/uiConfig';
import './App.css';

export default function App() {
  const [view, setView] = useState('dashboard');
  const [openWorkOrderId, setOpenWorkOrderId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const viewTitle = navItems.find((i) => i.id === view)?.label ?? 'GlassWorks';

  return (
    <div className="app-frame">
      <div className="app-shell">
        <Sidebar
          items={navItems}
          current={view}
          open={sidebarOpen}
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
            <p className="topbar-crumb">
              {viewTitle}
              {openWorkOrderId && ' · Detalle'}
            </p>
            <div className="topbar-user">
              <span className="user-avatar">GW</span>
              <span className="user-name">Administración</span>
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
            ) : view === 'settings' ? (
              <SettingsView uiConfig={uiConfig} navItems={navItems} />
            ) : (
              /* key: fuerza remontar la vista genérica al cambiar de módulo */
              <GenericModuleView
                key={view}
                module={resolveModule(view)}
                onOpenRow={view === 'workorders' ? (row) => setOpenWorkOrderId(row.id) : undefined}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
