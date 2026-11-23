import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PhoneCall, Plus, Pencil, Trash2, UserPlus, MessageCircle, CalendarClock, TrendingUp, Search, Users, XCircle,
  Ticket, LogIn,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, StatTile, PageLoader, LoadFailed, EmptyState, Refetching, SegmentedControl,
  FieldLabel, IconButton, inputClass, primaryButton, secondaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useDebounced } from '../hooks/useDebounced';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { openWhatsApp } from '../utils/whatsapp';
import type { Lead, LeadList, LeadStatus } from '../types';

const SOURCES = ['walk-in', 'call', 'whatsapp', 'facebook', 'instagram', 'referral', 'other'] as const;
const SOURCE_LABEL: Record<string, string> = {
  'walk-in': 'Walk-in', call: 'Phone call', whatsapp: 'WhatsApp', facebook: 'Facebook',
  instagram: 'Instagram', referral: 'Referral', other: 'Other',
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New', contacted: 'Contacted', trial: 'On trial', joined: 'Joined', lost: 'Lost',
};
const STATUS_STYLE: Record<LeadStatus, string> = {
  new: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  contacted: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300',
  trial: 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  joined: 'bg-lime-50 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300',
  lost: 'bg-gray-100 text-gray-500 dark:bg-slate-700/60 dark:text-slate-300',
};

type Filter = 'due' | 'all' | LeadStatus;

