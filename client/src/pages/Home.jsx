import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fmtTime, fmtUntil, greeting } from '../api.js';
import { useAuth, useLoad, useToast } from '../state.jsx';
import { RoomScene } from '../art.jsx';
import { Icon } from '../icons.jsx';
import { Bubble, ErrorNote, Loading, Shell, SproutRow } from '../components.jsx';

function bubbleText(d) {
  if (!d.doses.length && !d.asNeeded.length) return 'Add a medication and I’ll help you remember it!';
  if (d.overdueCount) return 'You have a dose waiting. Shall we check in?';
  if (d.remaining === 1) return 'One more dose to complete today!';
  if (d.remaining > 1) return `${d.remaining} doses to go today. You’ve got this!`;
  return 'All done for today. I’m so proud of you!';
}

function statusLine(d) {
  if (d.status === 'taken') return 'Taken';
  if (d.status === 'skipped') return 'Skipped';
  if (d.snoozedUntil && d.status !== 'overdue') return `Snoozed until ${fmtTime(d.snoozedUntil)}`;
  if (d.status === 'upcoming') return `Upcoming · ${fmtUntil(d.minutesUntil)}`;
  if (d.status === 'due') return 'Due now';
  return `Overdue · ${fmtUntil(d.minutesUntil)}`;
}

function NudgeSheet({ dose, color, onTake, onClose }) {
  const nav = useNavigate();
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="nudge-title" onClick={(e) => e.stopPropagation()}>
        <button className="iconbtn sheet-close" onClick={onClose} aria-label="Dismiss"><Icon name="x" /></button>
        <div className="scene">
          <RoomScene mood="sleepy" color={color} />
          <Bubble style={{ right: '5%', top: '8%', maxWidth: '58%' }} tail="right">
            <span id="nudge-title">You have an overdue dose.</span> Take a moment to check in? Mochi is cheering for you!
          </Bubble>
        </div>
        <p className="sub center">{dose.name} · {fmtTime(dose.time)}</p>
        <div className="pair">
          <button className="btn primary" onClick={onTake}>Mark as taken</button>
          <button className="btn outline" onClick={() => nav(`/dose/${dose.scheduleId}`)}>View details</button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const toast = useToast();
  const { data: d, setData, error, reload } = useLoad('/dashboard', { pollMs: 60_000 });
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('nudge-dismissed') || ''; } catch { return ''; }
  });

  if (!d) return <Shell>{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</Shell>;

  const overdue = d.doses.find((x) => x.status === 'overdue');
  const nudgeKey = overdue ? `${d.date}:${overdue.scheduleId}` : '';
  const showNudge = overdue && user.nudgesEnabled && dismissed !== nudgeKey;
  const dismiss = () => { setDismissed(nudgeKey); try { sessionStorage.setItem('nudge-dismissed', nudgeKey); } catch { /* ignore */ } };

  async function take(dose) {
    try { setData(await api.post(`/doses/${dose.scheduleId}/take`)); toast('Checked in! A new plant is growing in your garden.'); }
    catch (e) { toast(e.message); }
  }
  async function takePrn(m) {
    try { setData(await api.post(`/medications/${m.medicationId}/take`)); toast(`Logged ${m.name}.`); }
    catch (e) { toast(e.message); }
  }

  const hour = Number(d.now.slice(0, 2));
  const night = hour >= 18 || hour < 6;
  const weekOn = d.last7.filter((x) => x.complete).length;
  const empty = !d.doses.length && !d.asNeeded.length;

  return (
    <Shell>
      <div className="between">
        <div>
          <h1 className="title">{greeting(hour)}, {user.name} <Icon name={night ? 'moon' : 'sun'} size={20} /></h1>
          <p className="sub">{d.remaining === 0 && !empty ? 'Today is complete!' : 'You’re doing great!'}</p>
        </div>
        <Link className="iconbtn" to="/settings" aria-label="Settings"><Icon name="gear" size={22} /></Link>
      </div>

      <div className="scene">
        <RoomScene mood={d.remaining === 0 && !empty ? 'happy' : 'reading'} color={user.avatarColor} night={night} />
        <Bubble style={{ left: '30%', top: '10%' }}>{bubbleText(d)}</Bubble>
      </div>

      <Link to="/garden" className="card streak">
        <svg width="26" height="26" viewBox="0 0 24 24"><use href="#flame" /></svg>
        <span><b className="num">{d.streak}</b> <b>day streak</b></span>
        <Icon name="chev" />
      </Link>

      <div className="stats">
        <div className="card stat">
          <div className="lab">Last 7 days</div>
          <div className="big num">{d.week.percent}%</div>
          <div className="small num">{d.week.taken}/{d.week.total} doses</div>
          <SproutRow on={weekOn} total={7} />
        </div>
        <div className="card stat">
          <div className="lab">This month</div>
          <div className="big num">{d.month.percent}%</div>
          <div className="small num">{d.month.taken}/{d.month.total} doses</div>
          <SproutRow on={Math.round((d.month.percent / 100) * 5)} total={5} />
        </div>
      </div>

      <section className="card">
        <div className="between"><h2 className="h2">Today’s doses</h2><Link className="small link" to="/medications">Manage</Link></div>
        {empty ? (
          <div className="empty">
            <p>No medications yet. Add one and set its reminder times.</p>
            <Link className="btn primary" to="/medications/new"><Icon name="plus" />Add medication</Link>
          </div>
        ) : (
          <ul className="doses">
            {d.doses.map((x) => {
              const open = x.status !== 'taken' && x.status !== 'skipped';
              const next = d.nextDose?.scheduleId === x.scheduleId;
              return (
                <li key={x.scheduleId}>
                  <Link to={`/dose/${x.scheduleId}`} className={`dose${next ? ' next' : ''}${x.status === 'overdue' ? ' late' : ''}`}>
                    {x.status === 'taken' ? <span className="chk done"><Icon name="check" size={13} /></span>
                      : next ? <Icon name="pill" className="pill" /> : <Icon name="clock" className="muted" />}
                    <span className="t num">{fmtTime(x.time)}</span>
                    <span className="n">{x.name}<span className="meta">{statusLine(x)}</span></span>
                    {open ? <Icon name="chev" size={14} /> : <span />}
                  </Link>
                </li>
              );
            })}
            {d.asNeeded.map((m) => (
              <li key={`prn-${m.medicationId}`}>
                <div className="dose">
                  <Icon name="clock" className="muted" />
                  <span className="t">As needed</span>
                  <span className="n">{m.name}<span className="meta">{m.takenCount ? `Taken ${m.takenCount}× today` : 'Not taken today'}</span></span>
                  <button className="mini" onClick={() => takePrn(m)} aria-label={`Log a dose of ${m.name}`}><Icon name="plus" size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showNudge && <NudgeSheet dose={overdue} color={user.avatarColor} onClose={dismiss} onTake={() => { dismiss(); take(overdue); }} />}
    </Shell>
  );
}
