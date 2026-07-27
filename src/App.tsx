import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import DashboardView from './views/DashboardView';
import GenericModuleView from './views/GenericModuleView';
import WorkOrderDetailView from './views/WorkOrderDetailView';
import { getModule, NAV_GROUPS } from './config/modules';
import './App.css';

function viewTitle(viewId: string): string {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => i.id === viewId);
    if (item) return item.label;
  }
  return 'GlassWorks';
}

export default function App() {
  const [view, setView] = useState('dashboard');
  const [openWorkOrderId, setOpenWorkOrderId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = (viewId: string) => {
    setView(viewId);
    setOpenWorkOrderId(null);
    setSidebarOpen(false);
  };

  return (
    <div className="app-frame">
      <div className="app-shell">
        <Sidebar
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
              {viewTitle(view)}
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
            ) : (
              /* key: fuerza remontar la vista genérica al cambiar de módulo */
              <GenericModuleView
                key={view}
                module={getModule(view)}
                onOpenRow={view === 'workorders' ? (row) => setOpenWorkOrderId(row.id) : undefined}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
