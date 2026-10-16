import { interpolate, useCurrentFrame } from 'remotion';
import {
  Award, BarChart3, Bot, Calculator, Calendar, CalendarRange, CheckCircle2, ClipboardList,
  CreditCard, Download, Dumbbell, FileSpreadsheet, FlaskConical, ImagePlus, KeyRound,
  LayoutDashboard, Mail, Moon, QrCode, Receipt, ScrollText, ShieldCheck, Smartphone, Tag,
  User, UserCog, Users, Wallet, WifiOff,
} from 'lucide-react';
import { Avatar, Card, StatusBadge, useEnter } from '../components';
import { C, money } from '../theme';
import {
  Bars, Button, FeatureScene, Field, Floater, Panel, Pill, Rows, Stats,
} from './kit';

export interface SceneProps { duration: number; index: number; total: number }

const ok = { color: C.emerald, bg: C.emeraldSoft };
const warn = { color: C.amber, bg: C.amberSoft };
const bad = { color: C.rose, bg: C.roseSoft };
const violet = { color: '#7c3aed', bg: '#f5f3ff' };

/* ── 1. Sign up & branding ─────────────────────────────────────────── */
export const Onboarding = (p: SceneProps) => (
  <FeatureScene {...p} kicker="Get started" title="Your gym, set up in minutes."
    subtitle="Register your gym, upload your logo and you're ready. Sign in with email or Google.">
    <div style={{ position: 'relative' }}>
      <Panel icon={Dumbbell} title="Register your gym" width={760}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Gym name" value="Iron Strong Fitness" delay={14} />
          <Field label="Owner name" value="Faisal Ghafoor" delay={24} />
          <Field label="Email" value="owner@ironstrong.pk" delay={34} />
          <Field label="Phone" value="0300 1234567" delay={44} />
        </div>
        <div style={{ marginTop: 26 }}><Button delay={58}>Create Account & Continue</Button></div>
      </Panel>
      <Floater delay={70} style={{ right: -90, top: -50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 22, fontWeight: 700, color: C.ink }}>
          <ImagePlus color={C.blue} size={30} /> Gym logo uploaded
        </div>
      </Floater>
    </div>
  </FeatureScene>
);

/* ── 2. Dashboard ──────────────────────────────────────────────────── */
export const Dashboard = (p: SceneProps) => (
  <FeatureScene {...p} kicker="Dashboard" title="Today, at a glance."
    subtitle="Check-ins, active members, money collected and who needs a renewal call — the moment you open the app.">
    <Panel icon={LayoutDashboard} title="Dashboard">
      <Stats items={[
        { label: 'Checked in today', value: 86, color: C.blue },
        { label: 'Active members', value: 248, color: C.emerald },
        { label: 'Collected this month', value: 485000, color: C.ink, prefix: 'Rs ' },
      ]} />
      <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, margin: '8px 0 4px' }}>Renewal follow-up</div>
      <Rows start={30} rows={[
        { title: 'Usman Tariq', sub: 'Expires in 3 days · 0301 5550123', avatar: '#d97706', right: <StatusBadge status="expiring" /> },
        { title: 'Hina Malik', sub: 'Expired 6 days ago · 0322 5550456', avatar: '#e11d48', right: <StatusBadge status="expired" /> },
        { title: 'Kamran Ali', sub: 'Expires tomorrow · 0333 5550789', avatar: '#0891b2', right: <StatusBadge status="expiring" /> },
      ]} />
    </Panel>
  </FeatureScene>
);

/* ── 3. Members ────────────────────────────────────────────────────── */
export const MembersScene = (p: SceneProps) => (
  <FeatureScene {...p} kicker="Members" title="Every member, one glance."
    subtitle="Add members with photo and phone, filter by status, and long-gone members move to a Lapsed archive on their own.">
    <Panel icon={Users} title="Members" right={<Pill>+ Add member</Pill>}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {['All 269', 'Active 248', 'Expiring 12', 'Expired 9', 'Lapsed 31'].map((t, i) => (
          <Pill key={t} {...(i === 0 ? { color: C.white, bg: C.blue } : { color: C.text, bg: C.bg })}>{t}</Pill>
        ))}
      </div>
      <Rows rows={[
        { title: 'Ali Khan', sub: 'Monthly · Expires 12 Nov', avatar: '#2563eb', right: <StatusBadge status="active" /> },
        { title: 'Sara Ahmed', sub: 'Quarterly · Expires 3 Jan', avatar: '#7c3aed', right: <StatusBadge status="active" /> },
        { title: 'Usman Tariq', sub: 'Monthly · Expires in 3 days', avatar: '#d97706', right: <StatusBadge status="expiring" /> },
        { title: 'Hina Malik', sub: 'Monthly · Expired 6 days ago', avatar: '#e11d48', right: <StatusBadge status="expired" /> },
      ]} />
    </Panel>
  </FeatureScene>
);

