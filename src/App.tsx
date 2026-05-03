import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { WorkOrderPage } from './pages/WorkOrderPage';
import { SettingsPage } from './pages/SettingsPage';
import { CustomersPage } from './pages/CustomersPage';

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/work-orders" replace />} />
          <Route path="/work-orders" element={<WorkOrderPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;