import { useMemo, useState, type FormEvent } from 'react';
import {
  UserPlus, Plus, Search, MessageCircle, Pencil, Trash2, PhoneCall, CalendarClock, UserCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import MemberFormModal from '../components/members/MemberFormModal';
import {
  Page, PageHeader, Card, PageLoader, LoadFailed, EmptyState, Refetching, SegmentedControl,
  FieldLabel, IconButton, inputClass, primaryButton, secondaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useDebounced } from '../hooks/useDebounced';
import { useAuth } from '../context/AuthContext';
import { openWhatsApp, createLeadFollowUpMessage } from '../utils/whatsapp';
import type {
  GymSettings, Lead, LeadList, LeadStatus, Member, MembershipPlan, Paginated, Trainer,
} from '../types';

/** The sources offered first; anything else can be typed. */
const SOURCES = ['walk-in', 'call', 'whatsapp', 'referral', 'social', 'other'] as const;

/** What the desk can set by hand. `converted` only happens through Convert. */
const EDITABLE_STATUSES: readonly LeadStatus[] = ['new', 'contacted', 'trial', 'lost'];

type Tab = 'due' | 'open' | LeadStatus | 'all';

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  contacted: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300',
  trial: 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  converted: 'bg-lime-50 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300',
  lost: 'bg-gray-100 text-gray-500 dark:bg-slate-700/60 dark:text-slate-300',
};

const PAGE_SIZE = 50;

const toInput = (d: Date): string => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().split('T')[0]!;
};

const inDays = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toInput(d);
};

/** "Today", "Tomorrow", "3 days overdue", or a date. */
function followUpLabel(iso: string): { text: string; overdue: boolean } {
  const day = new Date(iso);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return { text: 'Today', overdue: false };
  if (diff === 1) return { text: 'Tomorrow', overdue: false };
  if (diff < 0) return { text: `${-diff}d overdue`, overdue: true };
  return { text: day.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }), overdue: false };
}

interface LeadForm {
  name: string;
  phone: string;
  source: string;
  interest: string;
  notes: string;
  status: LeadStatus;
  followUpOn: string;
}

const formFor = (lead: Lead | null): LeadForm => lead
  ? {
      name: lead.name,
      phone: lead.phone ?? '',
      source: lead.source,
      interest: lead.interest ?? '',
      notes: lead.notes ?? '',
      status: lead.status,
      followUpOn: lead.followUpOn ? toInput(new Date(lead.followUpOn)) : '',
    }
  : {
      name: '', phone: '', source: 'walk-in', interest: '', notes: '', status: 'new',
      // Somebody who just asked is worth a call in a couple of days.
      followUpOn: inDays(2),
    };