/* ── 4. Renew + member card ────────────────────────────────────────── */
export const Renewals = (p: SceneProps) => (
  <FeatureScene {...p} kicker="Renewals" title="Renew in one tap."
    subtitle="Pick the plan, take cash or a wallet payment, add a trainer — and every member gets their own QR check-in card.">
    <div style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
      <Panel icon={Receipt} title="Renew membership" width={580}>
        <Rows start={18} rows={[
          { title: 'Plan', right: <b style={{ fontSize: 24 }}>Monthly · 30 days</b> },
          { title: 'Payment', right: <Pill>Cash</Pill> },
          { title: 'Trainer', right: <span style={{ fontSize: 22, color: C.text }}>Coach Hamza</span> },
        ]} />
        <div style={{ marginTop: 22 }}><Button delay={44}>Renew ({money(3000)})</Button></div>
      </Panel>
      <MemberCard />
    </div>
  </FeatureScene>
);

const MemberCard = () => {
  const p = useEnter(30);
  return (
    <Card style={{ width: 340, padding: 30, textAlign: 'center', opacity: p, transform: `rotate(${(1 - p) * 8}deg) translateY(${(1 - p) * 60}px)` }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}><Avatar name="Ali Khan" color={C.blue} /></div>
      <div style={{ fontSize: 28, fontWeight: 800, color: C.ink, marginTop: 12 }}>Ali Khan</div>
      <div style={{ fontSize: 19, color: C.muted, marginBottom: 16 }}>Member #0142</div>
      <div style={{ display: 'flex', justifyContent: 'center' }}><QrCode size={180} color={C.ink} strokeWidth={1.3} /></div>
    </Card>
  );
};

