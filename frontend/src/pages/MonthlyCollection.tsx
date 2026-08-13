import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  CalendarRange, Search, X, Download, ChevronLeft, ChevronRight, ChevronDown,
  Users, Wallet, AlertCircle, Receipt, Phone, CheckCircle2,
} from 'lucide-react';
import Badge from '../components/Badge';
import {
  Page, PageHeader, Card, StatTile, PageLoader, EmptyState, Refetching,
  SegmentedControl, inputClass, secondaryButton, focusRing,
} from '../components/ui';
import { useDebounced } from '../hooks/useDebounced';
import { toCsv, downloadCsv } from '../utils/csv';
import api, { apiError } from '../api/client';
import type {
  MonthlyCollection, MonthlyCollectionRow, UnpaidRow, CollectionView,
} from '../types';
import toast from 'react-hot-toast';

const VIEWS = [
  { value: 'paid' as const, label: 'Paid' },
  { value: 'unpaid' as const, label: 'Unpaid' },
  { value: 'all' as const, label: 'All' },
];

/** Rows per request. A gym's month rarely runs past this, and the rest are one
 *  click away rather than downloaded up front. */
const PAGE_SIZE = 50;

/** `2026-08` for a Date, built from local parts. `toISOString` would shift a
 *  date near midnight into the neighbouring month for any timezone but UTC. */
const monthKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const thisMonth = (): string => monthKey(new Date());

/** Steps a `YYYY-MM` key by whole months. Day 1 keeps the arithmetic away from
 *  month lengths — stepping back from the 31st would otherwise skip February. */
const shiftMonth = (key: string, by: number): string => {
  const [y, m] = key.split('-').map(Number) as [number, number];
  return monthKey(new Date(y, m - 1 + by, 1));
};

const money = (n: number): string => `Rs. ${n.toLocaleString('en-PK')}`;

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });

/**
 * Who paid this month, member by member.
 *
 * The Payments page answers "what happened at the counter" — every entry, in
 * the order it was taken. This answers the question the owner actually asks at
 * month end: which members have settled, which have not, and what each of them
 * brought in. Same money, grouped by person rather than by receipt.
 *
 * Owner-only, matching the API. Staff see their own takings on the Payments
 * page and nothing here.
 */
