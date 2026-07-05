import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, CheckCircle2, Wind, ShieldAlert } from 'lucide-react';
import { useAuth, authErrorMessage, BYPASS_ENABLED } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { user, loading: authLoading, login, resetPassword, enterBypass } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // A dónde regresar después de entrar (o Work Orders por defecto).
  const from = (location.state as { from?: string } | null)?.from || '/work-orders';

  // Si ya hay sesión, no mostrar el login.
  if (!authLoading && user) return <Navigate to={from} replace />;

  const handleSubmit = async () => {
    if (submitting) return;
    setError('');
    setInfo('');
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Escribe tu correo arriba para enviarte el enlace de recuperación.');
      return;
    }
    try {
      await resetPassword(email);
      setInfo('Te enviamos un correo para restablecer tu contraseña.');
    } catch (err) {
      setError(authErrorMessage(err));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const handleBypass = () => {
    enterBypass();
    navigate(from, { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', width: '100%', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', boxSizing: 'border-box' }}>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>

      <div style={{ width: '100%', maxWidth: '440px', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 10px 30px -10px rgba(15,23,42,0.15)', border: '1px solid #E2E8F0', padding: '2.5rem 2.25rem' }}>

        {/* LOGO / MARCA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '14px', backgroundColor: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', boxShadow: '0 6px 14px -4px rgba(15,23,42,0.4)' }}>
            <Wind size={30} color="#3B82F6" />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px' }}>ReyesAutoGlass</h1>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.9rem', color: '#64748B' }}>Autoriza tu sesión para continuar</p>
        </div>

        {/* MENSAJES */}
        {error && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '0.75rem 0.9rem', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
            <AlertCircle size={17} /> {error}
          </div>
        )}
        {info && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', padding: '0.75rem 0.9rem', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
            <CheckCircle2 size={17} /> {info}
          </div>
        )}

        {/* CORREO */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>Correo Electrónico</label>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #CBD5E1', borderRadius: '10px', padding: '0.1rem 0.9rem', backgroundColor: '#F8FAFC' }}>
            <Mail size={18} color="#94A3B8" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="tu.correo@empresa.com"
              autoComplete="email"
              style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', padding: '0.75rem 0.6rem', fontSize: '0.9rem', color: '#0F172A' }}
            />
          </div>
        </div>

        {/* CONTRASEÑA */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Contraseña</label>
            <button type="button" onClick={handleForgot} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>¿Olvidaste?</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #CBD5E1', borderRadius: '10px', padding: '0.1rem 0.9rem', backgroundColor: '#F8FAFC' }}>
            <Lock size={18} color="#94A3B8" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', padding: '0.75rem 0.6rem', fontSize: '0.9rem', color: '#0F172A' }}
            />
            <button type="button" onClick={() => setShowPassword((s) => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: '0.2rem' }} title={showPassword ? 'Ocultar' : 'Mostrar'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* BOTÓN INICIAR SESIÓN */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            padding: '0.9rem', borderRadius: '10px', border: 'none',
            backgroundColor: submitting ? '#60A5FA' : '#2563EB', color: 'white', fontWeight: 700, fontSize: '0.95rem',
            cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 6px 14px -4px rgba(37,99,235,0.5)', transition: 'background 0.2s',
          }}
          onMouseOver={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = '#1D4ED8'; }}
          onMouseOut={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = '#2563EB'; }}
        >
          {submitting ? (
            <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Ingresando...</>
          ) : (
            <>Iniciar Sesión <ArrowRight size={18} /></>
          )}
        </button>

        {/* ⚠️ BOTÓN DE ACCESO TEMPORAL (BYPASS) — se oculta con BYPASS_ENABLED = false */}
        {BYPASS_ENABLED && (
          <button
            type="button"
            onClick={handleBypass}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              marginTop: '1rem', padding: '0.85rem', borderRadius: '10px',
              border: '1px solid #FED7AA', backgroundColor: '#FFF7ED', color: '#C2410C',
              fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'background 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#FFEDD5')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#FFF7ED')}
          >
            <ShieldAlert size={17} /> Entrar como Super Admin (Bypass)
          </button>
        )}
      </div>
    </div>
  );
};