import { CircleDot, GlassWater, X } from 'lucide-react';
import { firebaseProjectId } from '../firebase';
import { MODULE_ICONS } from '../config/moduleIcons';
import type { NavItem } from '../config/modules';
import './Sidebar.css';

interface Props {
  appName: string;
  items: NavItem[];
  current: string;
  open: boolean;
  onNavigate: (viewId: string) => void;
  onClose: () => void;
}

export default function Sidebar({ appName, items, current, open, onNavigate, onClose }: Props) {
  return (
    <>
      <div className={`sidebar-scrim${open ? ' visible' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-glyph"><GlassWater size={20} /></span>
          <span className="brand-name">{appName}</span>
          <button className="sidebar-close" onClick={onClose} aria-label="Cerrar menú">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul>
            {items.map((item) => {
              const Icon = MODULE_ICONS[item.id] ?? CircleDot;
              return (
                <li key={item.id}>
                  <button
                    className={`nav-item${current === item.id ? ' active' : ''}`}
                    onClick={() => onNavigate(item.id)}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-foot">
          <p>Taller de vidrios · v1.0</p>
          <p className="sidebar-project">Firebase: {firebaseProjectId}</p>
        </div>
      </aside>
    </>
  );
}
