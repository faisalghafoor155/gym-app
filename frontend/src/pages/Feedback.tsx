import { useEffect, useState, type FormEvent } from 'react';
import { MessageSquareHeart, Star, Smile, Inbox, CheckCircle2, RotateCcw, Reply, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import Stars from '../components/feedback/Stars';
import {
  Page, PageHeader, Card, StatTile, PageLoader, LoadFailed, EmptyState, Refetching, SegmentedControl,
  FieldLabel, inputClass, primaryButton, secondaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useLanguage } from '../context/LanguageContext';
import { FEEDBACK_CATEGORIES } from '../utils/feedback';
import type { Feedback as FeedbackRow, FeedbackSummary } from '../types';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

function ReplyModal({ row, onClose, onDone }: { row: FeedbackRow; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [response, setResponse] = useState(row.response ?? '');
  const [saving, setSaving] = useState(false);

  const save = async (resolve: boolean) => {
    setSaving(true);
    try {
      await api.put(`/feedback/${row.id}`, { response: response.trim(), ...(resolve && { status: 'resolved' }) });
      toast.success(resolve ? t('Marked resolved') : t('Reply saved'));
      onDone();
    } catch (err) {
      toast.error(apiError(err, t('Could not save')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={row.member ? t('Reply to {name}', { name: row.member.name }) : t('Anonymous feedback')} onClose={onClose}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save(true); }} className="space-y-4">
        <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-3 text-sm space-y-1">
          <Stars value={row.rating} />
          <p className="text-xs text-gray-500">{t(FEEDBACK_CATEGORIES[row.category])} · {when(row.createdAt)}</p>
          {row.message && <p>{row.message}</p>}
        </div>
        {row.member ? (
          <div>
            <FieldLabel htmlFor="fb-reply">{t('Your reply (the member sees this)')}</FieldLabel>
            <textarea id="fb-reply" rows={3} maxLength={1000} value={response} onChange={e => setResponse(e.target.value)}
              placeholder={t('e.g. Thank you — we have fixed this.')} className={inputClass} />
          </div>
        ) : (
          <p className="text-xs text-gray-500">{t('Sent anonymously, so there is nobody to reply to. Note what you did and resolve it.')}</p>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          {row.member && (
            <button type="button" disabled={saving} onClick={() => void save(false)} className={`flex-1 ${secondaryButton}`}>{t('Save reply')}</button>
          )}
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>{t('Resolve')}</button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * What members think of the gym: this month's score, and the complaints
 * still waiting for someone to deal with them.
 */
export default function Feedback() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const [replying, setReplying] = useState<FeedbackRow | null>(null);
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const { data, loading, refetching, reload } = useFetch<FeedbackRow[]>(`/feedback?status=${status}`, t('Could not load feedback'));

  const loadSummary = () => api.get<FeedbackSummary>('/feedback/summary').then(r => setSummary(r.data)).catch(() => {});
  useEffect(() => { void loadSummary(); }, []);

  const refresh = () => { void reload(); void loadSummary(); };

  const reopen = async (row: FeedbackRow) => {
    try {
      await api.put(`/feedback/${row.id}`, { status: 'open' });
      refresh();
    } catch (err) {
      toast.error(apiError(err, t('Could not save')));
    }
  };

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title={t('Could not load feedback')} onRetry={() => void reload()} />;

  const s = summary?.thisMonth;
  const last = summary?.lastMonth;
  const trend = s?.average != null && last?.average != null ? Math.round((s.average - last.average) * 10) / 10 : null;

  return (
    <Page>
      <PageHeader icon={MessageSquareHeart} title={t('Feedback & Complaints')} subtitle={t('What members say, and what still needs answering')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatTile icon={Star} label={t('Score this month')} tone="yellow"
          value={s?.average != null ? `${s.average} / 5` : '—'}
          hint={trend !== null ? t('{sign}{diff} vs last month', { sign: trend >= 0 ? '+' : '', diff: trend }) : undefined} />
        <StatTile icon={Smile} label={t('Happy (4–5 stars)')} tone="green" value={s?.happyPct != null ? `${s.happyPct}%` : '—'} />
        <StatTile icon={MessageSquareHeart} label={t('Responses this month')} tone="blue" value={s?.count ?? 0} />
        <StatTile icon={Inbox} label={t('Waiting for a reply')} tone="red" value={summary?.open ?? 0} />
      </div>

      {summary && summary.byCategory.length > 0 && (
        <Card className="p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1.5">
            {trend !== null && (trend >= 0 ? <TrendingUp size={14} className="text-green-600" /> : <TrendingDown size={14} className="text-red-600" />)}
            {t('This month by topic')}
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.byCategory.map(c => (
              <span key={c.category} className={`rounded-lg px-2.5 py-1.5 text-xs ${
                (c.average ?? 5) < 3 ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                  : (c.average ?? 5) < 4 ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                    : 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300'}`}>
                <strong>{t(FEEDBACK_CATEGORIES[c.category])}</strong> · {c.average}★ · {t('{count} responses', { count: c.count })}
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-3">
        <SegmentedControl value={status} onChange={setStatus}
          options={[
            { value: 'open', label: 'Open', count: summary?.open },
            { value: 'resolved', label: 'Resolved' },
            { value: 'all', label: 'All' },
          ]} />
      </div>

      <Refetching busy={refetching}>
        {data.length === 0 ? (
          <EmptyState icon={CheckCircle2}
            title={status === 'open' ? t('Nothing waiting for a reply') : t('No feedback yet')}
            hint={t('Members rate the gym from their portal. Low scores and comments land here to be answered.')} />
        ) : (
          <div className="space-y-2">
            {data.map(row => (
              <Card key={row.id} className={`p-3 sm:p-4 ${row.status === 'open' && row.rating <= 2 ? 'border-red-200 dark:border-red-500/30' : ''}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars value={row.rating} size={14} />
                      <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">{t(FEEDBACK_CATEGORIES[row.category])}</span>
                      <span className={`text-[11px] font-bold ${row.status === 'open' ? 'text-red-600' : 'text-green-600'}`}>
                        {row.status === 'open' ? t('Open') : t('Resolved')}
                      </span>
                    </div>
                    {row.message && <p className="text-sm text-gray-800 dark:text-slate-200">{row.message}</p>}
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {[
                        row.member ? `${row.member.name} (${row.member.memberNo})` : t('Anonymous'),
                        when(row.createdAt),
                        row.resolvedBy && t('resolved by {name}', { name: row.resolvedBy.name }),
                      ].filter(Boolean).join(' · ')}
                    </p>
                    {row.response && (
                      <p className="text-xs rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-200 px-2.5 py-1.5">
                        <Reply size={11} className="inline -mt-0.5 mr-1" />{row.response}
                      </p>
                    )}
                  </div>
                  {row.status === 'open' ? (
                    <button onClick={() => setReplying(row)} className={primaryButton}><Reply size={15} /> {t('Reply / resolve')}</button>
                  ) : (
                    <button onClick={() => void reopen(row)} className={secondaryButton}><RotateCcw size={14} /> {t('Reopen')}</button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Refetching>

      {replying && <ReplyModal row={replying} onClose={() => setReplying(null)} onDone={() => { setReplying(null); refresh(); }} />}
    </Page>
  );
}
