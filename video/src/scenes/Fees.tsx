import { interpolate, useCurrentFrame } from 'remotion';
import { TrendingUp, Wallet } from 'lucide-react';
import { Caption, Card, FeatureLayout, SceneFrame, useEnter } from '../components';
import { C, money } from '../theme';

const MONTHS = [
  { m: 'May', v: 312000 },
  { m: 'Jun', v: 348000 },
  { m: 'Jul', v: 365000 },
  { m: 'Aug', v: 402000 },
  { m: 'Sep', v: 441000 },
  { m: 'Oct', v: 485000 },
];
const MAX = 500000;

const Bar = ({ m, v, i }: { m: string; v: number; i: number }) => {
  const p = useEnter(20 + i * 6, 14);
  const last = i === MONTHS.length - 1;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ height: 300, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
        <div style={{
          width: '100%', height: `${(v / MAX) * 100 * p}%`, borderRadius: 14,
          background: last ? C.blue : '#bfdbfe',
        }} />
      </div>
      <div style={{ fontSize: 22, color: last ? C.ink : C.muted, fontWeight: 700 }}>{m}</div>
    </div>
  );
};

const Split = ({ label, value, color, delay }: { label: string; value: number; color: string; delay: number }) => {
  const p = useEnter(delay);
  return (
    <div style={{ flex: 1, padding: '18px 22px', borderRadius: 20, background: C.bg, opacity: p }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, color: C.muted, fontWeight: 600 }}>
        <span style={{ width: 12, height: 12, borderRadius: 12, background: color }} /> {label}
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, color: C.ink }}>{money(value)}</div>
    </div>
  );
};

export const Fees = ({ duration }: { duration: number }) => {
  const frame = useCurrentFrame();
  const card = useEnter(6);
  const total = interpolate(frame, [12, 70], [0, 485000], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return (
    <SceneFrame duration={duration}>
      <FeatureLayout
        caption={
          <Caption
            kicker="Fees"
            title="Know what came in."
            subtitle="Cash at the counter or JazzCash and EasyPaisa online. Every rupee lands in the monthly collection."
          />
        }
      >
        <Card style={{ width: 900, padding: 40, opacity: card, transform: `translateY(${(1 - card) * 80}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: C.muted, fontSize: 24, fontWeight: 700 }}>
            <Wallet size={30} color={C.blue} /> October collection
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, margin: '8px 0 24px' }}>
            <div style={{ fontSize: 80, fontWeight: 800, color: C.ink, letterSpacing: -2 }}>{money(total)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.emerald, fontSize: 26, fontWeight: 800 }}>
              <TrendingUp size={28} /> +10%
            </div>
          </div>
          <div style={{ display: 'flex', gap: 22, marginBottom: 26 }}>
            {MONTHS.map((x, i) => <Bar key={x.m} m={x.m} v={x.v} i={i} />)}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Split label="Cash" value={318000} color={C.blue} delay={56} />
            <Split label="Online" value={167000} color="#7c3aed" delay={62} />
          </div>
        </Card>
      </FeatureLayout>
    </SceneFrame>
  );
};
