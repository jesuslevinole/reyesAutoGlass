import { useState } from 'react';
import type { FormEvent } from 'react';
import { GlassWater, KeyRound, LogIn, Mail, ShieldAlert } from 'lucide-react';
import { BYPASS_ENABLED } from '../config/auth';
import type { Session } from '../config/auth';
import './LoginView.css';

interface Props {
  onEnter: (session: Session) => void;
}

export default function LoginView({ onEnter }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Firebase Auth aún no está conectado — el acceso real se habilitará después.
    setNotice('La autenticación con Firebase aún no está conectada. Usa el acceso temporal.');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <aside className="login-hero">
          <span className="login-glyph"><GlassWater size={26} /></span>
          <h1>Reyes Auto Glass</h1>
          <p>Gestión de work orders, catálogos y finanzas del taller.</p>
          <ul className="login-points">
            <li>Datos en tiempo real con Firebase</li>
            <li>Caminos Personal e Insurance</li>
            <li>Exportación Excel e importación CSV</li>
          </ul>
        </aside>

        <section className="login-form-side">
          <h2>Iniciar sesión</h2>
          <p className="login-sub">Ingresa con tu cuenta para continuar</p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <div className="login-input-wrap">
                <Mail size={15} />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  placeholder="tu@correo.com"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="login-password">Contraseña</label>
              <div className="login-input-wrap">
                <KeyRound size={15} />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {notice && <p className="login-notice">{notice}</p>}

            <button type="submit" className="btn-primary btn-gradient login-submit">
              <LogIn size={16} />
              Entrar
            </button>
          </form>

          {BYPASS_ENABLED && (
            <button
              className="login-bypass"
              onClick={() => onEnter({ name: 'Administración' })}
            >
              <ShieldAlert size={15} />
              Entrar sin login (acceso temporal)
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
