import { useMemo, useState } from 'react';
import { Building2, Users, Activity, Hourglass, CalendarClock, Wallet, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import {
  Page, PageHeader, Card, StatTile, PageLoader, LoadFailed, EmptyState, Refetching,
  SegmentedControl, inputClass, primaryButton, secondaryButton, dangerButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useLanguage } from '../context/LanguageContext';

type GymStatus = 'active' | 'pending' | 'suspended';
type SubState = 'unpaid' | 'expired' | 'expiring' | 'paid' | 'stopped';

interface PlatformGym {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string | null;
  phone: string | null;
  plan: string;
  status: GymStatus;
  suspendedReason: string | null;
  createdAt: string;
  staffAccounts: number;
  members: number;
  activeUsers7d: number;
  lastLoginAt: string | null;
  subscription: null | {
    plan: string; amount: number; cycle: string; periodDays: number;
    paidThrough: string | null; daysLeft: number | null; state: SubState;
  };
  openInvoice: null | { amount: number; dueDate: string };
}

interface PlatformData {
  summary: {
    gyms: number; active: number; pending: number; suspended: number;
    members: number; activeUsers7d: number; expiringSoon: number; expired: number;
    monthlyRevenue: number;
  };
  gyms: PlatformGym[];
}

type Filter = 'all' | 'pending' | 'active' | 'suspended' | 'expiring';

const money = (n: number): string => `Rs. ${n.toLocaleString('en-PK')}`;
const day = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

const PILL = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  amber: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
  red: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20',
  gray: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  blue: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
} as const;

