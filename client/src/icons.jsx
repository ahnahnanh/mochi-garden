const P = {
  home: <path d="M3.5 11 12 4l8.5 7v8.5a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" strokeLinejoin="round" />,
  plant: <path d="M12 21v-9M12 12c0-4 3-7 7.5-7 0 4-3 7-7.5 7zM12 14.5C12 11 9.5 8.5 5 8.5c0 3.5 2.5 6 7 6z" strokeLinejoin="round" strokeLinecap="round" />,
  people: <g strokeLinecap="round"><circle cx="9" cy="8.5" r="3.2" /><circle cx="17" cy="9.5" r="2.5" /><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15.5 14.6c3 0 5.5 1.7 5.5 4.6" /></g>,
  user: <g strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 20.5c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></g>,
  gear: <g strokeLinecap="round"><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="7" /><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></g>,
  clock: <g strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></g>,
  cal: <g strokeLinecap="round"><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></g>,
  pill: <g><rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-40 12 12)" /><path d="m9.4 8.6 5.2 6.8" /></g>,
  cup: <path d="M6 4h12l-1.5 16h-9zM6.6 10h10.8" strokeLinejoin="round" />,
  meal: <g strokeLinecap="round"><path d="M4 18h16M5.5 18a6.5 6.5 0 0 1 13 0M12 9.5V8" /></g>,
  bell: <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 21h4" strokeLinejoin="round" strokeLinecap="round" />,
  lock: <g><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></g>,
  palette: <g><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.5 0 2-1 1.4-2.2-.7-1.4.2-2.8 1.8-2.8h1.6a3.7 3.7 0 0 0 3.7-3.7C20.5 7 16.7 3.5 12 3.5z" /><circle cx="8" cy="11" r="1" /><circle cx="11" cy="7.5" r="1" /><circle cx="15.5" cy="8.5" r="1" /></g>,
  help: <g strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.6M12 17h.01" /></g>,
  chev: <path d="m9.5 6 6 6-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  back: <path d="m14.5 6-6 6 6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  check: <path d="m5.5 12.5 4 4 9-9" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
  plus: <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />,
  search: <g strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></g>,
  x: <path d="M6 6l12 12M18 6 6 18" strokeWidth="2" strokeLinecap="round" />,
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" fill="#f6c94a" stroke="#c99a2e" />,
  sun: <g strokeLinecap="round" stroke="#f2b632"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /><circle cx="12" cy="12" r="4.5" fill="#f6c94a" /></g>,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" strokeLinecap="round" strokeLinejoin="round" />,
  logout: <path d="M10 5H5v14h5M15 8l4 4-4 4M19 12H9" strokeLinecap="round" strokeLinejoin="round" />,
};

export function Icon({ name, size = 18, className, title }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {P[name]}
    </svg>
  );
}
