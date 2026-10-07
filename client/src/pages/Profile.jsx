import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useLoad } from '../state.jsx';
import { Mochi, Plant } from '../art.jsx';
import { Icon } from '../icons.jsx';
import { MenuLink, Shell } from '../components.jsx';

export default function Profile() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const { data: d } = useLoad('/dashboard');
  return (
    <Shell>
      <div className="between"><span style={{ width: 30 }} /><h1 className="h1">Profile</h1><Link className="iconbtn" to="/settings" aria-label="Settings"><Icon name="gear" size={22} /></Link></div>
      <div className="avatar">
        <Mochi color={user.avatarColor} width={78} height={70} />
        <Plant kind="flower" petal="#fff" width={26} height={26} className="avatar-flower" />
      </div>
      <div className="center"><h2 className="title">{user.name}</h2><p className="sub">{user.tagline}</p></div>
      <div className="card pstats">
        <div><b className="num">{d?.streak ?? '–'}</b><span>day streak</span></div>
        <div><b className="num">{d ? `${d.week.percent}%` : '–'}</b><span>last 7 days</span></div>
        <div><b className="num">{d ? `${d.month.percent}%` : '–'}</b><span>this month</span></div>
      </div>
      <nav className="card menu" aria-label="Profile">
        <MenuLink icon="pill" to="/medications">My medications</MenuLink>
        <MenuLink icon="bell" to="/settings#reminders">Reminders &amp; notifications</MenuLink>
        <MenuLink icon="plant" to="/garden">My garden</MenuLink>
        <MenuLink icon="people" to="/community?tab=groups">Community settings</MenuLink>
        <MenuLink icon="lock" to="/settings#privacy">Privacy &amp; data</MenuLink>
        <MenuLink icon="palette" to="/settings#appearance">Appearance</MenuLink>
        <MenuLink icon="help" to="/help">Help &amp; support</MenuLink>
      </nav>
      <button className="btn text" onClick={async () => { await signOut(); nav('/login'); }}><Icon name="logout" />Sign out</button>
    </Shell>
  );
}
