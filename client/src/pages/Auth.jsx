import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../state.jsx';
import { RoomScene } from '../art.jsx';
import { Bubble, Shell } from '../components.jsx';

export default function Auth({ mode }) {
  const isRegister = mode === 'register';
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const r = isRegister
        ? await api.post('/auth/register', { ...form, timezone })
        : await api.post('/auth/login', { email: form.email, password: form.password });
      setUser(r.user);
      nav(isRegister ? '/medications/new?welcome=1' : '/', { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Shell tabs={false}>
      <div className="auth">
        <div>
          <h1 className="title big">Mochi Garden</h1>
          <p className="sub">Gentle medication check-ins. Every dose helps Mochi's garden grow.</p>
        </div>
        <div className="scene">
          <RoomScene mood="happy" />
          <Bubble style={{ left: '30%', top: '10%' }}>{isRegister ? 'Nice to meet you! Let’s plant your first seed.' : 'Welcome back! I missed you.'}</Bubble>
        </div>
        <form className="card form" onSubmit={submit} noValidate>
          {isRegister && (
            <label htmlFor="name">Your name
              <input id="name" autoComplete="given-name" value={form.name} onChange={set('name')} required maxLength={40} />
            </label>
          )}
          <label htmlFor="email">Email
            <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
          </label>
          <label htmlFor="password">Password
            <input id="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} required minLength={isRegister ? 8 : undefined} />
            {isRegister && <small>At least 8 characters.</small>}
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn primary" disabled={busy}>{busy ? 'Just a moment…' : isRegister ? 'Create account' : 'Sign in'}</button>
        </form>
        <p className="sub center">
          {isRegister ? <>Already have an account? <Link to="/login">Sign in</Link></> : <>New here? <Link to="/register">Create an account</Link></>}
        </p>
      </div>
    </Shell>
  );
}
