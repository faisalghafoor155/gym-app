/**
 * The shared design system. Every page is built from these, so a change to a
 * card, a header or a button lands everywhere at once instead of drifting page
 * by page. The tokens come from the Membership Plans page, which is the
 * baseline the rest of the app now matches.
 */
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Tone = 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'purple';

/**
 * Dark is not the light palette inverted. Tinted surfaces drop to a translucent
 * wash of the same hue, because a solid `bg-blue-950` next to a slate card
 * reads as a differently-lit panel rather than as the same tile in a darker
 * room. Text lifts to the 300/400 steps: the 600s used in light mode fall below
 * readable contrast once the surface behind them goes dark.
 */
const toneTile: Record<Tone, string> = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  green: 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-400',
  gray: 'bg-gray-100 text-gray-500 dark:bg-slate-700/60 dark:text-slate-300',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400',
};

/** One ring style everywhere, so keyboard focus is always visible and always
 *  looks the same. The offset colour has to follow the surface, or the ring
 *  cuts a white notch out of a dark card. */
export const focusRing =
  `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
   focus:ring-offset-white dark:focus:ring-offset-slate-900`;

export const inputClass =
  `w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white
   placeholder:text-gray-400 ${focusRing} focus:border-blue-500 transition-colors
   dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100
   dark:placeholder:text-slate-500 dark:focus:border-blue-500`;

export const primaryButton =
  `inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5
   rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60
   disabled:cursor-not-allowed transition-colors shadow-sm ${focusRing}`;

export const secondaryButton =
  `inline-flex items-center justify-center gap-2 bg-white text-gray-700 px-4 py-2.5
   rounded-xl text-sm font-semibold border border-gray-300 hover:bg-gray-50
   disabled:opacity-60 transition-colors ${focusRing}
   dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700`;

export const dangerButton =
  `inline-flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2.5
   rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-60
   transition-colors shadow-sm ${focusRing}`;

/* ------------------------------------------------------------------ page */

interface PageProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Primary action for the page, right-aligned and never wrapped. */
  action?: ReactNode;
}

export function PageHeader({ icon: Icon, title, subtitle, action }: PageProps) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <Icon size={22} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="truncate">{title}</span>
        </h1>
        {subtitle && <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="p-4 sm:p-6 max-w-7xl mx-auto">{children}</div>;
}

