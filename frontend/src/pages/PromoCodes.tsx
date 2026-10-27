import { useState, type FormEvent } from 'react';
import { Ticket, Plus, Pencil, Trash2, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, PageLoader, LoadFailed, EmptyState, Refetching, FieldLabel, IconButton,
  inputClass, primaryButton, secondaryButton, focusRing,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useLanguage, type TVars } from '../context/LanguageContext';
import type { PromoCode, PromoKind } from '../types';

const money = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
const toInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/** Ready-made starting points for the offers gyms run most. */
const PRESETS: readonly { code: string; description: string; kind: PromoKind; value: number }[] = [
  { code: 'FAMILY10', description: 'Family members joining together', kind: 'percent', value: 10 },
  { code: 'STUDENT', description: 'Students with a valid card', kind: 'percent', value: 15 },
  { code: 'EID25', description: 'Eid offer', kind: 'percent', value: 25 },
];

const describe = (p: Pick<PromoCode, 'kind' | 'value'>, t: (s: string, vars?: TVars) => string) =>
  p.kind === 'percent' ? t('{value}% off', { value: p.value }) : t('{amount} off', { amount: money(p.value) });

/** Live, scheduled, expired, used up or off — the one word that matters. */
function state(p: PromoCode): { label: string; tone: string } {
  const now = new Date();
  if (!p.isActive) return { label: 'Off', tone: 'bg-gray-100 text-gray-500 dark:bg-slate-700/60 dark:text-slate-300' };
  if (p.validUntil && new Date(p.validUntil) < now) return { label: 'Expired', tone: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300' };
  if (p.maxUses != null && p.usedCount >= p.maxUses) return { label: 'Used up', tone: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300' };
  if (p.validFrom && new Date(p.validFrom) > now) return { label: 'Scheduled', tone: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' };
  return { label: 'Live', tone: 'bg-lime-50 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300' };
}

interface Form {
  code: string;
  description: string;
  kind: PromoKind;
  value: string;
  validFrom: string;
  validUntil: string;
  maxUses: string;
}

function PromoForm({ promo, onClose, onSaved }: { promo: PromoCode | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState<Form>(() => promo
    ? {
        code: promo.code, description: promo.description ?? '', kind: promo.kind, value: String(promo.value),
        validFrom: toInput(promo.validFrom), validUntil: toInput(promo.validUntil),
        maxUses: promo.maxUses != null ? String(promo.maxUses) : '',
      }
    : { code: '', description: '', kind: 'percent', value: '', validFrom: '', validUntil: '', maxUses: '' });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = { ...form, code: form.code.trim(), description: form.description.trim() };
    try {
      if (promo) await api.put(`/promo-codes/${promo.id}`, body);
      else await api.post('/promo-codes', body);
      toast.success(promo ? t('Promo code updated') : t('Promo code created'));
      onSaved();
    } catch (err) {
      toast.error(apiError(err, t('Could not save promo code')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={promo ? t('Edit promo code') : t('New promo code')} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        {!promo && (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button key={p.code} type="button"
                onClick={() => setForm(f => ({ ...f, code: p.code, description: t(p.description), kind: p.kind, value: String(p.value) }))}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-blue-400 ${focusRing}`}>
                {p.code}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="promo-code" required>{t('Code')}</FieldLabel>
            <input id="promo-code" required maxLength={40} value={form.code}
              onChange={e => set('code')(e.target.value.toUpperCase().replace(/\s/g, ''))}
              placeholder="EID25" className={`${inputClass} uppercase font-mono`} />
          </div>
          <div>
            <FieldLabel htmlFor="promo-value" required>{form.kind === 'percent' ? t('Percent off') : t('Rupees off')}</FieldLabel>
            <div className="flex gap-2">
              <input id="promo-value" type="number" required min={1} max={form.kind === 'percent' ? 100 : undefined} step={1}
                value={form.value} onChange={e => set('value')(e.target.value)} className={inputClass} />
              <select aria-label={t('Discount type')} value={form.kind} onChange={e => set('kind')(e.target.value as PromoKind)}
                className={`${inputClass} !w-20`}>
                <option value="percent">%</option>
                <option value="fixed">Rs</option>
              </select>
            </div>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="promo-desc">{t('Who it is for')}</FieldLabel>
          <input id="promo-desc" maxLength={200} value={form.description}
            onChange={e => set('description')(e.target.value)} placeholder={t('e.g. Students with a valid card')}
            className={inputClass} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <FieldLabel htmlFor="promo-from">{t('From')}</FieldLabel>
            <input id="promo-from" type="date" value={form.validFrom} onChange={e => set('validFrom')(e.target.value)} className={inputClass} />
          </div>
          <div>
            <FieldLabel htmlFor="promo-until">{t('Until')}</FieldLabel>
            <input id="promo-until" type="date" value={form.validUntil} onChange={e => set('validUntil')(e.target.value)} className={inputClass} />
          </div>
          <div>
            <FieldLabel htmlFor="promo-max">{t('Max uses')}</FieldLabel>
            <input id="promo-max" type="number" min={1} step={1} value={form.maxUses}
              onChange={e => set('maxUses')(e.target.value)} placeholder="∞" className={inputClass} />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
            {saving ? t('Saving…') : promo ? t('Save') : t('Create code')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Discount codes — family, student, Eid. The desk types the code when
 * registering or renewing, and the server works out the price.
 */
export default function PromoCodes() {
  const { t } = useLanguage();
  const { data, loading, refetching, reload } = useFetch<{ data: PromoCode[] }>('/promo-codes', t('Could not load promo codes'));
  const [editing, setEditing] = useState<PromoCode | 'new' | null>(null);
  const [deleting, setDeleting] = useState<PromoCode | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = async (p: PromoCode) => {
    try {
      await api.put(`/promo-codes/${p.id}`, { isActive: !p.isActive });
      await reload();
    } catch (err) {
      toast.error(apiError(err, t('Could not update promo code')));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await api.delete<{ deactivated?: boolean }>(`/promo-codes/${deleting.id}`);
      toast.success(res.data?.deactivated ? t('Code has been used, so it was switched off instead') : t('Promo code deleted'));
      setDeleting(null);
      await reload();
    } catch (err) {
      toast.error(apiError(err, t('Could not delete promo code')));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title={t('Could not load promo codes')} />;

  return (
    <Page>
      <PageHeader
        icon={Ticket}
        title={t('Discounts & Promo Codes')}
        subtitle={t('Family, student and seasonal offers, applied at registration and renewal')}
        action={<button onClick={() => setEditing('new')} className={primaryButton}><Plus size={16} /> {t('New code')}</button>}
      />

      {data.data.length === 0 ? (
        <EmptyState icon={Ticket} title={t('No promo codes yet')}
          hint={t('Create a code like STUDENT or EID25, then type it in the Renew or Add Member form.')}
          action={<button onClick={() => setEditing('new')} className={primaryButton}><Plus size={16} /> {t('Create the first code')}</button>} />
      ) : (
        <Refetching busy={refetching}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.data.map(p => {
              const s = state(p);
              return (
                <Card key={p.id} className={`p-4 ${p.isActive ? '' : 'opacity-70'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-lg text-gray-900 dark:text-slate-100">{p.code}</p>
                      <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{describe(p, t)}</p>
                      {p.description && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{p.description}</p>}
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.tone}`}>{t(s.label)}</span>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 dark:text-slate-400 space-y-0.5">
                    <p>
                      {p.maxUses != null
                        ? t(p.usedCount === 1 ? 'Used {count} of {max} time · {amount} given' : 'Used {count} of {max} times · {amount} given',
                          { count: p.usedCount, max: p.maxUses, amount: money(p.totalDiscount) })
                        : t(p.usedCount === 1 ? 'Used {count} time · {amount} given' : 'Used {count} times · {amount} given',
                          { count: p.usedCount, amount: money(p.totalDiscount) })}
                    </p>
                    {(p.validFrom || p.validUntil) && (
                      <p>{p.validFrom ? shortDate(p.validFrom) : t('Now')} → {p.validUntil ? shortDate(p.validUntil) : t('no end')}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                    <IconButton icon={Power} label={p.isActive ? t('Switch off') : t('Switch on')} tone={p.isActive ? 'yellow' : 'green'} onClick={() => void toggle(p)} />
                    <IconButton icon={Pencil} label={t('Edit {name}', { name: p.code })} onClick={() => setEditing(p)} />
                    <IconButton icon={Trash2} label={t('Delete {name}', { name: p.code })} tone="red" onClick={() => setDeleting(p)} />
                  </div>
                </Card>
              );
            })}
          </div>
        </Refetching>
      )}

      {editing && (
        <PromoForm promo={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }} />
      )}
      {deleting && (
        <ConfirmDialog
          title={t('Delete promo code')}
          message={deleting.redemptions > 0
            ? t('{code} has already been used, so it will be switched off rather than deleted — the memberships it discounted keep their record.', { code: deleting.code })
            : t('Delete {code}? This cannot be undone.', { code: deleting.code })}
          confirmLabel={deleting.redemptions > 0 ? t('Switch off') : t('Delete')}
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Page>
  );
}
