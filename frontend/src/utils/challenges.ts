import type { ChallengeKind, ChallengeStatus } from '../types';

/** How each challenge type is written for people, and what its score counts. */
export const CHALLENGE_KINDS: Record<ChallengeKind, { label: string; hint: string; unit: string }> = {
  visits: { label: 'Most visits', hint: 'Every day a member checks in counts once.', unit: 'visits' },
  streak: { label: 'Attendance streak', hint: 'The most days in a row a member checks in.', unit: 'days in a row' },
  weight_loss: {
    label: 'Weight loss %',
    hint: 'Percent of body weight lost, from the last weigh-in before the start to the latest one.',
    unit: '% lost',
  },
};

export const CHALLENGE_STATUS: Record<ChallengeStatus, { label: string; className: string }> = {
  upcoming: { label: 'Starts soon', className: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  running: { label: 'Running', className: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
  ended: { label: 'Ended', className: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300' },
};

/** A score with its unit: "12 visits", "5 days in a row", "4.5% lost"; a dash when unscored. */
export const formatScore = (kind: ChallengeKind, score: number | null, t: (s: string) => string): string => {
  if (score === null) return kind === 'weight_loss' ? t('needs a weigh-in') : '—';
  return kind === 'weight_loss' ? `${score}${t('% lost')}` : `${score} ${t(CHALLENGE_KINDS[kind].unit)}`;
};

/** A `@db.Date` day ("2026-11-19T00:00:00.000Z") written for people: "19 Nov". */
export const challengeDay = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Days from the gym's today to a challenge day: negative once it has passed. */
export const daysUntil = (iso: string): number => {
  const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }));
  return Math.round((new Date(iso).getTime() - today.getTime()) / 86_400_000);
};

/** Gold, silver and bronze for the top three places; plain after that. */
export const rankBadge = (rank: number | null): string =>
  rank === 1 ? 'bg-amber-400 text-white'
    : rank === 2 ? 'bg-slate-400 text-white'
      : rank === 3 ? 'bg-orange-400 text-white'
        : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400';
