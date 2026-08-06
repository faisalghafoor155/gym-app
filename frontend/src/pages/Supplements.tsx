import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, FlaskConical, Package, ShoppingCart } from 'lucide-react';
import api, { apiError } from '../api/client';
import { useDialog } from '../hooks/useDialog';
import type { Supplement, SupplementCategory } from '../types';
import toast from 'react-hot-toast';

interface CategoryInfo {
  value: SupplementCategory;
  label: string;
  icon: string;
  color: string;
}

const CATEGORIES: CategoryInfo[] = [
  { value: 'protein', label: 'Protein', icon: '🥩', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'creatine', label: 'Creatine', icon: '⚡', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'preworkout', label: 'Pre-Workout', icon: '🔥', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'bcaa', label: 'BCAA', icon: '💪', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'vitamins', label: 'Vitamins', icon: '🌿', color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'fatburner', label: 'Fat Burner', icon: '🏃', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'other', label: 'Other', icon: '💊', color: 'bg-gray-50 text-gray-700 border-gray-200' },
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
  const modalRef = useDialog(showModal, () => setShowModal(false));

  const load = () =>
    api.get<Supplement[]>('/supplements')
      .then(r => setSupplements(r.data))
      .catch(err => toast.error(apiError(err, 'Could not load supplements')))
      .finally(() => setLoading(false));

  useEffect(() => { void load(); }, []);

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

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/supplements/${id}`);
      toast.success('Deleted');
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete'));
    }
  };

  const filtered = filterCat === 'all'
    ? supplements
    : supplements.filter(s => s.category === filterCat);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical size={22} className="text-blue-600 shrink-0" />
            Supplements
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 truncate">Protein, Creatine, Pre-workout & more</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shrink-0">
          <Plus size={16} /> <span className="hidden sm:inline">Add Supplement</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Package size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{supplements.length}</p>
            <p className="text-xs text-gray-500">Total Products</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
            <ShoppingCart size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {supplements.reduce((s, x) => s + (x.stock || 0), 0)}
            </p>
            <p className="text-xs text-gray-500">Total Stock</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
            <FlaskConical size={20} className="text-orange-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {supplements.filter(s => (s.stock || 0) === 0).length}
            </p>
            <p className="text-xs text-gray-500">Out of Stock</p>
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setFilterCat('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            filterCat === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}>
          All ({supplements.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = supplements.filter(s => s.category === cat.value).length;
          if (count === 0 && filterCat !== cat.value) return null;
          return (
            <button key={cat.value} onClick={() => setFilterCat(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 ${
                filterCat === cat.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}>
              {cat.icon} {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <FlaskConical size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">No supplements yet</p>
          <p className="text-sm text-gray-400 mt-1">Add protein, creatine, and other supplements</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(s => {
            const catInfo = getCatInfo(s.category);
            const lowStock = s.stock <= 5;
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-2xl">
                      {catInfo.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{s.name}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${catInfo.color}`}>
                        {catInfo.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-blue-600 p-1">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => void handleDelete(s.id, s.name)} className="text-gray-400 hover:text-red-600 p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {s.description && (
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed">{s.description}</p>
                )}

                <div className="space-y-1.5">
                  {s.dosage && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Dosage</span>
                      <span className="font-semibold text-gray-700">{s.dosage}</span>
                    </div>
                  )}
                  {s.timing && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Timing</span>
                      <span className="font-semibold text-gray-700">{s.timing}</span>
                    </div>
                  )}
                  {s.price && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Price</span>
                      <span className="font-bold text-green-700">Rs. {Number(s.price).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Stock Badge */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Stock</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                    s.stock === 0 ? 'bg-red-100 text-red-700' :
                    lowStock ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {s.stock === 0 ? 'Out of stock' : `${s.stock} units`}
                  </span>
                </div>
              </div>
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
            className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg sm:mx-4 max-h-[92dvh] flex flex-col"
          >
            <div className="p-5 sm:p-6 border-b border-gray-100 shrink-0">
              <h2 id="supplement-modal-title" className="text-lg font-bold text-gray-900">
                {editing ? 'Edit Supplement' : 'Add Supplement'}
              </h2>
            </div>

            <form onSubmit={e => void handleSave(e)} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Name *</label>
                <input required value={form.name} onChange={set('name')}
                  placeholder="e.g. Whey Protein Gold Standard"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {CATEGORIES.map(cat => (
                    <button key={cat.value} type="button"
                      onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                      className={`border rounded-xl py-2 px-1 text-center transition-all ${
                        form.category === cat.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <p className="text-lg">{cat.icon}</p>
                      <p className="text-xs font-medium text-gray-700 mt-0.5 leading-tight">{cat.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                <textarea rows={2} value={form.description} onChange={set('description')}
                  placeholder="Brief description of this supplement..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Dosage</label>
                  <input value={form.dosage} onChange={set('dosage')}
                    placeholder="e.g. 1 scoop (30g)"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Timing</label>
                  <input value={form.timing} onChange={set('timing')}
                    placeholder="e.g. Post-workout"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Price (Rs.)</label>
                  <input type="number" min="0" value={form.price} onChange={set('price')}
                    placeholder="3500"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Stock (units)</label>
                  <input type="number" min="0" value={form.stock} onChange={set('stock')}
                    placeholder="10"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                  {saving ? 'Saving...' : editing ? 'Update' : 'Add Supplement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
