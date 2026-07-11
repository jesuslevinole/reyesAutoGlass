import React from 'react';
import { MemoryRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
// ⭐ MemoryRouter: la navegación vive EN MEMORIA, la URL del navegador nunca cambia
//    (siempre se queda en la raíz). Esto hace que la app se comporte como aplicación
//    y no como sitio web: los clics del menú jamás provocan cargas de página, y al
//    desplegar en Cloudflare no hay problemas de rutas directas (/work-orders → 404).
import { Loader2 } from 'lucide-react';
import { MainLayout } from './components/layout/MainLayout';
import { AuthProvider, useAuth } from './context/AuthContext';

// Importación de Páginas
import { WorkOrderPage } from './pages/WorkOrderPage';
import { CustomersPage } from './pages/CustomersPage';
import { EquipoTrabajo } from './pages/EquipoTrabajo';
import { SettingsPage } from './pages/SettingsPage';
import { CatalogView } from './pages/CatalogView';
import { DataImportPage } from './pages/DataImportPage';
import { CommissionsPage } from './pages/CommissionsPage';
import { LoginPage } from './pages/LoginPage';

// Pantalla de carga mientras se resuelve el estado de sesión.
const FullScreenLoader: React.FC = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' }}>
    <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    <Loader2 size={40} color="#2563EB" style={{ animation: 'spin 1s linear infinite' }} />
  </div>
);

// Envuelve las rutas privadas: si no hay sesión, redirige a /login.
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, bypass, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user && !bypass) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* RUTA PÚBLICA */}
          <Route path="/login" element={<LoginPage />} />

          {/* RUTAS PROTEGIDAS */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <MainLayout><Outlet /></MainLayout>
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/work-orders" replace />} />

            {/* LAS 3 VISTAS APUNTAN AL MISMO COMPONENTE (List, Calendar, Map) */}
            <Route path="work-orders" element={<WorkOrderPage />} />
            <Route path="calendar" element={<WorkOrderPage />} />
            <Route path="map" element={<WorkOrderPage />} /> {/* NUEVA RUTA PARA EL MAPA */}

            <Route path="catalog" element={<CatalogView catalog={{} as any} onBack={() => window.history.back()} />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="equipo" element={<EquipoTrabajo />} />
            <Route path="data-import" element={<DataImportPage />} /> {/* IMPORTACIÓN DE DATOS */}
            <Route path="commissions" element={<CommissionsPage />} /> {/* COMISIONES DE AGENTES */}
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/work-orders" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;