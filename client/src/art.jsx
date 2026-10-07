// Hand-drawn SVG art for Mochi Garden. <Sprites/> is rendered once; everything else <use>s it.

const OUT = '#5a3a22';

export function Sprites() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <symbol id="mochi" viewBox="0 0 100 90">
          <ellipse cx="27" cy="26" rx="10" ry="15" transform="rotate(-18 27 26)" fill="var(--m-body,#e2a462)" stroke={OUT} strokeWidth="2.5" />
          <ellipse cx="73" cy="26" rx="10" ry="15" transform="rotate(18 73 26)" fill="var(--m-body,#e2a462)" stroke={OUT} strokeWidth="2.5" />
          <ellipse cx="27" cy="27" rx="4.5" ry="8" transform="rotate(-18 27 27)" fill="#f0b9a0" />
          <ellipse cx="73" cy="27" rx="4.5" ry="8" transform="rotate(18 73 27)" fill="#f0b9a0" />
          <path d="M10 66C10 34 28 26 50 26s40 8 40 40c0 16-16 22-40 22S10 82 10 66Z" fill="var(--m-body,#e2a462)" stroke={OUT} strokeWidth="2.5" />
          <ellipse cx="50" cy="72" rx="22" ry="13" fill="#fff" opacity=".28" />
          <path d="M34 54q5-5 10 0M56 54q5-5 10 0" fill="none" stroke="#3a2516" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M46 61q4 4 8 0" fill="none" stroke="#3a2516" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="29" cy="62" rx="6" ry="3.5" fill="#ef8e86" opacity=".7" />
          <ellipse cx="71" cy="62" rx="6" ry="3.5" fill="#ef8e86" opacity=".7" />
        </symbol>
        <symbol id="mochi-sleepy" viewBox="0 0 100 90">
          <use href="#mochi" />
          <rect x="30" y="48" width="40" height="10" fill="var(--m-body,#e2a462)" />
          <path d="M34 53h10M56 53h10" stroke="#3a2516" strokeWidth="2.6" strokeLinecap="round" />
        </symbol>
        <symbol id="sprout" viewBox="0 0 40 40">
          <path d="M20 38V19" stroke="#4f8a3f" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M20 23C10 23 5 15 5 10c9 0 15 5 15 13z" fill="#7bb25b" stroke="#4f8a3f" strokeWidth="1.5" />
          <path d="M20 21c0-8 6-13 15-13 0 5-5 13-15 13z" fill="#8cc068" stroke="#4f8a3f" strokeWidth="1.5" />
        </symbol>
        <symbol id="seed" viewBox="0 0 40 40">
          <ellipse cx="20" cy="34" rx="9" ry="4" fill="#b98a5c" />
          <path d="M20 34v-6" stroke="#4f8a3f" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M20 29c-4 0-6-3-6-5 3 0 6 2 6 5z" fill="#8cc068" />
        </symbol>
        <symbol id="bud" viewBox="0 0 40 40">
          <use href="#sprout" />
          <ellipse cx="20" cy="12" rx="5" ry="7" fill="var(--petal,#f08a8a)" stroke="#c45d5d" />
        </symbol>
        <symbol id="flower" viewBox="0 0 40 40">
          <path d="M20 39V20" stroke="#4f8a3f" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M20 31c-7 0-11-5-11-8 6 0 11 3 11 8z" fill="#7bb25b" />
          <path d="M20 29c0-5 5-8 11-8 0 3-4 8-11 8z" fill="#8cc068" />
          <g fill="var(--petal,#f08a8a)" stroke="#c45d5d" strokeWidth="1">
            <circle cx="20" cy="7" r="5.5" /><circle cx="27" cy="12" r="5.5" /><circle cx="24.5" cy="20" r="5.5" /><circle cx="15.5" cy="20" r="5.5" /><circle cx="13" cy="12" r="5.5" />
          </g>
          <circle cx="20" cy="14" r="4.5" fill="#f6cf62" />
        </symbol>
        <symbol id="pot" viewBox="0 0 40 50">
          <use href="#sprout" width="40" height="38" />
          <path d="M8 34h24l-3 15H11z" fill="#c8764a" stroke="#8a4b2c" strokeWidth="1.5" />
        </symbol>
        <symbol id="heart" viewBox="0 0 40 40">
          <path d="M20 34S5 25 5 14a8 8 0 0 1 15-4 8 8 0 0 1 15 4c0 11-15 20-15 20z" fill="#e06b6b" stroke="#a84545" strokeWidth="1.5" />
        </symbol>
        <symbol id="leaf" viewBox="0 0 40 40">
          <path d="M20 36C8 30 6 16 20 4c14 12 12 26 0 32z" fill="#7bb25b" stroke="#4f8a3f" strokeWidth="1.5" />
          <path d="M20 36V10M20 18l-5-4M20 24l6-5M20 30l-6-4" stroke="#4f8a3f" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </symbol>
        <symbol id="flame" viewBox="0 0 24 24">
          <path d="M12 2.5c1 3.5 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.5 1.3-4 2.5-5 .1 1.8.8 3 2 3.4-.6-3.4.5-6.7 1-9.4z" fill="#e8692f" />
          <path d="M12 13c.8 1.6 2.4 2.5 2.4 4.4a2.4 2.4 0 0 1-4.8 0c0-1.5.9-2.4 2.4-4.4z" fill="#f7c64c" />
        </symbol>
      </defs>
    </svg>
  );
}

