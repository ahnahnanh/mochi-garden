import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, useToast } from '../state.jsx';
import { Mochi } from '../art.jsx';
import { Icon } from '../icons.jsx';
import { Shell, Toggle, TopBar } from '../components.jsx';

const COLORS = ['#e2a462', '#c0874c', '#f2cf55', '#f6f1ea', '#c9b8e8', '#9cc47a', '#8fb3d9', '#f2b8a0', '#3d3a3c'];
const ZONES = (() => { try { return Intl.supportedValuesOf('timeZone'); } catch { return ['UTC']; } })();

export default function Settings() {
  const { user, setUser, signOut } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { hash } = useLocation();
  const [name, setName] = useState(user.name);
  const [tagline, setTagline] = useState(user.tagline);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }); }, [hash]);

  async function save(patch, msg = 'Saved.') {
    try { const r = await api.patch('/me', patch); setUser(r.user); toast(msg); } catch (e) { toast(e.message); }
  }

  async function exportData() {
    try {
      const data = await api.get('/me/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'mochi-garden-export.json' });
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast(e.message); }
  }

  async function deleteAccount(e) {
    e.preventDefault();
    try { await api.del('/me', { password }); await signOut().catch(() => {}); nav('/register', { replace: true }); }
    catch (err) { setDeleteError(err.message); }
  }

  return (
    <Shell>
      <TopBar title="Settings" />

      <section className="card stack" id="appearance">
        <h2 className="h2">You &amp; Mochi</h2>
        <form className="form" onSubmit={(e) => { e.preventDefault(); save({ name, tagline }); }}>
          <label htmlFor="s-name">Name<input id="s-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
          <label htmlFor="s-tag">Tagline<input id="s-tag" value={tagline} maxLength={80} onChange={(e) => setTagline(e.target.value)} /></label>
          <button className="btn small outline" disabled={name === user.name && tagline === user.tagline}>Save</button>
        </form>
        <span className="small">Mochi’s colour</span>
        <div className="swatches" role="radiogroup" aria-label="Mochi’s colour">
          {COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={user.avatarColor === c} aria-label={c} className={user.avatarColor === c ? 'on' : undefined} onClick={() => save({ avatarColor: c }, 'Mochi has a new look!')}>
              <Mochi color={c} width={34} height={30} />
            </button>
          ))}
        </div>
      </section>

      <section className="card stack" id="reminders">
        <h2 className="h2">Reminders</h2>
        <Toggle id="nudges" checked={user.nudgesEnabled} onChange={(v) => save({ nudgesEnabled: v })} label="In-app nudges" hint="When you open the app with an overdue dose, Mochi will ask you to check in." />
        <label htmlFor="tz" className="form">Time zone
          <select id="tz" value={user.timezone} onChange={(e) => save({ timezone: e.target.value }, 'Time zone updated.')}>
            {ZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
          </select>
          <small>Dose times and streaks follow this time zone.</small>
        </label>
      </section>

      <section className="card stack" id="privacy">
        <h2 className="h2">Privacy &amp; data</h2>
        <Toggle id="share" checked={user.shareActivity} onChange={(v) => save({ shareActivity: v }, v ? 'Your check-ins will appear in the community feed.' : 'Your check-ins are now private.')} label="Share check-ins with the community" hint="Others see only that you checked in and your streak. Medication names are never shared." />
        <button className="btn ghost row-btn" onClick={exportData}><Icon name="download" />Download my data</button>
        {!confirmDelete ? (
          <button className="btn text danger" onClick={() => setConfirmDelete(true)}><Icon name="trash" />Delete my account</button>
        ) : (
          <form className="form danger-box" onSubmit={deleteAccount}>
            <p className="small">This permanently deletes your account, medications and history. Enter your password to confirm.</p>
            <label htmlFor="del-pw" className="sr-only">Password</label>
            <input id="del-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
            {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
            <div className="pair">
              <button type="button" className="btn ghost" onClick={() => { setConfirmDelete(false); setPassword(''); setDeleteError(''); }}>Keep my account</button>
              <button className="btn danger-fill" disabled={!password}>Delete forever</button>
            </div>
          </form>
        )}
      </section>
    </Shell>
  );
}
