import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const role = user?.perfil;

  const canAccessWms = ['admin', 'supervisor', 'operador'].includes(role || '');
  const canAccessConference = ['admin', 'supervisor', 'operador'].includes(role || '');
  const canAccessDelivery = ['admin', 'supervisor', 'motorista'].includes(role || '');
  const canAccessAdmin = ['admin', 'supervisor'].includes(role || '');

  const getProfileBadgeColor = (p?: string) => {
    switch (p) {
      case 'admin': return '#ef4444';
      case 'supervisor': return '#f59e0b';
      case 'operador': return '#38bdf8';
      case 'motorista': return '#10b981';
      default: return '#94a3b8';
    }
  };

  return (
    <>
      {/* Top Navbar */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '0 20px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.2rem',
              color: '#fff'
            }}>
              W
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#fff', letterSpacing: '-0.02em' }}>
                WMS<span style={{ color: 'var(--primary)' }}>Full</span>
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {canAccessWms && (
              <NavLink
                to="/wms"
                style={({ isActive }) => ({
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  textDecoration: 'none',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  background: isActive ? '#1e293b' : 'transparent',
                  border: isActive ? '1px solid var(--border-color)' : '1px solid transparent'
                })}
              >
                📦 WMS
              </NavLink>
            )}

            {canAccessConference && (
              <NavLink
                to="/conference"
                style={({ isActive }) => ({
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  textDecoration: 'none',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  background: isActive ? '#1e293b' : 'transparent',
                  border: isActive ? '1px solid var(--border-color)' : '1px solid transparent'
                })}
              >
                🔍 Conferência
              </NavLink>
            )}

            {canAccessDelivery && (
              <NavLink
                to="/delivery"
                style={({ isActive }) => ({
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  textDecoration: 'none',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  background: isActive ? '#1e293b' : 'transparent',
                  border: isActive ? '1px solid var(--border-color)' : '1px solid transparent'
                })}
              >
                🚚 Entregas
              </NavLink>
            )}

            {canAccessAdmin && (
              <NavLink
                to="/admin"
                style={({ isActive }) => ({
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  textDecoration: 'none',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  background: isActive ? '#1e293b' : 'transparent',
                  border: isActive ? '1px solid var(--border-color)' : '1px solid transparent'
                })}
              >
                ⚙️ Gestão
              </NavLink>
            )}
          </nav>
        </div>

        {/* User Badge & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{user?.nome}</span>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: getProfileBadgeColor(user?.perfil),
            }}>
              {user?.perfil}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            title="Sair"
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          >
            Sair
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-only" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60px',
        backgroundColor: '#0f172a',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 100,
        boxShadow: '0 -4px 12px rgba(0,0,0,0.4)'
      }}>
        {canAccessWms && (
          <NavLink
            to="/wms"
            style={({ isActive }) => ({
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              fontSize: '0.75rem',
              fontWeight: 600
            })}
          >
            <span style={{ fontSize: '1.25rem' }}>📦</span>
            WMS
          </NavLink>
        )}

        {canAccessConference && (
          <NavLink
            to="/conference"
            style={({ isActive }) => ({
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              fontSize: '0.75rem',
              fontWeight: 600
            })}
          >
            <span style={{ fontSize: '1.25rem' }}>🔍</span>
            Conferência
          </NavLink>
        )}

        {canAccessDelivery && (
          <NavLink
            to="/delivery"
            style={({ isActive }) => ({
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              fontSize: '0.75rem',
              fontWeight: 600
            })}
          >
            <span style={{ fontSize: '1.25rem' }}>🚚</span>
            Entrega
          </NavLink>
        )}

        {canAccessAdmin && (
          <NavLink
            to="/admin"
            style={({ isActive }) => ({
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              fontSize: '0.75rem',
              fontWeight: 600
            })}
          >
            <span style={{ fontSize: '1.25rem' }}>⚙️</span>
            Gestão
          </NavLink>
        )}
      </nav>
    </>
  );
};
