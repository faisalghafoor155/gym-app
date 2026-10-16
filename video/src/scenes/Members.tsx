import { interpolate, useCurrentFrame } from 'remotion';
import { Search, Users } from 'lucide-react';
import { Avatar, Caption, Card, FeatureLayout, SceneFrame, StatusBadge, useEnter } from '../components';
import { C } from '../theme';

const MEMBERS = [
  { name: 'Ali Khan', plan: 'Monthly', until: 'Expires 12 Nov', status: 'active', color: '#2563eb' },
  { name: 'Sara Ahmed', plan: 'Quarterly', until: 'Expires 3 Jan', status: 'active', color: '#7c3aed' },
  { name: 'Usman Tariq', plan: 'Monthly', until: 'Expires in 3 days', status: 'expiring', color: '#d97706' },
  { name: 'Hina Malik', plan: 'Monthly', until: 'Expired 6 days ago', status: 'expired', color: '#e11d48' },
  { name: 'Bilal Raza', plan: 'Yearly', until: 'Expires 20 Aug', status: 'active', color: '#059669' },
];

const Stat = ({ label, value, color, delay }: { label: string; value: number; color: string; delay: number }) => {
  const frame = useCurrentFrame();
  const p = useEnter(delay);
  const n = interpolate(frame, [delay, delay + 40], [0, value], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return (
    <div style={{
      flex: 1, padding: '18px 22px', borderRadius: 20, background: C.bg, opacity: p,
    }}>
      <div style={{ fontSize: 20, color: C.muted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 44, fontWeight: 800, color }}>{Math.round(n)}</div>
    </div>
  );
};

const Row = ({ m, delay }: { m: (typeof MEMBERS)[number]; delay: number }) => {
  const p = useEnter(delay);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 20, padding: '16px 8px',
      borderTop: `1px solid ${C.line}`, opacity: p, transform: `translateX(${(1 - p) * 60}px)`,
    }}>
      <Avatar name={m.name} color={m.color} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: C.ink }}>{m.name}</div>
        <div style={{ fontSize: 20, color: C.muted }}>{m.plan} · {m.until}</div>
      </div>
      <StatusBadge status={m.status} />
    </div>
  );
};

export const Members = ({ duration }: { duration: number }) => {
  const card = useEnter(6);
  return (
    <SceneFrame duration={duration}>
      <FeatureLayout
        caption={
          <Caption
            kicker="Members"
            title="Every member, one glance."
            subtitle="Plans, expiry dates and dues side by side. Expiring and expired members stand out so nobody slips through."
          />
        }
      >
        <Card style={{
          width: 900, padding: 40, opacity: card,
          transform: `translateY(${(1 - card) * 80}px)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <Users color={C.blue} size={36} />
            <div style={{ fontSize: 36, fontWeight: 800, color: C.ink, flex: 1 }}>Members</div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
              borderRadius: 16, background: C.bg, color: C.muted, fontSize: 20, width: 300,
            }}>
              <Search size={22} /> Search name or phone
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <Stat label="Active" value={248} color={C.emerald} delay={14} />
            <Stat label="Expiring" value={12} color={C.amber} delay={18} />
            <Stat label="Expired" value={9} color={C.rose} delay={22} />
          </div>
          {MEMBERS.map((m, i) => <Row key={m.name} m={m} delay={26 + i * 7} />)}
        </Card>
      </FeatureLayout>
    </SceneFrame>
  );
};
