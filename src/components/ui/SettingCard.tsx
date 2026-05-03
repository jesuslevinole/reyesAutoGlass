import React from 'react';
import { Link } from 'react-router-dom';
import styles from './SettingCard.module.css';
// Agregamos la palabra clave 'type' después de import
import { type SettingMenuOption } from '../../types/settings';

// Omitimos el id ya que no lo necesitamos para renderizar la UI visual de la tarjeta
type SettingCardProps = Omit<SettingMenuOption, 'id'>;

export const SettingCard: React.FC<SettingCardProps> = ({ 
  title, 
  description, 
  route, 
  icon: Icon 
}) => {
  return (
    <Link to={route} className={styles.cardLink}>
      <div className={styles.iconContainer}>
        {/* CORRECCIÓN: strokeWidth con W mayúscula */}
        <Icon size={24} strokeWidth={1.75} />
      </div>
      <div className={styles.textContainer}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>
      </div>
    </Link>
  );
};