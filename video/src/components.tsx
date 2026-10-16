import type { CSSProperties, ReactNode } from 'react';
import {
  AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';
import { C, FONT } from './theme';

/** 0 → 1 spring that starts `delay` frames into the current sequence. */
export const useEnter = (delay = 0, damping = 16) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.8 } });
};

/** Fades a scene in and out at its edges so cuts never pop. */
export const SceneFrame = ({
  children, duration, background = C.bg,
}: { children: ReactNode; duration: number; background?: string }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12, duration - 12, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [0, duration], [1.02, 1], { easing: Easing.out(Easing.quad) });
  return (
    <AbsoluteFill style={{ background, fontFamily: FONT, opacity }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Left-hand headline block every feature scene uses. */
export const Caption = ({
  kicker, title, subtitle,
}: { kicker: string; title: string; subtitle: string }) => {
  const a = useEnter(4);
  const b = useEnter(10);
  const c = useEnter(16);
  const rise = (p: number): CSSProperties => ({
    opacity: p, transform: `translateY(${(1 - p) * 30}px)`,
  });
  return (
    <div style={{ width: 640, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{
        ...rise(a), alignSelf: 'flex-start', padding: '8px 18px', borderRadius: 999,
        background: C.blueSoft, color: C.blueDark, fontSize: 24, fontWeight: 700,
        letterSpacing: 1, textTransform: 'uppercase',
      }}>
        {kicker}
      </div>
      <div style={{ ...rise(b), fontSize: 76, lineHeight: 1.05, fontWeight: 800, color: C.ink, letterSpacing: -2 }}>
        {title}
      </div>
      <div style={{ ...rise(c), fontSize: 32, lineHeight: 1.4, color: C.muted, fontWeight: 500 }}>
        {subtitle}
      </div>
    </div>
  );
};

/** Caption on the left, product UI on the right. */
export const FeatureLayout = ({ caption, children }: { caption: ReactNode; children: ReactNode }) => (
  <AbsoluteFill style={{
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 130px',
  }}>
    {caption}
    <div style={{ width: 980, display: 'flex', justifyContent: 'center' }}>{children}</div>
  </AbsoluteFill>
);

export const Card = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{
    background: C.white, borderRadius: 28, border: `1px solid ${C.line}`,
    boxShadow: '0 30px 80px rgba(15, 23, 42, 0.12)', ...style,
  }}>
    {children}
  </div>
);

const BADGE: Record<string, { bg: string; fg: string; dot: string }> = {
  active: { bg: C.emeraldSoft, fg: C.emerald, dot: '#10b981' },
  expiring: { bg: C.amberSoft, fg: C.amber, dot: '#f59e0b' },
  expired: { bg: C.roseSoft, fg: C.rose, dot: '#f43f5e' },
  lapsed: { bg: C.slateSoft, fg: C.muted, dot: '#94a3b8' },
  paid: { bg: C.emeraldSoft, fg: C.emerald, dot: '#10b981' },
  due: { bg: C.roseSoft, fg: C.rose, dot: '#f43f5e' },
};

/** Mirrors frontend/src/components/Badge.tsx. */
export const StatusBadge = ({ status }: { status: string }) => {
  const s = BADGE[status] ?? BADGE.lapsed;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px',
      borderRadius: 999, background: s.bg, color: s.fg, fontSize: 20, fontWeight: 700,
      textTransform: 'capitalize',
    }}>
      <span style={{ width: 9, height: 9, borderRadius: 9, background: s.dot }} />
      {status}
    </span>
  );
};

export const Avatar = ({ name, color }: { name: string; color: string }) => (
  <div style={{
    width: 56, height: 56, borderRadius: 18, background: color, color: C.white,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, fontWeight: 800, flexShrink: 0,
  }}>
    {name.split(' ').filter((p) => /^[A-Za-z]/.test(p)).map((p) => p[0]).join('').slice(0, 2)}
  </div>
);
