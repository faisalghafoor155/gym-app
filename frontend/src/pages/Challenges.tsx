import { useEffect, useState, type FormEvent } from 'react';
import { Trophy, Plus, Users, Calendar, Gift, Search, Trash2, Pencil, Megaphone, CheckCircle2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, PageLoader, LoadFailed, EmptyState, Refetching, SegmentedControl,
  FieldLabel, IconButton, InlineEmpty, inputClass, primaryButton, secondaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useDebounced } from '../hooks/useDebounced';
import { useLanguage } from '../context/LanguageContext';
import { CHALLENGE_KINDS, CHALLENGE_STATUS, challengeDay, daysUntil, formatScore, rankBadge } from '../utils/challenges';
import type {
  Challenge, ChallengeAnnouncement, ChallengeDetail, ChallengeKind, ChallengeStatus, PaginatedMembers,
} from '../types';

/** Today in the gym's calendar, as the yyyy-mm-dd a date input holds. */
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const plusDays = (ymd: string, n: number) =>
  new Date(new Date(ymd).getTime() + n * 86_400_000).toISOString().slice(0, 10);

type Editing = { mode: 'new' } | { mode: 'edit'; challenge: ChallengeDetail };

function ChallengeForm({ editing, onClose, onDone }: { editing: Editing; onClose: () => void; onDone: (id: string) => void }) {
  const { t } = useLanguage();
  const existing = editing.mode === 'edit' ? editing.challenge : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<ChallengeKind>(existing?.kind ?? 'visits');
  const [target, setTarget] = useState(existing?.target != null ? String(existing.target) : '');
  const [startsOn, setStartsOn] = useState(existing?.startsOn.slice(0, 10) ?? today());
  const [endsOn, setEndsOn] = useState(existing?.endsOn.slice(0, 10) ?? plusDays(today(), 29));
  const [prize, setPrize] = useState(existing?.prize ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = { name: name.trim(), target, startsOn, endsOn, prize: prize.trim(), description: description.trim() };
    try {
      const res = existing
        ? await api.put<{ id: string }>(`/challenges/${existing.id}`, body)
        : await api.post<{ id: string }>('/challenges', { ...body, kind });
      toast.success(existing ? t('Challenge saved') : t('Challenge created'));
      onDone(res.data.id);
    } catch (err) {
      toast.error(apiError(err, t('Could not save')));
    } finally {
      setSaving(false);
    }
  };

  const targetLabel = kind === 'weight_loss' ? t('Target (% of body weight)')
    : kind === 'streak' ? t('Target (days in a row)') : t('Target (visits)');

  return (
    <Modal title={existing ? t('Edit challenge') : t('New challenge')} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <div>
          <FieldLabel htmlFor="ch-name" required>{t('Name')}</FieldLabel>
          <input id="ch-name" required maxLength={80} value={name} onChange={e => setName(e.target.value)}
            placeholder={t('e.g. 30-day attendance challenge')} className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="ch-kind">{t('Type')}</FieldLabel>
          <select id="ch-kind" value={kind} disabled={!!existing} onChange={e => setKind(e.target.value as ChallengeKind)} className={inputClass}>
            {(Object.keys(CHALLENGE_KINDS) as ChallengeKind[]).map(k => <option key={k} value={k}>{t(CHALLENGE_KINDS[k].label)}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t(CHALLENGE_KINDS[kind].hint)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="ch-start" required>{t('Starts')}</FieldLabel>
            <input id="ch-start" type="date" required value={startsOn} onChange={e => setStartsOn(e.target.value)} className={inputClass} />
          </div>
          <div>
            <FieldLabel htmlFor="ch-end" required>{t('Ends')}</FieldLabel>
            <input id="ch-end" type="date" required min={startsOn} value={endsOn} onChange={e => setEndsOn(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="ch-target">{targetLabel}</FieldLabel>
          <input id="ch-target" type="number" min={1} max={kind === 'weight_loss' ? 30 : 366} value={target}
            onChange={e => setTarget(e.target.value)} placeholder={t('Optional')} className={inputClass} />
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('Members who reach it are marked as finished. Leave blank for a ranking only.')}</p>
        </div>
        <div>
          <FieldLabel htmlFor="ch-prize">{t('Prize')}</FieldLabel>
          <input id="ch-prize" maxLength={200} value={prize} onChange={e => setPrize(e.target.value)}
            placeholder={t('e.g. 1 month free for the winner')} className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="ch-desc">{t('Description')}</FieldLabel>
          <textarea id="ch-desc" rows={2} maxLength={500} value={description} onChange={e => setDescription(e.target.value)}
            placeholder={t('Rules or anything members should know')} className={inputClass} />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>{saving ? t('Saving…') : t('Save')}</button>
        </div>
      </form>
    </Modal>
  );
}

type Found = { id: string; name: string; memberNo: string };

/** Finds a member to sign up at the desk. */
function AddMember({ challengeId, onAdded }: { challengeId: string; onAdded: () => void }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const [results, setResults] = useState<Found[]>([]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) { setResults([]); return; }
    let stale = false;
    void api.get<PaginatedMembers>('/members', { params: { search: q, limit: 6 } })
      .then(r => { if (!stale) setResults(r.data.data); })
      .catch(() => { if (!stale) setResults([]); });
    return () => { stale = true; };
  }, [debounced]);

  const add = async (m: Found) => {
    try {
      await api.post(`/challenges/${challengeId}/participants`, { memberId: m.id });
      toast.success(t('{name} joined', { name: m.name }));
      setQuery('');
      onAdded();
    } catch (err) {
      toast.error(apiError(err, t('Could not add member')));
    }
  };

  return (
    <div>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} aria-label={t('Add a member')}
          placeholder={t('Add a member: name, ID or phone…')} className={`${inputClass} pl-9`} />
      </div>
      {results.length > 0 && (
        <ul className="mt-1 rounded-lg border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-800">
          {results.map(m => (
            <li key={m.id}>
              <button type="button" onClick={() => void add(m)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                <Plus size={14} className="text-blue-600" /><strong>{m.name}</strong> <span className="text-xs text-gray-400">{m.memberNo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One challenge: its leaderboard, sign-ups, and announcing the winners. */
function ChallengeModal({ id, onClose, onChanged, onEdit }: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (c: ChallengeDetail) => void;
}) {
  const { t } = useLanguage();
  const [c, setC] = useState<ChallengeDetail | null>(null);
  const [confirm, setConfirm] = useState<'delete' | 'announce' | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get<ChallengeDetail>(`/challenges/${id}`).then(r => setC(r.data))
    .catch(err => { toast.error(apiError(err, t('Could not load challenge'))); onClose(); });
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = () => { void load(); onChanged(); };

  const removeMember = async (memberId: string) => {
    try {
      await api.delete(`/challenges/${id}/participants/${memberId}`);
      changed();
    } catch (err) {
      toast.error(apiError(err, t('Could not save')));
    }
  };

  const act = async () => {
    setBusy(true);
    try {
      if (confirm === 'delete') {
        await api.delete(`/challenges/${id}`);
        toast.success(t('Challenge deleted'));
        onChanged();
        onClose();
        return;
      }
      const res = await api.post<ChallengeAnnouncement>(`/challenges/${id}/announce`);
      if (!res.data.winners.length) toast(t('Nobody scored, so there are no winners to announce'));
      else if (res.data.notSent) toast.success(t('Winners announced. {sent} messaged, {notSent} could not be reached on WhatsApp.', { sent: res.data.sent, notSent: res.data.notSent }));
      else toast.success(t('Winners announced and messaged on WhatsApp'));
      changed();
    } catch (err) {
      toast.error(apiError(err, t('Could not save')));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  if (!c) return <Modal title={t('Challenge')} onClose={onClose}><div className="py-8 text-center text-sm text-gray-500">{t('Loading…')}</div></Modal>;

  const kind = CHALLENGE_KINDS[c.kind];
  const final = !!c.announcedAt;

  return (
    <Modal title={c.name} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${CHALLENGE_STATUS[c.status].className}`}>{t(CHALLENGE_STATUS[c.status].label)}</span>
          <span className="text-gray-600 dark:text-slate-300 font-medium">{t(kind.label)}</span>
          <span className="text-gray-500">{challengeDay(c.startsOn)} – {challengeDay(c.endsOn)}</span>
          {c.target != null && <span className="text-gray-500">· {t('target')} {formatScore(c.kind, c.target, t)}</span>}
        </div>
        {c.description && <p className="text-sm text-gray-700 dark:text-slate-300">{c.description}</p>}
        {c.prize && <p className="text-sm"><Gift size={14} className="inline -mt-0.5 mr-1 text-pink-500" />{c.prize}</p>}

        {c.status !== 'ended' && <AddMember challengeId={c.id} onAdded={changed} />}

        {c.standings.length === 0 ? (
          <InlineEmpty message={t('Nobody has joined yet. Members join from their portal, or add them above.')} />
        ) : (
          <ol className="divide-y divide-gray-100 dark:divide-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
            {c.standings.map(s => (
              <li key={s.memberId} className="flex items-center gap-3 px-3 py-2">
                <span className={`w-7 h-7 shrink-0 rounded-full text-xs font-bold flex items-center justify-center ${rankBadge(s.rank)}`}>
                  {s.rank ?? '–'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{s.member.name}</p>
                  <p className="text-xs text-gray-500">{s.member.memberNo}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-gray-800 dark:text-slate-200 whitespace-nowrap">
                  {formatScore(c.kind, s.score, t)}
                </span>
                {s.completed && <CheckCircle2 size={16} className="text-green-600 shrink-0" aria-label={t('Reached the target')} />}
                {!final && <IconButton icon={X} tone="red" label={t('Remove {name}', { name: s.member.name })} onClick={() => void removeMember(s.memberId)} />}
              </li>
            ))}
          </ol>
        )}

        {final && (
          <p className="text-xs text-green-700 dark:text-green-400 font-semibold">
            <Megaphone size={13} className="inline -mt-0.5 mr-1" />
            {t('Winners announced on {date}', { date: new Date(c.announcedAt!).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }) })}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {c.status === 'ended' && !final && (
            <button onClick={() => setConfirm('announce')} className={`flex-1 ${primaryButton}`}><Megaphone size={15} /> {t('Announce winners')}</button>
          )}
          {!final && <button onClick={() => onEdit(c)} className={`flex-1 ${secondaryButton}`}><Pencil size={14} /> {t('Edit')}</button>}
          <button onClick={() => setConfirm('delete')} className={secondaryButton} aria-label={t('Delete challenge')}><Trash2 size={14} className="text-red-600" /></button>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm === 'delete' ? t('Delete this challenge?') : t('Announce the winners?')}
          message={confirm === 'delete'
            ? t('Its leaderboard and sign-ups go with it. Attendance and measurements are not touched.')
            : t('The top three are congratulated on WhatsApp and the leaderboard becomes final. This is done once.')}
          confirmLabel={confirm === 'delete' ? t('Delete') : t('Announce')}
          tone={confirm === 'delete' ? 'danger' : 'primary'}
          busy={busy}
          onConfirm={() => void act()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </Modal>
  );
}

/**
 * Challenges that keep members coming back: the most visits, the longest
 * streak, or the most weight lost over a stretch of days.
 */
export default function Challenges() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<ChallengeStatus | 'all'>('running');
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const { data, loading, refetching, reload } = useFetch<Challenge[]>('/challenges', t('Could not load challenges'));

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title={t('Could not load challenges')} onRetry={() => void reload()} />;

  const count = (s: ChallengeStatus) => data.filter(c => c.status === s).length;
  const shown = data.filter(c => tab === 'all' || c.status === tab);
  // Ended ones whose winners nobody has announced yet are the desk's to-do.
  const toAnnounce = data.filter(c => c.status === 'ended' && !c.announcedAt && c.participantCount > 0).length;

  return (
    <Page>
      <PageHeader icon={Trophy} title={t('Challenges')} subtitle={t('Streaks and weight-loss contests that keep members coming back')}
        action={<button onClick={() => setEditing({ mode: 'new' })} className={primaryButton}><Plus size={16} /> {t('New challenge')}</button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl value={tab} onChange={setTab}
          options={[
            { value: 'running', label: 'Running', count: count('running') },
            { value: 'upcoming', label: 'Starts soon', count: count('upcoming') },
            { value: 'ended', label: 'Ended', count: count('ended') },
            { value: 'all', label: 'All' },
          ]} />
        {toAnnounce > 0 && (
          <button onClick={() => setTab('ended')} className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline">
            <Megaphone size={13} className="inline -mt-0.5 mr-1" />{t('{count} waiting for winners to be announced', { count: toAnnounce })}
          </button>
        )}
      </div>

      <Refetching busy={refetching}>
        {shown.length === 0 ? (
          <EmptyState icon={Trophy}
            title={data.length === 0 ? t('No challenges yet') : t('Nothing here')}
            hint={t('Start a 30-day attendance streak or a weight-loss challenge. Members join from their portal and the leaderboard updates from check-ins and measurements.')}
            action={data.length === 0 ? <button onClick={() => setEditing({ mode: 'new' })} className={primaryButton}><Plus size={16} /> {t('New challenge')}</button> : undefined} />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {shown.map(c => {
              const left = daysUntil(c.endsOn);
              const starts = daysUntil(c.startsOn);
              return (
                <button key={c.id} onClick={() => setOpen(c.id)} className="text-left">
                  <Card hover className="p-4 h-full space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900 dark:text-slate-100">{c.name}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHALLENGE_STATUS[c.status].className}`}>
                        {t(CHALLENGE_STATUS[c.status].label)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{t(CHALLENGE_KINDS[c.kind].label)}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-slate-300">
                      <span><Calendar size={12} className="inline -mt-0.5 mr-1" />{challengeDay(c.startsOn)} – {challengeDay(c.endsOn)}
                        {c.status === 'running' && ` · ${t('{count} days left', { count: left + 1 })}`}
                        {c.status === 'upcoming' && ` · ${t('in {count} days', { count: starts })}`}
                      </span>
                      <span><Users size={12} className="inline -mt-0.5 mr-1" />{t('{count} joined', { count: c.participantCount })}</span>
                    </div>
                    {c.leader && (
                      <p className="text-sm">
                        <Trophy size={13} className="inline -mt-0.5 mr-1 text-amber-500" />
                        <strong>{c.leader.name}</strong>{' '}
                        <span className="text-gray-500">{formatScore(c.kind, c.leader.score, t)}</span>
                      </p>
                    )}
                    {c.prize && <p className="text-xs text-pink-600 dark:text-pink-400"><Gift size={12} className="inline -mt-0.5 mr-1" />{c.prize}</p>}
                    {c.status === 'ended' && !c.announcedAt && c.participantCount > 0 && (
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{t('Winners not announced yet')}</p>
                    )}
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </Refetching>

      {open && !editing && (
        <ChallengeModal id={open} onClose={() => setOpen(null)} onChanged={() => void reload()}
          onEdit={c => setEditing({ mode: 'edit', challenge: c })} />
      )}
      {editing && (
        <ChallengeForm editing={editing}
          onClose={() => setEditing(null)}
          onDone={id => { setEditing(null); setOpen(id); void reload(); }} />
      )}
    </Page>
  );
}