/* ── 5. Attendance (QR) ────────────────────────────────────────────── */
export const AttendanceScene = (p: SceneProps) => {
  const frame = useCurrentFrame();
  const scanned = frame >= 60;
  const line = interpolate(frame % 36, [0, 36], [-110, 110]);
  const res = useEnter(60);
  return (
    <FeatureScene {...p} kicker="Attendance" title="Check-in at the door."
      subtitle="Scan the member's QR card with any phone or webcam, or search by name. Any fee still owed shows up right away.">
      <div style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
        <div style={{
          width: 300, height: 300, borderRadius: 32, background: C.ink, position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          border: `6px solid ${scanned ? C.emerald : C.blue}`,
        }}>
          <QrCode size={200} color={C.white} strokeWidth={1.3} />
          {!scanned && <div style={{ position: 'absolute', left: 20, right: 20, height: 5, background: '#60a5fa', boxShadow: '0 0 24px #60a5fa', transform: `translateY(${line}px)` }} />}
        </div>
        <Card style={{ width: 560, padding: 34, opacity: res, transform: `translateY(${(1 - res) * 50}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: C.emerald, fontSize: 26, fontWeight: 800 }}>
            <CheckCircle2 size={34} /> Checked in · 7:42 AM
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, margin: '22px 0' }}>
            <Avatar name="Ali Khan" color={C.blue} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: C.ink }}>Ali Khan</div>
              <div style={{ fontSize: 20, color: C.muted }}>Monthly · until 12 Nov</div>
            </div>
          </div>
          {[['Membership fee', money(3000), C.ink], ['Paid', money(2000), C.emerald], ['Balance due', money(1000), C.rose]].map(([l, v, c]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, padding: '7px 0' }}>
              <span style={{ color: C.muted, fontWeight: 600 }}>{l}</span><b style={{ color: c }}>{v}</b>
            </div>
          ))}
        </Card>
      </div>
    </FeatureScene>
  );
};

/* ── 6. Analytics ──────────────────────────────────────────────────── */
export const Analytics = (p: SceneProps) => (
  <FeatureScene {...p} kicker="Analytics" title="Know your busy hours."
    subtitle="Daily attendance trends and peak check-in times, so you staff the floor when it's actually full.">
    <Panel icon={BarChart3} title="Peak hours" right={<Pill {...ok}>Busiest: 7 PM</Pill>}>
      <Bars highlightLast={false} height={300} data={[
        { label: '6a', value: 22 }, { label: '8a', value: 35 }, { label: '10a', value: 14 }, { label: '12p', value: 9 },
        { label: '2p', value: 11 }, { label: '4p', value: 26 }, { label: '6p', value: 48 }, { label: '7p', value: 61 },
        { label: '8p', value: 52 }, { label: '10p', value: 18 },
      ]} />
    </Panel>
  </FeatureScene>
);

/* ── 7. Membership plans ───────────────────────────────────────────── */
export const PlansScene = (p: SceneProps) => {
  const plans = [
    { name: 'Monthly', days: '30 days', price: 3000 },
    { name: 'Quarterly', days: '90 days', price: 8000 },
    { name: 'Half-year', days: '180 days', price: 15000 },
    { name: 'Yearly', days: '365 days', price: 28000 },
  ];
  return (
    <FeatureScene {...p} kicker="Membership Plans" title="Sell what you want."
      subtitle="Your own plans, your own prices and durations. Change a price anytime — past members keep what they paid.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, width: 860 }}>
        {plans.map((pl, i) => <PlanCard key={pl.name} {...pl} delay={10 + i * 7} hot={i === 1} />)}
      </div>
    </FeatureScene>
  );
};

const PlanCard = ({ name, days, price, delay, hot }: { name: string; days: string; price: number; delay: number; hot: boolean }) => {
  const p = useEnter(delay);
  return (
    <Card style={{ padding: 32, opacity: p, transform: `translateY(${(1 - p) * 50}px)`, border: hot ? `3px solid ${C.blue}` : `1px solid ${C.line}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Tag color={C.blue} size={26} /><span style={{ fontSize: 26, fontWeight: 800, color: C.ink }}>{name}</span>
      </div>
      <div style={{ fontSize: 46, fontWeight: 800, color: C.ink, marginTop: 12 }}>{money(price)}</div>
      <div style={{ fontSize: 20, color: C.muted }}>{days}</div>
    </Card>
  );
};

/* ── 8. Payments & receipts ────────────────────────────────────────── */
export const Payments = (p: SceneProps) => (
  <FeatureScene {...p} kicker="Payments" title="Every rupee recorded."
    subtitle="Cash at the counter or JazzCash and EasyPaisa online, with a printable receipt for every payment.">
    <div style={{ position: 'relative' }}>
      <Panel icon={CreditCard} title="Payments">
        <Rows rows={[
          { title: 'Ali Khan', sub: 'Monthly renewal · 16 Oct', avatar: '#2563eb', right: <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Pill>Cash</Pill><b style={{ fontSize: 24 }}>{money(3000)}</b></div> },
          { title: 'Sara Ahmed', sub: 'Quarterly · 15 Oct', avatar: '#7c3aed', right: <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Pill {...violet}>JazzCash</Pill><b style={{ fontSize: 24 }}>{money(8000)}</b></div> },
          { title: 'Bilal Raza', sub: 'Yearly · 14 Oct', avatar: '#059669', right: <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Pill {...ok}>EasyPaisa</Pill><b style={{ fontSize: 24 }}>{money(28000)}</b></div> },
          { title: 'Usman Tariq', sub: 'Monthly · due', avatar: '#d97706', right: <StatusBadge status="due" /> },
        ]} />
      </Panel>
      <Floater delay={55} style={{ right: -60, bottom: -60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, fontWeight: 700, color: C.ink }}>
          <Receipt color={C.emerald} size={30} /> Receipt #1042 printed
        </div>
      </Floater>
    </div>
  </FeatureScene>
);

/* ── 9. Monthly collection ─────────────────────────────────────────── */
export const Collection = (p: SceneProps) => (
  <FeatureScene {...p} kicker="Monthly Collection" title="The month, in one sheet."
    subtitle="Every member's fee record for any month — paid, partly paid or due — and export it all to Excel in one click.">
    <Panel icon={CalendarRange} title="October 2026" right={<Button delay={50} icon={FileSpreadsheet}>Export CSV</Button>}>
      <Stats items={[
        { label: 'Collected', value: 485000, color: C.emerald, prefix: 'Rs ' },
        { label: 'Pending', value: 41500, color: C.rose, prefix: 'Rs ' },
        { label: 'Members paid', value: '231 / 248', color: C.ink },
      ]} />
      <Bars data={[
        { label: 'May', value: 312 }, { label: 'Jun', value: 348 }, { label: 'Jul', value: 365 },
        { label: 'Aug', value: 402 }, { label: 'Sep', value: 441 }, { label: 'Oct', value: 485 },
      ]} height={200} start={26} />
    </Panel>
  </FeatureScene>
);

/* ── 10. Expenses ──────────────────────────────────────────────────── */
export const Expenses = (p: SceneProps) => (
  <FeatureScene {...p} kicker="Expenses" title="Know what's going out."
    subtitle="Rent, salaries, electricity and equipment — log them once and see what the gym really earns.">
    <Panel icon={Wallet} title="Expenses · October">
      <Stats items={[
        { label: 'Income', value: 485000, color: C.emerald, prefix: 'Rs ' },
        { label: 'Expenses', value: 212000, color: C.rose, prefix: 'Rs ' },
        { label: 'Profit', value: 273000, color: C.blue, prefix: 'Rs ' },
      ]} />
      <Rows start={30} rows={[
        { title: 'Rent', sub: 'Building · 1 Oct', right: <b style={{ fontSize: 24, color: C.rose }}>{money(120000)}</b> },
        { title: 'Staff salaries', sub: 'Payroll · 1 Oct', right: <b style={{ fontSize: 24, color: C.rose }}>{money(65000)}</b> },
        { title: 'Electricity', sub: 'Utilities · 12 Oct', right: <b style={{ fontSize: 24, color: C.rose }}>{money(27000)}</b> },
      ]} />
    </Panel>
  </FeatureScene>
);

/* ── 11. Supplements ───────────────────────────────────────────────── */
export const Supplements = (p: SceneProps) => (
  <FeatureScene {...p} kicker="Supplements" title="Sell from the shelf."
    subtitle="Track protein, creatine and pre-workout stock, sell at the counter and see every sale by date.">
    <Panel icon={FlaskConical} title="Supplements" right={<Pill {...ok}>Sales today: Rs 18,500</Pill>}>
      <Rows rows={[
        { title: 'Whey Protein 2 lb', sub: 'Stock: 14', icon: FlaskConical, right: <b style={{ fontSize: 24 }}>{money(9500)}</b> },
        { title: 'Creatine 300 g', sub: 'Stock: 22', icon: FlaskConical, right: <b style={{ fontSize: 24 }}>{money(4500)}</b> },
        { title: 'Pre-workout', sub: 'Stock: 3 · running low', icon: FlaskConical, right: <Pill {...warn}>Low stock</Pill> },
        { title: 'Mass Gainer 6 lb', sub: 'Stock: 8', icon: FlaskConical, right: <b style={{ fontSize: 24 }}>{money(12000)}</b> },
      ]} />
    </Panel>
  </FeatureScene>
);

/* ── 12. Trainers & PT ─────────────────────────────────────────────── */
export const Trainers = (p: SceneProps) => (
  <FeatureScene {...p} kicker="Trainers & PT" title="Personal training, organised."
    subtitle="Add trainers, book 1-on-1 PT sessions, assign clients and track every trainer's payout.">
    <Panel icon={Award} title="Personal Training">
      <Rows rows={[
        { title: 'Coach Hamza', sub: '12 clients · 38 sessions this month', avatar: '#0891b2', right: <b style={{ fontSize: 24, color: C.emerald }}>Payout {money(42000)}</b> },
        { title: 'Coach Ayesha', sub: '9 clients · 27 sessions this month', avatar: '#db2777', right: <b style={{ fontSize: 24, color: C.emerald }}>Payout {money(31500)}</b> },
        { title: 'PT: Ali Khan × Hamza', sub: 'Today · 6:00 PM', icon: Calendar, right: <Pill>Booked</Pill> },
      ]} />
    </Panel>
  </FeatureScene>
);

/* ── 13. Classes ───────────────────────────────────────────────────── */
export const Classes = (p: SceneProps) => {
  const slots = [
    { d: 'Mon', c: 'Zumba', t: '7:00 PM', seats: '14/20' },
    { d: 'Tue', c: 'CrossFit', t: '6:30 AM', seats: '18/18' },
    { d: 'Wed', c: 'Yoga', t: '8:00 AM', seats: '9/15' },
    { d: 'Thu', c: 'HIIT', t: '7:00 PM', seats: '16/20' },
    { d: 'Fri', c: 'Boxing', t: '6:00 PM', seats: '11/12' },
    { d: 'Sat', c: 'Spin', t: '9:00 AM', seats: '7/16' },
  ];
  return (
    <FeatureScene {...p} kicker="Classes" title="A timetable that fills itself."
      subtitle="Weekly repeating group classes with seat limits. Members book their own seats from their phone.">
      <Panel icon={Calendar} title="Group classes · this week">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {slots.map((s, i) => <Slot key={s.d} {...s} delay={16 + i * 5} />)}
        </div>
      </Panel>
    </FeatureScene>
  );
};

const Slot = ({ d, c, t, seats, delay }: { d: string; c: string; t: string; seats: string; delay: number }) => {
  const p = useEnter(delay);
  const full = seats.split('/')[0] === seats.split('/')[1];
  return (
    <div style={{ padding: 20, borderRadius: 18, background: C.bg, opacity: p, transform: `scale(${0.85 + p * 0.15})` }}>
      <div style={{ fontSize: 18, color: C.muted, fontWeight: 700 }}>{d} · {t}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: C.ink, margin: '6px 0 10px' }}>{c}</div>
      <Pill {...(full ? bad : ok)}>{full ? 'Full' : `${seats} seats`}</Pill>
    </div>
  );
};

