import { useMemo, useState, type FormEvent } from 'react';
import { HandCoins, MessageCircle, Search, Wallet, Receipt, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import {
  Page, PageHeader, Card, StatTile, PageLoader, LoadFailed, EmptyState, Refetching,
  FieldLabel, inputClass, primaryButton, secondaryButton, focusRing,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { hasPermission } from '../utils/permissions';
import { CHANNELS, CHANNEL_LABELS } from '../utils/paymentChannels';
import { openWhatsApp, createDuesMessage } from '../utils/whatsapp';
import type { Balances, MembershipBalance, PaymentChannel, PaymentMethod } from '../types';

const money = (n: number): string => `Rs. ${n.toLocaleString('en-PK')}`;

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Takes an instalment against a membership's balance. Recorded as an ordinary
 * paid membership payment linked to that membership, which is exactly what
 * shrinks the balance — there is no separate instalment ledger to drift.
 */
function CollectModal({ row, onClose, onCollected }: {
  row: MembershipBalance; onClose: () => void; onCollected: () => void;
}) {
  const { t } = useLanguage();
  const [amount, setAmount] = useState(String(row.outstanding));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [channel, setChannel] = useState<PaymentChannel | ''>('');
  const [saving, setSaving] = useState(false);
  const n = Number(amount) || 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (n <= 0 || n > row.outstanding) {
      toast.error(t('Enter an amount between 1 and {max}', { max: row.outstanding }));
      return;
    }
    setSaving(true);
    try {
      await api.post('/payments', {
        memberId: row.member.id,
        membershipId: row.membershipId,
        amount: n,
        method,
        ...(method === 'online' && { channel: channel || null }),
        status: 'paid',
        type: 'membership',
        notes: n < row.outstanding ? 'Instalment' : 'Balance cleared',
      });
      toast.success(n < row.outstanding
        ? t('{received} received · {left} still due', { received: money(n), left: money(row.outstanding - n) })
        : t('Balance cleared'));
      onCollected();
    } catch (err) {
      toast.error(apiError(err, t('Could not record payment')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('Collect payment')} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 px-3 py-2.5 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">{t('Member')}</span><span className="font-semibold">{row.member.name} · {row.member.memberNo}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">{t('Plan')}</span><span className="font-semibold">{row.membership.planName}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">{t('Paid so far')}</span><span className="font-semibold">{t('{paid} of {expected}', { paid: money(row.paid), expected: money(row.expected) })}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">{t('Outstanding')}</span><span className="font-bold text-red-600">{money(row.outstanding)}</span></div>
        </div>
        <div>
          <FieldLabel htmlFor="collect-amount" required>{t('Amount (Rs.)')}</FieldLabel>
          <input
            id="collect-amount" type="number" min={1} max={row.outstanding} step={1} required
            value={amount} onChange={e => setAmount(e.target.value)} className={inputClass}
          />
          {n > 0 && n < row.outstanding && (
            <p className="text-xs text-gray-400 mt-1">{t('{amount} will remain due.', { amount: money(row.outstanding - n) })}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['cash', 'online'] as PaymentMethod[]).map(m => (
            <button key={m} type="button" onClick={() => { setMethod(m); if (m === 'cash') setChannel(''); }}
              className={`border rounded-xl py-2.5 text-xs font-semibold capitalize transition-all ${focusRing} ${
                method === m
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700'
                  : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300'
              }`}>
              {m === 'cash' ? t('Cash') : t('Online')}
            </button>
          ))}
        </div>
        {method === 'online' && (
          <select value={channel} onChange={e => setChannel(e.target.value as PaymentChannel | '')}
            aria-label={t('Received in')} className={inputClass}>
            <option value="">{t('Select account')}</option>
            {CHANNELS.map(c => <option key={c} value={c}>{t(CHANNEL_LABELS[c])}</option>)}
          </select>
        )}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
            {saving ? t('Saving…') : t('Collect {amount}', { amount: n > 0 ? money(n) : '' })}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Everybody who owes the gym money — part-paid memberships and standalone
 * charges — with what to do about each: take the money, or remind them.
 *
 * The automatic WhatsApp reminder runs every few days on its own; the button
 * here is for the desk to nudge somebody now.
 */
export default function Dues() {
  const { gym, user, isOwner } = useAuth();
  const { t } = useLanguage();
  const { data, loading, refetching, reload } = useFetch<Balances>('/payments/balances', t('Could not load dues'));
  const [search, setSearch] = useState('');
  const [collecting, setCollecting] = useState<MembershipBalance | null>(null);
  const [settling, setSettling] = useState<string | null>(null);

  const can = (action: 'canRecordPayments' | 'canManagePayments') =>
    isOwner || (!!user?.staffPermission && hasPermission(user.role, user.staffPermission, action));

  const q = search.trim().toLowerCase();
  const match = (m: { name: string; memberNo: string; phone: string | null }) =>
    !q || m.name.toLowerCase().includes(q) || m.memberNo.toLowerCase().includes(q) || (m.phone ?? '').includes(q);

  const memberships = useMemo(() => data?.memberships.filter(r => match(r.member)) ?? [], [data, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const charges = useMemo(() => data?.charges.filter(r => match(r.member)) ?? [], [data, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const remind = (m: { name: string; phone: string | null }, amount: number, forWhat?: string) => {
    if (!m.phone) { toast.error(t('No phone number recorded for this member')); return; }
    openWhatsApp(m.phone, createDuesMessage({ memberName: m.name, gymName: gym?.name, amount, forWhat }));
  };

  const markPaid = async (paymentId: string) => {
    setSettling(paymentId);
    try {
      await api.put(`/payments/${paymentId}`, { status: 'paid' });
      toast.success(t('Marked as paid'));
      await reload();
    } catch (err) {
      toast.error(apiError(err, t('Could not update payment')));
    } finally {
      setSettling(null);
    }
  };

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title={t('Could not load dues')} />;

  const owingMembers = new Set([...data.memberships, ...data.charges].map(r => r.member.id)).size;
  const nothing = data.memberships.length === 0 && data.charges.length === 0;

  return (
    <Page>
      <PageHeader icon={HandCoins} title={t('Pending Dues')} subtitle={t('Who owes money, and how much')} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <StatTile icon={Wallet} label={t('Total outstanding')} value={money(data.totalOutstanding)} tone="red" />
        <StatTile icon={Users} label={t('Members owing')} value={owingMembers} tone="yellow" />
        <StatTile icon={Receipt} label={t('Part-paid memberships')} value={data.memberships.length} tone="purple" />
      </div>

      {nothing ? (
        <EmptyState icon={HandCoins} title={t('Nobody owes anything')} hint={t('When a member pays part of a fee, the rest shows up here until it is collected.')} />
      ) : (
        <Refetching busy={refetching}>
          <Card className="p-3 mb-4">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input type="search" value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('Search name, ID or phone...')} aria-label={t('Search dues')} className={`${inputClass} pl-9`} />
            </div>
          </Card>

          {memberships.length > 0 && (
            <Card className="p-5 mb-5">
              <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">{t('Membership balances')}</h2>
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {memberships.map(r => (
                  <li key={r.membershipId} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                        {r.member.name} <span className="text-xs font-medium text-gray-400">{r.member.memberNo}</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {r.membership.planName} · {t('paid {paid} of {expected}', { paid: money(r.paid), expected: money(r.expected) })}
                        {' · '}
                        {r.membership.daysLeft < 0
                          ? t('expired {days}d ago', { days: Math.abs(r.membership.daysLeft) })
                          : t('{days}d left', { days: r.membership.daysLeft })}
                      </p>
                      {/* How far along the instalments are. */}
                      <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden max-w-xs">
                        <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (r.paid / r.expected) * 100)}%` }} />
                      </div>
                    </div>
                    <p className="text-base font-bold text-red-600 dark:text-red-400 shrink-0">{money(r.outstanding)}</p>
                    <div className="flex gap-2 shrink-0">
                      {r.member.phone && (
                        <button onClick={() => remind(r.member, r.outstanding, r.membership.planName)}
                          className={`${secondaryButton} !py-1.5 !px-3 text-emerald-600`}>
                          <MessageCircle size={14} /> {t('Remind')}
                        </button>
                      )}
                      {can('canRecordPayments') && (
                        <button onClick={() => setCollecting(r)} className={`${primaryButton} !py-1.5 !px-3`}>
                          {t('Collect')}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {charges.length > 0 && (
            <Card className="p-5">
              <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">{t('Other unpaid charges')}</h2>
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {charges.map(c => (
                  <li key={c.paymentId} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                        {c.member.name} <span className="text-xs font-medium text-gray-400">{c.member.memberNo}</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 capitalize">
                        {c.notes || t(c.type.charAt(0).toUpperCase() + c.type.slice(1))} · {shortDate(c.paymentDate)}
                      </p>
                    </div>
                    <p className="text-base font-bold text-red-600 dark:text-red-400 shrink-0">{money(c.amount)}</p>
                    <div className="flex gap-2 shrink-0">
                      {c.member.phone && (
                        <button onClick={() => remind(c.member, c.amount, c.notes ?? undefined)}
                          className={`${secondaryButton} !py-1.5 !px-3 text-emerald-600`}>
                          <MessageCircle size={14} /> {t('Remind')}
                        </button>
                      )}
                      {can('canManagePayments') && (
                        <button onClick={() => void markPaid(c.paymentId)} disabled={settling === c.paymentId}
                          className={`${primaryButton} !py-1.5 !px-3`}>
                          {settling === c.paymentId ? t('Saving…') : t('Mark paid')}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {memberships.length === 0 && charges.length === 0 && (
            <EmptyState icon={Search} title={t('Nobody matches that search')} />
          )}
        </Refetching>
      )}

      {collecting && (
        <CollectModal
          row={collecting}
          onClose={() => setCollecting(null)}
          onCollected={() => { setCollecting(null); void reload(); }}
        />
      )}
    </Page>
  );
}