function Pill({ tone, children }: { tone: keyof typeof PILL; children: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${PILL[tone]}`}>
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: GymStatus }) {
  const { t } = useLanguage();
  if (status === 'active') return <Pill tone="green">{t('Active')}</Pill>;
  if (status === 'pending') return <Pill tone="amber">{t('Waiting for approval')}</Pill>;
  return <Pill tone="red">{t('Suspended')}</Pill>;
}

/** When the gym's own subscription to us runs out, in the words an operator wants. */
function Expiry({ gym }: { gym: PlatformGym }) {
  const { t } = useLanguage();
  const s = gym.subscription;
  if (!s) return <span className="text-xs text-gray-400">{t('No paid plan')}</span>;
  if (s.state === 'stopped') return <Pill tone="gray">{t('Billing stopped')}</Pill>;
  if (s.paidThrough === null || s.daysLeft === null) return <Pill tone="amber">{t('Not paid yet')}</Pill>;

  const tone = s.state === 'expired' ? 'red' : s.state === 'expiring' ? 'amber' : 'green';
  const text = s.daysLeft < 0
    ? `${t('Expired')} ${Math.abs(s.daysLeft)} ${t('days ago')}`
    : s.daysLeft === 0
      ? t('Expires today')
      : `${s.daysLeft} ${t('days left')}`;
  return (
    <div className="space-y-0.5">
      <Pill tone={tone}>{text}</Pill>
      <p className="text-[11px] text-gray-500 dark:text-slate-400">
        {t('Until')} {day(s.paidThrough)}
      </p>
    </div>
  );
}

type Action = { gym: PlatformGym; kind: 'approve' | 'suspend' | 'resume' };

export default function Platform() {
  const { t } = useLanguage();
  const { data, loading, refetching, reload } = useFetch<PlatformData>(
    '/platform/gyms',
    'Could not load gyms',
  );
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<PlatformGym | null>(null);
  const [typedName, setTypedName] = useState('');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.gyms ?? []).filter(g => {
      if (filter === 'expiring') {
        if (g.subscription?.state !== 'expiring' && g.subscription?.state !== 'expired') return false;
      } else if (filter !== 'all' && g.status !== filter) {
        return false;
      }
      return !q || [g.name, g.ownerName, g.ownerEmail ?? '', g.phone ?? ''].some(v => v.toLowerCase().includes(q));
    });
  }, [data, filter, search]);

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title="Could not load gyms" onRetry={reload} />;
  const { summary } = data;

  const run = async () => {
    if (!action) return;
    setBusy(true);
    try {
      await api.post(`/platform/gyms/${action.gym.id}/${action.kind}`, {});
      toast.success(t(action.kind === 'approve' ? 'Gym approved' : action.kind === 'resume' ? 'Gym resumed' : 'Gym suspended'));
      setAction(null);
      await reload();
    } catch (err) {
      toast.error(apiError(err, t('Could not update the gym')));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await api.delete(`/platform/gyms/${removing.id}`, { data: { confirmName: typedName } });
      toast.success(t('Gym deleted'));
      setRemoving(null);
      await reload();
    } catch (err) {
      toast.error(apiError(err, t('Could not delete the gym')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader
        icon={Building2}
        title="Platform"
        subtitle="Every gym on your app: who uses it and when their plan runs out"
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <StatTile icon={Building2} label="Gyms" value={summary.gyms} hint={`${summary.active} active`} />
        <StatTile icon={Hourglass} label="Waiting for approval" value={summary.pending} tone={summary.pending ? 'yellow' : 'gray'} />
        <StatTile icon={Users} label="Members (all gyms)" value={summary.members.toLocaleString('en-PK')} tone="purple" />
        <StatTile icon={Activity} label="Signed in this week" value={summary.activeUsers7d} tone="green" />
        <StatTile icon={CalendarClock} label="Expiring or expired" value={summary.expiringSoon + summary.expired} tone={summary.expired ? 'red' : 'yellow'} hint={`${summary.expired} expired`} />
        <StatTile icon={Wallet} label="Expected per month" value={money(summary.monthlyRevenue)} tone="green" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: summary.gyms },
            { value: 'pending', label: 'Pending', count: summary.pending },
            { value: 'active', label: 'Active', count: summary.active },
            { value: 'suspended', label: 'Suspended', count: summary.suspended },
            { value: 'expiring', label: 'Expiring', count: summary.expiringSoon + summary.expired },
          ]}
        />
        <div className="relative sm:ml-auto sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('Search gym, owner, email, phone')}
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      <Refetching busy={refetching}>
        {rows.length === 0 ? (
          <EmptyState icon={Building2} title="No gyms match" hint="Try another filter or search." />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
                  <th className="p-3 font-semibold">{t('Gym')}</th>
                  <th className="p-3 font-semibold">{t('Status')}</th>
                  <th className="p-3 font-semibold">{t('Usage')}</th>
                  <th className="p-3 font-semibold">{t('Plan & billing')}</th>
                  <th className="p-3 font-semibold">{t('Subscription')}</th>
                  <th className="p-3 font-semibold text-right">{t('Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {rows.map(g => (
                  <tr key={g.id} className="align-top">
                    <td className="p-3">
                      <p className="font-bold text-gray-900 dark:text-slate-100">{g.name}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{g.ownerName}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{g.ownerEmail}</p>
                      {g.phone && <p className="text-xs text-gray-500 dark:text-slate-400">{g.phone}</p>}
                      <p className="text-[11px] text-gray-400 mt-0.5">{t('Joined')} {day(g.createdAt)}</p>
                    </td>
                    <td className="p-3">
                      <StatusPill status={g.status} />
                      {g.status === 'suspended' && g.suspendedReason && (
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 max-w-[160px]">{g.suspendedReason}</p>
                      )}
                    </td>
                    <td className="p-3 text-xs space-y-0.5 text-gray-600 dark:text-slate-300">
                      <p><b>{g.members}</b> {t('members')}</p>
                      <p><b>{g.staffAccounts}</b> {t('staff logins')}</p>
                      <p><b>{g.activeUsers7d}</b> {t('active this week')}</p>
                      <p className="text-gray-400">
                        {g.lastLoginAt ? `${t('Last login')} ${day(g.lastLoginAt)}` : t('Never signed in')}
                      </p>
                    </td>
                    <td className="p-3 text-xs space-y-0.5">
                      <p className="font-bold text-gray-900 dark:text-slate-100">{g.plan}</p>
                      {g.subscription ? (
                        <>
                          <p className="text-gray-600 dark:text-slate-300">{money(g.subscription.amount)}</p>
                          <Pill tone="blue">{g.subscription.cycle}</Pill>
                        </>
                      ) : (
                        <p className="text-gray-400">—</p>
                      )}
                    </td>
                    <td className="p-3">
                      <Expiry gym={g} />
                      {g.openInvoice && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                          {t('Invoice')} {money(g.openInvoice.amount)} {t('due')} {day(g.openInvoice.dueDate)}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {g.status === 'pending' && (
                        <button className={primaryButton} onClick={() => setAction({ gym: g, kind: 'approve' })}>
                          {t('Approve')}
                        </button>
                      )}
                      {g.status === 'suspended' && (
                        <button className={secondaryButton} onClick={() => setAction({ gym: g, kind: 'resume' })}>
                          {t('Resume')}
                        </button>
                      )}
                      {g.status === 'active' && (
                        <button className={secondaryButton} onClick={() => setAction({ gym: g, kind: 'suspend' })}>
                          {t('Suspend')}
                        </button>
                      )}
                      <button
                        className={`${dangerButton} ml-2`}
                        onClick={() => { setTypedName(''); setRemoving(g); }}
                      >
                        {t('Delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Refetching>

      {action && (
        <ConfirmDialog
          title={t(action.kind === 'approve' ? 'Approve gym' : action.kind === 'resume' ? 'Resume gym' : 'Suspend gym')}
          message={t(
            action.kind === 'suspend'
              ? `${action.gym.name} will be locked out until you resume it. Nothing is deleted.`
              : `${action.gym.name} will be able to sign in and use the whole app.`,
          )}
          confirmLabel={t(action.kind === 'approve' ? 'Approve' : action.kind === 'resume' ? 'Resume' : 'Suspend')}
          tone={action.kind === 'suspend' ? 'danger' : 'primary'}
          busy={busy}
          onConfirm={run}
          onCancel={() => setAction(null)}
        />
      )}
      {removing && (
        <Modal title={t('Delete gym permanently')} onClose={() => setRemoving(null)}>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            {t('This erases the gym, its owner and staff logins, members, payments and every other record. It cannot be undone.')}
          </p>
          <p className="text-sm mt-3 text-gray-600 dark:text-slate-300">
            {t('Type the gym name to confirm:')} <b>{removing.name}</b>
          </p>
          <input
            value={typedName}
            onChange={e => setTypedName(e.target.value)}
            className={`${inputClass} mt-2`}
            autoFocus
          />
          <div className="flex gap-3 pt-5">
            <button type="button" onClick={() => setRemoving(null)} className={`flex-1 ${secondaryButton}`}>
              {t('Cancel')}
            </button>
            <button
              type="button"
              disabled={busy || typedName.trim() !== removing.name}
              onClick={remove}
              className={`flex-1 ${dangerButton}`}
            >
              {busy ? t('Working...') : t('Delete forever')}
            </button>
          </div>
        </Modal>
      )}
    </Page>
  );
}
