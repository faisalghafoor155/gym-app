import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, FlaskConical, Package, ShoppingCart, PackagePlus, BarChart3,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, StatTile, PageLoader, EmptyState, IconButton, FieldLabel,
  inputClass, primaryButton, secondaryButton, focusRing,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../hooks/useDialog';
import type { Supplement, SupplementCategory, Member, Paginated } from '../types';
import toast from 'react-hot-toast';

interface CategoryInfo {
  value: SupplementCategory;
  label: string;
  icon: string;
  color: string;
}

const CATEGORIES: CategoryInfo[] = [
  { value: 'protein', label: 'Protein', icon: '🥩', color: 'bg-red-50 dark:bg-red-500/15 text-red-700 border-red-200 dark:border-red-500/20' },
  { value: 'creatine', label: 'Creatine', icon: '⚡', color: 'bg-yellow-50 dark:bg-yellow-500/15 text-yellow-700 border-yellow-200 dark:border-yellow-500/20' },
  { value: 'preworkout', label: 'Pre-Workout', icon: '🔥', color: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 border-orange-200 dark:border-orange-500/20' },
  { value: 'bcaa', label: 'BCAA', icon: '💪', color: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 border-purple-200 dark:border-purple-500/20' },
  { value: 'vitamins', label: 'Vitamins', icon: '🌿', color: 'bg-green-50 dark:bg-green-500/15 text-green-700 border-green-200 dark:border-green-500/20' },
  { value: 'fatburner', label: 'Fat Burner', icon: '🏃', color: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 border-blue-200 dark:border-blue-500/20' },
  { value: 'other', label: 'Other', icon: '💊', color: 'bg-gray-50 dark:bg-slate-800/60 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-800' },
];

const getCatInfo = (cat: string): CategoryInfo =>
  CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[CATEGORIES.length - 1]!;

interface SupplementForm {
  name: string;
  category: SupplementCategory;
  description: string;
  dosage: string;
  timing: string;
  price: string;
  stock: string;
}

const emptyForm: SupplementForm = {
  name: '', category: 'protein', description: '',
  dosage: '', timing: '', price: '', stock: '',
};

export default function Supplements() {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<SupplementForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<'all' | SupplementCategory>('all');
  const [deleting, setDeleting] = useState<Supplement | null>(null);
  const modalRef = useDialog(showModal, () => setShowModal(false));

  // Selling and restocking are front-desk work, so staff get them too. Only
  // the revenue link below is owner-only.
  const { isOwner } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [selling, setSelling] = useState<Supplement | null>(null);
  const [sellForm, setSellForm] = useState({ quantity: '1', memberId: '', notes: '' });
  const [restocking, setRestocking] = useState<Supplement | null>(null);
  const [restockForm, setRestockForm] = useState({ quantity: '', notes: '' });
  const sellRef = useDialog(!!selling, () => setSelling(null));
  const restockRef = useDialog(!!restocking, () => setRestocking(null));

  const load = () =>
    api.get<Supplement[]>('/supplements')
      .then(r => setSupplements(r.data))
      .catch(err => toast.error(apiError(err, 'Could not load supplements')))
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
    // For the "sold to" picker. A failure here is not worth a toast — the
    // sale still works, it just cannot be attributed to a member.
    void api.get<Paginated<Member>>('/members?all=true')
      .then(r => setMembers(r.data.data))
      .catch(() => { /* walk-in sales still work without it */ });
  }, []);

  const set = (k: keyof SupplementForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };

  const openEdit = (s: Supplement) => {
    setEditing(s.id);
    setForm({
      name: s.name, category: s.category,
      description: s.description || '', dosage: s.dosage || '',
      timing: s.timing || '',
      price: s.price != null ? String(s.price) : '',
      stock: String(s.stock ?? 0),
    });
    setShowModal(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      // The API rejects "" for the numeric fields, so omit the empty ones.
      const payload = {
        name: form.name,
        category: form.category,
        description: form.description,
        dosage: form.dosage,
        timing: form.timing,
        ...(form.price !== '' && { price: form.price }),
        ...(form.stock !== '' && { stock: form.stock }),
      };
      if (editing) {
        await api.put(`/supplements/${editing}`, payload);
        toast.success('Updated');
      } else {
        await api.post('/supplements', payload);
        toast.success('Supplement added');
      }
      setShowModal(false);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not save the supplement'));
    } finally {
      setSaving(false);
    }
  };

  const openSell = (s: Supplement) => {
    setSellForm({ quantity: '1', memberId: '', notes: '' });
    setSelling(s);
  };

  const handleSell = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selling) return;
    setSaving(true);
    try {
      const { data } = await api.post<{ stockLeft: number; total: number }>(
        `/supplements/${selling.id}/sell`,
        {
          quantity: Number(sellForm.quantity),
          // '' means walk-in, which the API stores as null.
          memberId: sellForm.memberId || null,
          notes: sellForm.notes,
        },
      );
      toast.success(`Sold — Rs. ${data.total.toLocaleString()}, ${data.stockLeft} left`);
      setSelling(null);
      await load();
    } catch (err) {
      // Stays open with its values: an out-of-stock or quantity error is one
      // correction away from succeeding.
      toast.error(apiError(err, 'Could not record the sale'));
    } finally {
      setSaving(false);
    }
  };

  const openRestock = (s: Supplement) => {
    setRestockForm({ quantity: '', notes: '' });
    setRestocking(s);
  };

  const handleRestock = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!restocking) return;
    setSaving(true);
    try {
      await api.post(`/supplements/${restocking.id}/restock`, {
        quantity: Number(restockForm.quantity),
        notes: restockForm.notes,
      });
      toast.success(`Added ${restockForm.quantity} to ${restocking.name}`);
      setRestocking(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not restock'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.delete(`/supplements/${deleting.id}`);
      toast.success('Deleted');
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete'));
    } finally {
      setSaving(false);
    }
  };

  const filtered = filterCat === 'all'
    ? supplements
    : supplements.filter(s => s.category === filterCat);

  if (loading) return <PageLoader />;

  return (
    <Page>
      <PageHeader
        icon={FlaskConical}
        title="Supplements"
        subtitle="Protein, creatine, pre-workout and the rest of the shelf"
        action={
          <div className="flex gap-2">
            {/* Revenue is the owner's to see — the same rule the API enforces. */}
            {isOwner && (
              <Link to="/supplement-sales" className={secondaryButton}>
                <BarChart3 size={16} />
                <span className="hidden sm:inline">Sales</span>
              </Link>
            )}
            <button onClick={openAdd} className={primaryButton}>
              <Plus size={16} />
              <span className="hidden sm:inline">Add Supplement</span><span className="sm:hidden">Add</span>
            </button>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <StatTile icon={Package} tone="blue" label="Total Products" value={supplements.length} />
        <StatTile
          icon={ShoppingCart} tone="green" label="Total Stock"
          value={supplements.reduce((s, x) => s + (x.stock || 0), 0)}
        />
        <StatTile
          icon={FlaskConical} tone="red" label="Out of Stock"
          value={supplements.filter(s => (s.stock || 0) === 0).length}
        />
      </div>

      {/* Category filter */}
      <Card className="p-3 sm:p-4 mb-5">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterCat('all')}
            aria-pressed={filterCat === 'all'}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${focusRing} ${
              filterCat === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60'
            }`}>
            All ({supplements.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = supplements.filter(s => s.category === cat.value).length;
            if (count === 0 && filterCat !== cat.value) return null;
            return (
              <button key={cat.value} onClick={() => setFilterCat(cat.value)}
                aria-pressed={filterCat === cat.value}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 ${focusRing} ${
                  filterCat === cat.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60'
                }`}>
                {cat.icon} {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </Card>

      {/* Grid */}
      {filtered.length === 0 ? (
        filterCat === 'all' ? (
          <EmptyState
            icon={FlaskConical}
            title="No supplements yet"
            hint="List what the gym sells — protein, creatine, vitamins — with dosage, price and stock."
            action={
              <button onClick={openAdd} className={primaryButton}>
                <Plus size={16} /> Add the first supplement
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={FlaskConical}
            title="Nothing in this category"
            hint="Pick a different category, or add a product here."
            action={
              <button onClick={() => setFilterCat('all')} className={secondaryButton}>
                Show all
              </button>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(s => {
            const catInfo = getCatInfo(s.category);
            const lowStock = s.stock <= 5;
            return (
              <Card key={s.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 flex items-center justify-center text-2xl shrink-0">
                      {catInfo.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm truncate">{s.name}</h3>
                      <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${catInfo.color}`}>
                        {catInfo.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <IconButton icon={Pencil} label={`Edit ${s.name}`} onClick={() => openEdit(s)} />
                    <IconButton icon={Trash2} tone="red" label={`Delete ${s.name}`}
                      onClick={() => setDeleting(s)} />
                  </div>
                </div>

                {s.description && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-3 leading-relaxed wrap-break-word">{s.description}</p>
                )}

                <div className="space-y-1.5">
                  {s.dosage && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 dark:text-slate-500">Dosage</span>
                      <span className="font-semibold text-gray-700 dark:text-slate-300">{s.dosage}</span>
                    </div>
                  )}
                  {s.timing && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 dark:text-slate-500">Timing</span>
                      <span className="font-semibold text-gray-700 dark:text-slate-300">{s.timing}</span>
                    </div>
                  )}
                  {s.price && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 dark:text-slate-500">Price</span>
                      <span className="font-bold text-green-700">Rs. {Number(s.price).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Stock Badge */}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-gray-400 dark:text-slate-500">Stock</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                    s.stock === 0 ? 'bg-red-100 dark:bg-red-500/15 text-red-700' :
                    lowStock ? 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700' :
                    'bg-green-100 dark:bg-green-500/15 text-green-700'
                  }`}>
                    {s.stock === 0 ? 'Out of stock' : `${s.stock} units`}
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => openSell(s)}
                    // Nothing to sell, or no price to sell it at — the API
                    // refuses both, so the button says so first.
                    disabled={s.stock === 0 || s.price == null}
                    title={
                      s.stock === 0 ? 'Out of stock'
                        : s.price == null ? 'Set a price before selling'
                        : undefined
                    }
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${focusRing} ${
                      s.stock === 0 || s.price == null
                        ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    <ShoppingCart size={12} /> Sell
                  </button>
                  <button
                    onClick={() => openRestock(s)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors ${focusRing}`}
                  >
                    <PackagePlus size={12} /> Stock
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} aria-hidden="true" />
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplement-modal-title"
            className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg sm:mx-4 max-h-[92dvh] flex flex-col"
          >
            <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
              <h2 id="supplement-modal-title" className="text-lg font-bold text-gray-900 dark:text-slate-100">
                {editing ? 'Edit Supplement' : 'Add Supplement'}
              </h2>
            </div>

            <form onSubmit={e => void handleSave(e)} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <FieldLabel required>Name</FieldLabel>
                <input required value={form.name} onChange={set('name')}
                  placeholder="e.g. Whey Protein Gold Standard"
                  className={inputClass} />
              </div>

              <div>
                <FieldLabel required>Category</FieldLabel>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {CATEGORIES.map(cat => (
                    <button key={cat.value} type="button"
                      onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                      aria-pressed={form.category === cat.value}
                      className={`border rounded-xl py-2 px-1 text-center transition-all ${focusRing} ${
                        form.category === cat.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15'
                          : 'border-gray-200 dark:border-slate-800 hover:border-gray-300'
                      }`}>
                      <p className="text-lg">{cat.icon}</p>
                      <p className="text-xs font-medium text-gray-700 dark:text-slate-300 mt-0.5 leading-tight">{cat.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Description</FieldLabel>
                <textarea rows={2} value={form.description} onChange={set('description')}
                  placeholder="Brief description of this supplement..."
                  className={`${inputClass} resize-none`} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Dosage</FieldLabel>
                  <input value={form.dosage} onChange={set('dosage')}
                    placeholder="e.g. 1 scoop (30g)"
                    className={inputClass} />
                </div>
                <div>
                  <FieldLabel>Timing</FieldLabel>
                  <input value={form.timing} onChange={set('timing')}
                    placeholder="e.g. Post-workout"
                    className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Price (Rs.)</FieldLabel>
                  <input type="number" min="0" value={form.price} onChange={set('price')}
                    placeholder="3500"
                    className={inputClass} />
                </div>
                <div>
                  <FieldLabel>Stock (units)</FieldLabel>
                  <input type="number" min="0" value={form.stock} onChange={set('stock')}
                    placeholder="10"
                    className={inputClass} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className={`flex-1 ${secondaryButton}`}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
                  {saving ? 'Saving...' : editing ? 'Update' : 'Add Supplement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sell */}
      {selling && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelling(null)} aria-hidden="true" />
          <div
            ref={sellRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sell-modal-title"
            className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md sm:mx-4 max-h-[92dvh] flex flex-col"
          >
            <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
              <h2 id="sell-modal-title" className="text-lg font-bold text-gray-900 dark:text-slate-100">Sell {selling.name}</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                Rs. {Number(selling.price).toLocaleString()} each · {selling.stock} in stock
              </p>
            </div>

            <form onSubmit={e => void handleSell(e)} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <FieldLabel required>Quantity</FieldLabel>
                <input
                  type="number" min={1} max={selling.stock} step={1} required
                  value={sellForm.quantity}
                  onChange={e => setSellForm(f => ({ ...f, quantity: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <FieldLabel>Sold to</FieldLabel>
                <select
                  value={sellForm.memberId}
                  onChange={e => setSellForm(f => ({ ...f, memberId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Walk-in (not a member)</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.memberNo} · {m.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                  A member's purchase is also recorded as a payment. Walk-in money is
                  recorded on the sale only.
                </p>
              </div>

              <div>
                <FieldLabel>Notes</FieldLabel>
                <input
                  type="text" maxLength={500}
                  value={sellForm.notes}
                  onChange={e => setSellForm(f => ({ ...f, notes: e.target.value }))}
                  className={inputClass}
                  placeholder="Optional"
                />
              </div>

              {Number(sellForm.quantity) > 0 && selling.price != null && (
                <div className="rounded-lg bg-green-50 dark:bg-green-500/15 border border-green-100 dark:border-green-500/20 px-3 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-green-800">Total</span>
                  <span className="text-lg font-bold text-green-900">
                    Rs. {(Number(sellForm.quantity) * selling.price).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setSelling(null)} className={`flex-1 ${secondaryButton}`}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
                  {saving ? 'Recording...' : 'Record sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock */}
      {restocking && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRestocking(null)} aria-hidden="true" />
          <div
            ref={restockRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="restock-modal-title"
            className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md sm:mx-4 max-h-[92dvh] flex flex-col"
          >
            <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
              <h2 id="restock-modal-title" className="text-lg font-bold text-gray-900 dark:text-slate-100">
                Add stock — {restocking.name}
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{restocking.stock} in stock now</p>
            </div>

            <form onSubmit={e => void handleRestock(e)} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <FieldLabel required>Units received</FieldLabel>
                <input
                  type="number" min={1} step={1} required
                  value={restockForm.quantity}
                  onChange={e => setRestockForm(f => ({ ...f, quantity: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. 12"
                />
              </div>

              <div>
                <FieldLabel>Note</FieldLabel>
                <input
                  type="text" maxLength={500}
                  value={restockForm.notes}
                  onChange={e => setRestockForm(f => ({ ...f, notes: e.target.value }))}
                  className={inputClass}
                  placeholder="Supplier, invoice number…"
                />
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">Recorded in the audit log.</p>
              </div>

              {Number(restockForm.quantity) > 0 && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/20 px-3 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-800">New stock</span>
                  <span className="text-lg font-bold text-blue-900">
                    {restocking.stock + Number(restockForm.quantity)} units
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setRestocking(null)} className={`flex-1 ${secondaryButton}`}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
                  {saving ? 'Adding...' : 'Add stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete supplement"
          message={`Delete "${deleting.name}" from the shelf? This cannot be undone.`}
          busy={saving}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Page>
  );
}