/* ── 14. Workout & diet plans ──────────────────────────────────────── */
export const WorkoutDiet = (p: SceneProps) => (
  <FeatureScene {...p} kicker="Workout & Diet" title="Plans members actually follow."
    subtitle="Build weekly workout and diet plans and assign them to members — they see them in their own app.">
    <Panel icon={ClipboardList} title="Plan: Muscle Gain · Week 1" right={<Pill>Assigned to 18</Pill>}>
      <Rows rows={[
        { title: 'Monday — Chest & Triceps', sub: 'Bench 4×10 · Incline 3×12 · Dips 3×12', icon: Dumbbell },
        { title: 'Tuesday — Back & Biceps', sub: 'Deadlift 4×6 · Rows 4×10 · Curls 3×12', icon: Dumbbell },
        { title: 'Breakfast', sub: '4 eggs · oats · banana · milk', icon: ClipboardList },
        { title: 'Post-workout', sub: 'Whey shake · rice · chicken', icon: ClipboardList },
      ]} />
    </Panel>
  </FeatureScene>
);

/* ── 15. Fitness calculator & AI coach ─────────────────────────────── */
export const Calculator_ = (p: SceneProps) => (
  <FeatureScene {...p} kicker="Fitness Calculator" title="A coach in your pocket."
    subtitle="Calories, protein and mass-gainer servings from a member's weight and goal, exercise photo guides, and an AI chat coach.">
    <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
      <Panel icon={Calculator} title="Daily target" width={500}>
        <Stats items={[{ label: 'Calories', value: 3150, color: C.blue }, { label: 'Protein', value: '160 g', color: C.emerald }]} />
        <Rows start={30} rows={[
          { title: 'Weight', right: <b style={{ fontSize: 22 }}>72 kg</b> },
          { title: 'Goal', right: <Pill>Bulk</Pill> },
          { title: 'Mass gainer', right: <b style={{ fontSize: 22 }}>2 scoops / day</b> },
        ]} />
      </Panel>
      <AiChat />
    </div>
  </FeatureScene>
);

