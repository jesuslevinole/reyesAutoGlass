import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Bell, Settings, UserCircle } from 'lucide-react';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      
      {/* HEADER SUPERIOR (Top Navbar) */}
      <header style={{ 
        height: '60px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', zIndex: 10 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--color-primary)' }}>ReyesAutoGlass</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', color: 'var(--color-text-muted)' }}>
          <Bell size={20} style={{ cursor: 'pointer' }} />
          <Settings size={20} style={{ cursor: 'pointer' }} />
          <UserCircle size={28} color="var(--color-primary)" style={{ cursor: 'pointer' }} />
        </div>
      </header>

      {/* CUERPO PRINCIPAL (Sidebar + Contenido) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
        
        <main style={{ flex: 1, display: 'flex', backgroundColor: 'var(--bg-body)', overflow: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  );
};