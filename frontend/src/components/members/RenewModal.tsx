import { useState, type FormEvent } from 'react';
import {
  FieldLabel, inputClass, primaryButton, secondaryButton, focusRing,
} from '../ui';
import { Dumbbell, UserCheck, UserX } from 'lucide-react';
import api, { apiError } from '../../api/client';
import { useDialog } from '../../hooks/useDialog';
import type { GymSettings, Member, MembershipPlan, PaymentChannel, PaymentMethod } from '../../types';
import { CHANNELS, CHANNEL_LABELS, accountFor } from '../../utils/paymentChannels';
import toast from 'react-hot-toast';

/** What the desk fills in to renew: the next period, and the money for it. */
interface RenewForm {
  /** Blank means the same plan again. */
  planId: string;
  amount: string;
  method: PaymentMethod;
  channel: PaymentChannel | '';
  reference: string;
}

/**
 * When a renewal's new period will begin — the day after the current expiry,
 * or today if that has already passed.
 *
 * Mirrors `renewalStart` on the server so the modal can say what the member is
 * buying before they pay for it. The server's answer is still the one stored.
 */
function renewalStart(expiryDate: string): Date {
  const dayAfter = new Date(expiryDate);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const now = new Date();
  return dayAfter > now ? dayAfter : now;
}