const AiChat = () => {
  const q = useEnter(30);
  const a = useEnter(55);
  return (
    <Card style={{ width: 430, padding: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, fontWeight: 800, color: C.ink, marginBottom: 16 }}>
        <Bot color={C.blue} size={28} /> AI Coach
      </div>
      <div style={{ alignSelf: 'flex-end', marginLeft: 60, background: C.blue, color: C.white, padding: '14px 18px', borderRadius: '20px 20px 6px 20px', fontSize: 20, opacity: q }}>
        How do I grow my chest faster?
      </div>
      <div style={{ marginTop: 14, marginRight: 30, background: C.bg, color: C.ink, padding: '14px 18px', borderRadius: '20px 20px 20px 6px', fontSize: 20, lineHeight: 1.4, opacity: a }}>
        Train chest twice a week, add weight every session and eat 1.6 g protein per kg.
      </div>
    </Card>
  );
};

/* ── 16. WhatsApp & email ──────────────────────────────────────────── */
export const Reminders = (p: SceneProps) => {
  const a = useEnter(16);
  const b = useEnter(42);
  const bubble = (op: number) => ({
    background: C.white, borderRadius: '6px 22px 22px 22px', padding: '16px 20px', fontSize: 21, lineHeight: 1.45,
    color: C.ink, opacity: op, transform: `translateY(${(1 - op) * 24}px)`, boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
  });
  return (
    <FeatureScene {...p} kicker="Reminders" title="Reminders that send themselves."
      subtitle="Expiry reminders, welcome messages and receipts go out on WhatsApp and email — or send one yourself in a tap.">
      <div style={{ position: 'relative' }}>
        <Card style={{ width: 560, overflow: 'hidden', padding: 0 }}>
          <div style={{ background: C.whatsappDark, color: C.white, padding: '22px 26px', fontSize: 24, fontWeight: 700 }}>Iron Strong Fitness</div>
          <div style={{ background: '#efeae2', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 360 }}>
            <div style={bubble(a)}>Assalam o Alaikum <b>Ali</b>! 👋 Your membership expires on <b>12 Nov</b>. Renew to keep training.</div>
            <div style={bubble(b)}>✅ Payment received: <b>Rs 3,000</b>. Valid until <b>12 Dec</b>. Thank you!</div>
          </div>
        </Card>
        <Floater delay={60} style={{ right: -120, bottom: -40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, fontWeight: 700, color: C.ink }}>
            <Mail color={C.blue} size={28} /> Email reminder sent
          </div>
        </Floater>
      </div>
    </FeatureScene>
  );
};