/** Today in the gym's calendar, as the yyyy-mm-dd a date input holds. */
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const plusDays = (n: number) => {
  const d = new Date(`${today()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function LeadFormModal({ lead, onClose, onDone }: { lead: Lead | null; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: lead?.name ?? '',
    phone: lead?.phone ?? '',
    source: lead?.source ?? 'walk-in',
    interest: lead?.interest ?? '',
    notes: lead?.notes ?? '',
    status: (lead?.status === 'joined' ? 'joined' : lead?.status ?? 'new') as LeadStatus,
    // A new enquiry gets a call-back tomorrow unless the desk says otherwise —
    // a lead with no date is the one nobody rings.
    followUpOn: lead ? (lead.followUpOn?.slice(0, 10) ?? '') : plusDays(1),
    lostReason: lead?.lostReason ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        source: form.source,
        interest: form.interest.trim(),
        notes: form.notes.trim(),
        followUpOn: form.status === 'lost' ? '' : form.followUpOn,
        lostReason: form.status === 'lost' ? form.lostReason.trim() : '',
        // A joined lead's status is fixed; sending it would be refused.
        ...(form.status !== 'joined' && { status: form.status }),
      };
      if (lead) await api.put(`/leads/${lead.id}`, body);
      else await api.post('/leads', body);
      toast.success(lead ? t('Lead updated') : t('Lead added'));
      onDone();
    } catch (err) {
      toast.error(apiError(err, t('Could not save lead')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={lead ? t('Edit lead') : t('New lead')} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="ld-name" required>{t('Name')}</FieldLabel>
            <input id="ld-name" required autoFocus maxLength={100} value={form.name} onChange={e => set('name')(e.target.value)} className={inputClass} />
          </div>
          <div>
            <FieldLabel htmlFor="ld-phone">{t('Phone')}</FieldLabel>
            <input id="ld-phone" type="tel" inputMode="tel" maxLength={30} value={form.phone} onChange={e => set('phone')(e.target.value)} placeholder="03xx xxxxxxx" className={inputClass} />
          </div>
          <div>
            <FieldLabel htmlFor="ld-source">{t('Source')}</FieldLabel>
            <select id="ld-source" value={form.source} onChange={e => set('source')(e.target.value)} className={inputClass}>
              {SOURCES.map(s => <option key={s} value={s}>{t(SOURCE_LABEL[s]!)}</option>)}
              {!SOURCES.includes(form.source as typeof SOURCES[number]) && <option value={form.source}>{form.source}</option>}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="ld-status">{t('Status')}</FieldLabel>
            <select id="ld-status" value={form.status} disabled={form.status === 'joined'} onChange={e => set('status')(e.target.value)} className={inputClass}>
              {(['new', 'contacted', 'trial', 'lost'] as const).map(s => <option key={s} value={s}>{t(STATUS_LABEL[s])}</option>)}
              {form.status === 'joined' && <option value="joined">{t('Joined')}</option>}
            </select>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="ld-interest">{t('Interested in')}</FieldLabel>
          <input id="ld-interest" maxLength={120} value={form.interest} onChange={e => set('interest')(e.target.value)} placeholder={t('e.g. weight loss, PT, ladies timing')} className={inputClass} />
        </div>
        {form.status === 'lost' ? (
          <div>
            <FieldLabel htmlFor="ld-lost">{t('Why did they not join?')}</FieldLabel>
            <input id="ld-lost" maxLength={200} value={form.lostReason} onChange={e => set('lostReason')(e.target.value)} placeholder={t('e.g. fee too high, too far')} className={inputClass} />
          </div>
        ) : form.status !== 'joined' && (
          <div>
            <FieldLabel htmlFor="ld-follow">{t('Follow up on')}</FieldLabel>
            <input id="ld-follow" type="date" value={form.followUpOn} onChange={e => set('followUpOn')(e.target.value)} className={inputClass} />
          </div>
        )}
        <div>
          <FieldLabel htmlFor="ld-notes">{t('Notes')}</FieldLabel>
          <textarea id="ld-notes" rows={2} maxLength={500} value={form.notes} onChange={e => set('notes')(e.target.value)} className={inputClass} />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>{saving ? t('Saving…') : t('Save')}</button>
        </div>
      </form>
    </Modal>
  );
}

const TRIAL_DAYS = [1, 2, 3, 5, 7];

/** Gives a lead a free trial of a few days, starting today. */
function TrialModal({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [days, setDays] = useState(3);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/leads/${lead.id}/trial`, { days });
      toast.success(t('Free trial started for {name}', { name: lead.name }));
      onDone();
    } catch (err) {
      toast.error(apiError(err, t('Could not start the trial')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('Free trial')} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-slate-300">
          {t('{name} can be checked in from this page each day of the trial, without a membership.', { name: lead.name })}
        </p>
        <div>
          <FieldLabel htmlFor="trial-days" required>{t('Trial length')}</FieldLabel>
          <select id="trial-days" value={days} onChange={e => setDays(Number(e.target.value))} className={inputClass}>
            {TRIAL_DAYS.map(n => (
              <option key={n} value={n}>{n === 1 ? t('1 day (today)') : t('{count} days from today', { count: n })}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
            {t('A follow-up is set for the day after the trial ends.')}
          </p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>{saving ? t('Saving…') : t('Start trial')}</button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Enquiries — people who asked about the gym and have not joined yet.
 *
 * Opens on who is due a call today, because that is the question the page
 * exists to answer. Converting sends the desk to the normal registration form
 * with the name and phone filled in, and the lead is linked to the member the
 * moment that form saves.
 */
export default function Leads() {
  const { t } = useLanguage();
  const { gym } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('due');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const [editing, setEditing] = useState<Lead | null | 'new'>(null);
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
  const [trialFor, setTrialFor] = useState<Lead | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  const params = new URLSearchParams({ limit: '100' });
  if (filter === 'due') params.set('due', 'true');
  else if (filter !== 'all') params.set('status', filter);
  if (debounced) params.set('search', debounced);
  const { data, loading, refetching, reload } = useFetch<LeadList>(`/leads?${params}`, t('Could not load leads'));

  const quickStatus = async (lead: Lead, patch: { status?: LeadStatus; followUpOn?: string }) => {
    try {
      await api.put(`/leads/${lead.id}`, patch);
      await reload();
    } catch (err) {
      toast.error(apiError(err, t('Could not save lead')));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/leads/${deleting.id}`);
      toast.success(t('Lead deleted'));
      setDeleting(null);
      await reload();
    } catch (err) {
      toast.error(apiError(err, t('Could not delete lead')));
    } finally {
      setBusy(false);
    }
  };

  const trialCheckin = async (lead: Lead) => {
    setCheckingIn(lead.id);
    try {
      const { data: visit } = await api.post<{ visits: number; alreadyCheckedIn: boolean }>(`/leads/${lead.id}/checkin`);
      if (visit.alreadyCheckedIn) toast(t('{name} is already checked in today', { name: lead.name }), { icon: 'ℹ️' });
      else toast.success(t('{name} checked in · trial visit {count}', { name: lead.name, count: visit.visits }));
      await reload();
    } catch (err) {
      toast.error(apiError(err, t('Check-in failed')));
    } finally {
      setCheckingIn(null);
    }
  };

  const convert = (lead: Lead) => {
    const q = new URLSearchParams({ lead: lead.id, name: lead.name, ...(lead.phone && { phone: lead.phone }) });
    navigate(`/members?${q}`);
  };

  const message = (lead: Lead) => openWhatsApp(lead.phone, t(
    'Assalam o Alaikum {name}, thank you for visiting {gym}. Are you ready to start your fitness journey? We would love to have you.',
    { name: lead.name, gym: gym?.name ?? t('our gym') },
  ));

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title={t('Could not load leads')} onRetry={() => void reload()} />;

  const { counts } = data;
  const decided = counts.joined + counts.lost;
  const conversion = decided > 0 ? Math.round((counts.joined / decided) * 100) : null;

  return (
    <Page>
      <PageHeader icon={PhoneCall} title={t('Leads & Enquiries')} subtitle={t('People who asked about the gym, until they join')}
        action={<button onClick={() => setEditing('new')} className={primaryButton}><Plus size={16} /> {t('New lead')}</button>} />

      {counts.all === 0 ? (
        <EmptyState icon={PhoneCall} title={t('No leads yet')}
          hint={t('Add everyone who asks about the gym — walk-ins, calls, messages — with a date to follow up.')}
          action={<button onClick={() => setEditing('new')} className={primaryButton}><Plus size={16} /> {t('New lead')}</button>} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <StatTile icon={CalendarClock} label={t('Follow up today')} value={counts.due} tone={counts.due > 0 ? 'red' : 'gray'} />
            <StatTile icon={Users} label={t('Open leads')} value={counts.new + counts.contacted + counts.trial} tone="blue" />
            <StatTile icon={UserPlus} label={t('Joined')} value={counts.joined} tone="green" />
            <StatTile icon={TrendingUp} label={t('Conversion')} value={conversion == null ? '—' : `${conversion}%`} tone="purple"
              hint={t('Joined out of leads that are decided')} />
          </div>

          {data.bySource.length > 0 && (
            <Card className="p-4 mb-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-3">{t('Where leads come from')}</p>
              <div className="flex flex-wrap gap-2">
                {data.bySource.map(s => (
                  <span key={s.source} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 dark:bg-slate-800 px-2.5 py-1 text-xs">
                    <strong className="text-gray-800 dark:text-slate-200">{t(SOURCE_LABEL[s.source] ?? s.source)}</strong>
                    <span className="text-gray-500 dark:text-slate-400">{t('{total} leads · {joined} joined', { total: s.total, joined: s.joined })}</span>
                  </span>
                ))}
              </div>
            </Card>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
            <div className="overflow-x-auto">
              <SegmentedControl value={filter} onChange={setFilter} options={[
                { value: 'due', label: t('Due today'), count: counts.due },
                { value: 'all', label: t('All'), count: counts.all },
                { value: 'new', label: t('New'), count: counts.new },
                { value: 'contacted', label: t('Contacted'), count: counts.contacted },
                { value: 'trial', label: t('On trial'), count: counts.trial },
                { value: 'joined', label: t('Joined'), count: counts.joined },
                { value: 'lost', label: t('Lost'), count: counts.lost },
              ]} />
            </div>
            <div className="relative lg:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input type="search" value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('Search name or phone…')} aria-label={t('Search leads')} className={`${inputClass} pl-9`} />
            </div>
          </div>

          <Refetching busy={refetching}>
            {data.data.length === 0 ? (
              <Card className="p-8 text-center text-sm text-gray-400">
                {filter === 'due' ? t('Nobody to call today.') : t('No leads match.')}
              </Card>
            ) : (
              <div className="space-y-2">
                {data.data.map(l => {
                  const overdue = l.followUpOn && l.followUpOn.slice(0, 10) < today() && ['new', 'contacted', 'trial'].includes(l.status);
                  const open = !['joined', 'lost'].includes(l.status);
                  const onTrial = l.status === 'trial' && !!l.trialUntil && l.trialUntil.slice(0, 10) >= today();
                  const visits = l._count?.visits ?? 0;
                  return (
                    <Card key={l.id} className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{l.name}</p>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${STATUS_STYLE[l.status]}`}>{t(STATUS_LABEL[l.status])}</span>
                            <span className="text-[11px] text-gray-400">{t(SOURCE_LABEL[l.source] ?? l.source)}</span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
                            {[l.phone, l.interest, l.notes].filter(Boolean).join(' · ') || t('No details')}
                          </p>
                          {l.status === 'joined' && l.member && (
                            <p className="text-xs text-lime-700 dark:text-lime-400 mt-0.5">{t('Became member {memberNo}', { memberNo: l.member.memberNo })}</p>
                          )}
                          {l.status === 'lost' && l.lostReason && (
                            <p className="text-xs text-gray-400 mt-0.5">{l.lostReason}</p>
                          )}
                          {l.trialUntil && (l.status === 'trial' || visits > 0) && (
                            <p className={`text-xs mt-0.5 font-medium ${onTrial ? 'text-purple-700 dark:text-purple-300' : 'text-gray-400'}`}>
                              <Ticket size={12} className="inline -mt-0.5 mr-1" />
                              {onTrial
                                ? t('Free trial until {date}', { date: shortDate(l.trialUntil) })
                                : t('Trial ended {date}', { date: shortDate(l.trialUntil) })}
                              {' · '}{visits === 1 ? t('1 visit') : t('{count} visits', { count: visits })}
                            </p>
                          )}
                          {open && l.followUpOn && (
                            <p className={`text-xs mt-0.5 font-medium ${overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>
                              <CalendarClock size={12} className="inline -mt-0.5 mr-1" />
                              {overdue ? t('Follow-up overdue since {date}', { date: shortDate(l.followUpOn) }) : t('Follow up {date}', { date: shortDate(l.followUpOn) })}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {open && l.phone && (
                            <>
                              <a href={`tel:${l.phone}`} className={`${secondaryButton} !py-1 !px-2.5 text-xs`}><PhoneCall size={13} /> {t('Call')}</a>
                              <button onClick={() => message(l)} className={`${secondaryButton} !py-1 !px-2.5 text-xs`}><MessageCircle size={13} /> {t('WhatsApp')}</button>
                            </>
                          )}
                          {open && (onTrial ? (
                            <button onClick={() => void trialCheckin(l)} disabled={checkingIn === l.id}
                              className={`${secondaryButton} !py-1 !px-2.5 text-xs text-purple-700 dark:text-purple-300`}>
                              <LogIn size={13} /> {checkingIn === l.id ? t('Checking in…') : t('Check in')}
                            </button>
                          ) : (
                            <button onClick={() => setTrialFor(l)} className={`${secondaryButton} !py-1 !px-2.5 text-xs`}>
                              <Ticket size={13} /> {t('Free trial')}
                            </button>
                          ))}
                          {open && (
                            <>
                              {/* After a call: mark it done and push the next one out a few days. */}
                              <button onClick={() => void quickStatus(l, { status: l.status === 'new' ? 'contacted' : l.status, followUpOn: plusDays(3) })}
                                className={`${secondaryButton} !py-1 !px-2.5 text-xs`}>
                                <CalendarClock size={13} /> {t('Called · +3 days')}
                              </button>
                              <button onClick={() => convert(l)} className={`${primaryButton} !py-1 !px-2.5 text-xs`}><UserPlus size={13} /> {t('Make member')}</button>
                              <IconButton icon={XCircle} label={t('Mark {name} as lost', { name: l.name })} tone="red"
                                onClick={() => setEditing({ ...l, status: 'lost' })} />
                            </>
                          )}
                          <IconButton icon={Pencil} label={t('Edit {name}', { name: l.name })} onClick={() => setEditing(l)} />
                          <IconButton icon={Trash2} label={t('Delete {name}', { name: l.name })} tone="red" onClick={() => setDeleting(l)} />
                        </div>
                      </div>
                    </Card>
                  );
                })}
                {data.hasMore && (
                  <p className="text-center text-xs text-gray-400 pt-2">{t('Showing the first {count} — search to narrow down.', { count: data.data.length })}</p>
                )}
              </div>
            )}
          </Refetching>
        </>
      )}

      {editing && (
        <LeadFormModal lead={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); void reload(); }} />
      )}
      {trialFor && (
        <TrialModal lead={trialFor} onClose={() => setTrialFor(null)}
          onDone={() => { setTrialFor(null); void reload(); }} />
      )}
      {deleting && (
        <ConfirmDialog
          title={t('Delete lead')}
          message={t('Delete {name} from your leads?', { name: deleting.name })}
          confirmLabel={t('Delete')}
          tone="danger"
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Page>
  );
}
