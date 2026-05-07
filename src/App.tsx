import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { WorkOrderPage } from './pages/WorkOrderPage';
import { SettingsPage } from './pages/SettingsPage';
import { CustomersPage } from './pages/CustomersPage';
import { EquipoTrabajo } from './pages/EquipoTrabajo'; // Importamos el nuevo módulo

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/work-orders" replace />} />
          <Route path="/work-orders" element={<WorkOrderPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/equipo" element={<EquipoTrabajo />} /> {/* Nueva ruta agregada */}
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;