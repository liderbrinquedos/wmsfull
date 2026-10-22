import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface AuthGuardProps {
  allowedRoles?: ('admin' | 'supervisor' | 'operador' | 'motorista')[];
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ allowedRoles }) => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.perfil)) {
    // Redireciona para rota padrão do perfil se não tiver acesso
    if (user.perfil === 'motorista') {
      return <Navigate to="/delivery" replace />;
    } else if (user.perfil === 'operador') {
      return <Navigate to="/conference" replace />;
    } else {
      return <Navigate to="/wms" replace />;
    }
  }

  return <Outlet />;
};
