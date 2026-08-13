import { useEffect, useState, type FormEvent } from 'react';
import {
  Plus, Pencil, Archive, RotateCcw, Tag, CalendarRange, Wallet, EyeOff,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, IconTile, DataRow, PageLoader, EmptyState, IconButton,
  inputClass, primaryButton, secondaryButton, focusRing,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useDialog } from '../hooks/useDialog';
import type { MembershipPlan } from '../types';
import toast from 'react-hot-toast';

interface PlanForm {
  name: string;
  price: string;
  durationDays: string;
}

const emptyForm: PlanForm = { name: '', price: '', durationDays: '30' };

/** Shortcuts for the durations gyms actually sell, so the common cases are
 *  one tap and the unusual ones are still typeable. */
const DURATION_PRESETS = [
  { days: 30, label: '1 month' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
] as const;

/** Reads a duration back as something human: "90 days" is also "3 months". */
function describeDuration(days: number): string | null {
  const preset = DURATION_PRESETS.find(p => p.days === days);
  return preset?.label ?? null;
}

export default function MembershipPlans() {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showRetired, setShowRetired] = useState(false);
  const [retiring, setRetiring] = useState<MembershipPlan | null>(null);
  const modalRef = useDialog(showModal, () => setShowModal(false));

  // Always fetch everything; the toggle is a display choice, so flipping it
  // does not cost a round trip.
  const load = () =>
    api.get<MembershipPlan[]>('/membership-plans?includeInactive=true')
      .then(r => setPlans(r.data))
      .catch(err => toast.error(apiError(err, 'Could not load membership plans')))
      .finally(() => setLoading(false));

  useEffect(() => { void load(); }, []);

  const set = (k: keyof PlanForm) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };

  const openEdit = (p: MembershipPlan) => {
    setEditing(p.id);
    setForm({ name: p.name, price: String(p.price), durationDays: String(p.durationDays) });
    setShowModal(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        price: form.price === '' ? 0 : form.price,
        durationDays: form.durationDays,
      };
      if (editing) {
        await api.put(`/membership-plans/${editing}`, payload);
        toast.success('Plan updated');
      } else {
        await api.post('/membership-plans', payload);
        toast.success('Plan added');
      }
      setShowModal(false);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not save the plan'));
    } finally {
      setSaving(false);
    }
  };

  /** Retiring is not deleting: memberships already sold under a plan keep
   *  pointing at it, so it stops being offered and nothing else changes. */
  const handleRetire = async () => {
    if (!retiring) return;
    setSaving(true);
    try {
      await api.delete(`/membership-plans/${retiring.id}`);
      toast.success(`"${retiring.name}" is no longer offered`);
      setRetiring(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not retire the plan'));
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (p: MembershipPlan) => {
    try {
      await api.put(`/membership-plans/${p.id}`, { isActive: true });
      toast.success(`"${p.name}" is being offered again`);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not restore the plan'));
    }
  };

  const active = plans.filter(p => p.isActive);
  const retired = plans.filter(p => !p.isActive);
  const unpriced = active.filter(p => p.price === 0).length;

  if (loading) return <PageLoader />;

  const planCard = (p: MembershipPlan) => (
    <Card key={p.id} className={`p-5 transition-shadow ${
      p.isActive ? 'hover:shadow-md' : 'bg-gray-50/60'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <IconTile icon={Tag} tone={p.isActive ? 'blue' : 'gray'} />
          <div className="min-w-0">
            <h3 className={`font-bold text-sm truncate ${p.isActive ? 'text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}>
              {p.name}
            </h3>
            {!p.isActive && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-slate-400 bg-gray-200 dark:bg-slate-700 px-2 py-0.5 rounded-full mt-1">
                <EyeOff size={10} /> Not offered
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-0.5 shrink-0">
          <IconButton icon={Pencil} label={`Edit ${p.name}`} onClick={() => openEdit(p)} />
          {p.isActive ? (
            <IconButton icon={Archive} tone="red" label={`Stop offering ${p.name}`}
              onClick={() => setRetiring(p)} />
          ) : (
            <IconButton icon={RotateCcw} tone="green" label={`Offer ${p.name} again`}
              onClick={() => void handleRestore(p)} />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <DataRow
          icon={Wallet}
          label="Price"
          value={p.price === 0
            ? <span className="text-yellow-700">Not set</span>
            : `Rs. ${p.price.toLocaleString()}`}
        />
        <DataRow
          icon={CalendarRange}
          label="Duration"
          value={
            <>
              {p.durationDays} days
              {describeDuration(p.durationDays) && (
                <span className="text-gray-400 dark:text-slate-500 font-normal"> · {describeDuration(p.durationDays)}</span>
              )}
            </>
          }
        />
      </div>
    </Card>
  );

  return (
    <Page>
      <PageHeader
        icon={Tag}
        title="Membership Plans"
        subtitle="What this gym sells — price and how long it runs for"
        action={
          <button onClick={openAdd} className={primaryButton}>
            <Plus size={16} />
            <span className="hidden sm:inline">Add Plan</span><span className="sm:hidden">Add</span>
          </button>
        }
      />

      {/* A plan priced at zero is the seeded default nobody has filled in yet;
          it will sell a membership for nothing until somebody does. */}
      {unpriced > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-500/15 border border-yellow-200 dark:border-yellow-500/20 rounded-xl px-4 py-3 mb-5 flex items-start gap-2.5">
          <Wallet size={16} className="text-yellow-600 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800">
            {unpriced === 1 ? 'One plan has' : `${unpriced} plans have`} no price set.
            Members signed up on {unpriced === 1 ? 'it' : 'them'} will be recorded as paying Rs. 0.
          </p>
        </div>
      )}

      {/* Plans */}
      {active.length === 0 && retired.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No membership plans yet"
          hint="Add a plan before signing members up — a membership needs one."
          action={
            <button onClick={openAdd} className={primaryButton}>
              <Plus size={16} /> Add the first plan
            </button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {active.map(planCard)}
          </div>

          {active.length === 0 && (
            <EmptyState
              icon={Tag}
              title="No plans are being offered"
              hint="Add one, or bring a retired plan back below."
            />
          )}

          {retired.length > 0 && (
            <div className="mt-8">
              <button
                onClick={() => setShowRetired(v => !v)}
                aria-expanded={showRetired}
                className={`text-sm font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 flex items-center gap-2 transition-colors rounded-lg px-1 py-0.5 ${focusRing}`}
              >
                <EyeOff size={14} />
                {showRetired ? 'Hide' : 'Show'} retired plans ({retired.length})
              </button>
              {showRetired && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                  {retired.map(planCard)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} aria-hidden="true" />
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-modal-title"
            className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md sm:mx-4 max-h-[92dvh] flex flex-col"
          >
            <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
              <h2 id="plan-modal-title" className="text-lg font-bold text-gray-900 dark:text-slate-100">
                {editing ? 'Edit Plan' : 'Add Membership Plan'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                {editing
                  ? 'Members already on this plan keep what they paid'
                  : 'Name it, price it, and say how many days it runs'}
              </p>
            </div>

            <form onSubmit={e => void handleSave(e)} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <label htmlFor="plan-name" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Plan Name *
                </label>
                <input
                  id="plan-name"
                  required
                  value={form.name}
                  onChange={e => set('name')(e.target.value)}
                  placeholder="Monthly"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="plan-price" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Price (Rs.)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm font-medium">Rs.</span>
                  <input
                    id="plan-price"
                    type="number"
                    min="0"
                    step="any"
                    value={form.price}
                    onChange={e => set('price')(e.target.value)}
                    placeholder="3000"
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="plan-duration" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Duration (days) *
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {DURATION_PRESETS.map(d => (
                    <button key={d.days} type="button"
                      onClick={() => set('durationDays')(String(d.days))}
                      aria-pressed={form.durationDays === String(d.days)}
                      className={`border rounded-xl py-2 px-1 text-center transition-all ${focusRing} ${
                        form.durationDays === String(d.days)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700'
                          : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:border-gray-300'
                      }`}>
                      <p className="font-semibold text-xs">{d.days}d</p>
                      <p className="text-xs opacity-60 mt-0.5">{d.label}</p>
                    </button>
                  ))}
                </div>
                <input
                  id="plan-duration"
                  type="number"
                  required
                  min="1"
                  max="3650"
                  value={form.durationDays}
                  onChange={e => set('durationDays')(e.target.value)}
                  className={inputClass}
                />
                {/* Days, not months: "31 Jan + 1 month" has no single right
                    answer, "31 Jan + 30 days" has exactly one. */}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                  Expiry is counted in days from the start date.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className={`flex-1 ${secondaryButton}`}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
                  {saving ? 'Saving...' : editing ? 'Update Plan' : 'Add Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {retiring && (
        <ConfirmDialog
          title="Stop offering this plan"
          message={`Stop offering "${retiring.name}"? Members already on it keep it and their history is untouched — it just disappears from the list when signing someone up.`}
          confirmLabel="Stop offering"
          busy={saving}
          onConfirm={() => void handleRetire()}
          onCancel={() => setRetiring(null)}
        />
      )}
    </Page>
  );
}
