import { useEffect, useState, type FormEvent } from 'react';
import {
  Wallet, Plus, Search, X, Pencil, Trash2, TrendingUp, TrendingDown,
  Receipt, AlertCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, StatTile, PageLoader, EmptyState, Refetching,
  FieldLabel, inputClass, primaryButton, secondaryButton, focusRing,
} from '../components/ui';
import { useDebounced } from '../hooks/useDebounced';
import api, { apiError } from '../api/client';
import type { Expense, ExpenseList, ProfitReport } from '../types';
import toast from 'react-hot-toast';

/** The categories offered first. Anything typed is accepted — a gym's spending
 *  is its own, so these are suggestions rather than a fixed list. */
const CATEGORIES = [
  'rent', 'utilities', 'salaries', 'equipment',
  'maintenance', 'marketing', 'supplies', 'other',
];

const PAGE_SIZE = 25;

const money = (n: number): string =>
  `${n < 0 ? '-' : ''}Rs. ${Math.abs(n).toLocaleString('en-PK')}`;

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

/** Today as `YYYY-MM-DD`, from local parts — `toISOString` would shift the date
 *  near midnight for any timezone but UTC. */
const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface ExpenseForm {
  category: string;
  amount: string;
  spentOn: string;
  vendor: string;
  notes: string;
}

const emptyForm = (): ExpenseForm => ({
  category: 'rent',
  amount: '',
  spentOn: todayKey(),
  vendor: '',
  notes: '',
});

/**
 * What the gym spends, and what that leaves.
 *
 * The Payments page answers what came in. This is the other half — without it
 * the app could report revenue but never profit, which is the number an owner
 * actually runs the business on.
 *
 * Behind `canManageExpenses`, matching the API: the owner, a manager or an
 * accountant. The front desk sees none of it.
 */
