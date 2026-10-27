import { useState, type FormEvent } from 'react';
import {
  Plus, Pencil, Archive, RotateCcw, Tag, CalendarRange, Wallet, EyeOff,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, IconTile, DataRow, PageLoader, EmptyState, IconButton,
  inputClass, primaryButton, secondaryButton, focusRing,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useDialog } from '../hooks/useDialog';
import type { MembershipPlan, Paginated } from '../types';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';

interface PlanForm {
  name: string;
  price: string;
  durationDays: string;
  includesCardio: boolean;
  includesLocker: boolean;
}

const emptyForm: PlanForm = {
  name: '', price: '', durationDays: '30', includesCardio: false, includesLocker: false,
};

/** What a plan covers beyond the gym floor, as the toggles and badges show it.
 *  Labels are the English; they are translated where they are drawn. */
const INCLUSIONS = [
  { key: 'includesCardio', label: 'Cardio' },
  { key: 'includesLocker', label: 'Locker' },
] as const;

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
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showRetired, setShowRetired] = useState(false);
  const [retiring, setRetiring] = useState<MembershipPlan | null>(null);
  const modalRef = useDialog(showModal, () => setShowModal(false));

  // Always fetch everything; the toggle is a display choice, so flipping it
  // does not cost a round trip. `all=true` keeps that true now the endpoint is
  // paged — a gym's price list is a handful of rows, and the retired ones the
  // toggle reveals have to already be here for it to reveal them.
  const { data, loading, reload: load } = useFetch<Paginated<MembershipPlan>>(
    '/membership-plans?includeInactive=true&all=true',
    t('Could not load membership plans'),
  );
  // Null only before the first load lands, which the spinner covers.
  const plans = data?.data ?? [];

  const set = (k: 'name' | 'price' | 'durationDays') => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };

  const openEdit = (p: MembershipPlan) => {
    setEditing(p.id);
    setForm({
      name: p.name,
      price: String(p.price),
      durationDays: String(p.durationDays),
      includesCardio: p.includesCardio,
      includesLocker: p.includesLocker,
    });
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
        includesCardio: form.includesCardio,
        includesLocker: form.includesLocker,
      };
      if (editing) {
        await api.put(`/membership-plans/${editing}`, payload);
        toast.success(t('Plan updated'));
      } else {
        await api.post('/membership-plans', payload);
        toast.success(t('Plan added'));
      }
      setShowModal(false);
      await load();
    } catch (err) {
      toast.error(apiError(err, t('Could not save the plan')));
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
      toast.success(t('"{name}" is no longer offered', { name: retiring.name }));
      setRetiring(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, t('Could not retire the plan')));
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (p: MembershipPlan) => {
    try {
      await api.put(`/membership-plans/${p.id}`, { isActive: true });
      toast.success(t('"{name}" is being offered again', { name: p.name }));
      await load();
    } catch (err) {
      toast.error(apiError(err, t('Could not restore the plan')));
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
                <EyeOff size={10} /> {t('Not offered')}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-0.5 shrink-0">
          <IconButton icon={Pencil} label={t('Edit {name}', { name: p.name })} onClick={() => openEdit(p)} />
          {p.isActive ? (
            <IconButton icon={Archive} tone="red" label={t('Stop offering {name}', { name: p.name })}
              onClick={() => setRetiring(p)} />
          ) : (
            <IconButton icon={RotateCcw} tone="green" label={t('Offer {name} again', { name: p.name })}
              onClick={() => void handleRestore(p)} />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <DataRow
          icon={Wallet}
          label={t('Price')}
          value={p.price === 0
            ? <span className="text-yellow-700">{t('Not set')}</span>
            : `Rs. ${p.price.toLocaleString()}`}
        />
        <DataRow
          icon={CalendarRange}
          label={t('Duration')}
          value={
            <>
              {t('{days} days', { days: p.durationDays })}
              {describeDuration(p.durationDays) && (
                <span className="text-gray-400 dark:text-slate-500 font-normal"> · {t(describeDuration(p.durationDays)!)}</span>
              )}
            </>
          }
        />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300">
          {t('Gym')}
        </span>
        {INCLUSIONS.filter(i => p[i.key]).map(i => (
          <span key={i.key} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
            {t(i.label)}
          </span>
        ))}
      </div>
    </Card>
  );

  return (
    <Page>
      <PageHeader
        icon={Tag}
        title={t('Membership Plans')}
        subtitle={t('What this gym sells — price and how long it runs for')}
        action={
          <button onClick={openAdd} className={primaryButton}>
            <Plus size={16} />
            <span className="hidden sm:inline">{t('Add Plan')}</span><span className="sm:hidden">{t('Add')}</span>
          </button>
        }
      />

      {/* A plan priced at zero is the seeded default nobody has filled in yet;
          it will sell a membership for nothing until somebody does. */}
      {unpriced > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-500/15 border border-yellow-200 dark:border-yellow-500/20 rounded-xl px-4 py-3 mb-5 flex items-start gap-2.5">
          <Wallet size={16} className="text-yellow-600 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800">
            {unpriced === 1
              ? t('One plan has no price set. Members signed up on it will be recorded as paying Rs. 0.')
              : t('{count} plans have no price set. Members signed up on them will be recorded as paying Rs. 0.', { count: unpriced })}
          </p>
        </div>
      )}

      {/* Plans */}
      {active.length === 0 && retired.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={t('No membership plans yet')}
          hint={t('Add a plan before signing members up — a membership needs one.')}
          action={
            <button onClick={openAdd} className={primaryButton}>
              <Plus size={16} /> {t('Add the first plan')}
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
              title={t('No plans are being offered')}
              hint={t('Add one, or bring a retired plan back below.')}
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
                {showRetired
                  ? t('Hide retired plans ({count})', { count: retired.length })
                  : t('Show retired plans ({count})', { count: retired.length })}
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
                {editing ? t('Edit Plan') : t('Add Membership Plan')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                {editing
                  ? t('Members already on this plan keep what they paid')
                  : t('Name it, price it, and say how many days it runs')}
              </p>
            </div>

            <form onSubmit={e => void handleSave(e)} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <label htmlFor="plan-name" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  {t('Plan Name')} *
                </label>
                <input
                  id="plan-name"
                  required
                  value={form.name}
                  onChange={e => set('name')(e.target.value)}
                  placeholder={t('Monthly')}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="plan-price" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  {t('Price (Rs.)')}
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
                  {t('Duration (days)')} *
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
                      <p className="font-semibold text-xs">{t('{days}d', { days: d.days })}</p>
                      <p className="text-xs opacity-60 mt-0.5">{t(d.label)}</p>
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
                  {t('Expiry is counted in days from the start date.')}
                </p>
              </div>

              <fieldset>
                <legend className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  {t('Included')}
                </legend>
                <div className="flex flex-wrap gap-4">
                  {INCLUSIONS.map(i => (
                    <label key={i.key} className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={form[i.key]}
                        onChange={e => setForm(f => ({ ...f, [i.key]: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      {t(i.label)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className={`flex-1 ${secondaryButton}`}>
                  {t('Cancel')}
                </button>
                <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
                  {saving ? t('Saving...') : editing ? t('Update Plan') : t('Add Plan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {retiring && (
        <ConfirmDialog
          title={t('Stop offering this plan')}
          message={t('Stop offering "{name}"? Members already on it keep it and their history is untouched — it just disappears from the list when signing someone up.', { name: retiring.name })}
          confirmLabel={t('Stop offering')}
          busy={saving}
          onConfirm={() => void handleRetire()}
          onCancel={() => setRetiring(null)}
        />
      )}
    </Page>
  );
}
