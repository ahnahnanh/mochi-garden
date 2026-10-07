import { NavLink, useNavigate } from 'react-router-dom';
import { Icon } from './icons.jsx';
import { Plant } from './art.jsx';

const TABS = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/garden', label: 'Garden', icon: 'plant' },
  { to: '/community', label: 'Community', icon: 'people' },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

export function Shell({ children, tabs = true, tint }) {
  return (
    <div className="stage">
      <div className="app" style={tint ? { background: tint } : undefined}>
        <main className="screen">{children}</main>
        {tabs && (
          <nav className="tabs" aria-label="Main">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'on' : undefined)}>
                <Icon name={t.icon} size={22} />{t.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

export function TopBar({ title, back = true, right }) {
  const nav = useNavigate();
  return (
    <div className="topbar">
      {back ? (
        <button className="iconbtn backbtn" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} aria-label="Back">
          <Icon name="back" />Back
        </button>
      ) : <span />}
      <h1 className="topbar-title">{title}</h1>
      <span className="topbar-right">{right}</span>
    </div>
  );
}

export function Bubble({ children, style, tail = 'left' }) {
  return <div className={`bubble tail-${tail}`} style={style}>{children}</div>;
}

export function SproutRow({ on, total, size = 18 }) {
  return (
    <div className="sprouts" aria-label={`${on} of ${total}`}>
      {Array.from({ length: total }, (_, i) => <Plant key={i} kind="sprout" width={size} height={size} className={i < on ? '' : 'off'} />)}
    </div>
  );
}

export function Segmented({ options, value, onChange, solid }) {
  return (
    <div className={`seg${solid ? ' solid' : ''}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : undefined} onClick={() => onChange(o.value)} type="button">{o.label}</button>
      ))}
    </div>
  );
}

export function Loading({ label = 'Watering the garden…' }) {
  return <div className="loading"><Plant kind="sprout" width={40} height={40} className="bob" />{label}</div>;
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="card error-note" role="alert">
      <p>{error.message}</p>
      {onRetry && <button className="btn small outline" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function MenuLink({ icon, children, onClick, to }) {
  const nav = useNavigate();
  return (
    <button type="button" className="menu-item" onClick={onClick || (() => nav(to))}>
      <Icon name={icon} /><span>{children}</span><Icon name="chev" />
    </button>
  );
}

export function Toggle({ id, checked, onChange, label, hint }) {
  return (
    <label className="toggle" htmlFor={id}>
      <span><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}
