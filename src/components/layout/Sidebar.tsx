import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, Users, LogOut, Settings, ChevronLeft, ChevronRight, Briefcase, CalendarDays } from 'lucide-react';

interface SidebarProps { 
  isCollapsed: boolean; 
  onToggle: () => void; 
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <aside style={{
      width: isCollapsed ? '80px' : '260px',
      backgroundColor: 'var(--bg-surface)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      transition: 'width 0.3s ease', zIndex: 5
    }}>
      <div>
        <nav style={{ padding: '2rem 0.8rem 0 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {/* ORDENES DE TRABAJO */}
          <MenuItem 
            icon={<FileText size={20} />} 
            label="Work Orders" 
            isCollapsed={isCollapsed} 
            active={location.pathname.includes('/work-orders')} 
            onClick={() => handleNavigation('/work-orders')} 
          />

          {/* CALENDARIO */}
          <MenuItem 
            icon={<CalendarDays size={20} />} 
            label="Calendario" 
            isCollapsed={isCollapsed} 
            active={location.pathname.includes('/calendar')} 
            onClick={() => handleNavigation('/calendar')} 
          />

          {/* CLIENTES */}
          <MenuItem 
            icon={<Users size={20} />} 
            label="Customers" 
            isCollapsed={isCollapsed} 
            active={location.pathname.includes('/customers')} 
            onClick={() => handleNavigation('/customers')} 
          />

          {/* EQUIPO */}
          <MenuItem 
            icon={<Briefcase size={20} />} 
            label="Equipo" 
            isCollapsed={isCollapsed} 
            active={location.pathname.includes('/equipo')} 
            onClick={() => handleNavigation('/equipo')} 
          />
        </nav>
      </div>
      
      <div style={{ padding: '1.5rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <MenuItem 
          icon={<Settings size={20} />} 
          label="Settings" 
          isCollapsed={isCollapsed} 
          active={location.pathname.includes('/settings')}
          onClick={() => handleNavigation('/settings')} 
        />
        <MenuItem 
          icon={<LogOut size={20} />} 
          label="Logout" 
          isCollapsed={isCollapsed} 
        />
        
        <div 
          onClick={onToggle}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem', borderRadius: '6px', 
            cursor: 'pointer', color: 'var(--color-text-muted)', justifyContent: isCollapsed ? 'center' : 'flex-start',
            marginTop: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem', transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          {!isCollapsed && <span style={{ fontWeight: 500 }}>Colapsar Menú</span>}
        </div>
      </div>
    </aside>
  );
};

const MenuItem = ({ icon, label, isCollapsed, active = false, onClick }: { icon: React.ReactNode, label: string, isCollapsed: boolean, active?: boolean, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem', borderRadius: '6px', cursor: 'pointer',
      backgroundColor: active ? '#F1F5F9' : 'transparent',
      color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
      borderRight: active && !isCollapsed ? '3px solid var(--color-accent)' : 'none',
      fontWeight: active ? '600' : '500', justifyContent: isCollapsed ? 'center' : 'flex-start',
      transition: 'background 0.2s'
    }}
    onMouseOver={(e) => !active && (e.currentTarget.style.backgroundColor = '#F8FAFC')}
    onMouseOut={(e) => !active && (e.currentTarget.style.backgroundColor = 'transparent')}
    title={isCollapsed ? label : undefined}
  >
    {icon} {!isCollapsed && <span>{label}</span>}
  </div>
);