/* ── 17. Member portal ─────────────────────────────────────────────── */
export const Portal = (p: SceneProps) => {
  const ph = useEnter(8);
  return (
    <FeatureScene {...p} kicker="Member App" title="Members get their own app."
      subtitle="Members log in to see their membership, history and plans, show their check-in code and book classes.">
      <div style={{
        width: 420, height: 820, borderRadius: 56, background: '#0b0f19', padding: 14, opacity: ph,
        transform: `translateY(${(1 - ph) * 100}px)`, boxShadow: '0 40px 100px rgba(15,23,42,0.35)',
      }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 44, background: C.white, padding: '44px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 800, color: C.ink }}>
            <User color={C.blue} size={28} /> My Membership
          </div>
          <div style={{ background: C.emeraldSoft, borderRadius: 20, padding: 18 }}>
            <div style={{ fontSize: 18, color: C.emerald, fontWeight: 700 }}>Active · Monthly</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.ink }}>27 days left</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: C.bg, borderRadius: 20, padding: 16 }}>
            <QrCode size={170} color={C.ink} strokeWidth={1.3} />
            <div style={{ fontSize: 17, color: C.muted, fontWeight: 600 }}>Show at the door</div>
          </div>
          <div style={{ background: C.blueSoft, borderRadius: 20, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 18, color: C.blueDark, fontWeight: 700 }}>Zumba · Mon 7 PM</div>
              <div style={{ fontSize: 16, color: C.muted }}>6 seats left</div>
            </div>
            <Pill color={C.white} bg={C.blue}>Book</Pill>
          </div>
        </div>
      </div>
    </FeatureScene>
  );
};