export const Mochi = ({ color, sleepy, ...p }) => (
  <svg viewBox="0 0 100 90" style={color ? { '--m-body': color } : undefined} {...p}><use href={sleepy ? '#mochi-sleepy' : '#mochi'} /></svg>
);
export const Plant = ({ kind = 'sprout', petal, ...p }) => (
  <svg viewBox="0 0 40 40" style={petal ? { '--petal': petal } : undefined} {...p}><use href={`#${kind}`} /></svg>
);

const PETALS = ['#f08a8a', '#f5b14d', '#c99be8', '#7da4e6', '#f2a3c4'];

/** Cozy evening room. `mood` changes Mochi's prop. */
export function RoomScene({ mood = 'reading', color, night = true }) {
  return (
    <svg viewBox="0 0 280 180" role="img" aria-label="Mochi relaxing in a cozy room">
      <rect width="280" height="180" fill="#f1d7aa" />
      <rect y="138" width="280" height="42" fill="#e0b984" />
      <ellipse cx="140" cy="164" rx="100" ry="12" fill="#d6a46c" />
      <rect x="22" y="26" width="72" height="74" rx="4" fill={night ? '#2f3d5e' : '#a9d4e6'} stroke="#8a5a35" strokeWidth="4" />
      <path d="M58 26v74M22 63h72" stroke="#8a5a35" strokeWidth="3" />
      {night ? (
        <>
          <circle cx="76" cy="44" r="8" fill="#f7d774" /><circle cx="80" cy="41" r="7" fill="#2f3d5e" />
          <g fill="#f7e6a4"><circle cx="34" cy="38" r="1.3" /><circle cx="46" cy="50" r="1" /><circle cx="36" cy="78" r="1.2" /><circle cx="72" cy="82" r="1" /><circle cx="84" cy="70" r="1.3" /></g>
        </>
      ) : (
        <circle cx="40" cy="44" r="9" fill="#f6c94a" />
      )}
      <rect x="160" y="40" width="104" height="5" rx="2" fill="#a8723f" />
      <use href="#pot" x="168" y="10" width="24" height="31" /><use href="#pot" x="200" y="12" width="20" height="29" /><use href="#pot" x="234" y="8" width="26" height="33" />
      <rect x="200" y="56" width="24" height="30" rx="2" fill="#f6ead2" stroke="#a8723f" strokeWidth="3" /><use href="#sprout" x="204" y="60" width="16" height="22" />
      <rect x="160" y="112" width="116" height="34" rx="10" fill="#7fb1ab" /><rect x="160" y="104" width="34" height="16" rx="8" fill="#e9f0e6" />
      <path d="M250 70h22l-5-18h-12z" fill="#f6e3a6" stroke="#b58a49" strokeWidth="1.5" /><rect x="259" y="70" width="3" height="40" fill="#8a5a35" />
      {night && <ellipse cx="260" cy="72" rx="26" ry="10" fill="#fff4c4" opacity=".45" />}
      <use href="#pot" x="4" y="98" width="38" height="48" />
      <g style={color ? { '--m-body': color } : undefined}>
        <use href={mood === 'sleepy' ? '#mochi-sleepy' : '#mochi'} x="92" y="88" width="96" height="86" />
      </g>
      {mood === 'reading' && (<><rect x="122" y="140" width="34" height="20" rx="3" fill="#4f7a52" stroke="#2f4f32" strokeWidth="1.5" /><path d="M139 140v20" stroke="#e7efd8" strokeWidth="1.5" /></>)}
      {mood === 'happy' && (<><use href="#flower" x="122" y="128" width="34" height="36" style={{ '--petal': '#f5b14d' }} /></>)}
    </svg>
  );
}

