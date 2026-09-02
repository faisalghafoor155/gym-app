import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, FlaskConical, Package, ShoppingCart, PackagePlus, BarChart3,
  Search,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, StatTile, PageLoader, EmptyState, IconButton, FieldLabel,
  inputClass, primaryButton, secondaryButton, focusRing,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../hooks/useDialog';
import { useFetch } from '../hooks/useFetch';
import { useDebounced } from '../hooks/useDebounced';
import type {
  Supplement, SupplementCategory, Member, Paginated, PaginatedSupplements,
} from '../types';
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

/** How many products a page carries. Matches the members page. */
const PAGE_SIZE = 25;

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
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<SupplementForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<'all' | SupplementCategory>('all');
  const [searchInput, setSearchInput] = useState('');
  // Pages beyond the first, appended to what `useFetch` holds for page one.
  const [extra, setExtra] = useState<Supplement[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleting, setDeleting] = useState<Supplement | null>(null);
  const modalRef = useDialog(showModal, () => setShowModal(false));

  // POS Shopping Cart states
  interface CartItem {
    supplementId: string;
    name: string;
    price: number;
    quantity: number;
    maxStock: number;
  }
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartMemberId, setCartMemberId] = useState('');
  const [cartPaymentMethod, setCartPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [cartNotes, setCartNotes] = useState('');
  const [checkoutCartLoading, setCheckoutCartLoading] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  // Selling and restocking are front-desk work, so staff get them too. Only
  // the revenue link below is owner-only.
  const { isOwner } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [restocking, setRestocking] = useState<Supplement | null>(null);
  const [restockForm, setRestockForm] = useState({ quantity: '', notes: '' });
  const restockRef = useDialog(!!restocking, () => setRestocking(null));

  // Debounced so a search does not fire a request per keystroke, the same way
  // the members page searches.
  const search = useDebounced(searchInput, 300);

  // Filtering happens on the server now that the list is paged: filtering a
  // page in the browser could only ever search the products that happened to
  // be loaded, and the shelf outgrows one page.
  const query = `/supplements?limit=${PAGE_SIZE}` +
    (filterCat === 'all' ? '' : `&category=${filterCat}`) +
    (search ? `&search=${encodeURIComponent(search)}` : '');

  const { data, loading, reload: load } = useFetch<PaginatedSupplements>(
    query,
    'Could not load supplements',
  );

  // Null only before the first load lands, which the spinner covers.
  const supplements = extra.length ? [...(data?.data ?? []), ...extra] : data?.data ?? [];
  const counts = data?.counts;
  const total = data?.total ?? 0;
  const hasMore = supplements.length < total;

  // Later pages are dropped whenever the query changes: they were fetched
  // under filters that no longer select them, and keeping them would leave
  // rows on screen that the current filter excludes.
  useEffect(() => { setExtra([]); }, [query]);

  /** Appends the next page rather than replacing what is on screen. */
  const showMore = async () => {
    const next = Math.floor(supplements.length / PAGE_SIZE) + 1;
    setLoadingMore(true);
    try {
      const r = await api.get<PaginatedSupplements>(`${query}&page=${next}`);
      setExtra(prev => [...prev, ...r.data.data]);
    } catch (err) {
      toast.error(apiError(err, 'Could not load more'));
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    // For the "sold to" picker. A failure here is not worth a toast — the
    // sale still works, it just cannot be attributed to a member. Kept out of
    // the loader above so a missing picker never blanks the stock list.
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

  const addToCart = (s: Supplement) => {
    if (s.stock === 0 || s.price == null) return;
    setCart(prev => {
      const existing = prev.find(item => item.supplementId === s.id);
      if (existing) {
        if (existing.quantity >= s.stock) {
          toast.error(`Cannot add more. Only ${s.stock} in stock.`);
          return prev;
        }
        toast.success(`Increased ${s.name} quantity in cart`);
        return prev.map(item =>
          item.supplementId === s.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      toast.success(`Added ${s.name} to cart`);
      return [...prev, {
        supplementId: s.id,
        name: s.name,
        price: Number(s.price),
        quantity: 1,
        maxStock: s.stock
      }];
    });
  };

  const handleCartCheckout = async (e: FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setCheckoutCartLoading(true);
    try {
      await api.post('/supplements/checkout-pos', {
        memberId: cartMemberId || null,
        paymentMethod: cartPaymentMethod,
        notes: cartNotes,
        items: cart.map(item => ({
          supplementId: item.supplementId,
          quantity: item.quantity,
        })),
      });

      // Play sound
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } catch {
        // The browser blocks audio until the page has been interacted with.
        // The sale is already recorded; the chime is a nicety.
      }

      toast.success('POS Cart checked out successfully!');
      setCart([]);
      setCartMemberId('');
      setCartNotes('');
      setCartPaymentMethod('cash');
      setShowCartDrawer(false);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Failed to checkout cart'));
    } finally {
      setCheckoutCartLoading(false);
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

  // The server already applied the category and the search, so what arrives is
  // the list to render.
  const filtered = supplements;

  if (loading) return <PageLoader />;

  return (
    <Page>
      <PageHeader
        icon={FlaskConical}
        title="Supplements"
        subtitle="Protein, creatine, pre-workout and the rest of the shelf"
        action={
          <div className="flex gap-2">
            {cart.length > 0 && (
              <button
                onClick={() => setShowCartDrawer(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md relative"
              >
                <ShoppingCart size={16} />
                <span>Cart ({cart.reduce((total, it) => total + it.quantity, 0)})</span>
              </button>
            )}
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
        {/* Over the whole shelf, not the page: a tile counted from what
            happened to be loaded would climb as you pressed Show more. */}
        <StatTile icon={Package} tone="blue" label="Total Products" value={counts?.all ?? 0} />
        <StatTile
          icon={ShoppingCart} tone="green" label="Showing"
          value={`${supplements.length} of ${total}`}
        />
        <StatTile
          icon={FlaskConical} tone="red" label="Out of Stock"
          value={counts?.outOfStock ?? 0}
        />
      </div>

      {/* Category filter */}
      <Card className="p-3 sm:p-4 mb-5">
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input
            type="search"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search product or description…"
            aria-label="Search supplements"
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterCat('all')}
            aria-pressed={filterCat === 'all'}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${focusRing} ${
              filterCat === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60'
            }`}>
            All ({counts?.all ?? 0})
          </button>
          {CATEGORIES.map(cat => {
            const count = counts?.byCategory[cat.value] ?? 0;
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
        filterCat === 'all' && !search ? (
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
            title="Nothing matches"
            hint="Try a different category, or clear the search."
            action={
              <button
                onClick={() => { setFilterCat('all'); setSearchInput(''); }}
                className={secondaryButton}
              >
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
                    onClick={() => addToCart(s)}
                    disabled={s.stock === 0 || s.price == null}
                    title={
                      s.stock === 0 ? 'Out of stock'
                        : s.price == null ? 'Set a price before selling'
                        : undefined
                    }
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${focusRing} ${
                      s.stock === 0 || s.price == null
                        ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    <Plus size={12} /> Cart
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

      {hasMore && (
        <div className="flex justify-center mt-5">
          <button onClick={showMore} disabled={loadingMore} className={secondaryButton}>
            {loadingMore ? 'Loading…' : `Show more · ${total - supplements.length} left`}
          </button>
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
      ) /* Sell modal removed */

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

      {/* POS Shopping Cart Drawer Modal */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCartDrawer(false)} aria-hidden="true" />
          <div className="relative bg-white dark:bg-slate-900 shadow-2xl w-full max-w-md h-full flex flex-col z-10 animate-slide-in">
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <ShoppingCart className="text-emerald-600" size={18} />
                POS Shopping Cart
              </h2>
              <button
                onClick={() => setShowCartDrawer(false)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <ShoppingCart size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Your shopping cart is empty</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.supplementId} className="flex justify-between items-center p-3 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40">
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">{item.name}</p>
                        <p className="text-xs text-green-700 font-bold mt-0.5">Rs. {item.price.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCart(prev =>
                              prev.map(it =>
                                it.supplementId === item.supplementId
                                  ? { ...it, quantity: Math.max(1, it.quantity - 1) }
                                  : it
                              )
                            );
                          }}
                          className="px-2 py-0.5 border border-gray-200 dark:border-slate-700 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 text-xs font-bold"
                        >
                          -
                        </button>
                        <span className="text-sm font-bold w-6 text-center text-gray-800 dark:text-slate-200">{item.quantity}</span>
                        <button
                          onClick={() => {
                            if (item.quantity >= item.maxStock) {
                              toast.error(`Only ${item.maxStock} in stock`);
                              return;
                            }
                            setCart(prev =>
                              prev.map(it =>
                                it.supplementId === item.supplementId
                                  ? { ...it, quantity: it.quantity + 1 }
                                  : it
                              )
                            );
                          }}
                          className="px-2 py-0.5 border border-gray-200 dark:border-slate-700 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 text-xs font-bold"
                        >
                          +
                        </button>
                        <button
                          onClick={() => {
                            setCart(prev => prev.filter(it => it.supplementId !== item.supplementId));
                            toast.success('Removed item from cart');
                          }}
                          className="ml-2 text-xs text-red-500 hover:text-red-700 font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <form onSubmit={handleCartCheckout} className="p-5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/60 space-y-4 shrink-0">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-600 dark:text-slate-400">Cart Subtotal</span>
                  <span className="text-xl font-black text-indigo-600">
                    Rs. {cart.reduce((total, item) => total + (item.price * item.quantity), 0).toLocaleString()}
                  </span>
                </div>

                <div>
                  <FieldLabel>Associate Member (Optional)</FieldLabel>
                  <select
                    value={cartMemberId}
                    onChange={e => setCartMemberId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">-- Walk-in Customer --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.memberNo} · {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {cartMemberId && (
                  <div>
                    <FieldLabel>Payment Method</FieldLabel>
                    <select
                      value={cartPaymentMethod}
                      onChange={e => setCartPaymentMethod(e.target.value as 'cash' | 'card')}
                      className={inputClass}
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card / POS Terminal</option>
                    </select>
                  </div>
                )}

                <div>
                  <FieldLabel>Sales Notes / Comments</FieldLabel>
                  <input
                    placeholder="Add discount details, invoice remarks..."
                    value={cartNotes}
                    onChange={e => setCartNotes(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className={`flex-1 ${secondaryButton}`}
                  >
                    Clear Cart
                  </button>
                  <button
                    type="submit"
                    disabled={checkoutCartLoading}
                    className={`flex-1 ${primaryButton}`}
                  >
                    {checkoutCartLoading ? 'Processing…' : 'Checkout Cart'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
