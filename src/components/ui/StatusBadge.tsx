import React from 'react';
// Importamos el tipo maestro para mantener la sincronización
import type { WorkOrderData } from '../../types/workOrder';

interface Props {
  // Le decimos a TypeScript: "Acepta exactamente los mismos estados definidos en WorkOrderData"
  status: WorkOrderData['status'];
}

// Usamos Record<string, ...> para manejar cualquier estado, incluyendo el vacío ('')
const statusConfig: Record<string, { bg: string, color: string, text: string }> = {
  'New': { bg: '#e0f2fe', color: '#0369a1', text: 'Nueva' },
  'In Progress': { bg: '#fef3c7', color: '#a16207', text: 'En Proceso' },
  'Job Done': { bg: '#dcfce7', color: '#15803d', text: 'Terminada' },
  'Cancelled': { bg: '#fef2f2', color: '#dc2626', text: 'Cancelada' },
  '': { bg: '#F1F5F9', color: '#64748B', text: 'Sin Estado' } // Estado fallback elegante
};

export const StatusBadge: React.FC<Props> = ({ status }) => {
  // Si el status existe en el config lo usa, de lo contrario cae en el fallback ('')
  const config = statusConfig[status] || statusConfig[''];
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.4rem 0.8rem',
      borderRadius: '20px',
      fontSize: '0.75rem',
      fontWeight: '600',
      letterSpacing: '0.02em',
      backgroundColor: config.bg,
      color: config.color,
      whiteSpace: 'nowrap'
    }}>
      <span style={{ 
        width: '6px', 
        height: '6px', 
        borderRadius: '50%', 
        backgroundColor: config.color, 
        marginRight: '6px' 
      }}></span>
      {config.text}
    </span>
  );
};