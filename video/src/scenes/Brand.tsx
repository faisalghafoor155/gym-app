import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Dumbbell } from 'lucide-react';
import { SceneFrame, useEnter } from '../components';
import { C } from '../theme';

const DARK_BG = `radial-gradient(circle at 30% 20%, #1e3a8a 0%, ${C.ink} 55%, #020617 100%)`;

const Logo = ({ size }: { size: number }) => {
  const p = useEnter(0, 12);
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, background: C.blue,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 30px 90px rgba(37, 99, 235, 0.55)',
      transform: `scale(${p}) rotate(${(1 - p) * -25}deg)`,
    }}>
      <Dumbbell color={C.white} size={size * 0.55} strokeWidth={2.4} />
    </div>
  );
};

export const Intro = ({ duration }: { duration: number }) => {
  const title = useEnter(8);
  const tag = useEnter(18);
  const chips = ['Members', 'Attendance', 'Fees', 'WhatsApp'];
  return (
    <SceneFrame duration={duration} background={DARK_BG}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 40 }}>
        <Logo size={170} />
        <div style={{
          fontSize: 140, fontWeight: 800, color: C.white, letterSpacing: -5,
          opacity: title, transform: `translateY(${(1 - title) * 40}px)`,
        }}>
          GymPro
        </div>
        <div style={{
          fontSize: 40, color: '#cbd5e1', fontWeight: 500, marginTop: -20,
          opacity: tag, transform: `translateY(${(1 - tag) * 20}px)`,
        }}>
          Run your whole gym from one place
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
          {chips.map((c, i) => <Chip key={c} label={c} delay={28 + i * 5} />)}
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};

const Chip = ({ label, delay }: { label: string; delay: number }) => {
  const p = useEnter(delay);
  return (
    <div style={{
      padding: '12px 28px', borderRadius: 999, border: '1px solid rgba(148,163,184,0.35)',
      background: 'rgba(30, 41, 59, 0.6)', color: C.white, fontSize: 28, fontWeight: 600,
      opacity: p, transform: `scale(${0.8 + p * 0.2})`,
    }}>
      {label}
    </div>
  );
};

export const Outro = ({
  duration, line = 'Members · Fingerprint check-in · Fees · WhatsApp reminders',
}: { duration: number; line?: string }) => {
  const frame = useCurrentFrame();
  const title = useEnter(8);
  const lineIn = useEnter(16);
  const cta = useEnter(26);
  const glow = interpolate(Math.sin(frame / 8), [-1, 1], [0.35, 0.7]);
  return (
    <SceneFrame duration={duration} background={DARK_BG}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 36 }}>
        <Logo size={130} />
        <div style={{
          fontSize: 96, fontWeight: 800, color: C.white, letterSpacing: -3, textAlign: 'center',
          opacity: title, transform: `translateY(${(1 - title) * 30}px)`,
        }}>
          Less paperwork. More training.
        </div>
        <div style={{ fontSize: 38, color: '#cbd5e1', opacity: lineIn }}>
          {line}
        </div>
        <div style={{
          marginTop: 20, padding: '24px 56px', borderRadius: 22, background: C.blue,
          color: C.white, fontSize: 40, fontWeight: 800, opacity: cta,
          transform: `scale(${0.85 + cta * 0.15})`,
          boxShadow: `0 20px 70px rgba(37, 99, 235, ${glow})`,
        }}>
          Start with GymPro today
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
