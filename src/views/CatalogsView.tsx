import { useState } from 'react';
import { CircleDot } from 'lucide-react';
import { MODULE_ICONS } from '../config/moduleIcons';
import { CATALOG_IDS } from '../config/modules';
import type { ModuleDef } from '../config/modules';
import GenericModuleView from './GenericModuleView';
import './CatalogsView.css';

interface Props {
  /** Resuelve un módulo con sus overrides de configuración ya aplicados */
  resolveModule: (id: string) => ModuleDef;
}

export default function CatalogsView({ resolveModule }: Props) {
  const [activeId, setActiveId] = useState<string>(CATALOG_IDS[0]);

  return (
    <div className="catalogs-view">
      <nav className="catalog-picker" aria-label="Catálogos">
        <ul>
          {CATALOG_IDS.map((id) => {
            const mod = resolveModule(id);
            const Icon = MODULE_ICONS[id] ?? CircleDot;
            return (
              <li key={id}>
                <button
                  className={`catalog-chip${activeId === id ? ' active' : ''}`}
                  onClick={() => setActiveId(id)}
                >
                  <Icon size={14} />
                  {mod.title}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* key: remonta la vista al cambiar de catálogo */}
      <GenericModuleView key={activeId} module={resolveModule(activeId)} />
    </div>
  );
}