/* ------------------------------------------------------------- surfaces */

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200
      dark:bg-slate-900 dark:border-slate-800 transition-colors ${className}`}>
      {children}
    </div>
  );
}

export function IconTile({ icon: Icon, tone = 'blue', size = 'md' }: {
  icon: LucideIcon; tone?: Tone; size?: 'sm' | 'md';
}) {
  const box = size === 'sm' ? 'w-9 h-9 rounded-xl' : 'w-12 h-12 rounded-2xl';
  return (
    <div className={`${box} ${toneTile[tone]} flex items-center justify-center shrink-0`}>
      <Icon size={size === 'sm' ? 16 : 20} />
    </div>
  );
}

/** A label/value strip — the readable way to show a field inside a card. */
export function DataRow({ icon: Icon, label, value }: {
  icon?: LucideIcon; label: string; value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-slate-800/60 rounded-lg px-3 py-2 text-xs">
      <span className="text-gray-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
        {Icon && <Icon size={12} />} {label}
      </span>
      <span className="font-semibold text-gray-800 dark:text-slate-200 text-right truncate">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ data */

export function StatTile({ icon: Icon, label, value, tone = 'blue', hint }: {
  icon: LucideIcon; label: string; value: ReactNode; tone?: Tone; hint?: string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3 sm:gap-4">
        <IconTile icon={Icon} tone={tone} />
        <div className="min-w-0">
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 truncate">{value}</p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5 truncate">{label}</p>
          {hint && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">{hint}</p>}
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- charts */

/**
 * Charts are hand-drawn SVG rather than a charting library: two small shapes
 * do not justify the dependency, and these scale with the surrounding type
 * instead of fighting it.
 *
 * Both take pre-bucketed data — deciding what a bar means is the server's job,
 * so the client never disagrees with it about where a month starts.
 */

export interface BarDatum {
  label: string;
  value: number;
  /** Read out to screen readers and shown on hover; the label alone is rarely
   *  enough to say what the bar is. */
  title?: string;
}

export function BarChart({ data, format = String, height = 160 }: {
  data: readonly BarDatum[];
  format?: (v: number) => string;
  height?: number;
}) {
  // An all-zero series still has to draw: dividing by a zero max would put
  // every bar at NaN% and collapse the chart to nothing.
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="overflow-x-auto">
      <div
        className="flex items-end gap-2 sm:gap-3 min-w-max"
        style={{ height }}
        role="img"
        aria-label={data.map(d => `${d.label}: ${format(d.value)}`).join(', ')}
      >
        {data.map(d => (
          <div key={d.label} className="flex flex-col items-center justify-end gap-1.5 h-full min-w-11 flex-1">
            <span className="text-xs font-semibold text-gray-700 dark:text-slate-300 whitespace-nowrap">
              {format(d.value)}
            </span>
            <div
              title={d.title ?? `${d.label}: ${format(d.value)}`}
              className="w-full rounded-t-lg bg-linear-to-t from-blue-600 to-blue-400
                dark:from-blue-500 dark:to-blue-300 transition-all min-h-1"
              style={{ height: `${(d.value / max) * 100}%` }}
            />
            <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface LineDatum {
  label: string;
  value: number;
}

/**
 * A filled sparkline. Drawn in a fixed 0–100 viewBox and stretched with
 * `preserveAspectRatio="none"`, so it fills whatever width it is given without
 * the caller having to measure anything.
 */
export function LineChart({ data, height = 140, format = String, gradientId = 'lineFill' }: {
  data: readonly LineDatum[];
  height?: number;
  format?: (v: number) => string;
  /** SVG ids are document-global: two charts on one page sharing an id would
   *  both paint whichever gradient rendered last. */
  gradientId?: string;
}) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map(d => d.value), 1);
  // A single point has no span to divide by; place it mid-chart instead.
  const x = (i: number) => (data.length === 1 ? 50 : (i / (data.length - 1)) * 100);
  const y = (v: number) => 100 - (v / max) * 92 - 4;

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.value)}`).join(' ');
  const area = `${line} L 100 100 L 0 100 Z`;

  const peak = data.reduce((best, d) => (d.value > best.value ? d : best), data[0]!);

  return (
    <div>
      <div className="relative" style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          // Both the stroke and the gradient read `currentColor`, so the one
          // text-colour class here is what themes the whole chart.
          className="w-full h-full overflow-visible text-blue-600 dark:text-blue-400"
          role="img"
          aria-label={`Trend over ${data.length} days, peaking at ${format(peak.value)} on ${peak.label}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            // The viewBox is stretched horizontally, so an unscaled stroke is
            // what keeps the line an even weight rather than a smeared wedge.
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-slate-500">
        <span>{data[0]!.label}</span>
        <span>{data.at(-1)!.label}</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- page states */

export function Spinner({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`${className} border-4 border-blue-600 dark:border-blue-400 border-t-transparent
        dark:border-t-transparent rounded-full animate-spin`}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
      <Spinner />
    </div>
  );
}

/**
 * Nothing to show. `filtered` separates "there is no data yet" from "your
 * filters hid it all" — the two need different words and different exits.
 */
export function EmptyState({ icon: Icon, title, hint, action }: {
  icon: LucideIcon; title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <Card className="p-10 sm:p-14 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-4">
        <Icon size={24} />
      </div>
      <p className="font-semibold text-gray-700 dark:text-slate-200">{title}</p>
      {hint && <p className="text-sm text-gray-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">{hint}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Card>
  );
}

/**
 * A page that could not load at all.
 *
 * Distinct from `EmptyState`: nothing is wrong with the gym's data, the fetch
 * failed. It always offers the way out, because a dead end with no button is
 * indistinguishable to the user from the app being broken for good.
 */
export function LoadFailed({ title, hint, onRetry }: {
  title: string;
  hint?: string;
  /** Defaults to a full reload, which is the honest retry for a page whose
   *  whole state came from the one request that failed. */
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-full min-h-[50vh] p-6">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={24} />
        </div>
        <p className="font-semibold text-gray-700 dark:text-slate-300">{title}</p>
        {hint && <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">{hint}</p>}
        <button
          onClick={onRetry ?? (() => window.location.reload())}
          className={`mt-5 ${secondaryButton}`}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/**
 * Nothing to show *inside* a card that already has its own heading and border.
 *
 * `EmptyState` is a card, so using it for a panel within a card nests one
 * surface in another. This is the same idea at panel scale: one muted line,
 * optionally with something to do about it. The icon is deliberately absent —
 * the panel heading above it already carries one.
 */
export function InlineEmpty({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="py-6 text-center">
      <p className="text-sm text-gray-400 dark:text-slate-500">{message}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

/** Wraps a list that is being refetched: the old rows stay readable instead of
 *  the page blanking back to a spinner on every keystroke. */
export function Refetching({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <div className={busy ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- controls */

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
      {children}{required && <span className="text-red-500 dark:text-red-400"> *</span>}
    </label>
  );
}

export function IconButton({ icon: Icon, label, onClick, tone = 'blue', disabled }: {
  icon: LucideIcon; label: string; onClick: () => void; tone?: Tone; disabled?: boolean;
}) {
  const hover: Record<Tone, string> = {
    blue: 'hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/15',
    green: 'hover:text-green-600 hover:bg-green-50 dark:hover:text-green-400 dark:hover:bg-green-500/15',
    red: 'hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/15',
    yellow: 'hover:text-yellow-600 hover:bg-yellow-50 dark:hover:text-yellow-400 dark:hover:bg-yellow-500/15',
    gray: 'hover:text-gray-700 hover:bg-gray-100 dark:hover:text-slate-200 dark:hover:bg-slate-700',
    purple: 'hover:text-purple-600 hover:bg-purple-50 dark:hover:text-purple-400 dark:hover:bg-purple-500/15',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`p-2 rounded-lg text-gray-400 dark:text-slate-500 transition-colors
        disabled:opacity-40 ${hover[tone]} ${focusRing}`}
    >
      <Icon size={15} />
    </button>
  );
}

/** Segmented filter. Values stay caller-defined so a page can filter on
 *  whatever it likes without this needing to know about it. */
export function SegmentedControl<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="inline-flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1 gap-1" role="tablist">
      {options.map(o => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${focusRing} ${
            value === o.value
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
          }`}
        >
          {o.label}
          {o.count !== undefined && (
            <span className="ml-1.5 text-xs text-gray-400 dark:text-slate-500">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
