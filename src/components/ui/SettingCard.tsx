import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { SettingMenuOption } from '../../types/settings';

interface SettingCardProps {
  option: SettingMenuOption;
}

export const SettingCard: React.FC<SettingCardProps> = ({ option }) => {
  const navigate = useNavigate();
  const { title, description, icon: Icon, route } = option;

  return (
    <div 
      onClick={() => navigate(route)}
      className="card"
      style={{ 
        cursor: 'pointer', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1.5rem',
        transition: 'transform 0.2s, box-shadow 0.2s'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      <div style={{ 
        backgroundColor: '#F1F5F9', 
        padding: '1rem', 
        borderRadius: '12px',
        color: 'var(--color-primary)'
      }}>
        <Icon size={28} />
      </div>
      <div>
        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{title}</h4>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>{description}</p>
      </div>
    </div>
  );
};