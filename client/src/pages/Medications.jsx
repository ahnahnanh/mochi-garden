import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, fmtTime } from '../api.js';
import { useLoad, useToast } from '../state.jsx';
import { Plant } from '../art.jsx';
import { Icon } from '../icons.jsx';
import { ErrorNote, Loading, Shell, Toggle, TopBar } from '../components.jsx';

export function MedicationList() {
  const { data, error, reload } = useLoad('/medications');
  return (
    <Shell>
      <TopBar title="My medications" right={<Link className="iconbtn" to="/medications/new" aria-label="Add medication"><Icon name="plus" size={22} /></Link>} />
      <ErrorNote error={error} onRetry={reload} />
      {!data ? <Loading /> : data.medications.length === 0 ? (
        <div className="card empty">
          <Plant kind="seed" width={48} height={48} />
          <p>Nothing planted yet. Add your first medication to start your garden.</p>
          <Link className="btn primary" to="/medications/new"><Icon name="plus" />Add medication</Link>
        </div>
      ) : (
        <ul className="stack">
          {data.medications.map((m) => (
            <li key={m.id}>
              <Link className="card med" to={`/medications/${m.id}`}>
                <Icon name="pill" className="pill" size={22} />
                <span><b>{m.name}</b><span className="small">{m.dosage}{m.instructions ? ` · ${m.instructions}` : ''}</span></span>
                <span className="small num right">{m.asNeeded ? 'As needed' : m.times.map(fmtTime).join(', ')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

const EMPTY = { name: '', dosage: '1 tablet', withWater: true, instructions: '', notes: '', asNeeded: false, times: ['08:00'] };

export function MedicationForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const welcome = params.get('welcome');
  const isNew = !id;
  const nav = useNavigate();
  const toast = useToast();
  const [m, setM] = useState(isNew ? EMPTY : null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!isNew) api.get(`/medications/${id}`).then((r) => setM({ ...r.medication, times: r.medication.times.length ? r.medication.times : ['08:00'] })).catch((e) => setError(e.message));
  }, [id, isNew]);

  if (!m) return <Shell><TopBar title="Medication" />{error ? <p className="form-error">{error}</p> : <Loading />}</Shell>;
  const set = (k, v) => setM({ ...m, [k]: v });

  async function submit(e) {
    e.preventDefault(); setError('');
    const body = { name: m.name, dosage: m.dosage, withWater: m.withWater, instructions: m.instructions, notes: m.notes, asNeeded: m.asNeeded, times: m.asNeeded ? [] : [...new Set(m.times.filter(Boolean))] };
    try {
      if (isNew) await api.post('/medications', body); else await api.put(`/medications/${id}`, body);
      toast(isNew ? `${m.name} added. Mochi planted a seed!` : 'Changes saved.');
      nav(welcome ? '/' : '/medications');
    } catch (err) { setError(err.message); }
  }

  async function remove() {
    try { await api.del(`/medications/${id}`); toast(`${m.name} removed. Its history stays in your garden.`); nav('/medications'); }
    catch (err) { setError(err.message); }
  }

  return (
    <Shell>
      <TopBar title={isNew ? 'Add medication' : 'Edit medication'} />
      {welcome && <div className="keep"><b>Welcome to Mochi Garden!</b>Add a medication you take so Mochi can remind you.</div>}
      <form className="card form" onSubmit={submit}>
        <label htmlFor="m-name">Name<input id="m-name" value={m.name} onChange={(e) => set('name', e.target.value)} maxLength={80} placeholder="e.g. Metformin 500 mg" required /></label>
        <label htmlFor="m-dose">Amount<input id="m-dose" value={m.dosage} onChange={(e) => set('dosage', e.target.value)} maxLength={60} placeholder="1 tablet" /></label>
        <label htmlFor="m-ins">How to take it<input id="m-ins" value={m.instructions} onChange={(e) => set('instructions', e.target.value)} maxLength={120} placeholder="After dinner" /></label>
        <Toggle id="m-water" checked={m.withWater} onChange={(v) => set('withWater', v)} label="Take with water" />
        <Toggle id="m-prn" checked={m.asNeeded} onChange={(v) => set('asNeeded', v)} label="As needed" hint="No reminders, and it never affects your streak." />
        {!m.asNeeded && (
          <fieldset className="times">
            <legend>Reminder times</legend>
            {m.times.map((t, i) => (
              <div className="row" key={i}>
                <label className="sr-only" htmlFor={`m-t${i}`}>Time {i + 1}</label>
                <input id={`m-t${i}`} type="time" value={t} required onChange={(e) => set('times', m.times.map((x, j) => (j === i ? e.target.value : x)))} />
                {m.times.length > 1 && <button type="button" className="iconbtn" aria-label={`Remove ${fmtTime(t)}`} onClick={() => set('times', m.times.filter((_, j) => j !== i))}><Icon name="x" /></button>}
              </div>
            ))}
            {m.times.length < 8 && <button type="button" className="btn small outline" onClick={() => set('times', [...m.times, '20:00'])}><Icon name="plus" size={14} />Add a time</button>}
          </fieldset>
        )}
        <label htmlFor="m-notes">Notes<textarea id="m-notes" rows={3} value={m.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} placeholder="Prescriber, refill reminders… only you can see this." /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary">{isNew ? 'Add medication' : 'Save changes'}</button>
      </form>
      {!isNew && (!confirm
        ? <button className="btn text danger" onClick={() => setConfirm(true)}><Icon name="trash" />Remove medication</button>
        : (
          <div className="card danger-box stack">
            <p className="small">Stop reminders for {m.name}? Past check-ins stay in your history.</p>
            <div className="pair"><button className="btn ghost" onClick={() => setConfirm(false)}>Keep it</button><button className="btn danger-fill" onClick={remove}>Remove</button></div>
          </div>
        ))}
    </Shell>
  );
}
