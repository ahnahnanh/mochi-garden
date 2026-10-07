import { Shell, TopBar } from '../components.jsx';

const FAQ = [
  ['How does my garden grow?', 'Every dose you check in plants something new. Each day you take all your scheduled doses, a flower blooms and your streak grows.'],
  ['What breaks a streak?', 'A day where at least one scheduled dose wasn’t checked in. Today never breaks your streak while it’s still in progress, and as-needed medications never count against you.'],
  ['I forgot to check in yesterday.', 'Open the dose from yesterday’s reminder and mark it as taken — you can log doses for today and yesterday.'],
  ['What does the community see?', 'Only your name, Mochi’s colour, that you checked in, and your streak milestones. Never your medications, doses or times. You can turn sharing off in Settings.'],
  ['Is this medical advice?', 'No. Mochi Garden helps you remember doses you’ve already been prescribed. Always follow your doctor or pharmacist’s instructions.'],
];

export default function Help() {
  return (
    <Shell>
      <TopBar title="Help & support" />
      {FAQ.map(([q, a]) => (
        <details key={q} className="card faq">
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </Shell>
  );
}
