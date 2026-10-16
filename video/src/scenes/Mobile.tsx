import { CalendarCheck, CreditCard, LayoutDashboard, Users, Wifi } from 'lucide-react';
import { Caption, FeatureLayout, SceneFrame, useEnter } from '../components';
import { C } from '../theme';

const Tile = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div style={{ background: C.bg, borderRadius: 14, padding: '12px 16px' }}>
    <div style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
  </div>
);

const Laptop = () => {
  const p = useEnter(6);
  return (
    <div style={{ opacity: p, transform: `translateX(${(1 - p) * -80}px)` }}>
      <div style={{ width: 640, height: 400, background: '#0b0f19', borderRadius: '24px 24px 0 0', padding: 14 }}>
        <div style={{ width: '100%', height: '100%', background: C.white, borderRadius: 12, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: 150, background: C.bg, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[LayoutDashboard, Users, CalendarCheck, CreditCard].map((I, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, color: i === 0 ? C.blue : C.muted }}>
                <I size={20} />
                <div style={{ height: 8, flex: 1, borderRadius: 8, background: i === 0 ? C.blueSoft : C.line }} />
              </div>
            ))}
          </div>
          <div style={{ flex: 1, padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignContent: 'start' }}>
            <Tile label="Checked in today" value="86" color={C.blue} />
            <Tile label="Active members" value="248" color={C.emerald} />
            <Tile label="Dues pending" value="Rs 41,500" color={C.rose} />
            <Tile label="This month" value="Rs 485k" color={C.ink} />
          </div>
        </div>
      </div>
      <div style={{ width: 720, height: 22, marginLeft: -40, background: '#cbd5e1', borderRadius: '0 0 20px 20px' }} />
    </div>
  );
};

const Phone = () => {
  const p = useEnter(18);
  return (
    <div style={{
      width: 250, height: 500, borderRadius: 40, background: '#0b0f19', padding: 10,
      marginLeft: -60, marginTop: 80, opacity: p, transform: `translateY(${(1 - p) * 100}px)`,
      boxShadow: '0 30px 80px rgba(15,23,42,0.35)',
    }}>
      <div style={{ width: '100%', height: '100%', background: C.white, borderRadius: 32, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: C.bg, margin: '34px 12px 12px', padding: '8px 12px', borderRadius: 12, fontSize: 14, color: C.muted, fontWeight: 600 }}>
          192.168.1.10:5000
        </div>
        <div style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Tile label="Checked in today" value="86" color={C.blue} />
          <Tile label="Dues pending" value="Rs 41,500" color={C.rose} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '14px 0', borderTop: `1px solid ${C.line}` }}>
          {[LayoutDashboard, Users, CalendarCheck, CreditCard].map((I, i) => (
            <I key={i} size={24} color={i === 0 ? C.blue : C.muted} />
          ))}
        </div>
      </div>
    </div>
  );
};

export const Mobile = ({ duration }: { duration: number }) => {
  const wifi = useEnter(34);
  return (
    <SceneFrame duration={duration}>
      <FeatureLayout
        caption={
          <Caption
            kicker="Desktop + Mobile"
            title="Runs on your gym PC."
            subtitle="Install it once at the front desk, then open it from any phone on the gym's Wi-Fi. No internet needed."
          />
        }
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start' }}>
          <Laptop />
          <Phone />
          <div style={{
            position: 'absolute', left: 560, top: -75, width: 90, height: 90, borderRadius: 90,
            background: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: wifi, transform: `scale(${wifi})`, boxShadow: '0 15px 40px rgba(37,99,235,0.45)',
          }}>
            <Wifi size={48} color={C.white} />
          </div>
        </div>
      </FeatureLayout>
    </SceneFrame>
  );
};