/** Mochi at the table with a glass of water, for check-in. */
export function CheckInScene({ color, taken }) {
  return (
    <svg viewBox="0 0 280 200" role="img" aria-label="Mochi sitting at a table with water and a pill">
      <rect width="280" height="200" fill="#f1d7aa" />
      <rect x="14" y="36" width="80" height="5" rx="2" fill="#a8723f" /><use href="#pot" x="18" y="6" width="24" height="31" /><use href="#pot" x="56" y="4" width="28" height="33" />
      <use href="#pot" x="10" y="100" width="40" height="50" />
      <path d="M226 92h28l-6-22h-16z" fill="#f6e3a6" stroke="#b58a49" strokeWidth="1.5" /><rect x="238" y="92" width="4" height="54" fill="#8a5a35" /><rect x="226" y="144" width="28" height="5" rx="2" fill="#8a5a35" />
      <ellipse cx="240" cy="94" rx="32" ry="11" fill="#fff4c4" opacity=".45" />
      <g style={color ? { '--m-body': color } : undefined}><use href="#mochi" x="78" y="62" width="124" height="112" /></g>
      <rect x="0" y="160" width="280" height="40" fill="#b9814d" /><rect x="0" y="156" width="280" height="8" fill="#cf9a62" />
      <path d="M70 124h22l-2 34H72z" fill="#e7f1f4" stroke="#8fb2bd" strokeWidth="2" /><path d={taken ? 'M73 150h17l-1 6H74z' : 'M73 136h17l-1 20H74z'} fill="#bfdde6" />
      {!taken && (<><rect x="180" y="146" width="22" height="12" rx="6" fill="#f2f2f2" stroke="#c9a3a3" strokeWidth="1.5" /><path d="M191 146v12" stroke="#e46f6f" strokeWidth="5" /></>)}
      {taken && <use href="#flower" x="176" y="118" width="34" height="40" style={{ '--petal': '#f5b14d' }} />}
    </svg>
  );
}

// Fixed planting spots in the personal garden, filled in order.
const GARDEN_SPOTS = [
  [20, 128], [48, 124], [76, 128], [184, 124], [212, 128], [240, 124],
  [20, 178], [48, 174], [76, 178], [184, 174], [240, 174], [212, 176],
  [8, 236], [36, 240], [64, 236], [96, 244], [158, 244], [262, 200],
];

/** Personal garden that grows with total check-ins and complete days. */
export function GardenScene({ plants = 0, blooms = 0, stage = 1, color }) {
  const filled = Math.min(GARDEN_SPOTS.length, Math.ceil(plants / 6));
  const flowers = Math.min(filled, Math.ceil(blooms / 2));
  return (
    <svg viewBox="0 0 280 270" role="img" aria-label={`Your garden: ${filled} plants, ${flowers} in bloom`}>
      <rect width="280" height="270" fill="#cfe7ea" />
      <ellipse cx="60" cy="26" rx="26" ry="8" fill="#fff" opacity=".8" /><ellipse cx="210" cy="20" rx="22" ry="7" fill="#fff" opacity=".8" />
      <g fill="#78a95c"><circle cx="20" cy="70" r="26" /><circle cx="60" cy="58" r="24" /><circle cx="100" cy="68" r="22" /><circle cx="175" cy="62" r="26" /><circle cx="220" cy="56" r="24" /><circle cx="265" cy="70" r="26" /></g>
      <g fill="#5d8f47"><circle cx="40" cy="80" r="18" /><circle cx="140" cy="76" r="20" /><circle cx="245" cy="80" r="18" /></g>
      <path d="M0 92Q140 74 280 92V270H0Z" fill="#9cc47a" />
      <g fill="#c99a63" stroke="#8a6238" strokeWidth="1">
        <rect x="0" y="94" width="280" height="4" /><rect x="0" y="106" width="280" height="4" />
        {[10, 40, 70, 200, 230, 260].map((x) => <rect key={x} x={x} y="88" width="6" height="28" />)}
      </g>
      <rect x="110" y="70" width="44" height="40" rx="3" fill="#b07a48" stroke="#7a5230" strokeWidth="2" /><path d="M106 72l26-18 26 18z" fill="#c4553f" /><rect x="124" y="82" width="16" height="14" fill="#fbe3a4" />
      <path d="M120 270Q130 180 140 130Q150 180 170 270Z" fill="#ead6ad" />
      <g fill="#b98a5c"><rect x="14" y="150" width="88" height="22" rx="10" /><rect x="180" y="150" width="88" height="22" rx="10" /><rect x="14" y="200" width="88" height="22" rx="10" /><rect x="180" y="200" width="60" height="22" rx="10" /></g>
      {GARDEN_SPOTS.slice(0, filled).map(([x, y], i) => (
        <use key={i} href={i < flowers ? '#flower' : '#sprout'} x={x} y={y} width="28" height="32" style={{ '--petal': PETALS[i % PETALS.length] }} className={i === filled - 1 ? 'grow' : undefined} />
      ))}
      <ellipse cx="218" cy="236" rx="38" ry="15" fill="#8a8274" /><ellipse cx="218" cy="234" rx="32" ry="11" fill="#7fb6c9" /><ellipse cx="208" cy="231" rx="8" ry="2" fill="#d2edf3" />
      <g style={color ? { '--m-body': color } : undefined}><use href="#mochi" x="96" y="156" width="88" height="80" /></g>
      <ellipse cx="140" cy="179" rx="32" ry="5" fill="#d9b56f" stroke="#7a5a2c" strokeWidth="1.5" /><path d="M122 179c0-14 36-14 36 0z" fill="#e6c886" stroke="#7a5a2c" strokeWidth="1.5" /><path d="M123 175h34" stroke={stage >= 4 ? '#e06b6b' : '#5b8f4e'} strokeWidth="3" />
    </svg>
  );
}