export default function Expenses() {
  const [list, setList] = useState<ExpenseList | null>(null);
  const [profit, setProfit] = useState<ProfitReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search, 300);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const query = () => {
    const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (category) p.set('category', category);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return p.toString();
  };

  const load = async (isStale: () => boolean = () => false) => {
    setBusy(true);
    try {
      const profitParams = new URLSearchParams();
      if (from) profitParams.set('from', from);
      if (to) profitParams.set('to', to);

      const [listRes, profitRes] = await Promise.all([
        api.get<ExpenseList>(`/expenses?${query()}`),
        // Shares the date filter so the tiles and the table always describe
        // the same window — two figures from different periods sitting next to
        // each other would be worse than none.
        api.get<ProfitReport>(`/expenses/profit?${profitParams.toString()}`),
      ]);
      if (isStale()) return;
      setList(listRes.data);
      setProfit(profitRes.data);
    } catch (err) {
      if (!isStale()) toast.error(apiError(err, 'Could not load expenses'));
    } finally {
      if (!isStale()) {
        setLoading(false);
        setBusy(false);
      }
    }
  };

  useEffect(() => {
    // A slow earlier response must not overwrite a newer one — the search box
    // and the date filters both refetch, and landing an old pair of responses
    // afterwards would show a table and tiles for filters no longer set.
    let cancelled = false;
    void load(() => cancelled);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, category, from, to, page]);

  // Any filter change puts you back on page one; staying on page 4 of a
  // now-shorter list shows an empty table and reads as "no results".
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, from, to]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      category: e.category,
      amount: String(e.amount),
      spentOn: e.spentOn.substring(0, 10),
      vendor: e.vendor ?? '',
      notes: e.notes ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async (ev: FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    try {
      const payload = {
        category: form.category.trim(),
        amount: Number(form.amount),
        spentOn: form.spentOn,
        vendor: form.vendor.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        await api.put(`/expenses/${editing.id}`, payload);
        toast.success('Expense updated');
      } else {
        await api.post('/expenses', payload);
        toast.success('Expense recorded');
      }
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not save the expense'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.delete(`/expenses/${deleting.id}`);
      toast.success('Expense deleted');
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the expense'));
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setFrom('');
    setTo('');
  };

  const hasFilters = Boolean(search || category || from || to);

  if (loading) return <PageLoader />;

  const rows = list?.data ?? [];
  const inProfit = (profit?.profit ?? 0) >= 0;

  return (
    <Page>
      <PageHeader
        icon={Wallet}
        title="Expenses"
        subtitle={
          from || to
            ? 'Money out for the selected period'
            : 'Money out, and what it leaves against revenue'
        }
        action={
          <button onClick={openCreate} className={primaryButton}>
            <Plus size={16} />
            <span className="hidden sm:inline">Add Expense</span>
            <span className="sm:hidden">Add</span>
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <StatTile
          icon={TrendingUp}
          tone="green"
          label="Revenue"
          value={money(profit?.revenue ?? 0)}
          hint="Payments received"
        />
        <StatTile
          icon={TrendingDown}
          tone="red"
          label="Expenses"
          value={money(profit?.expenses ?? 0)}
        />
        <StatTile
          icon={Receipt}
          tone={inProfit ? 'green' : 'red'}
          label={inProfit ? 'Profit' : 'Loss'}
          value={money(profit?.profit ?? 0)}
        />
        <StatTile
          icon={AlertCircle}
          tone="yellow"
          label="Outstanding"
          value={money(profit?.outstanding ?? 0)}
          hint="Owed, not yet received"
        />
      </div>

      <Card className="p-4 mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendor or notes…"
              className={`${inputClass} pl-9`}
            />
          </div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className={inputClass}
          >
            <option value="">All categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c[0]!.toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            aria-label="From date"
            className={inputClass}
          />
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            aria-label="To date"
            className={inputClass}
          />
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className={`mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 rounded ${focusRing}`}
          >
            <X size={13} /> Clear filters
          </button>
        )}
      </Card>

      {(list?.byCategory.length ?? 0) > 0 && (
        <Card className="p-4 mb-5">
          <h3 className="text-xs font-bold uppercase text-gray-400 mb-3">
            Where it went{hasFilters ? ' (filtered)' : ''}
          </h3>
          <div className="flex flex-wrap gap-2">
            {list!.byCategory.map(c => (
              <button
                key={c.category}
                onClick={() => setCategory(c.category === category ? '' : c.category)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${focusRing} ${
                  category === c.category
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                    : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/60'
                }`}
              >
                {c.category} · {money(c.total)}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Refetching busy={busy}>
        {rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={hasFilters ? 'No expenses match those filters' : 'No expenses recorded yet'}
            hint={
              hasFilters
                ? 'Try a wider date range or a different category.'
                : 'Add rent, salaries, utilities and equipment here to see what the gym actually keeps.'
            }
            action={
              hasFilters ? (
                <button onClick={clearFilters} className={secondaryButton}>Clear filters</button>
              ) : (
                <button onClick={openCreate} className={primaryButton}>
                  <Plus size={16} /> Add Expense
                </button>
              )
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-xs uppercase text-gray-500 dark:text-slate-400">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">Date</th>
                    <th className="text-left font-semibold px-4 py-3">Category</th>
                    <th className="text-left font-semibold px-4 py-3">Vendor</th>
                    <th className="text-right font-semibold px-4 py-3">Amount</th>
                    <th className="text-left font-semibold px-4 py-3 hidden md:table-cell">Recorded by</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {rows.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-slate-400">
                        {shortDate(e.spentOn)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900 dark:text-slate-100">{e.category}</span>
                        {e.notes && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 truncate max-w-xs">{e.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{e.vendor || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-slate-100 whitespace-nowrap">
                        {money(e.amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-500 hidden md:table-cell">
                        {e.recordedBy?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => openEdit(e)}
                            aria-label={`Edit ${e.category} expense`}
                            className={`p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors ${focusRing}`}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeleting(e)}
                            aria-label={`Delete ${e.category} expense`}
                            className={`p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors ${focusRing}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-slate-800">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {list!.total} {list!.total === 1 ? 'expense' : 'expenses'} · {money(list!.totalSpent)} total
              </p>
              {(list!.total > PAGE_SIZE) && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    aria-label="Previous page"
                    className={`p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40 ${focusRing}`}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-xs text-gray-500 dark:text-slate-400">Page {page}</span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!list!.hasMore}
                    aria-label="Next page"
                    className={`p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40 ${focusRing}`}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>
          </Card>
        )}
      </Refetching>

      {showForm && (
        <Modal
          title={editing ? 'Edit expense' : 'Record an expense'}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <FieldLabel>Category</FieldLabel>
              <input
                required
                list="expense-categories"
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className={inputClass}
                placeholder="rent"
              />
              {/* A datalist rather than a select: the common ones are one
                  keystroke away, and a gym with a category of its own is not
                  forced into "other". */}
              <datalist id="expense-categories">
                {CATEGORIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Amount (Rs.)</FieldLabel>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel>Date spent</FieldLabel>
                <input
                  required
                  type="date"
                  value={form.spentOn}
                  onChange={e => setForm(p => ({ ...p, spentOn: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <FieldLabel>Paid to (optional)</FieldLabel>
              <input
                value={form.vendor}
                onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))}
                className={inputClass}
                placeholder="K-Electric"
              />
            </div>

            <div>
              <FieldLabel>Notes (optional)</FieldLabel>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowForm(false)} className={secondaryButton}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={primaryButton}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Record expense'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this expense?"
          message={`${deleting.category} — ${money(deleting.amount)}${deleting.vendor ? ` to ${deleting.vendor}` : ''}. This cannot be undone, though it stays in the audit log.`}
          busy={saving}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Page>
  );
}
