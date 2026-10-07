import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtTime } from '../api.js';
import { useAuth, useLoad, useToast } from '../state.jsx';
import { CheckInScene, Plant } from '../art.jsx';
import { Icon } from '../icons.jsx';
import { Bubble, ErrorNote, Loading, Shell, TopBar } from '../components.jsx';

const addMin = (hhmm, n) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = Math.min(h * 60 + m + n, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export default function Dose() {
  const { scheduleId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, reload } = useLoad(`/doses/${scheduleId}`);
  const [resched, setResched] = useState(false);
  const [newTime, setNewTime] = useState('');
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!data) return <Shell tabs={false}><TopBar title="Dose" />{error ? <ErrorNote error={error} /> : <Loading />}</Shell>;
  const { dose, medication: m, lastTakenAt } = data;
  const taken = dose?.status === 'taken';

  async function act(path, body, msg) {
    setBusy(true);
    try { await api.post(`/doses/${scheduleId}/${path}`, body); await reload(); toast(msg); setResched(false); }
    catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  const quick = dose ? [30, 60, 90].map((n) => addMin(dose.time, n)) : [];

  return (
    <Shell tabs={false}>
      <TopBar title="" />
      <div className="center">
        <h1 className="h1">{m.name}</h1>
        <p className="sub num">{dose ? `${fmtTime(dose.time)} today` : 'Not scheduled today'}{dose?.snoozedUntil && !taken ? ` · snoozed to ${fmtTime(dose.snoozedUntil)}` : ''}</p>
      </div>
      <div className="scene">
        <CheckInScene color={user.avatarColor} taken={taken} />
        <Bubble style={{ right: '6%', top: '8%' }} tail="right">{taken ? 'Yay! I watered the garden for you.' : 'Ready for today’s check-in?'}</Bubble>
      </div>

      {dose && (taken ? (
        <div className="stack">
          <button className="btn primary" disabled><Icon name="check" />Taken{dose.takenAt ? ` at ${new Date(dose.takenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</button>
          <button className="btn text" onClick={() => act('undo', {}, 'Check-in removed.')} disabled={busy}>Undo check-in</button>
        </div>
      ) : (
        <>
          <button className="btn primary" disabled={busy} onClick={() => act('take', {}, 'Dose logged. A new plant is growing!')}>Mark as taken</button>
          <div className="pair">
            <button className="btn ghost" disabled={busy} onClick={() => act('snooze', { minutes: 10 }, 'Snoozed for 10 minutes.')}><Icon name="clock" />Snooze 10 min</button>
            <button className="btn ghost" aria-expanded={resched} onClick={() => setResched(!resched)}><Icon name="cal" />Reschedule</button>
          </div>
          {resched && (
            <div className="card stack">
              <span className="small">Move today’s dose to</span>
              <div className="chips">
                {quick.map((t) => <button key={t} type="button" onClick={() => act('reschedule', { time: t }, `Moved to ${fmtTime(t)} today.`)}>{fmtTime(t)}</button>)}
              </div>
              <form className="row" onSubmit={(e) => { e.preventDefault(); if (newTime) act('reschedule', { time: newTime }, `Moved to ${fmtTime(newTime)} today.`); }}>
                <label className="sr-only" htmlFor="newtime">Custom time</label>
                <input id="newtime" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                <button className="btn small outline" disabled={!newTime}>Move</button>
              </form>
              <span className="small">Your usual time stays the same for tomorrow.</span>
            </div>
          )}
        </>
      ))}

      <section className="card info">
        <h2 className="h2">Dose info</h2>
        <ul>
          <li><Icon name="pill" />{m.dosage}</li>
          {m.withWater && <li><Icon name="cup" />With water</li>}
          {m.instructions && <li><Icon name="meal" />{m.instructions}</li>}
        </ul>
        <button className="linkrow" type="button" onClick={() => setDetails(!details)} aria-expanded={details}><span>View details</span><Icon name="chev" /></button>
        {details && (
          <div className="small stack" style={{ paddingTop: 8 }}>
            {m.notes && <p>{m.notes}</p>}
            <p>Last taken: {lastTakenAt ? new Date(lastTakenAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'no earlier check-ins'}</p>
            <Link className="link" to={`/medications/${m.id}`}>Edit medication and reminder times</Link>
          </div>
        )}
      </section>
      <div className="foot"><Plant width={16} height={16} />Checking in helps your garden grow!</div>
    </Shell>
  );
}
