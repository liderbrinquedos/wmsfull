import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export const Layout: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{
        flex: 1,
        padding: '24px 20px 80px 20px',
        maxWidth: '1280px',
        width: '100%',
        margin: '0 auto'
      }}>
        <Outlet />
      </main>
    </div>
  );
};
