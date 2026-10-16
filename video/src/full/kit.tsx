import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Avatar, Caption, Card, SceneFrame, useEnter } from '../components';
import { C } from '../theme';

type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** One feature: numbered chapter tag, caption on the left, UI on the right. */
export const FeatureScene = ({
  duration, index, total, kicker, title, subtitle, children,
}: {
  duration: number; index: number; total: number;
  kicker: string; title: string; subtitle: string; children: ReactNode;
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, duration], [(index - 1) / total, index / total]);
  return (
    <SceneFrame duration={duration}>
      <AbsoluteFill style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '0 120px',
      }}>
        <Caption kicker={`${String(index).padStart(2, '0')} · ${kicker}`} title={title} subtitle={subtitle} />
        <div style={{ width: 1000, display: 'flex', justifyContent: 'center' }}>{children}</div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 8, width: `${progress * 100}%`, background: C.blue }} />
    </SceneFrame>
  );
};

/** A card that rises in, with an app-style header. */
export const Panel = ({
  icon: I, title, right, width = 900, children, style,
}: { icon: Icon; title: string; right?: ReactNode; width?: number; children: ReactNode; style?: CSSProperties }) => {
  const p = useEnter(6);
  return (
    <Card style={{ width, padding: 36, opacity: p, transform: `translateY(${(1 - p) * 80}px)`, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <I color={C.blue} size={34} />
        <div style={{ fontSize: 32, fontWeight: 800, color: C.ink, flex: 1 }}>{title}</div>
        {right}
      </div>
      {children}
    </Card>
  );
};

export interface RowData {
  title: string;
  sub?: string;
  right?: ReactNode;
  avatar?: string;
  icon?: Icon;
}

export const Rows = ({ rows, start = 22 }: { rows: RowData[]; start?: number }) => (
  <div>
    {rows.map((r, i) => <Row key={r.title + i} r={r} delay={start + i * 6} />)}
  </div>
);

const Row = ({ r, delay }: { r: RowData; delay: number }) => {
  const p = useEnter(delay);
  const I = r.icon;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 18, padding: '14px 6px', borderTop: `1px solid ${C.line}`,
      opacity: p, transform: `translateX(${(1 - p) * 50}px)`,
    }}>
      {r.avatar && <Avatar name={r.title} color={r.avatar} />}
      {I && (
        <div style={{ width: 56, height: 56, borderRadius: 18, background: C.blueSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <I size={28} color={C.blue} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 25, fontWeight: 700, color: C.ink }}>{r.title}</div>
        {r.sub && <div style={{ fontSize: 19, color: C.muted }}>{r.sub}</div>}
      </div>
      {r.right}
    </div>
  );
};

/** Plain value or a count-up when given a number. */
export const Stats = ({
  items, start = 14,
}: { items: { label: string; value: number | string; color: string; prefix?: string }[]; start?: number }) => (
  <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
    {items.map((s, i) => <Stat key={s.label} {...s} delay={start + i * 4} />)}
  </div>
);

const Stat = ({ label, value, color, prefix = '', delay }: {
  label: string; value: number | string; color: string; prefix?: string; delay: number;
}) => {
  const frame = useCurrentFrame();
  const p = useEnter(delay);
  const shown = typeof value === 'number'
    ? Math.round(interpolate(frame, [delay, delay + 35], [0, value], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })).toLocaleString('en-US')
    : value;
  return (
    <div style={{ flex: 1, padding: '16px 20px', borderRadius: 18, background: C.bg, opacity: p }}>
      <div style={{ fontSize: 19, color: C.muted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 38, fontWeight: 800, color }}>{prefix}{shown}</div>
    </div>
  );
};

export const Bars = ({
  data, height = 260, highlightLast = true, start = 20,
}: { data: { label: string; value: number }[]; height?: number; highlightLast?: boolean; start?: number }) => {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
      {data.map((d, i) => <BarCol key={d.label} {...d} max={max} height={height} delay={start + i * 3} hot={highlightLast ? i === data.length - 1 : d.value === max} />)}
    </div>
  );
};

const BarCol = ({ label, value, max, height, delay, hot }: {
  label: string; value: number; max: number; height: number; delay: number; hot: boolean;
}) => {
  const p = useEnter(delay, 14);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ height, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ width: '100%', height: `${(value / max) * 100 * p}%`, borderRadius: 10, background: hot ? C.blue : '#bfdbfe' }} />
      </div>
      <div style={{ fontSize: 18, color: hot ? C.ink : C.muted, fontWeight: 700 }}>{label}</div>
    </div>
  );
};

export const Pill = ({ children, color = C.blue, bg = C.blueSoft }: { children: ReactNode; color?: string; bg?: string }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 999,
    background: bg, color, fontSize: 19, fontWeight: 700, whiteSpace: 'nowrap',
  }}>
    {children}
  </span>
);

export const Button = ({ children, delay = 40, icon: I }: { children: ReactNode; delay?: number; icon?: Icon }) => {
  const p = useEnter(delay);
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 26px', borderRadius: 16,
      background: C.blue, color: C.white, fontSize: 22, fontWeight: 800, opacity: p,
      transform: `scale(${0.85 + p * 0.15})`, boxShadow: '0 12px 30px rgba(37,99,235,0.35)',
    }}>
      {I && <I size={24} color={C.white} />}{children}
    </div>
  );
};

/** Small floating tile, for "and also" extras around a panel. */
export const Floater = ({ children, delay, style }: { children: ReactNode; delay: number; style: CSSProperties }) => {
  const p = useEnter(delay);
  return (
    <div style={{ position: 'absolute', opacity: p, transform: `scale(${0.8 + p * 0.2})`, ...style }}>
      <Card style={{ padding: '18px 24px', borderRadius: 22 }}>{children}</Card>
    </div>
  );
};

export const Field = ({ label, value, delay }: { label: string; value: string; delay: number }) => {
  const frame = useCurrentFrame();
  const p = useEnter(delay);
  const chars = Math.round(interpolate(frame, [delay + 4, delay + 22], [0, value.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  return (
    <div style={{ opacity: p }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 6 }}>{label}</div>
      <div style={{ border: `2px solid ${C.line}`, borderRadius: 14, padding: '12px 16px', fontSize: 22, color: C.ink, minHeight: 30 }}>
        {value.slice(0, chars)}
      </div>
    </div>
  );
};
