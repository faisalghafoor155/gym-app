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
import type { Payment, Member, PaymentMethod, PaymentStatus } from '../types';
import toast from 'react-hot-toast';

interface PaymentForm {
  memberId: string;
  amount: string;
  method: PaymentMethod;
  notes: string;
  status: PaymentStatus;
  paymentDate: string;
}

const today = () => new Date().toISOString().split('T')[0]!;

const emptyForm = (): PaymentForm => ({
  memberId: '', amount: '', method: 'cash', notes: '', status: 'paid', paymentDate: today(),
});

type Filter = 'all' | PaymentStatus;

const FILTERS = [
  { value: 'all' as const, label: 'All' },
  { value: 'paid' as const, label: 'Paid' },
  { value: 'due' as const, label: 'Due' },
];

/** Past 200 rows the table stops being something anyone reads; the rest load on
 *  demand rather than all at once. */
const PAGE_SIZE = 50;

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
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
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [filter, debouncedSearch, from, to]);

  useEffect(() => {
    let cancelled = false;
    setRefetching(true);
    api.get<Payment[]>(`/payments${query}`)
      .then(r => { if (!cancelled) { setPayments(r.data); setVisible(PAGE_SIZE); } })
      .catch(err => { if (!cancelled) toast.error(apiError(err, 'Could not load payments')); })
      .finally(() => { if (!cancelled) { setLoading(false); setRefetching(false); } });
    // A slow earlier response must not overwrite a newer one.
    return () => { cancelled = true; };
  }, [query]);

  // The member list never changes with the filters, so it loads once.
  useEffect(() => {
    api.get<Member[]>('/members')
      .then(r => setMembers(r.data))
      .catch(() => { /* the payments error toast already covers a dead API */ });
  }, []);

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

  const reload = () => api.get<Payment[]>(`/payments${query}`)
    .then(r => setPayments(r.data))
    .catch(err => toast.error(apiError(err, 'Could not load payments')));

  const set = (k: keyof PaymentForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setShowModal(true); };

  const openEdit = (p: Payment) => {
    setEditing(p);
    setForm({
      memberId: p.memberId,
      amount: String(p.amount),
      method: p.method,
      notes: p.notes ?? '',
      status: p.status,
      paymentDate: p.paymentDate.split('T')[0]!,
    });
    setShowModal(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        // The member a payment belongs to is not editable — the API rejects it,
        // and moving money between members should be a delete and a re-entry.
        const { memberId: _memberId, ...editable } = form;
        await api.put(`/payments/${editing.id}`, editable);
        toast.success('Payment updated');
      } else {
        await api.post('/payments', form);
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

  const collected = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const outstanding = payments.filter(p => p.status === 'due').reduce((s, p) => s + p.amount, 0);

  /** Exports exactly what is on screen, filters and all — an export that
   *  quietly returned everything would be read as the filtered total. */
  const handleExport = () => {
    if (payments.length === 0) { toast.error('Nothing to export'); return; }
    const csv = toCsv(
      ['Member No', 'Member', 'Phone', 'Amount', 'Method', 'Status', 'Date', 'Notes'],
      payments.map(p => [
        p.member.memberNo ?? '', p.member.name, p.member.phone ?? '', p.amount,
        p.method, p.status, new Date(p.paymentDate).toLocaleDateString(), p.notes ?? '',
      ]),
    );
    downloadCsv(`payments-${today()}.csv`, csv);
    toast.success(`Exported ${payments.length} payment${payments.length === 1 ? '' : 's'}`);
  };

  if (loading) return <PageLoader />;

  const shown = payments.slice(0, visible);

  return (
    <Page>
      <PageHeader
        icon={CreditCard}
        title="Payments"
        subtitle="What the gym has taken, and what is still owed"
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
          value={payments.length} hint={hasFilters ? 'matching filters' : undefined}
        />
      </div>

      {/* Filters */}
      <Card className="p-3 sm:p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl value={filter} onChange={setFilter} options={FILTERS} />

          <div className="relative flex-1 min-w-50">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
            <span className="text-gray-400 text-sm">to</span>
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
            title="No payments recorded yet"
            hint="Every fee a member pays is logged here, so the books and the renewal list stay honest."
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
              <Card key={p.id} className={`p-4 ${p.status === 'due' ? 'border-red-200 bg-red-50/40' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{p.member.name}</p>
                    {p.member.memberNo && (
                      <p className="text-xs text-gray-400">{p.member.memberNo}</p>
                    )}
                  </div>
                  <p className="font-bold text-gray-900 shrink-0">Rs. {p.amount.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge status={p.status} />
                  <Badge status={p.method} />
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(p.paymentDate).toLocaleDateString()}
                  </span>
                </div>
                {p.notes && <p className="text-xs text-gray-500 mt-2 wrap-break-word">{p.notes}</p>}
                <div className="flex justify-end gap-1 mt-2 -mb-1 -mr-1">
                  <IconButton icon={Pencil} label={`Edit payment for ${p.member.name}`}
                    onClick={() => openEdit(p)} />
                  <IconButton icon={Trash2} tone="red" label={`Delete payment for ${p.member.name}`}
                    onClick={() => setDeleting(p)} />
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Member', 'Amount', 'Method', 'Date', 'Status', 'Notes'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                    ))}
                    <th className="px-4 py-3 w-24"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(p => (
                    <tr key={p.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
                      p.status === 'due' ? 'bg-red-50/40' : ''
                    }`}>
                      <td className="px-4 py-3 max-w-55">
                        <p className="font-medium text-gray-900 truncate">{p.member.name}</p>
                        {p.member.memberNo && (
                          <p className="text-xs text-gray-400">{p.member.memberNo}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-semibold whitespace-nowrap">
                        Rs. {p.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3"><Badge status={p.method} /></td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3"><Badge status={p.status} /></td>
                      <td className="px-4 py-3 text-gray-500 max-w-65 truncate" title={p.notes ?? ''}>
                        {p.notes || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton icon={Pencil} label={`Edit payment for ${p.member.name}`}
                            onClick={() => openEdit(p)} />
                          <IconButton icon={Trash2} tone="red" label={`Delete payment for ${p.member.name}`}
                            onClick={() => setDeleting(p)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {visible < payments.length && (
            <div className="flex justify-center mt-5">
              <button onClick={() => setVisible(v => v + PAGE_SIZE)} className={secondaryButton}>
                Show more · {payments.length - visible} left
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
                <p className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-600">
                  {editing.member.name}
                </p>
              ) : (
                <select required value={form.memberId} onChange={set('memberId')} className={inputClass}>
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