export default function MonthlyCollection() {
  const [month, setMonth] = useState<string>(thisMonth);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<CollectionView>('paid');
  const [includeDue, setIncludeDue] = useState(true);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<MonthlyCollection | null>(null);
  /** Which member rows are expanded to show their individual receipts. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // First paint shows a spinner; later fetches dim the old table instead, so
  // typing in the search box does not blank the page.
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);

  const debouncedSearch = useDebounced(search);

  const query = useMemo(() => {
    const q = new URLSearchParams({ month, view, limit: String(PAGE_SIZE) });
    if (debouncedSearch.trim()) q.set('search', debouncedSearch.trim());
    // Only meaningful on the paid view — the unpaid list is dues by definition.
    if (view === 'paid' && !includeDue) q.set('includeDue', 'false');
    if (page > 1) q.set('page', String(page));
    return `?${q.toString()}`;
  }, [month, view, debouncedSearch, includeDue, page]);

  useEffect(() => {
    let cancelled = false;
    setRefetching(true);
    api.get<MonthlyCollection>(`/payments/monthly${query}`)
      .then(r => {
        if (cancelled) return;
        setReport(r.data);
        // Rows are re-sorted and re-paged by the server, so an id that was
        // expanded before may now be a different row's neighbour. Collapsing
        // avoids opening something the user did not click.
        setExpanded(new Set());
      })
      .catch(err => {
        if (!cancelled) toast.error(apiError(err, 'Could not load the month'));
      })
      .finally(() => { if (!cancelled) { setLoading(false); setRefetching(false); } });
    // A slow earlier response must not overwrite a newer one.
    return () => { cancelled = true; };
  }, [query]);

  // Page one whenever the month, the search or the filter changes: page three
  // of the old result set has nothing to do with the new one.
  useEffect(() => { setPage(1); }, [month, view, debouncedSearch, includeDue]);

  const toggleRow = (memberId: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });

  /**
   * Exports the month as one row per payment rather than per member, because a
   * sheet is something people re-total themselves — and a folded row cannot be
   * checked against the receipts it came from.
   *
   * Exports what is on screen, which is the current page. Said so on the
   * button, since a file quietly holding 50 of 200 members would be worse than
   * no file at all.
   */
  const handleExport = () => {
    if (!report) return;

    // The unpaid list is a different sheet with different columns — a debt has
    // no date, method or receipt, and padding it into the payments shape would
    // produce a column of blanks that reads as missing data.
    if (view === 'unpaid') {
      if (report.unpaid.length === 0) return;
      downloadCsv(
        `unpaid-${report.month}.csv`,
        toCsv(
          ['Member No', 'Name', 'Phone', 'Plan', 'Expires', 'Expected', 'Paid', 'Shortfall'],
          report.unpaid.map(r => [
            r.memberNo, r.name, r.phone ?? '', r.membership.planName,
            new Date(r.membership.expiryDate).toLocaleDateString('en-PK'),
            r.expected, r.paid, r.shortfall,
          ]),
        ),
      );
      return;
    }

    if (report.data.length === 0) return;
    const rows = report.data.flatMap(r =>
      r.payments.map(p => [
        r.memberNo, r.name, r.phone ?? '',
        new Date(p.paymentDate).toLocaleDateString('en-PK'),
        p.amount, p.status, p.method, p.type,
        p.recordedBy?.name ?? '', p.notes ?? '',
      ]),
    );
    downloadCsv(
      `collection-${report.month}.csv`,
      toCsv(
        ['Member No', 'Name', 'Phone', 'Date', 'Amount', 'Status', 'Method', 'Type', 'Recorded By', 'Notes'],
        rows,
      ),
    );
  };

  // The month picker must not offer a future month: there is nothing to report
  // and an empty August in the middle of July only looks like a bug.
  const atCurrentMonth = month >= thisMonth();

  if (loading) return <PageLoader />;

  return (
    <Page>
      <PageHeader
        icon={CalendarRange}
        title="Monthly Collection"
        subtitle="Every member's fee record for the month you choose"
        action={
          <button
            onClick={handleExport}
            disabled={!report || (view === 'unpaid' ? report.unpaid : report.data).length === 0}
            className={secondaryButton}
            title="Exports the members shown on this page"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export page</span>
          </button>
        }
      />

      <div className="mb-4">
        <SegmentedControl value={view} onChange={setView} options={VIEWS} />
      </div>

      {/* Month picker — arrows for the common step, a native input for a jump
          across the year. */}
      <Card className="p-3 sm:p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMonth(m => shiftMonth(m, -1))}
              aria-label="Previous month"
              className={`p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-slate-400
                dark:hover:bg-slate-800 transition-colors ${focusRing}`}
            >
              <ChevronLeft size={18} />
            </button>
            <input
              type="month"
              value={month}
              max={thisMonth()}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                // An empty value is what the picker's clear button produces;
                // falling back keeps the report from asking for no month.
                if (e.target.value) setMonth(e.target.value);
              }}
              aria-label="Month"
              className={`${inputClass} w-auto`}
            />
            <button
              onClick={() => setMonth(m => shiftMonth(m, 1))}
              disabled={atCurrentMonth}
              aria-label="Next month"
              className={`p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-slate-400
                dark:hover:bg-slate-800 transition-colors disabled:opacity-30
                disabled:cursor-not-allowed ${focusRing}`}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="relative flex-1 min-w-56">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none"
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, phone or member no."
              aria-label="Search members"
              className={`${inputClass} pl-9 pr-9`}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Only on the paid view: the unpaid tab is dues by definition, and
              a checkbox that cannot change anything invites the reader to
              believe the list is filtered when it is not. */}
          {view === 'paid' && (
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 select-none">
              <input
                type="checkbox"
                checked={includeDue}
                onChange={e => setIncludeDue(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600"
              />
              Include due entries
            </label>
          )}
        </div>
      </Card>

      {report && (
        <>
          {/* The two views are answering different questions, so they get
              different headline figures rather than one set that means
              something different depending on which tab is open. */}
          {view === 'unpaid' ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5">
              <StatTile
                icon={AlertCircle}
                label="Still owed"
                value={money(report.shortfallTotal)}
                tone={report.shortfallTotal > 0 ? 'red' : 'green'}
                hint={report.label}
              />
              <StatTile
                icon={Users}
                label="Members who owe"
                value={report.memberCount}
                tone={report.memberCount > 0 ? 'yellow' : 'gray'}
              />
              <StatTile
                icon={Receipt}
                label="Expected in total"
                value={money(report.expectedTotal)}
                tone="blue"
                hint="Across the memberships listed"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
              <StatTile
                icon={Wallet}
                label="Collected"
                value={money(report.collected)}
                tone="green"
                hint={report.label}
              />
              <StatTile
                icon={AlertCircle}
                label={view === 'all' ? 'Still owed' : 'Due entries'}
                value={money(view === 'all' ? report.shortfallTotal : report.outstanding)}
                tone={(view === 'all' ? report.shortfallTotal : report.outstanding) > 0 ? 'red' : 'gray'}
              />
              <StatTile
                icon={Users}
                label="Members who paid"
                value={report.memberCount}
                tone="blue"
                hint={`${report.paymentCount} payment${report.paymentCount === 1 ? '' : 's'}`}
              />
              <StatTile
                icon={Receipt}
                label="Average per member"
                value={money(
                  // Guarded rather than shown as NaN: an empty month is a real
                  // state, and "Rs. NaN" reads as a broken page.
                  report.memberCount > 0
                    ? Math.round(report.collected / report.memberCount)
                    : 0,
                )}
                tone="purple"
              />
            </div>
          )}

          <Refetching busy={refetching}>
            {view === 'unpaid' ? (
              report.unpaid.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title={
                    search
                      ? 'Nobody matching that search owes anything'
                      : `Everyone has settled for ${report.label}`
                  }
                  hint={
                    search
                      ? 'Try a different name, phone number or member number.'
                      : 'Members whose membership ran during this month and who still owe part of the fee would be listed here.'
                  }
                />
              ) : (
                <UnpaidList rows={report.unpaid} />
              )
            ) : report.data.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={search ? 'No members match that search' : `Nothing recorded in ${report.label}`}
                hint={
                  search
                    ? 'Try a different name, phone number or member number.'
                    : 'Payments recorded for this month will appear here, one row per member.'
                }
              />
            ) : (
              <Card className="overflow-hidden">
                {/* Desktop: a real table. Mobile: the same rows as cards, since
                    ten columns on a phone is a horizontal scroll nobody uses. */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-800/60 text-left">
                      <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        <th className="px-4 py-3 font-semibold">Member</th>
                        <th className="px-4 py-3 font-semibold">Phone</th>
                        <th className="px-4 py-3 font-semibold text-right">Paid</th>
                        <th className="px-4 py-3 font-semibold text-right">Unpaid</th>
                        <th className="px-4 py-3 font-semibold text-center">Entries</th>
                        <th className="px-4 py-3 font-semibold">Last paid</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {report.data.map(row => (
                        <MemberRow
                          key={row.memberId}
                          row={row}
                          open={expanded.has(row.memberId)}
                          onToggle={() => toggleRow(row.memberId)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-800">
                  {report.data.map(row => (
                    <MemberCard
                      key={row.memberId}
                      row={row}
                      open={expanded.has(row.memberId)}
                      onToggle={() => toggleRow(row.memberId)}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* On the combined view the debtors follow the payers, under their
                own heading — the same month read from both ends rather than
                two lists the reader has to reconcile by switching tabs. */}
            {view === 'all' && report.unpaid.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                  <AlertCircle size={15} className="text-red-500 dark:text-red-400" />
                  Still owing · {report.unpaid.length} member
                  {report.unpaid.length === 1 ? '' : 's'}
                </h2>
                <UnpaidList rows={report.unpaid} />
              </div>
            )}
          </Refetching>

          {view !== 'unpaid' && (report.hasMore || page > 1) && (
            <div className="flex items-center justify-between gap-3 mt-4">
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Page {report.page} · {report.memberCount} member
                {report.memberCount === 1 ? '' : 's'} in {report.label}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || refetching}
                  className={secondaryButton}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!report.hasMore || refetching}
                  className={secondaryButton}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Page>
  );
}

/* ------------------------------------------------------------------ rows */

interface RowProps {
  row: MonthlyCollectionRow;
  open: boolean;
  onToggle: () => void;
}

/** The receipts behind one member's total, shared by both layouts. */
function Entries({ row }: { row: MonthlyCollectionRow }) {
  return (
    <div className="space-y-1.5">
      {row.payments.map(p => (
        <div
          key={p.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs bg-gray-50 dark:bg-slate-800/60 rounded-lg px-3 py-2"
        >
          <span className="text-gray-500 dark:text-slate-400 w-14 shrink-0">
            {shortDate(p.paymentDate)}
          </span>
          <span className="font-semibold text-gray-800 dark:text-slate-200 w-24 shrink-0">
            {money(p.amount)}
          </span>
          <Badge status={p.status} />
          <Badge status={p.method} />
          <span className="text-gray-400 dark:text-slate-500 capitalize">{p.type}</span>
          {p.recordedBy && (
            <span className="text-gray-400 dark:text-slate-500">· by {p.recordedBy.name}</span>
          )}
          {p.notes && (
            <span className="text-gray-500 dark:text-slate-400 basis-full truncate" title={p.notes}>
              {p.notes}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function MemberRow({ row, open, onToggle }: RowProps) {
  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
        <td className="px-4 py-3">
          <p className="font-semibold text-gray-900 dark:text-slate-100">{row.name}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{row.memberNo}</p>
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{row.phone ?? '—'}</td>
        <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">
          {money(row.paid)}
        </td>
        <td className="px-4 py-3 text-right">
          {row.due > 0 ? (
            <span className="font-semibold text-red-600 dark:text-red-400">{money(row.due)}</span>
          ) : (
            <span className="text-gray-300 dark:text-slate-600">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-center text-gray-500 dark:text-slate-400">{row.count}</td>
        <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
          {row.lastPaymentAt ? shortDate(row.lastPaymentAt) : '—'}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? `Hide ${row.name}'s payments` : `Show ${row.name}'s payments`}
            className={`p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:bg-gray-100
              dark:hover:bg-slate-700 transition-colors ${focusRing}`}
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="px-4 pb-3 bg-gray-50/50 dark:bg-slate-800/20">
            <Entries row={row} />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * The members who still owe.
 *
 * Deliberately not expandable, unlike the paid rows: there are no receipts to
 * show. What matters is the three figures — what the membership cost, what has
 * come in, and the gap — so all three are on the row rather than one being
 * inferable from the others.
 */
function UnpaidList({ rows }: { rows: readonly UnpaidRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-800/60 text-left">
            <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
              <th className="px-4 py-3 font-semibold">Member</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Expires</th>
              <th className="px-4 py-3 font-semibold text-right">Expected</th>
              <th className="px-4 py-3 font-semibold text-right">Paid</th>
              <th className="px-4 py-3 font-semibold text-right">Shortfall</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {rows.map(r => (
              <tr key={r.memberId} className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900 dark:text-slate-100">{r.name}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{r.memberNo}</p>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{r.phone ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{r.membership.planName}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-slate-400">
                      {shortDate(r.membership.expiryDate)}
                    </span>
                    <Badge status={r.membership.status} />
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-300">
                  {money(r.expected)}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-300">
                  {r.paid > 0 ? money(r.paid) : <span className="text-gray-300 dark:text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400">
                  {money(r.shortfall)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-800">
        {rows.map(r => (
          <div key={r.memberId} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{r.name}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{r.memberNo}</p>
                {r.phone && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <Phone size={11} /> {r.phone}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-red-600 dark:text-red-400">{money(r.shortfall)}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {money(r.paid)} of {money(r.expected)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {r.membership.planName} · expires {shortDate(r.membership.expiryDate)}
              </span>
              <Badge status={r.membership.status} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MemberCard({ row, open, onToggle }: RowProps) {
  return (
    <div className="p-4">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{row.name}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{row.memberNo}</p>
          {row.phone && (
            <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
              <Phone size={11} /> {row.phone}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-green-600 dark:text-green-400">{money(row.paid)}</p>
          {row.due > 0 && (
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">
              {money(row.due)} unpaid
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            {row.count} entr{row.count === 1 ? 'y' : 'ies'}
            <ChevronDown
              size={12}
              className={`inline ml-1 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </p>
        </div>
      </button>
      {open && <div className="mt-3"><Entries row={row} /></div>}
    </div>
  );
}
