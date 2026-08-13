import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Search, X, Download, Pencil, Trash2, CreditCard, Wallet, AlertCircle, Receipt,
} from 'lucide-react';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, StatTile, PageLoader, EmptyState, Refetching, IconButton,
  SegmentedControl, FieldLabel, inputClass, primaryButton, secondaryButton,
} from '../components/ui';
import { useDebounced } from '../hooks/useDebounced';
import { toCsv, downloadCsv } from '../utils/csv';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type {
  Payment, Member, PaymentMethod, PaymentStatus, PaymentType, PaymentSummary,
  Paginated, PaginatedPayments,
} from '../types';
import toast from 'react-hot-toast';

interface PaymentForm {
  memberId: string;
  amount: string;
  method: PaymentMethod;
  notes: string;
  status: PaymentStatus;
  type: PaymentType;
  /** '' means "not against a membership", which is what the API stores as null. */
  membershipId: string;
  paymentDate: string;
}

const today = () => new Date().toISOString().split('T')[0]!;

const emptyForm = (): PaymentForm => ({
  memberId: '', amount: '', method: 'cash', notes: '', status: 'paid',
  type: 'membership', membershipId: '', paymentDate: today(),
});

const TYPE_LABELS: Record<PaymentType, string> = {
  membership: 'Membership fee',
  supplement: 'Supplement',
  other: 'Other',
};

type Filter = 'all' | PaymentStatus;

const FILTERS = [
  { value: 'all' as const, label: 'All' },
  { value: 'paid' as const, label: 'Paid' },
  { value: 'due' as const, label: 'Due' },
];

/** Rows per request. The table stops being something anyone reads long before
 *  this, so the rest are fetched on demand rather than shipped up front. */
const PAGE_SIZE = 50;

/** How many months of history the summary covers — the same window as the
 *  supplement sales report, so the two pages line up month for month. */
const SUMMARY_MONTHS = 6;

