import { interpolate, useCurrentFrame } from 'remotion';
import { CheckCircle2, Fingerprint } from 'lucide-react';
import { Avatar, Caption, Card, FeatureLayout, SceneFrame, StatusBadge, useEnter } from '../components';
import { C, money } from '../theme';

/** Frame (within the scene) at which the scan "matches" and the result shows. */
const MATCH_AT = 62;

const Scanner = () => {
  const frame = useCurrentFrame();
  const p = useEnter(6);
  const scanY = interpolate(frame % 40, [0, 40], [-90, 90]);
  const done = frame >= MATCH_AT;
  const ring = (offset: number) => {
    const t = ((frame + offset) % 45) / 45;
    return (
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: `4px solid ${done ? C.emerald : C.blue}`,
        transform: `scale(${1 + t * 0.6})`, opacity: done ? 0 : 1 - t,
      }} />
    );
  };
  return (
    <div style={{
      position: 'relative', width: 320, height: 320, opacity: p,
      transform: `scale(${0.7 + p * 0.3})`,
    }}>
      {ring(0)}
      {ring(22)}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden',
        background: done ? C.emeraldSoft : C.blueSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Fingerprint size={180} color={done ? C.emerald : C.blue} strokeWidth={1.4} />
        {!done && (
          <div style={{
            position: 'absolute', left: 40, right: 40, height: 6, borderRadius: 6,
            background: C.blue, boxShadow: `0 0 30px ${C.blue}`,
            transform: `translateY(${scanY}px)`,
          }} />
        )}
      </div>
    </div>
  );
};

const FeeLine = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, padding: '10px 0' }}>
    <span style={{ color: C.muted, fontWeight: 600 }}>{label}</span>
    <span style={{ color, fontWeight: 800 }}>{value}</span>
  </div>
);

/** Mirrors the check-in result modal, including the fee summary. */
const Result = () => {
  const p = useEnter(MATCH_AT);
  return (
    <Card style={{
      width: 620, padding: 40, opacity: p,
      transform: `translateY(${(1 - p) * 60}px) scale(${0.92 + p * 0.08})`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: C.emerald, fontSize: 28, fontWeight: 800 }}>
        <CheckCircle2 size={36} /> Checked in · 7:42 AM
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, margin: '28px 0' }}>
        <Avatar name="Ali Khan" color={C.blue} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: C.ink }}>Ali Khan</div>
          <div style={{ fontSize: 22, color: C.muted }}>#0142 · Monthly · until 12 Nov</div>
        </div>
        <StatusBadge status="active" />
      </div>
      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
        <FeeLine label="Membership fee" value={money(3000)} color={C.ink} />
        <FeeLine label="Paid" value={money(2000)} color={C.emerald} />
        <FeeLine label="Balance due" value={money(1000)} color={C.rose} />
      </div>
    </Card>
  );
};

export const CheckIn = ({ duration }: { duration: number }) => (
  <SceneFrame duration={duration}>
    <FeatureLayout
      caption={
        <Caption
          kicker="Attendance"
          title="One touch at the door."
          subtitle="Fingerprint check-in finds the member in a second and shows the front desk any fee still owed."
        />
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 50 }}>
        <Scanner />
        <Result />
      </div>
    </FeatureLayout>
  </SceneFrame>
);
