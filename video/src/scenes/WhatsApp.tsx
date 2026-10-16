import type { ReactNode } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CheckCheck, Dumbbell } from 'lucide-react';
import { Caption, FeatureLayout, SceneFrame, useEnter } from '../components';
import { C } from '../theme';

const Bubble = ({ children, delay, time }: { children: ReactNode; delay: number; time: string }) => {
  const p = useEnter(delay);
  return (
    <div style={{
      alignSelf: 'flex-start', maxWidth: 400, background: C.white, borderRadius: '6px 22px 22px 22px',
      padding: '16px 20px 10px', fontSize: 21, lineHeight: 1.45, color: C.ink,
      boxShadow: '0 2px 4px rgba(0,0,0,0.08)', opacity: p,
      transform: `translateY(${(1 - p) * 30}px) scale(${0.9 + p * 0.1})`, transformOrigin: 'top left',
    }}>
      {children}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, fontSize: 15, color: C.muted, marginTop: 6 }}>
        {time} <CheckCheck size={18} color="#34b7f1" />
      </div>
    </div>
  );
};

/** Three bouncing dots shown until the first message arrives. */
const Typing = ({ until }: { until: number }) => {
  const frame = useCurrentFrame();
  if (frame >= until) return null;
  return (
    <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 8, background: C.white, padding: '18px 22px', borderRadius: 22 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 12, height: 12, borderRadius: 12, background: C.muted,
          transform: `translateY(${interpolate(Math.sin((frame - i * 4) / 3), [-1, 1], [-5, 5])}px)`,
        }} />
      ))}
    </div>
  );
};

const Phone = () => {
  const p = useEnter(4);
  return (
    <div style={{
      width: 500, height: 900, borderRadius: 64, background: '#0b0f19', padding: 16,
      boxShadow: '0 40px 100px rgba(15,23,42,0.35)', opacity: p,
      transform: `translateY(${(1 - p) * 120}px) rotate(${(1 - p) * 6}deg)`,
    }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 50, overflow: 'hidden', background: '#efeae2', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: C.whatsappDark, color: C.white, padding: '48px 24px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 54, height: 54, borderRadius: 54, background: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Dumbbell size={28} color={C.white} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>Iron Strong Fitness</div>
            <div style={{ fontSize: 17, opacity: 0.8 }}>online</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Typing until={30} />
          <Bubble delay={30} time="9:00 AM">
            Assalam o Alaikum <b>Ali</b>! 👋 Your membership expires on <b>12 Nov</b>.
            Renew at the counter or pay online to keep training.
          </Bubble>
          <Bubble delay={70} time="6:15 PM">
            ✅ Payment received: <b>Rs 3,000</b>. Your membership now runs until <b>12 Dec</b>. Thank you!
          </Bubble>
        </div>
      </div>
    </div>
  );
};

export const WhatsApp = ({ duration }: { duration: number }) => (
  <SceneFrame duration={duration}>
    <FeatureLayout
      caption={
        <Caption
          kicker="WhatsApp"
          title="Reminders that send themselves."
          subtitle="Expiry reminders and payment receipts go out on WhatsApp automatically, so members renew on time."
        />
      }
    >
      <Phone />
    </FeatureLayout>
  </SceneFrame>
);
