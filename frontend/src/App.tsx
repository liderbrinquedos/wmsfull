import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { LoginPage } from './auth/LoginPage';
import { AuthGuard } from './auth/AuthGuard';
import { Layout } from './components/Layout';
import { WMSPage } from './modules/wms/WMSPage';
import { ConferencePage } from './modules/conference/ConferencePage';
import { DeliveryPage } from './modules/delivery/DeliveryPage';
import { AdminDashboard } from './modules/admin/AdminDashboard';

export const App: React.FC = () => {
  const { init, user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    init();
  }, []);

  const getHomeRedirect = () => {
    if (!isAuthenticated || !user) return '/login';
    if (user.perfil === 'motorista') return '/delivery';
    if (user.perfil === 'operador') return '/conference';
    return '/wms';
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Rotas Protegidas */}
        <Route element={<Layout />}>
          {/* Home redirect */}
          <Route path="/" element={<Navigate to={getHomeRedirect()} replace />} />

          {/* WMS: Admin, Supervisor, Operador */}
          <Route element={<AuthGuard allowedRoles={['admin', 'supervisor', 'operador']} />}>
            <Route path="/wms" element={<WMSPage />} />
          </Route>

          {/* Conferência: Admin, Supervisor, Operador */}
          <Route element={<AuthGuard allowedRoles={['admin', 'supervisor', 'operador']} />}>
            <Route path="/conference" element={<ConferencePage />} />
          </Route>

          {/* Entrega: Admin, Supervisor, Motorista */}
          <Route element={<AuthGuard allowedRoles={['admin', 'supervisor', 'motorista']} />}>
            <Route path="/delivery" element={<DeliveryPage />} />
          </Route>

          {/* Gestão Admin & Supervisão */}
          <Route element={<AuthGuard allowedRoles={['admin', 'supervisor']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