/** What the renewal will run to, given the plan picked. */
function previewRenewal(expiryDate: string, durationDays: number): string {
  const d = renewalStart(expiryDate);
  d.setDate(d.getDate() + durationDays);
  return d.toLocaleDateString('en-PK', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

interface Props {
  /** The member being renewed. Rendered only when they hold a membership, so
   *  `currentMembership` is non-null by the time this mounts. */
  member: Member & { currentMembership: NonNullable<Member['currentMembership']> };
  plans: MembershipPlan[];
  /** The gym's published accounts, for the line under the channel picker.
   *  Null while they are still loading, or if that call failed. */
  settings: GymSettings | null;
  onClose: () => void;
  onRenewed: () => void;
}

/**
 * Sells a member their next period.
 *
 * Owns the form rather than taking it from the page: nothing outside needs to
 * read a half-typed renewal, and keeping it here means the values are gone
 * when the modal closes rather than lingering to reappear on the next member.
 */
export default function RenewModal({ member, plans, settings, onClose, onRenewed }: Props) {
  const ms = member.currentMembership;

  const hasTrainer = Boolean(member.trainerId || member.trainer);
  const trainerName = member.trainer?.name || 'Assigned Trainer';

  const [includeTrainer, setIncludeTrainer] = useState<boolean>(hasTrainer);
  // Default to 10,000 as requested, or trainer's custom fee if set, manually editable
  const [ptFee, setPtFee] = useState<string>(() => {
    if (member.trainer?.ptFee != null && Number(member.trainer.ptFee) > 0) {
      return String(member.trainer.ptFee);
    }
    return '10000';
  });

  const [form, setForm] = useState<RenewForm>(() => {
    const plan = plans.find(p => p.id === ms.planId);
    return {
      // Same plan again is the common case, so it is preselected.
      planId: ms.planId ?? plans[0]?.id ?? '',
      // Prefilled from the plan's price, and editable — a haggled renewal is
      // recorded at what was actually taken, not what the list says.
      amount: plan ? String(plan.price) : '',
      method: 'cash',
      channel: '',
      reference: '',
    };
  });
  const [saving, setSaving] = useState(false);
  const dialogRef = useDialog(true, onClose);

  const picked = plans.find(p => p.id === form.planId);

  const gymAmount = Number(form.amount) || 0;
  const ptFeeNum = hasTrainer && includeTrainer ? Math.max(0, Number(ptFee) || 0) : 0;
  const totalAmount = gymAmount + ptFeeNum;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (gymAmount <= 0) {
      toast.error('Gym membership plan fee must be greater than zero');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/members/${member.id}/memberships/${ms.id}/renew`, {
        ...(form.planId && { planId: form.planId }),
        amount: gymAmount,
        method: form.method,
        ...(form.method === 'online' && {
          channel: form.channel || null,
          reference: form.reference.trim() || null,
        }),
        ...(hasTrainer && {
          includeTrainer,
          ptFee: includeTrainer ? ptFeeNum : 0,
        }),
      });

      if (hasTrainer && !includeTrainer) {
        toast.success(`Membership renewed. Trainer (${trainerName}) removed from card.`);
      } else if (hasTrainer && includeTrainer) {
        toast.success(`Membership & Trainer renewed (Total: Rs. ${totalAmount.toLocaleString('en-PK')})`);
      } else {
        toast.success('Membership renewed');
      }
      onRenewed();
    } catch (err) {
      // The modal stays open with its values, so a mistyped amount can be
      // corrected without retyping the rest.
      toast.error(apiError(err, 'Could not renew membership'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="renew-modal-title"
        className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md sm:mx-4 max-h-[92dvh] flex flex-col"
      >
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <h2 id="renew-modal-title" className="text-lg font-bold text-gray-900 dark:text-slate-100">
            Renew membership
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {member.name} · {member.memberNo}
          </p>
        </div>

        <form onSubmit={e => void handleSubmit(e)} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 px-3 py-2.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-slate-400">Current plan</span>
              <span className="font-semibold text-gray-800 dark:text-slate-200">{ms.planName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-slate-400">Expires</span>
              <span className="font-semibold text-gray-800 dark:text-slate-200">
                {new Date(ms.expiryDate)
                  .toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-slate-400">Status</span>
              <span className="font-semibold text-gray-800 dark:text-slate-200">
                {ms.daysLeft < 0
                  ? `Expired ${Math.abs(ms.daysLeft)}d ago`
                  : `${ms.daysLeft}d left`}
              </span>
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="renew-plan" required>Plan</FieldLabel>
            <select
              id="renew-plan"
              value={form.planId}
              onChange={e => {
                const planId = e.target.value;
                const plan = plans.find(p => p.id === planId);
                // The price follows the plan, so switching plans does not
                // leave the old plan's figure sitting in the amount.
                setForm(f => ({
                  ...f, planId, ...(plan && { amount: String(plan.price) }),
                }));
              }}
              className={inputClass}
            >
              {/* The member's own plan stays offered even if it has since
                  been retired — renewing what they already hold is not
                  buying something new. */}
              {!plans.some(p => p.id === ms.planId) && (
                <option value={ms.planId}>{ms.planName} (current)</option>
              )}
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — Rs. {p.price.toLocaleString('en-PK')} / {p.durationDays}d
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel htmlFor="renew-amount" required>Fee collected (Rs.)</FieldLabel>
            <input
              id="renew-amount"
              type="number" min={1} step={1} required
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className={inputClass}
            />
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Change it if a different amount was agreed.
            </p>
          </div>

          <div>
            {/* Two buttons rather than a field, so the label names the pair. */}
            <FieldLabel id="renew-method-label" required>Paid by</FieldLabel>
            <div
              role="group"
              aria-labelledby="renew-method-label"
              className="grid grid-cols-2 gap-2"
            >
              {(['cash', 'online'] as PaymentMethod[]).map(m => (
                <button key={m} type="button"
                  onClick={() => setForm(f => ({
                    ...f, method: m,
                    // Cash carries no wallet; drop what an earlier online
                    // selection left behind.
                    ...(m === 'cash' && { channel: '' as const, reference: '' }),
                  }))}
                  className={`border rounded-xl py-2.5 px-2 text-center transition-all ${focusRing} ${
                    form.method === m
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700'
                      : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:border-gray-300'
                  }`}>
                  <p className="font-semibold text-xs capitalize">{m}</p>
                </button>
              ))}
            </div>
          </div>

          {form.method === 'online' && (
            <>
              <div>
                <FieldLabel htmlFor="renew-channel">Received in</FieldLabel>
                <select
                  id="renew-channel"
                  value={form.channel}
                  onChange={e => setForm(f => ({ ...f, channel: e.target.value as PaymentChannel | '' }))}
                  className={inputClass}
                >
                  <option value="">Select account</option>
                  {CHANNELS.map(c => (
                    <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                  ))}
                </select>
                {accountFor(settings, form.channel) && (
                  <div className="mt-2 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/20 rounded-xl px-3 py-2">
                    <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Send to</p>
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-200 break-words">
                      {accountFor(settings, form.channel)}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <FieldLabel htmlFor="renew-reference">Transaction ID <span className="font-normal text-gray-400">(optional)</span></FieldLabel>
                <input
                  id="renew-reference"
                  type="text" maxLength={100}
                  value={form.reference}
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="e.g. 4429183756"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {/* Trainer Section: Only shown if member has an assigned trainer */}
          {hasTrainer && (
            <div className="rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/40 dark:bg-purple-950/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
                    <Dumbbell size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block">
                      Assigned Personal Trainer
                    </span>
                    <h3 className="text-xs font-bold text-gray-900 dark:text-slate-100">
                      {trainerName}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Toggle Choices */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIncludeTrainer(true)}
                  className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
                    includeTrainer
                      ? 'border-purple-500 bg-white dark:bg-slate-800 shadow-xs ring-1 ring-purple-500'
                      : 'border-gray-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 opacity-70 hover:opacity-100'
                  }`}
                >
                  <UserCheck size={16} className={includeTrainer ? 'text-purple-600 mt-0.5' : 'text-gray-400 mt-0.5'} />
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-slate-100">Renew Trainer</p>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400">Keep trainer assigned</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIncludeTrainer(false)}
                  className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
                    !includeTrainer
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 shadow-xs ring-1 ring-rose-500'
                      : 'border-gray-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 opacity-70 hover:opacity-100'
                  }`}
                >
                  <UserX size={16} className={!includeTrainer ? 'text-rose-600 mt-0.5' : 'text-gray-400 mt-0.5'} />
                  <div>
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Gym Fee Only</p>
                    <p className="text-[10px] text-rose-600/80 dark:text-rose-400">Remove trainer</p>
                  </div>
                </button>
              </div>

              {/* If Renew Trainer is chosen: Editable Fee */}
              {includeTrainer ? (
                <div className="space-y-1.5 pt-2 border-t border-purple-100 dark:border-purple-900/40">
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="renew-pt-fee">Trainer Fee (Rs.)</FieldLabel>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                      Default: Rs. 10,000 (Adjustable)
                    </span>
                  </div>
                  <input
                    id="renew-pt-fee"
                    type="number"
                    min={0}
                    step={100}
                    value={ptFee}
                    onChange={e => setPtFee(e.target.value)}
                    placeholder="10000"
                    className={inputClass}
                  />
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Aap trainer ki fee manually kam ya ziada kar saktay hain.
                  </p>
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-700 dark:text-rose-300">
                  ⚠️ Renewal submit hotay hi <strong>{trainerName}</strong> is member ke card/profile se auto-remove ho jayega.
                </div>
              )}
            </div>
          )}

          {/* Says what the member is buying before they pay for it. Days
              still on the clock are carried, so renewing early costs them
              nothing. */}
          {picked && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/20 px-3 py-2.5">
              <p className="text-xs font-semibold text-blue-800">New expiry</p>
              <p className="text-sm font-bold text-blue-900 mt-0.5">
                {previewRenewal(ms.expiryDate, picked.durationDays)}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                {ms.daysLeft > 0
                  ? `Starts when the current one ends — their ${ms.daysLeft} remaining day${ms.daysLeft === 1 ? '' : 's'} are kept.`
                  : 'Starts today.'}
              </p>
            </div>
          )}

          {/* Total Fee Summary Card */}
          <div className="rounded-xl bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-800 p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-gray-600 dark:text-slate-300">
              <span>Gym Plan ({picked?.name || ms.planName}):</span>
              <span className="font-semibold text-gray-900 dark:text-slate-100">
                Rs. {gymAmount.toLocaleString('en-PK')}
              </span>
            </div>
            {hasTrainer && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-slate-300">Trainer Fee ({trainerName}):</span>
                {includeTrainer ? (
                  <span className="font-semibold text-purple-600 dark:text-purple-400">
                    + Rs. {ptFeeNum.toLocaleString('en-PK')}
                  </span>
                ) : (
                  <span className="font-semibold text-rose-500 dark:text-rose-400">
                    Removed (Rs. 0)
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-slate-700 font-bold text-sm">
              <span className="text-gray-900 dark:text-slate-100">Total Fee Collected:</span>
              <span className="text-blue-600 dark:text-blue-400">
                Rs. {totalAmount.toLocaleString('en-PK')}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className={`flex-1 ${secondaryButton}`}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
              {saving ? 'Renewing...' : `Renew (Rs. ${totalAmount.toLocaleString('en-PK')})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