/* ── 18. Staff & permissions ───────────────────────────────────────── */
export const Staff = (p: SceneProps) => (
  <FeatureScene {...p} kicker="Staff & Logins" title="The right access for everyone."
    subtitle="Invite receptionists and trainers with their own login, and choose exactly what each one can see and do.">
    <Panel icon={UserCog} title="Staff & Logins" right={<Pill>+ Invite staff</Pill>}>
      <Rows rows={[
        { title: 'Faisal Ghafoor', sub: 'Owner · full access', avatar: '#0f172a', right: <Pill {...violet}>Owner</Pill> },
        { title: 'Zainab (Front desk)', sub: 'Members · Attendance · Payments', avatar: '#2563eb', right: <Pill>Staff</Pill> },
        { title: 'Coach Hamza', sub: 'Members · Plans · Classes', avatar: '#0891b2', right: <Pill>Staff</Pill> },
        { title: 'Ali Khan', sub: 'Member login', avatar: '#059669', right: <Pill {...ok}>Member</Pill> },
      ]} />
    </Panel>
  </FeatureScene>
);

/* ── 19. Security & audit ──────────────────────────────────────────── */
export const Security = (p: SceneProps) => (
  <FeatureScene {...p} kicker="Security" title="Safe, and fully traceable."
    subtitle="Two-factor login with backup codes, and an audit log of who changed what, and when.">
    <div style={{ display: 'flex', gap: 26, alignItems: 'flex-start' }}>
      <Panel icon={ShieldCheck} title="Two-factor" width={380}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '10px 0 18px' }}>
          {'482913'.split('').map((d, i) => <Digit key={i} d={d} delay={18 + i * 4} />)}
        </div>
        <Pill {...ok}><KeyRound size={20} /> 2FA enabled</Pill>
      </Panel>
      <Panel icon={ScrollText} title="Audit log" width={560}>
        <Rows start={24} rows={[
          { title: 'Zainab renewed Ali Khan', sub: 'Today · 10:14 AM' },
          { title: 'Owner changed Monthly price', sub: 'Yesterday · 6:02 PM' },
          { title: 'Hamza deleted a PT session', sub: '14 Oct · 8:40 PM' },
        ]} />
      </Panel>
    </div>
  </FeatureScene>
);

const Digit = ({ d, delay }: { d: string; delay: number }) => {
  const p = useEnter(delay);
  return (
    <div style={{ width: 44, height: 58, borderRadius: 12, border: `2px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: C.ink, opacity: p }}>
      {d}
    </div>
  );
};

/* ── 20. Desktop, mobile, offline, dark mode ───────────────────────── */
export const Anywhere = (p: SceneProps) => {
  const items = [
    { icon: Smartphone, title: 'Open on any phone', sub: 'Same Wi-Fi as the gym PC' },
    { icon: Download, title: 'Install as an app', sub: 'Desktop app or phone home screen' },
    { icon: WifiOff, title: 'Keeps working offline', sub: 'Runs on your own PC' },
    { icon: Moon, title: 'Light & dark mode', sub: 'Easy on the eyes at night' },
  ];
  return (
    <FeatureScene {...p} kicker="Anywhere" title="Desk, phone, day or night."
      subtitle="A desktop app for the front desk that every phone in the gym can open — installable, offline-ready, with dark mode.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, width: 900 }}>
        {items.map((it, i) => <Tile key={it.title} {...it} delay={10 + i * 7} dark={i === 3} />)}
      </div>
    </FeatureScene>
  );
};

const Tile = ({ icon: I, title, sub, delay, dark }: { icon: typeof Moon; title: string; sub: string; delay: number; dark: boolean }) => {
  const p = useEnter(delay);
  return (
    <Card style={{ padding: 32, opacity: p, transform: `translateY(${(1 - p) * 50}px)`, background: dark ? C.ink : C.white, border: dark ? 'none' : `1px solid ${C.line}` }}>
      <I size={44} color={dark ? '#93c5fd' : C.blue} />
      <div style={{ fontSize: 30, fontWeight: 800, color: dark ? C.white : C.ink, marginTop: 14 }}>{title}</div>
      <div style={{ fontSize: 21, color: dark ? '#94a3b8' : C.muted }}>{sub}</div>
    </Card>
  );
};
