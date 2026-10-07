import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const AuthCtx = createContext(null);
const ToastCtx = createContext(() => {});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  useEffect(() => {
    api.get('/me').then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);
  const signOut = useCallback(async () => { await api.post('/auth/logout'); setUser(null); }, []);
  return <AuthCtx.Provider value={{ user, setUser, signOut }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  const show = useCallback((text) => {
    setMsg(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2800);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className={`toast${msg ? ' show' : ''}`} role="status" aria-live="polite">{msg}</div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/** Fetches `url`, refetches on demand and every `pollMs` while the tab is visible. */
export function useLoad(url, { pollMs } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(() => api.get(url).then((d) => { setData(d); setError(null); return d; }).catch((e) => setError(e)), [url]);
  useEffect(() => {
    reload();
    if (!pollMs) return;
    const id = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, pollMs);
    const onVis = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [reload, pollMs]);
  return { data, setData, error, reload };
}
