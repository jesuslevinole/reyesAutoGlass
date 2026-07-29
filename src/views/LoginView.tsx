import { useState } from 'react';
import type { FormEvent } from 'react';
import { GlassWater, KeyRound, ShieldAlert, UserRound } from 'lucide-react';
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
    setNotice('Firebase authentication is not connected yet. Use the temporary access.');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-body">
          {/* ============ Panel de arte geométrico ============ */}
          <aside className="login-art" aria-hidden="true">
            <span className="art-layer art-l1" />
            <span className="art-layer art-l2" />
            <span className="art-layer art-l3" />
            <span className="login-tab">LOGIN</span>
          </aside>

          {/* ============ Formulario ============ */}
          <section className="login-main">
            <span className="login-diamond">
              <GlassWater size={30} />
            </span>
            <h1 className="login-word">LOGIN</h1>

            <form onSubmit={handleSubmit}>
              <div className="u-field">
                <UserRound size={17} />
                <input
                  type="email"
                  value={email}
                  placeholder="Email"
                  aria-label="Email"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="u-field">
                <KeyRound size={17} />
                <input
                  type="password"
                  value={password}
                  placeholder="Password"
                  aria-label="Password"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {notice && <p className="login-notice">{notice}</p>}

              <div className="login-actions">
                <button
                  type="button"
                  className="login-forgot"
                  onClick={() => setNotice('Password recovery will be available once authentication is connected.')}
                >
                  Forgot your password?
                </button>
                <button type="submit" className="login-pill">LOGIN</button>
              </div>
            </form>
          </section>
        </div>

        {/* ============ Franja inferior ============ */}
        {BYPASS_ENABLED && (
          <footer className="login-strip">
            <span>No account connected yet?</span>
            <button className="login-bypass" onClick={() => onEnter({ name: 'Administration' })}>
              <ShieldAlert size={15} />
              Enter without login (temporary access)
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
