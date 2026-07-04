import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';

// Importación de Páginas
import { WorkOrderPage } from './pages/WorkOrderPage';
import { CustomersPage } from './pages/CustomersPage';
import { EquipoTrabajo } from './pages/EquipoTrabajo';
import { SettingsPage } from './pages/SettingsPage';
import { CatalogView } from './pages/CatalogView';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout><Outlet /></MainLayout>}>
          
          <Route index element={<Navigate to="/work-orders" replace />} />

          {/* LAS 3 VISTAS APUNTAN AL MISMO COMPONENTE (List, Calendar, Map) */}
          <Route path="work-orders" element={<WorkOrderPage />} />
          <Route path="calendar" element={<WorkOrderPage />} />
          <Route path="map" element={<WorkOrderPage />} /> {/* NUEVA RUTA PARA EL MAPA */}

          <Route path="catalog" element={<CatalogView catalog={{} as any} onBack={() => window.history.back()} />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="equipo" element={<EquipoTrabajo />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/work-orders" replace />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;