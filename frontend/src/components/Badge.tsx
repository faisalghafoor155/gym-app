import { useLanguage } from '../context/LanguageContext';

/**
 * Clean, modern status badges with glowing indicator dots.
 */

interface BadgeStyle {
  bg: string;
  dot: string;
}

const styles: Record<string, BadgeStyle> = {
  active: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]',
  },
  expiring: {
    bg: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
    dot: 'bg-amber-500 animate-pulse',
  },
  expired: {
    bg: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20',
    dot: 'bg-rose-500',
  },
  suspended: {
    bg: 'bg-orange-50 text-orange-700 border-orange-200/80 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20',
    dot: 'bg-orange-500',
  },
  cancelled: {
    bg: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    dot: 'bg-gray-400',
  },
  superseded: {
    bg: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    dot: 'bg-gray-400',
  },
  lapsed: {
    bg: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  inactive: {
    bg: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  paid: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  due: {
    bg: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20',
    dot: 'bg-rose-500',
  },
  cash: {
    bg: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
    dot: 'bg-blue-500',
  },
  online: {
    bg: 'bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20',
    dot: 'bg-violet-500',
  },
};

const defaultStyle: BadgeStyle = {
  bg: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  dot: 'bg-gray-400',
};

export default function Badge({ status }: { status: string }) {
  const { t } = useLanguage();
  const style = styles[status] ?? defaultStyle;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide capitalize border shadow-2xs transition-colors ${style.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      <span>{t(status)}</span>
    </span>
  );
}
