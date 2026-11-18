import { useEffect, useState, type FormEvent } from 'react';
import { Ticket, Plus, Trash2, Users, Wallet, Search, UserCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, StatTile, PageLoader, LoadFailed, EmptyState, Refetching,
  FieldLabel, IconButton, inputClass, primaryButton, secondaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { cachedResponse, useFetch } from '../hooks/useFetch';
import { useDebounced } from '../hooks/useDebounced';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { hasPermission } from '../utils/permissions';
import type { DayPass, DayPassList, GymSettings, PaginatedMembers, PaymentChannel } from '../types';

/** Today in the gym's calendar, as the yyyy-mm-dd a date input holds. */
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Karachi' });
const money = (n: number) => `Rs. ${n.toLocaleString()}`;

type Host = { id: string; name: string; memberNo: string };

/** Picks the member a guest came with. Optional — most day passes have none. */
function HostPicker({ host, onChange }: { host: Host | null; onChange: (h: Host | null) => void }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const [results, setResults] = useState<Host[]>([]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) { setResults([]); return; }
    let stale = false;
    void api.get<PaginatedMembers>('/members', { params: { search: q, limit: 6 } })
      .then(r => { if (!stale) setResults(r.data.data); })
      .catch(() => { if (!stale) setResults([]); });
    return () => { stale = true; };
  }, [debounced]);

  if (host) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-purple-200 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-500/10 px-3 py-2">
        <span className="text-sm"><UserCheck size={14} className="inline -mt-0.5 mr-1 text-purple-600" />
          {t('Guest of')} <strong>{host.name}</strong> <span className="text-xs text-gray-400">{host.memberNo}</span>
        </span>
        <IconButton icon={X} label={t('Remove host member')} onClick={() => onChange(null)} />
      </div>
    );
  }
  return (
    <div>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input id="dp-host" type="search" value={query} onChange={e => setQuery(e.target.value)}
          placeholder={t('Search member by name, ID or phone…')} className={`${inputClass} pl-9`} />
      </div>
      {results.length > 0 && (
        <ul className="mt-1 rounded-lg border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-800">
          {results.map(m => (
            <li key={m.id}>
              <button type="button" onClick={() => { onChange(m); setQuery(''); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800">
                <strong>{m.name}</strong> <span className="text-xs text-gray-400">{m.memberNo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SellModal({ defaultFee, onClose, onDone }: { defaultFee: number; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState(defaultFee > 0 ? String(defaultFee) : '');
  const [paidBy, setPaidBy] = useState<'cash' | PaymentChannel>('cash');
  const [host, setHost] = useState<Host | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/day-passes', {
        name: name.trim(),
        phone: phone.trim(),
        amount: Number(amount) || 0,
        method: paidBy === 'cash' ? 'cash' : 'online',
        ...(paidBy !== 'cash' && { channel: paidBy }),
        hostMemberId: host?.id,
        notes: notes.trim(),
      });
      toast.success(t('Day pass recorded for {name}', { name: name.trim() }));
      onDone();
    } catch (err) {
      toast.error(apiError(err, t('Could not record day pass')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('Sell day pass')} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="dp-name" required>{t('Name')}</FieldLabel>
            <input id="dp-name" required autoFocus maxLength={100} value={name} onChange={e => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <FieldLabel htmlFor="dp-phone">{t('Phone')}</FieldLabel>
            <input id="dp-phone" type="tel" inputMode="tel" maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} placeholder="03xx xxxxxxx" className={inputClass} />
          </div>
          <div>
            <FieldLabel htmlFor="dp-amount" required>{t('Amount (Rs.)')}</FieldLabel>
            <input id="dp-amount" type="number" min={0} required inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} placeholder={t('0 = free')} className={inputClass} />
          </div>
          <div>
            <FieldLabel htmlFor="dp-method">{t('Paid by')}</FieldLabel>
            <select id="dp-method" value={paidBy} onChange={e => setPaidBy(e.target.value as typeof paidBy)} className={inputClass}>
              <option value="cash">{t('Cash')}</option>
              <option value="easypaisa">{t('Easypaisa')}</option>
              <option value="jazzcash">{t('JazzCash')}</option>
              <option value="bank">{t('Bank')}</option>
            </select>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="dp-host">{t('Guest of a member? (optional)')}</FieldLabel>
          <HostPicker host={host} onChange={setHost} />
        </div>
        <div>
          <FieldLabel htmlFor="dp-notes">{t('Notes')}</FieldLabel>
          <input id="dp-notes" maxLength={300} value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>{saving ? t('Saving…') : t('Record')}</button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * One-day entries for walk-ins and members' guests.
 *
 * Opens on today, because that is the desk's question; the date picker reads
 * back any other day. The money here is counted in the dashboard and the
 * payment reports alongside fees, as "Day passes".
 */
export default function DayPasses() {
  const { t } = useLanguage();
  const { user, isOwner } = useAuth();
  const canDelete = isOwner || (!!user?.staffPermission && hasPermission(user.role, user.staffPermission, 'canManagePayments'));
  const [day, setDay] = useState(today);
  const [selling, setSelling] = useState(false);
  const [deleting, setDeleting] = useState<DayPass | null>(null);
  const [busy, setBusy] = useState(false);
  const [defaultFee, setDefaultFee] = useState(() => cachedResponse<GymSettings>('/gym-settings')?.dayPassFee ?? 0);

  const { data, loading, refetching, reload } = useFetch<DayPassList>(
    `/day-passes?${new URLSearchParams({ from: day, to: day })}`, t('Could not load day passes'),
  );

  useEffect(() => {
    void api.get<GymSettings>('/gym-settings')
      .then(r => setDefaultFee(r.data.dayPassFee ?? 0))
      .catch(() => { /* the fee is only a prefill */ });
  }, []);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/day-passes/${deleting.id}`);
      toast.success(t('Day pass deleted'));
      setDeleting(null);
      await reload();
    } catch (err) {
      toast.error(apiError(err, t('Could not delete day pass')));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title={t('Could not load day passes')} onRetry={() => void reload()} />;

  const isToday = day === today();
  const sellButton = <button onClick={() => setSelling(true)} className={primaryButton}><Plus size={16} /> {t('Sell day pass')}</button>;

  return (
    <Page>
      <PageHeader icon={Ticket} title={t('Day Passes')} subtitle={t('One-day entry for walk-ins and guests')} action={sellButton} />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <FieldLabel htmlFor="dp-day">{t('Day')}</FieldLabel>
          <input id="dp-day" type="date" max={today()} value={day} onChange={e => setDay(e.target.value || today())} className={inputClass} />
        </div>
        {!isToday && <button onClick={() => setDay(today())} className={secondaryButton}>{t('Today')}</button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <StatTile icon={Ticket} label={t('Day passes')} value={data.totals.count} tone="blue" />
        <StatTile icon={Wallet} label={t('Collected')} value={money(data.totals.amount)} tone="green" />
        <StatTile icon={Users} label={t("Members' guests")} value={data.totals.guests} tone="purple" />
      </div>

      <Refetching busy={refetching}>
        {data.data.length === 0 ? (
          <EmptyState icon={Ticket}
            title={isToday ? t('No day passes today') : t('No day passes on this day')}
            hint={t('Record anyone who pays for a single visit — the money is added to your reports.')}
            action={isToday ? sellButton : undefined} />
        ) : (
          <div className="space-y-2">
            {data.data.map(p => (
              <Card key={p.id} className="p-3 sm:p-4 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{p.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                    {[
                      time(p.visitedAt),
                      p.phone,
                      p.hostMember && t('Guest of {name}', { name: p.hostMember.name }),
                      p.notes,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900 dark:text-slate-100 tabular-nums">{p.amount > 0 ? money(p.amount) : t('Free')}</p>
                  <p className="text-[11px] text-gray-400 capitalize">{p.method === 'cash' ? t('Cash') : (p.channel ?? t('Online'))}</p>
                </div>
                {canDelete && (
                  <IconButton icon={Trash2} label={t('Delete {name}', { name: p.name })} tone="red" onClick={() => setDeleting(p)} />
                )}
              </Card>
            ))}
          </div>
        )}
      </Refetching>

      {selling && <SellModal defaultFee={defaultFee} onClose={() => setSelling(false)}
        onDone={() => { setSelling(false); setDay(today()); void reload(); }} />}
      {deleting && (
        <ConfirmDialog
          title={t('Delete day pass')}
          message={t("Delete {name}'s day pass? The money will be removed from your reports.", { name: deleting.name })}
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
