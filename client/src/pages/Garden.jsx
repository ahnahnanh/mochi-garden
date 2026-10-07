import { useAuth, useLoad } from '../state.jsx';
import { GardenScene, Plant } from '../art.jsx';
import { Icon } from '../icons.jsx';
import { ErrorNote, Loading, Shell } from '../components.jsx';

const STAGES = [
  { kind: 'seed', label: 'Seedling', at: 0 },
  { kind: 'sprout', label: 'Sprouting', at: 3 },
  { kind: 'bud', label: 'Budding', at: 7 },
  { kind: 'flower', label: 'Full bloom', at: 14 },
];

export default function Garden() {
  const { user } = useAuth();
  const { data: d, error, reload } = useLoad('/dashboard');
  const { data: h } = useLoad('/history?days=28');

  if (!d) return <Shell tint="#eaf3ee">{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</Shell>;
  const nextStage = STAGES.find((s) => s.at > d.streak);

  return (
    <Shell tint="#eaf3ee">
      <div className="between">
        <div><h1 className="title">My Garden</h1><p className="sub">Your habits help Mochi’s home grow!</p></div>
        <Icon name="sun" size={34} />
      </div>
      <div className="scene"><GardenScene {...d.garden} color={user.avatarColor} /></div>

      <section className="card">
        <div className="between"><h2 className="h2">Mochi’s progress</h2><b className="num small-strong">{d.streak} day streak</b></div>
        <div className="stages">
          {STAGES.map((s, i) => (
            <div key={s.kind} className={`stage-step${d.garden.stage === i + 1 ? ' current' : ''}${d.garden.stage < i + 1 ? ' locked' : ''}`}>
              <Plant kind={s.kind} width={22 + i * 9} height={26 + i * 11} />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
        <div className="soil" />
      </section>

      <div className="keep">
        <b>{d.remaining === 0 && d.doses.length ? 'Today is complete!' : 'Keep going!'}</b>
        {nextStage ? `${nextStage.at - d.streak} more complete day${nextStage.at - d.streak === 1 ? '' : 's'} until ${nextStage.label.toLowerCase()}.` : 'Your garden is in full bloom. Keep it flowering!'}
      </div>

      <section className="card">
        <div className="between"><h2 className="h2">Last 4 weeks</h2><span className="small num">{d.garden.plants} plants grown</span></div>
        {h ? (
          <div className="cal" role="list">
            {h.days.map((x) => (
              <div key={x.date} role="listitem" className={`cal-day${x.complete ? ' ok' : x.taken ? ' part' : ''}`} title={`${x.date}: ${x.taken}/${x.required}`}>
                {x.complete ? <Plant kind="flower" width={18} height={18} petal="#f5b14d" /> : x.taken ? <Plant kind="sprout" width={16} height={16} /> : null}
                <span>{Number(x.date.slice(8))}</span>
              </div>
            ))}
          </div>
        ) : <Loading label="Loading history…" />}
        <p className="small legend"><Plant kind="flower" width={14} height={14} petal="#f5b14d" /> all doses <Plant kind="sprout" width={14} height={14} /> some doses</p>
      </section>
    </Shell>
  );
}