function LeadFormModal({ lead, onClose, onSaved }: {
  lead: Lead | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<LeadForm>(() => formFor(lead));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof LeadForm>(k: K) => (v: LeadForm[K]) => setForm(f => ({ ...f, [k]: v }));
  const converted = lead?.status === 'converted';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      source: form.source.trim() || 'walk-in',
      interest: form.interest.trim(),
      notes: form.notes.trim(),
      followUpOn: form.followUpOn,
      // A converted lead's status is fixed; sending it would be refused.
      ...(!converted && { status: form.status }),
    };
    try {
      if (lead) await api.put(`/leads/${lead.id}`, body);
      else await api.post('/leads', body);
      toast.success(lead ? 'Lead updated' : 'Lead added');
      onSaved();
    } catch (err) {
      toast.error(apiError(err, 'Could not save lead'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={lead ? 'Edit lead' : 'New enquiry'} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <div>
          <FieldLabel htmlFor="lead-name" required>Name</FieldLabel>
          <input id="lead-name" required maxLength={100} value={form.name}
            onChange={e => set('name')(e.target.value)} className={inputClass} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="lead-phone">Phone</FieldLabel>
            <input id="lead-phone" type="tel" maxLength={30} value={form.phone}
              onChange={e => set('phone')(e.target.value)} placeholder="03xx xxxxxxx" className={inputClass} />
          </div>
          <div>
            <FieldLabel htmlFor="lead-source">Source</FieldLabel>
            <input id="lead-source" list="lead-sources" maxLength={40} value={form.source}
              onChange={e => set('source')(e.target.value)} className={inputClass} />
            <datalist id="lead-sources">{SOURCES.map(s => <option key={s} value={s} />)}</datalist>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="lead-interest">Interested in</FieldLabel>
          <input id="lead-interest" maxLength={200} value={form.interest}
            onChange={e => set('interest')(e.target.value)} placeholder="e.g. weight loss, evening batch, PT"
            className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="lead-status">Status</FieldLabel>
            {converted ? (
              <p className="text-sm font-semibold text-lime-700 py-2.5">Joined</p>
            ) : (
              <select id="lead-status" value={form.status}
                onChange={e => set('status')(e.target.value as LeadStatus)} className={`${inputClass} capitalize`}>
                {EDITABLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>
          <div>
            <FieldLabel htmlFor="lead-followup">Follow up on</FieldLabel>
            <input id="lead-followup" type="date" value={form.followUpOn}
              onChange={e => set('followUpOn')(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="lead-notes">Notes</FieldLabel>
          <textarea id="lead-notes" rows={3} maxLength={1000} value={form.notes}
            onChange={e => set('notes')(e.target.value)} className={inputClass} />
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>Cancel</button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
            {saving ? 'Saving…' : lead ? 'Save' : 'Add lead'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** What the registration form needs, fetched only when somebody converts. */
interface RegisterContext {
  plans: MembershipPlan[];
  trainers: Trainer[];
  settings: GymSettings | null;
}

/**
 * Walk-ins and phone enquiries: who asked, what about, and when to call them
 * back. The "Follow up" tab is the list to work through each day.
 */
export default function Leads() {
  const { gym } = useAuth();
  const [tab, setTab] = useState<Tab>('due');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [editing, setEditing] = useState<Lead | null | 'new'>(null);
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState<Lead | null>(null);
  const [registerCtx, setRegisterCtx] = useState<RegisterContext | null>(null);

  const url = useMemo(() => {
    const q = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (tab === 'due') q.set('due', 'true');
    else if (tab !== 'all') q.set('status', tab);
    if (debounced.trim()) q.set('search', debounced.trim());
    return `/leads?${q.toString()}`;
  }, [tab, debounced]);

  const { data, loading, refetching, reload } = useFetch<LeadList>(url, 'Could not load leads');

  const leads = data?.data ?? [];
  const counts = data?.counts;

  const followUp = (l: Lead) => {
    if (!l.phone) { toast.error('No phone number for this lead'); return; }
    openWhatsApp(l.phone, createLeadFollowUpMessage({ name: l.name, gymName: gym?.name, interest: l.interest }));
    // Messaging a brand-new lead is contacting them.
    if (l.status === 'new') {
      void api.put(`/leads/${l.id}`, { status: 'contacted' }).then(() => reload()).catch(() => {});
    }
  };

  const quickStatus = async (l: Lead, status: LeadStatus) => {
    try {
      await api.put(`/leads/${l.id}`, { status });
      await reload();
    } catch (err) {
      toast.error(apiError(err, 'Could not update lead'));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/leads/${deleting.id}`);
      toast.success('Lead deleted');
      setDeleting(null);
      await reload();
    } catch (err) {
      toast.error(apiError(err, 'Could not delete lead'));
    } finally {
      setBusy(false);
    }
  };

  const startConvert = async (l: Lead) => {
    if (!registerCtx) {
      try {
        const [plans, trainers, settings] = await Promise.all([
          api.get<Paginated<MembershipPlan>>('/membership-plans?all=true').then(r => r.data.data),
          api.get<Paginated<Trainer>>('/trainers?all=true').then(r => r.data.data.filter(t => t.isActive)).catch(() => []),
          api.get<GymSettings>('/gym-settings').then(r => r.data).catch(() => null),
        ]);
        setRegisterCtx({ plans, trainers, settings });
      } catch (err) {
        toast.error(apiError(err, 'Could not load membership plans'));
        return;
      }
    }
    setConverting(l);
  };

  const linkConverted = async (lead: Lead, member: Member | null) => {
    setConverting(null);
    if (!member) return;
    try {
      await api.post(`/leads/${lead.id}/convert`, { memberId: member.id });
      toast.success(`${lead.name} joined as ${member.memberNo}`);
    } catch (err) {
      toast.error(apiError(err, 'Member registered, but the lead could not be marked as joined'));
    }
    await reload();
  };

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title="Could not load leads" />;

  const openCount = counts ? counts.new + counts.contacted + counts.trial : 0;

  return (
    <Page>
      <PageHeader
        icon={UserPlus}
        title="Leads & Enquiries"
        subtitle={`${openCount} open · ${counts?.converted ?? 0} joined`}
        action={
          <button onClick={() => setEditing('new')} className={primaryButton}>
            <Plus size={16} /> <span className="hidden sm:inline">New enquiry</span><span className="sm:hidden">Add</span>
          </button>
        }
      />

      <Card className="p-2.5 sm:p-4 mb-4 space-y-3">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'due', label: 'Follow up', count: counts?.due },
            { value: 'open', label: 'Open', count: openCount },
            { value: 'new', label: 'New', count: counts?.new },
            { value: 'contacted', label: 'Contacted', count: counts?.contacted },
            { value: 'trial', label: 'Trial', count: counts?.trial },
            { value: 'converted', label: 'Joined', count: counts?.converted },
            { value: 'lost', label: 'Lost', count: counts?.lost },
            { value: 'all', label: 'All' },
          ]}
        />
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, phone or interest..." aria-label="Search leads" className={`${inputClass} pl-9`} />
        </div>
      </Card>

      {leads.length === 0 ? (
        tab === 'due' && !search ? (
          <EmptyState icon={CalendarClock} title="No follow-ups due" hint="Leads whose follow-up date is today or overdue show here." />
        ) : (
          <EmptyState
            icon={UserPlus}
            title={search ? 'No leads match that search' : 'No leads here yet'}
            hint="Write down everyone who visits or calls asking about the gym, so nobody is forgotten."
            action={<button onClick={() => setEditing('new')} className={primaryButton}><Plus size={16} /> New enquiry</button>}
          />
        )
      ) : (
        <Refetching busy={refetching}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {leads.map(l => {
              const due = l.followUpOn && l.status !== 'converted' && l.status !== 'lost'
                ? followUpLabel(l.followUpOn) : null;
              const open = l.status !== 'converted' && l.status !== 'lost';
              return (
                <Card key={l.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-slate-100 truncate">{l.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <PhoneCall size={11} /> {l.phone || 'No phone'} · <span className="capitalize">{l.source}</span>
                      </p>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[l.status]}`}>
                      {l.status === 'converted' ? 'Joined' : l.status}
                    </span>
                  </div>

                  {l.interest && <p className="text-sm text-gray-700 dark:text-slate-300">{l.interest}</p>}
                  {l.notes && <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">{l.notes}</p>}

                  {due && (
                    <p className={`text-xs font-semibold flex items-center gap-1 ${
                      due.overdue ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      <CalendarClock size={12} /> Follow up: {due.text}
                    </p>
                  )}
                  {l.convertedMember && (
                    <p className="text-xs font-semibold text-lime-700 dark:text-lime-300 flex items-center gap-1">
                      <UserCheck size={12} /> Joined as {l.convertedMember.memberNo}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-slate-800 mt-auto">
                    {l.phone && open && (
                      <button onClick={() => followUp(l)}
                        className={`${secondaryButton} !py-1.5 !px-2.5 text-xs text-emerald-600`}>
                        <MessageCircle size={13} /> WhatsApp
                      </button>
                    )}
                    {open && (
                      <button onClick={() => void startConvert(l)} className={`${primaryButton} !py-1.5 !px-2.5 text-xs`}>
                        <UserCheck size={13} /> Convert
                      </button>
                    )}
                    <div className="ml-auto flex items-center">
                      {open && l.status !== 'trial' && (
                        <button onClick={() => void quickStatus(l, 'trial')}
                          className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 px-1.5 hover:underline">
                          Trial
                        </button>
                      )}
                      {open && (
                        <button onClick={() => void quickStatus(l, 'lost')}
                          className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 px-1.5 hover:underline">
                          Lost
                        </button>
                      )}
                      <IconButton icon={Pencil} label={`Edit ${l.name}`} onClick={() => setEditing(l)} />
                      <IconButton icon={Trash2} label={`Delete ${l.name}`} tone="red" onClick={() => setDeleting(l)} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {data.hasMore && (
            <p className="text-center text-xs text-gray-400 mt-4">
              Showing the first {PAGE_SIZE} — search to narrow the list.
            </p>
          )}
        </Refetching>
      )}

      {editing && (
        <LeadFormModal
          lead={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete lead"
          message={`Delete ${deleting.name}? This cannot be undone.`}
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(null)}
        />
      )}

      {/* Converting is registering: the ordinary form, prefilled, and the
          new member is linked back to the lead once it exists. */}
      {converting && registerCtx && (
        <MemberFormModal
          member={null}
          prefill={{ name: converting.name, phone: converting.phone }}
          plans={registerCtx.plans}
          trainers={registerCtx.trainers}
          settings={registerCtx.settings}
          onClose={() => setConverting(null)}
          onSaved={created => void linkConverted(converting, created)}
        />
      )}
    </Page>
  );
}