export default function Payments() {
  const { isOwner } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** How many rows match the filters in total, not how many are on screen. */
  const [total, setTotal] = useState(0);
  /** Totalled by the server over everything matching the filters — see
   *  PaginatedPayments. Summing `payments` here would only total this page. */
  const [totals, setTotals] = useState({ collected: 0, outstanding: 0 });
  const [params, setParams] = useSearchParams();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const [form, setForm] = useState<PaymentForm>(emptyForm);

  // First paint shows a spinner; every later fetch dims the old list instead,
  // so typing in the search box does not blank the page.
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const debouncedSearch = useDebounced(search);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (filter !== 'all') q.set('status', filter);
    // Blank values are omitted rather than sent — the API rejects "" for a date.
    if (debouncedSearch.trim()) q.set('search', debouncedSearch.trim());
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    q.set('limit', String(PAGE_SIZE));
    return `?${q.toString()}`;
  }, [filter, debouncedSearch, from, to]);

  // Page one whenever the filters change: page three of the old result set
  // has nothing to do with the new one.
  useEffect(() => {
    let cancelled = false;
    setRefetching(true);
    api.get<PaginatedPayments>(`/payments${query}`)
      .then(r => {
        if (cancelled) return;
        setPayments(r.data.data);
        setTotals({ collected: r.data.collected, outstanding: r.data.outstanding });
        setTotal(r.data.total);
        setHasMore(r.data.hasMore);
        setPage(1);
      })
      .catch(err => { if (!cancelled) toast.error(apiError(err, 'Could not load payments')); })
      .finally(() => { if (!cancelled) { setLoading(false); setRefetching(false); } });
    // A slow earlier response must not overwrite a newer one.
    return () => { cancelled = true; };
  }, [query]);

  /**
   * Appends the next page rather than replacing the list, so "Show more" grows
   * what is on screen the way it always did — the rows now come from the server
   * one page at a time instead of all having been downloaded up front.
   */
  const loadMore = () => {
    const next = page + 1;
    setLoadingMore(true);
    api.get<PaginatedPayments>(`/payments${query}&page=${next}`)
      .then(r => {
        setPayments(prev => [...prev, ...r.data.data]);
        setHasMore(r.data.hasMore);
        setPage(next);
      })
      .catch(err => toast.error(apiError(err, 'Could not load more payments')))
      .finally(() => setLoadingMore(false));
  };

  // The member list never changes with the filters, so it loads once. The
  // picker has to offer every member, hence all=true.
  useEffect(() => {
    api.get<Paginated<Member>>('/members?all=true')
      .then(r => setMembers(r.data.data))
      .catch(() => { /* the payments error toast already covers a dead API */ });
  }, []);

  /**
   * The gym's books, month by month. Owner-only — the API refuses staff, so
   * asking as staff would earn nothing but a 403 and a toast.
   *
   * Deliberately not filtered: the tiles above the table follow the filters and
   * say so, while this answers "what did the gym take in August", which no
   * filter should be able to change the answer to.
   */
  const loadSummary = useMemo(() => () => {
    if (!isOwner) return Promise.resolve();
    return api.get<PaymentSummary>(`/payments/summary?months=${SUMMARY_MONTHS}`)
      .then(r => setSummary(r.data))
      .catch(err => toast.error(apiError(err, 'Could not load the monthly totals')));
  }, [isOwner]);

  useEffect(() => { void loadSummary(); }, [loadSummary]);

  // The dashboard's "Record Payment" shortcut lands here as ?new=1. The param
  // is cleared once used, so refreshing does not reopen the modal.
  useEffect(() => {
    if (!params.get('new')) return;
    openAdd();
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('new');
      return next;
    }, { replace: true });
    // Runs on the landing param only — this is a hint, not a live binding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recording or correcting a payment moves the month's total too, so the
  // summary is refreshed alongside the list rather than going stale until the
  // next page load.
  // Back to page one: a correction can move a row out of the current filter
  // entirely, and re-fetching a later page would leave a gap above it.
  const reload = () => Promise.all([
    api.get<PaginatedPayments>(`/payments${query}`)
      .then(r => {
        setPayments(r.data.data);
        setTotals({ collected: r.data.collected, outstanding: r.data.outstanding });
        setTotal(r.data.total);
        setHasMore(r.data.hasMore);
        setPage(1);
      })
      .catch(err => toast.error(apiError(err, 'Could not load payments'))),
    loadSummary(),
  ]);

  const set = (k: keyof PaymentForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  // The member the form is about — the picked one when adding, the payment's
  // own when editing, since the member select is read-only there.
  const formMember = members.find(
    m => m.id === (editing ? editing.memberId : form.memberId),
  );

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setShowModal(true); };

  const openEdit = (p: Payment) => {
    setEditing(p);
    setForm({
      memberId: p.memberId,
      amount: String(p.amount),
      method: p.method,
      notes: p.notes ?? '',
      status: p.status,
      type: p.type,
      membershipId: p.membershipId ?? '',
      paymentDate: p.paymentDate.split('T')[0]!,
    });
    setShowModal(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      // The select uses '' for "no membership"; the API wants null. Only a
      // membership payment carries a link at all, so switching the type to
      // supplement or other drops any membership that was picked earlier
      // rather than leaving a stale one attached.
      const payload = {
        ...form,
        membershipId: form.type === 'membership' && form.membershipId
          ? form.membershipId
          : null,
      };
      if (editing) {
        // The member a payment belongs to is not editable — the API rejects it,
        // and moving money between members should be a delete and a re-entry.
        const { memberId: _memberId, ...editable } = payload;
        await api.put(`/payments/${editing.id}`, editable);
        toast.success('Payment updated');
      } else {
        await api.post('/payments', payload);
        toast.success('Payment recorded');
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm());
      await reload();
    } catch (err) {
      // The modal stays open with its values intact, so a rejected save is one
      // correction away from succeeding.
      toast.error(apiError(err, 'Could not save the payment'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.delete(`/payments/${deleting.id}`);
      toast.success('Payment deleted');
      setDeleting(null);
      await reload();
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the payment'));
    } finally {
      setSaving(false);
    }
  };

  const hasFilters = filter !== 'all' || search !== '' || from !== '' || to !== '';
  const clearFilters = () => { setFilter('all'); setSearch(''); setFrom(''); setTo(''); };

  const { collected, outstanding } = totals;

  /**
   * Exports the rows that have been loaded, filters and all — an export that
   * quietly returned everything would be read as the filtered total.
   *
   * With the list now paged, that means what has been fetched so far rather
   * than every match, so the toast says how many of the total went out. Getting
   * the rest is a matter of pressing Show more first, which is honest about the
   * cost instead of quietly fetching thousands of rows behind a button labelled
   * Export.
   */
  const handleExport = () => {
    if (payments.length === 0) { toast.error('Nothing to export'); return; }
    const csv = toCsv(
      [
        'Member No', 'Member', 'Phone', 'Amount', 'For', 'Method', 'Status', 'Date', 'Notes',
        ...(isOwner ? ['Taken by'] : []),
      ],
      payments.map(p => [
        p.member.memberNo ?? '', p.member.name, p.member.phone ?? '', p.amount,
        TYPE_LABELS[p.type], p.method,
        p.status, new Date(p.paymentDate).toLocaleDateString(), p.notes ?? '',
        ...(isOwner ? [p.recordedBy?.name ?? ''] : []),
      ]),
    );
    downloadCsv(`payments-${today()}.csv`, csv);
    toast.success(
      payments.length < total
        // Say so plainly rather than letting a partial file read as the lot.
        ? `Exported ${payments.length} of ${total} — press Show more for the rest`
        : `Exported ${payments.length} payment${payments.length === 1 ? '' : 's'}`,
    );
  };

  if (loading) return <PageLoader />;

  const shown = payments;

  return (
    <Page>
      <PageHeader
        icon={CreditCard}
        title="Payments"
        subtitle={isOwner
          ? 'What the gym has taken, and what is still owed'
          : 'Fees you have recorded, and who still owes'}
        action={
          <button onClick={openAdd} className={primaryButton}>
            <Plus size={16} />
            <span className="hidden sm:inline">Record Payment</span>
            <span className="sm:hidden">Record</span>
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <StatTile
          icon={Wallet} tone="green" label="Collected"
          value={`Rs. ${collected.toLocaleString()}`}
          hint={hasFilters ? 'matching filters' : undefined}
        />
        <StatTile
          icon={AlertCircle} tone="red" label="Outstanding"
          value={`Rs. ${outstanding.toLocaleString()}`}
          hint={hasFilters ? 'matching filters' : undefined}
        />
        <StatTile
          icon={Receipt} tone="blue" label="Payments"
          value={total} hint={hasFilters ? 'matching filters' : undefined}
        />
      </div>

      {/*
        Month by month, owner-only.

        Sits apart from the tiles above because it answers a different question:
        those follow the filters and say so, this is the gym's books and no
        filter should be able to change what August took in.

        Split by what the money was for — membership fees and supplement sales
        come through the same till, and a lone grand total reconciles against
        nothing.
      */}
      {isOwner && summary && (
        <Card className="p-4 sm:p-5 mb-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-slate-100">Monthly totals</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Settled payments only · last {summary.months} months
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 dark:text-slate-500">This month</p>
              <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
                Rs. {summary.thisMonth.toLocaleString()}
              </p>
              {summary.lastMonth > 0 && (
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  vs Rs. {summary.lastMonth.toLocaleString()} last month
                </p>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-125">
              <thead className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-slate-300">Month</th>
                  {['Membership', 'Supplements', 'Other'].map(h => (
                    <th key={h} className="text-right px-3 py-2 font-semibold text-gray-600 dark:text-slate-300">{h}</th>
                  ))}
                  <th className="text-right px-3 py-2 font-semibold text-gray-600 dark:text-slate-300">Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.byMonth.map((m, i) => (
                  <tr
                    key={m.month}
                    className={`border-b border-gray-100 dark:border-slate-800 last:border-0 ${
                      // The current month is still being earned, so it reads as
                      // a running figure rather than a closed one.
                      i === summary.byMonth.length - 1 ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-slate-100 whitespace-nowrap">
                      {m.label}
                      {i === summary.byMonth.length - 1 && (
                        <span className="ml-2 text-xs font-normal text-blue-600">so far</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-slate-300 tabular-nums">
                      {m.membership.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-slate-300 tabular-nums">
                      {m.supplement.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-slate-300 tabular-nums">
                      {m.other.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                      Rs. {m.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 dark:border-slate-800">
                <tr>
                  <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-slate-100">Grand total</td>
                  {(['membership', 'supplement', 'other'] as const).map(k => (
                    <td key={k} className="px-3 py-2.5 text-right font-semibold text-gray-700 dark:text-slate-300 tabular-nums">
                      {summary.byMonth.reduce((s, m) => s + m[k], 0).toLocaleString()}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right font-bold text-gray-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                    Rs. {summary.grandTotal.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {summary.dueTotal > 0 && (
            // Outstanding is the whole ledger, not just this window — money owed
            // from four months ago is still owed today. Kept out of the totals
            // above: it is a debt the gym is owed, not income it has received.
            <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
              Rs. {summary.dueTotal.toLocaleString()} still outstanding across{' '}
              {summary.dueCount} unpaid {summary.dueCount === 1 ? 'entry' : 'entries'}, not
              counted above.
            </p>
          )}
        </Card>
      )}

      {/* Filters */}
      <Card className="p-3 sm:p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl value={filter} onChange={setFilter} options={FILTERS} />

          <div className="relative flex-1 min-w-50">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search member, phone or member no..."
              aria-label="Search payments"
              className={`${inputClass} pl-9`}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date" value={from} max={to || undefined}
              onChange={e => setFrom(e.target.value)}
              aria-label="From date" className={`${inputClass} w-auto`}
            />
            <span className="text-gray-400 dark:text-slate-500 text-sm">to</span>
            <input
              type="date" value={to} min={from || undefined}
              onChange={e => setTo(e.target.value)}
              aria-label="To date" className={`${inputClass} w-auto`}
            />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className={secondaryButton}>
              <X size={14} /> Clear
            </button>
          )}

          <button onClick={handleExport} className={`${secondaryButton} ml-auto`}>
            <Download size={14} /> <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </Card>

      {payments.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Search}
            title="No payments match these filters"
            hint="Try a different date range, status or search term."
            action={
              <button onClick={clearFilters} className={secondaryButton}>
                <X size={14} /> Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={Receipt}
            title={isOwner ? 'No payments recorded yet' : 'You have not recorded any payments yet'}
            hint={isOwner
              ? 'Every fee a member pays is logged here, so the books and the renewal list stay honest.'
              : 'Fees you take are logged here. The gym’s full books are the owner’s to see.'}
            action={
              <button onClick={openAdd} className={primaryButton}>
                <Plus size={16} /> Record the first payment
              </button>
            }
          />
        )
      ) : (
        <Refetching busy={refetching}>
          {/* Mobile: cards — an eight-column table cannot fit a phone screen */}
          <div className="space-y-3 md:hidden">
            {shown.map(p => (
              <Card key={p.id} className={`p-4 ${p.status === 'due' ? 'border-red-200 dark:border-red-500/20 bg-red-50/40' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{p.member.name}</p>
                    {p.member.memberNo && (
                      <p className="text-xs text-gray-400 dark:text-slate-500">{p.member.memberNo}</p>
                    )}
                  </div>
                  <p className="font-bold text-gray-900 dark:text-slate-100 shrink-0">Rs. {p.amount.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge status={p.status} />
                  <Badge status={p.method} />
                  <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">
                    {new Date(p.paymentDate).toLocaleDateString()}
                  </span>
                </div>
                {p.notes && <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 wrap-break-word">{p.notes}</p>}
                {/* Correcting the record is the owner's — an entry that can be
                    edited by whoever took it is not a record of anything. The
                    API refuses staff either way; hiding the buttons just keeps
                    them from being offered an action they cannot complete. */}
                {isOwner && (
                  <div className="flex items-center gap-1 mt-2 -mb-1 -mr-1">
                    {p.recordedBy && (
                      <span className="text-xs text-gray-400 dark:text-slate-500 truncate mr-auto">
                        by {p.recordedBy.name}
                      </span>
                    )}
                    <IconButton icon={Pencil} label={`Edit payment for ${p.member.name}`}
                      onClick={() => openEdit(p)} />
                    <IconButton icon={Trash2} tone="red" label={`Delete payment for ${p.member.name}`}
                      onClick={() => setDeleting(p)} />
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800">
                  <tr>
                    {['Member', 'Amount', 'Method', 'Date', 'Status', 'Notes'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">{h}</th>
                    ))}
                    {/* Staff see only their own entries, so "who took this"
                        would tell them nothing they did not already know. */}
                    {isOwner && (
                      <>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Taken by</th>
                        <th className="px-4 py-3 w-24"><span className="sr-only">Actions</span></th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {shown.map(p => (
                    <tr key={p.id} className={`border-b border-gray-100 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/60 ${
                      p.status === 'due' ? 'bg-red-50/40' : ''
                    }`}>
                      <td className="px-4 py-3 max-w-55">
                        <p className="font-medium text-gray-900 dark:text-slate-100 truncate">{p.member.name}</p>
                        {p.member.memberNo && (
                          <p className="text-xs text-gray-400 dark:text-slate-500">{p.member.memberNo}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-slate-100 font-semibold whitespace-nowrap">
                        Rs. {p.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3"><Badge status={p.method} /></td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3"><Badge status={p.status} /></td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 max-w-65 truncate" title={p.notes ?? ''}>
                        {p.notes || '—'}
                      </td>
                      {isOwner && (
                        <>
                          <td className="px-4 py-3 text-gray-500 dark:text-slate-400 max-w-35 truncate">
                            {/* An em dash rather than a guess: the row predates
                                the column, or the account that took it is gone. */}
                            {p.recordedBy?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <IconButton icon={Pencil} label={`Edit payment for ${p.member.name}`}
                                onClick={() => openEdit(p)} />
                              <IconButton icon={Trash2} tone="red" label={`Delete payment for ${p.member.name}`}
                                onClick={() => setDeleting(p)} />
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {hasMore && (
            <div className="flex justify-center mt-5">
              <button onClick={loadMore} disabled={loadingMore} className={secondaryButton}>
                {loadingMore ? 'Loading…' : `Show more · ${total - payments.length} left`}
              </button>
            </div>
          )}
        </Refetching>
      )}

      {showModal && (
        <Modal title={editing ? 'Edit Payment' : 'Record Payment'} onClose={() => setShowModal(false)}>
          <form onSubmit={e => void handleSave(e)} className="space-y-4">
            <div>
              <FieldLabel required>Member</FieldLabel>
              {editing ? (
                // Reassigning a payment is a delete and a re-entry, so the trail
                // shows both. Shown read-only rather than hidden.
                <p className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 text-sm text-gray-600 dark:text-slate-300">
                  {editing.member.name}
                </p>
              ) : (
                <select
                  required
                  value={form.memberId}
                  // Changing the member invalidates any membership already
                  // picked — it belongs to the previous one.
                  onChange={e => setForm(f => ({
                    ...f, memberId: e.target.value, membershipId: '',
                  }))}
                  className={inputClass}
                >
                  <option value="">Select member...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}{m.phone ? ` · ${m.phone}` : ''}
                    </option>
                  ))}
                </select>
              )}
              {!editing && members.length === 0 && (
                <p className="text-xs text-yellow-700 mt-1.5">
                  No members yet — add a member before recording a payment.
                </p>
              )}
            </div>

            <div>
              <FieldLabel>For</FieldLabel>
              <select value={form.type} onChange={set('type')} className={inputClass}>
                {(Object.keys(TYPE_LABELS) as PaymentType[]).map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            {/* Which membership this settles. Offered only for membership money,
                and only once a member is chosen — there is nothing to list
                before that. */}
            {form.type === 'membership' && formMember && (
              <div>
                <FieldLabel>Membership</FieldLabel>
                {formMember.currentMembership ? (
                  <select value={form.membershipId} onChange={set('membershipId')} className={inputClass}>
                    <option value="">Not linked to a membership</option>
                    <option value={formMember.currentMembership.id}>
                      {formMember.currentMembership.planName}
                      {' · Rs. '}
                      {formMember.currentMembership.pricePaid.toLocaleString()}
                      {' · expires '}
                      {new Date(formMember.currentMembership.expiryDate)
                        .toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </option>
                  </select>
                ) : (
                  <p className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 text-sm text-gray-500 dark:text-slate-400">
                    This member has no membership to link to.
                  </p>
                )}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                  Linking is what lets the app tell a paid-up membership from an unpaid one.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required>Amount (Rs.)</FieldLabel>
                <input type="number" required min="1" step="any" value={form.amount}
                  onChange={set('amount')} className={inputClass} placeholder="2500" />
              </div>
              <div>
                <FieldLabel required>Date</FieldLabel>
                <input type="date" required max={today()} value={form.paymentDate}
                  onChange={set('paymentDate')} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Method</FieldLabel>
                <select value={form.method} onChange={set('method')} className={inputClass}>
                  <option value="cash">Cash</option>
                  <option value="online">Online</option>
                </select>
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <select value={form.status} onChange={set('status')} className={inputClass}>
                  <option value="paid">Paid</option>
                  <option value="due">Due</option>
                </select>
              </div>
            </div>

            <div>
              <FieldLabel>Notes</FieldLabel>
              <input type="text" maxLength={500} value={form.notes} onChange={set('notes')}
                className={inputClass} placeholder="Optional note..." />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)}
                className={`flex-1 ${secondaryButton}`}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
                {saving ? 'Saving...' : editing ? 'Save changes' : 'Record'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete payment"
          message={`Delete the Rs. ${deleting.amount.toLocaleString()} payment from ${deleting.member.name}? This removes it from the books and cannot be undone — it is recorded in the audit log.`}
          busy={saving}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Page>
  );
}