const NEIGHBOUR_SPOTS = [[30, 114, 56], [70, 104, 44], [190, 104, 50], [40, 176, 60], [176, 178, 60], [116, 182, 50], [226, 160, 48], [4, 200, 44]];

/** Shared garden; plants scale with this week's community check-ins. */
export function CommunityScene({ neighbours = [], progress = 0 }) {
  const extra = Math.round(progress * 10);
  const spots = [[10, 150], [250, 150], [232, 214], [110, 218], [160, 216], [6, 226], [256, 232], [84, 236], [196, 240], [140, 240]];
  return (
    <svg viewBox="0 0 280 260" role="img" aria-label="The community garden with neighbours gathered around a fountain">
      <rect width="280" height="260" fill="#cfe7ea" />
      <g fill="#78a95c"><circle cx="20" cy="70" r="30" /><circle cx="260" cy="66" r="30" /></g>
      <path d="M0 110Q140 90 280 110V260H0Z" fill="#9cc47a" />
      <rect x="130" y="60" width="18" height="70" fill="#8a5a35" />
      <g fill="#6a9c4f"><circle cx="110" cy="40" r="32" /><circle cx="170" cy="36" r="34" /><circle cx="140" cy="18" r="28" /><circle cx="90" cy="64" r="20" /><circle cx="192" cy="62" r="22" /></g>
      <rect x="96" y="44" width="88" height="56" rx="4" fill="#e9cf9f" stroke="#8a5a35" strokeWidth="2.5" />
      <g fontFamily="Nunito, sans-serif" fontSize="11" fontWeight="700" fill="#4b3420" textAnchor="middle">
        <text x="140" y="62">Together</text><text x="140" y="76">we grow</text><text x="140" y="90">stronger</text>
      </g>
      <ellipse cx="140" cy="164" rx="40" ry="13" fill="#a99f92" /><ellipse cx="140" cy="162" rx="34" ry="9" fill="#8cc3d4" /><rect x="134" y="138" width="12" height="24" fill="#a99f92" /><ellipse cx="140" cy="138" rx="16" ry="5" fill="#8cc3d4" stroke="#a99f92" strokeWidth="3" />
      {spots.slice(0, Math.max(3, extra)).map(([x, y], i) => (
        <use key={i} href={i % 3 === 1 ? '#sprout' : '#flower'} x={x} y={y} width="26" height="30" style={{ '--petal': PETALS[i % PETALS.length] }} />
      ))}
      {neighbours.slice(0, NEIGHBOUR_SPOTS.length).map((n, i) => {
        const [x, y, w] = NEIGHBOUR_SPOTS[i];
        return <g key={n.id} style={{ '--m-body': n.avatarColor }}><title>{n.name}</title><use href="#mochi" x={x} y={y} width={w} height={w * 0.9} /></g>;
      })}
    </svg>
  );
}
