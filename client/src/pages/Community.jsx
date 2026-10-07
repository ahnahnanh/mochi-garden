import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, timeAgo } from '../api.js';
import { useLoad, useToast } from '../state.jsx';
import { CommunityScene, Mochi, Plant } from '../art.jsx';
import { Icon } from '../icons.jsx';
import { ErrorNote, Loading, Segmented, Shell } from '../components.jsx';

const CHEERS = ['Keep it up!', 'Small steps make a big difference.', 'You got this!', 'So proud!', 'One day at a time.', 'Your garden thanks you!'];
const STREAK_CHEERS = ['So proud!', 'Amazing!', 'What a gardener!', 'Look at it bloom!'];
const PETALS = ['#f08a8a', '#f5b14d', '#c99be8', '#7da4e6', '#e06b6b'];

export function GroupIcon({ g, size = 30 }) {
  if (g.icon === 'mochi') return <Mochi color="#c9b8e8" width={size} height={size * 0.9} />;
  return <Plant kind={g.icon} width={size} height={size} />;
}

function Feed() {
  const toast = useToast();
  const { data: groups } = useLoad('/groups');
  const [filter, setFilter] = useState('');
  const { data, setData, error, reload } = useLoad(`/feed${filter ? `?group=${filter}` : ''}`, { pollMs: 30_000 });
  const joined = groups?.groups.filter((g) => g.joined) || [];

  async function cheer(ev) {
    try {
      const r = await api.post(`/feed/${ev.id}/cheer`);
      setData({ events: data.events.map((e) => (e.id === ev.id ? { ...e, cheers: r.cheers, cheered: r.cheered } : e)) });
      if (r.cheered) toast(`You cheered for ${ev.user.name}!`);
    } catch (e) { toast(e.message); }
  }

  return (
    <>
      {joined.length > 0 && (
        <div className="chips" role="group" aria-label="Show posts from">
          <button type="button" className={!filter ? 'on' : undefined} onClick={() => setFilter('')}>Everyone</button>
          {joined.map((g) => <button type="button" key={g.id} className={filter === String(g.id) ? 'on' : undefined} onClick={() => setFilter(String(g.id))}>{g.name}</button>)}
        </div>
      )}
      <ErrorNote error={error} onRetry={reload} />
      {!data ? <Loading /> : data.events.length === 0 ? (
        <div className="card empty"><p>No check-ins here yet. When people check in, they’ll show up here.</p></div>
      ) : (
        <ul className="feed">
          {data.events.map((e) => (
            <li key={e.id} className="card post">
              <div className="av"><Mochi color={e.user.avatarColor} width={36} height={34} /></div>
              <div>
                <p>
                  <b>{e.user.isMe ? 'You' : e.user.name}</b>{' '}
                  {e.type === 'streak' ? <>{e.user.isMe ? 'are' : 'is'} on a {e.value} day streak!</> : <>checked in today!</>}
                  <br />
                  {e.type === 'streak' ? STREAK_CHEERS[e.id % STREAK_CHEERS.length] : CHEERS[e.id % CHEERS.length]}
                </p>
                <span className="ago">{timeAgo(e.createdAt)}</span>
              </div>
              <button className={`cheer${e.cheered ? ' on' : ''}`} onClick={() => cheer(e)} aria-pressed={e.cheered} aria-label={`Cheer for ${e.user.name}`} disabled={e.user.isMe}>
                <Plant kind={e.type === 'streak' ? 'flower' : 'sprout'} petal={PETALS[e.id % PETALS.length]} width={28} height={28} />
                {e.cheers > 0 && <span className="num">{e.cheers}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function OurGarden() {
  const toast = useToast();
  const { data: c, setData, error, reload } = useLoad('/community', { pollMs: 30_000 });
  if (!c) return error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />;
  const pct = Math.min(1, c.weekCheckins / c.goal);
  async function encourage() {
    try { const r = await api.post('/community/encourage'); setData({ ...c, encouragements: r.encouragements }); toast('Encouragement sent to the garden!'); }
    catch (e) { toast(e.message); }
  }
  return (
    <>
      <div className="scene"><CommunityScene neighbours={c.neighbours} progress={pct} /></div>
      <section className="card">
        <div className="row gap4"><h2 className="h2">Community progress</h2><span className="muted" title="Every dose anyone takes this week counts toward the goal."><Icon name="help" size={14} /></span></div>
        <p className="small num ink"><b>{c.weekCheckins.toLocaleString()}</b> / {c.goal.toLocaleString()} check-ins this week</p>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={c.goal} aria-valuenow={c.weekCheckins}><i style={{ width: `${pct * 100}%` }} /></div>
        <p className="small center">Every completed routine adds a plant to our garden! {c.encouragements > 0 && <>· {c.encouragements} encouragements sent this week</>}</p>
      </section>
      <button className="btn primary" onClick={encourage}><Plant width={18} height={18} />Send encouragement</button>
    </>
  );
}

export function Groups() {
  const toast = useToast();
  const { data, error, reload } = useLoad('/groups');
  if (!data) return error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />;
  async function toggle(g) {
    try {
      if (g.joined) await api.del(`/groups/${g.id}/join`); else await api.post(`/groups/${g.id}/join`);
      await reload();
      toast(g.joined ? `You left ${g.name}.` : `You joined ${g.name}!`);
    } catch (e) { toast(e.message); }
  }
  return (
    <section className="card groups">
      <h2 className="h2">Find your community</h2>
      <ul className="stack">
        {data.groups.map((g) => (
          <li key={g.id} className="group" style={{ background: g.color }}>
            <div className="gi"><GroupIcon g={g} /></div>
            <div><b>{g.name}</b><span>{g.description}</span><span className="small">{g.checkedInToday} checked in today</span></div>
            <div className="r">
              <span className="small num">{g.members} member{g.members === 1 ? '' : 's'}</span>
              <button className={`join${g.joined ? ' on' : ''}`} aria-pressed={g.joined} onClick={() => toggle(g)}>{g.joined ? 'Joined' : 'Join'}</button>
            </div>
          </li>
        ))}
      </ul>
      <p className="small">Joining is optional. Groups only see that you checked in — never medication names or health details.</p>
    </section>
  );
}

export default function Community() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'feed';
  return (
    <Shell>
      <h1 className="title center" style={{ fontSize: 19 }}>Community</h1>
      <Segmented solid value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })}
        options={[{ value: 'feed', label: 'Feed' }, { value: 'garden', label: 'Our Garden' }, { value: 'groups', label: 'Groups' }]} />
      {tab === 'feed' && <Feed />}
      {tab === 'garden' && <OurGarden />}
      {tab === 'groups' && <Groups />}
    </Shell>
  );
}
