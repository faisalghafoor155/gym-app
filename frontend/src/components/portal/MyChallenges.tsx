import { useEffect, useState } from 'react';
import { Trophy, Gift, Calendar, Users, CheckCircle2, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { apiError } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { Card, EmptyState, primaryButton, secondaryButton } from '../ui';
import { CHALLENGE_KINDS, CHALLENGE_STATUS, challengeDay, daysUntil, formatScore, rankBadge } from '../../utils/challenges';
import type { MyChallenge } from '../../types';

/**
 * Challenges the member can join, their place in the ones they are in, and the
 * leaderboard. Other members appear by first name and initial only.
 */
export default function MyChallenges() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<MyChallenge[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => api.get<MyChallenge[]>('/me/challenges').then(r => setRows(r.data)).catch(() => setRows([]));
  useEffect(() => { void load(); }, []);

  const toggle = async (c: MyChallenge) => {
    setBusy(c.id);
    try {
      if (c.joined) await api.delete(`/me/challenges/${c.id}/join`);
      else await api.post(`/me/challenges/${c.id}/join`);
      toast.success(c.joined ? t('You left {name}', { name: c.name }) : t('You joined {name}. Good luck!', { name: c.name }));
      await load();
    } catch (err) {
      toast.error(apiError(err, t('Could not save')));
    } finally {
      setBusy(null);
    }
  };

  if (!rows) return null;
  if (rows.length === 0) {
    return <EmptyState icon={Trophy} title={t('No challenges right now')} hint={t('When the gym starts a challenge it appears here for you to join.')} />;
  }

  return (
    <div className="space-y-4">
      {rows.map(c => {
        const kind = CHALLENGE_KINDS[c.kind];
        const left = daysUntil(c.endsOn) + 1;
        return (
          <Card key={c.id} className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-slate-100">{c.name}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{t(kind.label)} · {t(kind.hint)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHALLENGE_STATUS[c.status].className}`}>
                {t(CHALLENGE_STATUS[c.status].label)}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-slate-300">
              <span><Calendar size={12} className="inline -mt-0.5 mr-1" />{challengeDay(c.startsOn)} – {challengeDay(c.endsOn)}
                {c.status === 'running' && ` · ${t('{count} days left', { count: left })}`}
              </span>
              <span><Users size={12} className="inline -mt-0.5 mr-1" />{t('{count} joined', { count: c.participantCount })}</span>
              {c.target != null && <span>{t('Goal')}: {formatScore(c.kind, c.target, t)}</span>}
            </div>
            {c.description && <p className="text-sm text-gray-700 dark:text-slate-300">{c.description}</p>}
            {c.prize && <p className="text-sm text-pink-600 dark:text-pink-400"><Gift size={14} className="inline -mt-0.5 mr-1" />{c.prize}</p>}

            {c.me && c.status !== 'upcoming' && (
              <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 px-4 py-3 flex items-center gap-3">
                <span className={`w-9 h-9 shrink-0 rounded-full text-sm font-bold flex items-center justify-center ${rankBadge(c.me.rank)}`}>
                  {c.me.rank ?? '–'}
                </span>
                <div className="text-sm">
                  <p className="font-semibold text-gray-900 dark:text-slate-100">{formatScore(c.kind, c.me.score, t)}</p>
                  <p className="text-xs text-gray-600 dark:text-slate-300">
                    {c.me.completed ? <><CheckCircle2 size={12} className="inline -mt-0.5 mr-1 text-green-600" />{t('Goal reached!')}</>
                      : c.me.rank ? t('You are {place} of {count}', { place: c.me.rank, count: c.participantCount })
                        : c.kind === 'weight_loss' ? t('Ask the desk or your trainer to record your weight') : null}
                  </p>
                </div>
              </div>
            )}

            {c.leaderboard.length > 0 && c.status !== 'upcoming' && (
              <ol className="space-y-1">
                {c.leaderboard.map((row, i) => (
                  <li key={i} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${row.isMe ? 'bg-blue-50/70 dark:bg-blue-500/10 font-semibold' : ''}`}>
                    <span className={`w-6 h-6 shrink-0 rounded-full text-[11px] font-bold flex items-center justify-center ${rankBadge(row.rank)}`}>{row.rank ?? '–'}</span>
                    <span className="flex-1 truncate text-gray-800 dark:text-slate-200">{row.isMe ? t('You') : row.name}</span>
                    <span className="tabular-nums text-gray-600 dark:text-slate-300 whitespace-nowrap">{formatScore(c.kind, row.score, t)}</span>
                    {row.completed && <CheckCircle2 size={14} className="text-green-600 shrink-0" />}
                  </li>
                ))}
              </ol>
            )}

            {c.status !== 'ended' && (
              c.joined ? (
                <button onClick={() => void toggle(c)} disabled={busy === c.id} className={`w-full ${secondaryButton}`}>
                  <LogOut size={14} /> {t('Leave challenge')}
                </button>
              ) : (
                <button onClick={() => void toggle(c)} disabled={busy === c.id} className={`w-full ${primaryButton}`}>
                  <Trophy size={15} /> {t('Join challenge')}
                </button>
              )
            )}
          </Card>
        );
      })}
    </div>
  );
}
