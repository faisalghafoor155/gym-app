import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Calendar, Fingerprint } from 'lucide-react';
import {
  FieldLabel, inputClass, primaryButton, secondaryButton, focusRing,
} from '../ui';
import type { AxiosError } from 'axios';
import api, { apiError } from '../../api/client';
import { useDialog } from '../../hooks/useDialog';
import type {
  Gender, GymSettings, Member, MembershipPlan, PaymentChannel, PaymentMethod, Trainer,
} from '../../types';
import { CHANNELS, CHANNEL_LABELS, accountFor } from '../../utils/paymentChannels';
import toast from 'react-hot-toast';

/** What the desk fills in to register somebody, or to correct their details. */
interface MemberForm {
  name: string;
  email: string;
  phone: string;
  photo: string;
  gender: Gender | '';
  dateOfBirth: string;
  address: string;
  emergencyContact: string;
  /** Only ever sent from an edit — see the field in the form. */
  whatsappOptOut: boolean;
  /** Only sent when adding — an existing member's membership is changed from
   *  the membership flow, not by editing the person. */
  planId: string;
  startDate: string;
  trainerId: string;
  /** What was agreed for the trainer, when it was haggled. Blank means "use
   *  the trainer's rate, then the gym's" — not "free". */
  ptFee: string;
  /** Whether the fee was taken at the counter. False records a due. */
  ptFeePaid: boolean;
  /** The joining fee handed over at the counter. Blank means none was taken —
   *  the member is registered and can be billed from the Payments page. */
  feeAmount: string;
  feeMethod: PaymentMethod;
  /** Which wallet, when the money came in online. */
  feeChannel: PaymentChannel | '';
  /** The wallet's transaction id, when the front desk was given one. */
  feeReference: string;
}

const emptyForm: MemberForm = {
  name: '', email: '', phone: '', photo: '',
  gender: '', dateOfBirth: '', address: '', emergencyContact: '',
  whatsappOptOut: false,
  planId: '', startDate: '', trainerId: '', ptFee: '', ptFeePaid: false,
  feeAmount: '', feeMethod: 'cash', feeChannel: '', feeReference: '',
};

/**
 * Reads a 409 from the member endpoints back into the field warning the form
 * shows. Anything else — a 500, a network failure — is not a duplicate and is
 * left to the generic error path.
 */
function isDuplicateError(err: unknown): { field: 'phone' | 'name'; message: string } | null {
  const res = (err as AxiosError<{ error?: string; field?: 'phone' | 'name' }>)?.response;
  if (res?.status !== 409 || !res.data?.field || !res.data.error) return null;
  return { field: res.data.field, message: res.data.error };
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/** Local preview of what the server will calculate. The server's answer is
 *  the one that counts — this only saves the user a round trip to see it. */
function previewExpiry(startDate: string, durationDays: number): string {
  if (!startDate) return '';
  const d = new Date(startDate);
  d.setDate(d.getDate() + durationDays);
  return d.toISOString().split('T')[0]!;
}

/** The registration form's opening state, with the sensible defaults filled. */
function addDefaults(plans: MembershipPlan[]): MemberForm {
  return {
    ...emptyForm,
    startDate: new Date().toISOString().split('T')[0]!,
    // Preselect the cheapest offered plan so the common case is one click.
    planId: plans[0]?.id ?? '',
  };
}

/**
 * An existing member's details, as the form holds them.
 *
 * Built on `emptyForm` rather than listing every field: an edit only fills in
 * what the member already has, and the rest — the plan and the fee, which
 * belong to registration — should stay at their blank defaults whatever fields
 * the form grows later.
 */
function editDefaults(m: Member): MemberForm {
  return {
    ...emptyForm,
    name: m.name, email: m.email || '', phone: m.phone || '',
    photo: m.photo || '',
    gender: m.gender ?? '',
    dateOfBirth: m.dateOfBirth ? m.dateOfBirth.split('T')[0]! : '',
    address: m.address ?? '',
    emergencyContact: m.emergencyContact ?? '',
    whatsappOptOut: m.whatsappOptOut,
    trainerId: m.trainerId || '',
  };
}

interface Props {
  /** The member being edited, or null to register a new one. */
  member: Member | null;
  plans: MembershipPlan[];
  trainers: Trainer[];
  /** The gym's own settings: the default PT rate, and the accounts members are
   *  told to send money to. Null while loading, or if that call failed. */
  settings: GymSettings | null;
  onClose: () => void;
  /** Handed the created member when registering, so the caller can follow up —
   *  enrolment needs an id that only exists once the save has returned. Null
   *  on an edit, which creates nobody. */
  onSaved: (created: Member | null) => void;
}

/**
 * Registers a member, or corrects one.
 *
 * Owns the form rather than taking it from the page: nothing outside needs to
 * read a half-typed registration, and keeping it here means the values are
 * gone when the modal closes rather than lingering to reappear on the next
 * member. Which member is being edited is the page's business; everything
 * typed about them is this modal's.
 */
export default function MemberFormModal({
  member, plans, trainers, settings, onClose, onSaved,
}: Props) {
  const editing = member?.id ?? null;
  const [form, setForm] = useState<MemberForm>(
    () => (member ? editDefaults(member) : addDefaults(plans)),
  );
  /**
   * The trainer the member already had, so a re-save is told apart from a new
   * assignment — only the latter is billed. A new member has none, so picking
   * one is always fresh.
   */
  const [originalTrainerId] = useState(() => member?.trainerId || '');
  const [saving, setSaving] = useState(false);
  /**
   * Whether what has been typed so far already belongs to somebody, and under
   * which field to say so. Cleared as soon as the offending field is edited,
   * so a corrected number stops complaining without waiting for a round trip.
   */
  const [duplicate, setDuplicate] = useState<{ field: 'phone' | 'name'; message: string } | null>(null);
  /** Guards against a slow answer landing after the field has moved on. */
  const dupCheckSeq = useRef(0);
  const photoRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialog(true, onClose);

  const gymPtFee = settings?.defaultPtFee ?? null;

  const set = <K extends keyof MemberForm>(k: K) => (v: MemberForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  /**
   * Asks the server whether this would be a duplicate, on leaving a field
   * rather than on every keystroke.
   *
   * Only ever a hint: the save re-checks server-side, so a failure here is
   * swallowed. Blocking a registration because a lookup timed out would be a
   * worse bug than the duplicate it was trying to prevent.
   */
  const checkDuplicate = async (next: MemberForm) => {
    const phone = next.phone.trim();
    const name = next.name.trim();
    const dob = next.dateOfBirth;
    if (!phone && !(name && dob)) { setDuplicate(null); return; }

    const seq = ++dupCheckSeq.current;
    try {
      const { data } = await api.get<{
        duplicate: boolean;
        field?: 'phone' | 'name';
        message?: string;
      }>('/members/check-duplicate', {
        params: {
          ...(phone && { phone }),
          ...(name && { name }),
          ...(dob && { dateOfBirth: dob }),
          // An edit must not find the member being edited.
          ...(editing && { excludeId: editing }),
        },
      });
      // A newer check has been asked for since; this answer is about text the
      // user has already replaced.
      if (seq !== dupCheckSeq.current) return;
      setDuplicate(
        data.duplicate && data.field && data.message
          ? { field: data.field, message: data.message }
          : null,
      );
    } catch {
      // Fail open — let the save attempt decide.
      if (seq === dupCheckSeq.current) setDuplicate(null);
    }
  };

  /** Editing a flagged field clears its warning; the blur will re-ask. */
  const setChecked = <K extends 'name' | 'phone' | 'dateOfBirth'>(k: K) => (v: MemberForm[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setDuplicate(d => {
      if (!d) return null;
      return (d.field === 'phone' && k === 'phone') ||
        (d.field === 'name' && (k === 'name' || k === 'dateOfBirth'))
        ? null
        : d;
    });
  };

  /**
   * What leaving the fee blank will actually charge — the same trainer-then-gym
   * resolution the server does, so the hint cannot promise one number while the
   * API bills another.
   */
  const ptFeePlaceholder = (() => {
    const trainer = trainers.find(t => t.id === form.trainerId);
    const rate = trainer?.ptFee ?? gymPtFee;
    if (rate === null || rate === undefined) return 'Usual rate';
    return rate === 0 ? 'No charge' : `Usual rate — ${rate.toLocaleString('en-PK')}`;
  })();

  const selectedPlan = plans.find(p => p.id === form.planId);
  const expiryPreview = selectedPlan
    ? previewExpiry(form.startDate, selectedPlan.durationDays)
    : '';

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => set('photo')(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        photo: form.photo,
        gender: form.gender,
        // The API rejects "" for a date, so omit an unset one.
        ...(form.dateOfBirth && { dateOfBirth: form.dateOfBirth }),
        address: form.address,
        emergencyContact: form.emergencyContact,
        // Only meaningful on an edit, and the create endpoint rejects what it
        // does not know — so it travels only where it is accepted.
        ...(editing && { whatsappOptOut: form.whatsappOptOut }),
        trainerId: form.trainerId || null,
        // Only meaningful alongside a trainer, and blank has to reach the API
        // as null: `Number('')` is 0, which the server would read as a
        // deliberate decision to charge nothing.
        ...(form.trainerId && {
          ptFee: form.ptFee.trim() === '' ? null : Number(form.ptFee),
          ptFeePaid: form.ptFeePaid,
        }),
      };
      if (editing) {
        await api.put(`/members/${editing}`, payload);
        toast.success('Member updated');
        onSaved(null);
      } else {
        // A plan sells the membership in the same call; without one the member
        // is registered and can be given a membership later.
        const { data: created } = await api.post<Member>('/members', {
          ...payload,
          ...(form.planId && { planId: form.planId, startDate: form.startDate }),
          // Only sent when money actually changed hands. A blank amount means
          // no payment was taken, not a payment of nothing.
          ...(form.feeAmount.trim() !== '' && Number(form.feeAmount) > 0 && {
            feeAmount: Number(form.feeAmount),
            feeMethod: form.feeMethod,
            ...(form.feeMethod === 'online' && {
              feeChannel: form.feeChannel || null,
              feeReference: form.feeReference.trim() || null,
            }),
          }),
        });
        toast.success('Member added successfully');
        // The created member goes back to the page: enrolment needs an id that
        // did not exist until this call returned, and offering the scan is the
        // page's decision rather than the form's.
        onSaved(created);
      }
    } catch (err) {
      // The server found a duplicate the live check missed — either it was
      // never asked, or somebody else registered this person in between. Keep
      // the modal and the typed data, and point at the field at fault.
      const conflict = isDuplicateError(err);
      if (conflict) {
        setDuplicate(conflict);
        toast.error(conflict.message);
      } else {
        toast.error(apiError(err, 'Error saving member'));
      }
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
        aria-labelledby="member-modal-title"
        className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg sm:mx-4 max-h-[92dvh] flex flex-col"
      >
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <h2 id="member-modal-title" className="text-lg font-bold text-gray-900 dark:text-slate-100">
            {editing ? 'Edit Member' : 'Add New Member'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {editing ? 'Update member details' : 'Fill in details — expiry auto-calculated'}
          </p>
        </div>

        <form onSubmit={e => void handleSave(e)} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Photo Upload */}
          <div className="flex flex-col items-center gap-3">
            <div
              onClick={() => photoRef.current?.click()}
              className="w-20 h-20 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center cursor-pointer overflow-hidden relative group"
            >
              {form.photo
                ? <img src={form.photo} alt="preview" className="w-full h-full object-cover" />
                : <span className="text-white font-bold text-lg">
                    {form.name ? getInitials(form.name) : <Camera size={24} className="text-white/70" />}
                  </span>
              }
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={18} className="text-white" />
              </div>
            </div>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <button type="button" onClick={() => photoRef.current?.click()}
              className="text-xs text-blue-600 font-medium hover:underline">
              {form.photo ? 'Change photo' : 'Upload photo (optional)'}
            </button>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="member-name" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Full Name *</label>
            <input
              id="member-name"
              required
              value={form.name}
              onChange={e => setChecked('name')(e.target.value)}
              onBlur={() => void checkDuplicate(form)}
              placeholder="Ahmed Khan"
              aria-invalid={duplicate?.field === 'name'}
              // Points at the warning below, so a screen reader reads why the
              // field is marked invalid rather than only that it is.
              aria-describedby={duplicate?.field === 'name' ? 'member-name-error' : undefined}
              className={inputClass}
            />
            {duplicate?.field === 'name' && (
              <p id="member-name-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                {duplicate.message}
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="member-phone" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Phone</label>
            <input
              id="member-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={e => setChecked('phone')(e.target.value)}
              onBlur={() => void checkDuplicate(form)}
              placeholder="03001234567"
              aria-invalid={duplicate?.field === 'phone'}
              aria-describedby={duplicate?.field === 'phone' ? 'member-phone-error' : undefined}
              className={inputClass}
            />
            {duplicate?.field === 'phone' && (
              <p id="member-phone-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                {duplicate.message}
              </p>
            )}
          </div>

          {/* Gender + Date of birth */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="member-gender" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Gender</label>
              <select
                id="member-gender"
                value={form.gender}
                onChange={e => set('gender')(e.target.value as Gender | '')}
                className={inputClass}
              >
                <option value="">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            {/* Half of the name+DOB duplicate rule, so the form has to be
                able to set it — a rule keyed on a field nobody can fill
                would never fire. */}
            <div>
              <label htmlFor="member-dob" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Date of Birth</label>
              <input
                id="member-dob"
                type="date"
                value={form.dateOfBirth}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setChecked('dateOfBirth')(e.target.value)}
                onBlur={() => void checkDuplicate(form)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Personal Trainer Selection */}
          <div>
            <label htmlFor="member-trainer" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Personal Trainer (PT)</label>
            <select
              id="member-trainer"
              value={form.trainerId}
              onChange={e => set('trainerId')(e.target.value)}
              className={inputClass}
            >
              <option value="">No trainer assigned</option>
              {trainers.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.specialization || 'General'})</option>
              ))}
            </select>
          </div>

          {/* The fee is only asked for when a trainer is actually being
              assigned, and only when it is a *new* assignment — re-saving
              a member who already has this trainer bills nothing, so a
              field offering to charge them again would be a trap. */}
          {form.trainerId && form.trainerId !== originalTrainerId && (
            <div>
              <label htmlFor="member-ptfee" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Trainer Fee (Rs.)
              </label>
              <input
                id="member-ptfee"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder={ptFeePlaceholder}
                value={form.ptFee}
                onChange={e => set('ptFee')(e.target.value)}
                className={inputClass}
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Charged once. Leave blank for the usual rate, or type what you
                agreed — enter 0 to charge nothing.
              </p>

              <label className="flex items-start gap-2.5 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ptFeePaid}
                  onChange={e => set('ptFeePaid')(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 shrink-0"
                />
                <span className="text-sm text-gray-700 dark:text-slate-300">
                  Fee collected now
                  <span className="block text-xs text-gray-400 dark:text-slate-500">
                    {/* Unticked is the safe default: recording money that never
                        arrived is worse than leaving a real payment to be settled
                        on the Payments page. */}
                    {form.ptFeePaid
                      ? 'Recorded as paid — it will not show as outstanding.'
                      : 'Left as a due for the member to settle later.'}
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Address */}
          <div>
            <label htmlFor="member-address" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Address</label>
            <input
              id="member-address"
              value={form.address}
              onChange={e => set('address')(e.target.value)}
              placeholder="House 12, Street 4, Lahore"
              className={inputClass}
            />
          </div>

          {/* Emergency contact */}
          <div>
            <label htmlFor="member-emergency" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Emergency Contact</label>
            <input
              id="member-emergency"
              value={form.emergencyContact}
              onChange={e => set('emergencyContact')(e.target.value)}
              placeholder="Brother — 03009876543"
              className={inputClass}
            />
          </div>

          {/* Only on an edit. Nobody opts out before they have been
              registered, and a box on the registration form invites the desk
              to answer it on the member's behalf. */}
          {editing && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.whatsappOptOut}
                onChange={e => set('whatsappOptOut')(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 shrink-0"
              />
              <span className="text-sm text-gray-700 dark:text-slate-300">
                No WhatsApp messages
                <span className="block text-xs text-gray-400 dark:text-slate-500">
                  {form.whatsappOptOut
                    ? 'Renewal reminders and receipts will not be sent to them on WhatsApp.'
                    : 'Tick if the member has asked not to be messaged. Email is unaffected.'}
                </span>
              </span>
            </label>
          )}

          {/* Membership — only when registering. Changing what an existing
              member bought is its own action, not a profile edit. */}
          {!editing && (
            <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Membership Plan</label>
                {plans.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800/60 rounded-xl px-3 py-3">
                    No plans set up yet — register the member now and give them
                    a membership later, or{' '}
                    <Link to="/membership-plans" className="text-blue-600 font-medium hover:underline">
                      add a plan first
                    </Link>.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button"
                      onClick={() => set('planId')('')}
                      className={`border rounded-xl py-2.5 px-2 text-center transition-all ${focusRing} ${
                        form.planId === ''
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700'
                          : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:border-gray-300'
                      }`}>
                      <p className="font-semibold text-xs">None</p>
                      <p className="text-xs opacity-60 mt-0.5">Add later</p>
                    </button>
                    {plans.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => set('planId')(p.id)}
                        className={`border rounded-xl py-2.5 px-2 text-center transition-all ${focusRing} ${
                          form.planId === p.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700'
                            : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:border-gray-300'
                        }`}>
                        <p className="font-semibold text-xs truncate">{p.name}</p>
                        <p className="text-xs opacity-60 mt-0.5">
                          {p.durationDays}d · Rs. {p.price.toLocaleString()}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {form.planId && (
                <div>
                  <label htmlFor="member-start" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Start Date *</label>
                  <input
                    id="member-start"
                    type="date"
                    required
                    value={form.startDate}
                    onChange={e => set('startDate')(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}

              {/* Preview of what the server will calculate — the server's
                  answer is the one that is stored. */}
              {expiryPreview && (
                <div className="bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/20 rounded-xl p-3 flex items-center gap-2">
                  <Calendar size={15} className="text-blue-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-blue-800">Auto-calculated expiry</p>
                    <p className="text-sm font-bold text-blue-700">
                      {new Date(expiryPreview).toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}

              {/* Fee taken at the counter. Always offered, plan or no plan:
                  a gym takes a registration fee from somebody who has not
                  picked a package yet, and that money still has to land in
                  the books. Leaving the amount blank records no payment. */}
              <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-3">
                <div>
                  <label htmlFor="member-fee" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                    Fee Collected (Rs.)
                  </label>
                  <input
                    id="member-fee"
                    type="number"
                    min="0"
                    step="1"
                    value={form.feeAmount}
                    onChange={e => set('feeAmount')(e.target.value)}
                    placeholder={
                      selectedPlan
                        ? `Plan price — ${selectedPlan.price.toLocaleString('en-PK')}`
                        : 'Leave blank if nothing was paid yet'
                    }
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                    Leave blank to register without taking payment.
                  </p>
                </div>

                {/* The rest of the section is only meaningful once there is
                    money to describe. */}
                {form.feeAmount.trim() !== '' && Number(form.feeAmount) > 0 && (
                  <>
                    <div>
                      {/* A pair of buttons, so the label names the group. */}
                      <FieldLabel id="member-fee-method-label">Paid by</FieldLabel>
                      <div
                        role="group"
                        aria-labelledby="member-fee-method-label"
                        className="grid grid-cols-2 gap-2"
                      >
                        {(['cash', 'online'] as PaymentMethod[]).map(m => (
                          <button key={m} type="button"
                            onClick={() => {
                              set('feeMethod')(m);
                              // Cash carries no channel; drop anything a
                              // previous online selection left behind.
                              if (m === 'cash') { set('feeChannel')(''); set('feeReference')(''); }
                            }}
                            className={`border rounded-xl py-2.5 px-2 text-center transition-all ${focusRing} ${
                              form.feeMethod === m
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700'
                                : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:border-gray-300'
                            }`}>
                            <p className="font-semibold text-xs capitalize">{m}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {form.feeMethod === 'online' && (
                      <>
                        <div>
                          <label htmlFor="member-fee-channel" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                            Received in
                          </label>
                          <select
                            id="member-fee-channel"
                            value={form.feeChannel}
                            onChange={e => set('feeChannel')(e.target.value as PaymentChannel | '')}
                            className={inputClass}
                          >
                            <option value="">Select account</option>
                            {CHANNELS.map(c => (
                              <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                            ))}
                          </select>
                          {/* What the front desk reads out to the member.
                              Absent when the owner has not published this
                              channel's details in Settings. */}
                          {accountFor(settings, form.feeChannel) && (
                            <div className="mt-2 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/20 rounded-xl px-3 py-2">
                              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Send to</p>
                              <p className="text-sm font-bold text-blue-700 dark:text-blue-200 break-words">
                                {accountFor(settings, form.feeChannel)}
                              </p>
                            </div>
                          )}
                          {form.feeChannel && !accountFor(settings, form.feeChannel) && (
                            <p className="mt-1.5 text-xs text-gray-400 dark:text-slate-500">
                              No account saved for this — the owner can add one in Team &rsaquo; Gym Settings.
                            </p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="member-fee-ref" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                            Transaction ID <span className="font-normal text-gray-400">(optional)</span>
                          </label>
                          <input
                            id="member-fee-ref"
                            value={form.feeReference}
                            onChange={e => set('feeReference')(e.target.value)}
                            placeholder="e.g. 4429183756"
                            className={inputClass}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {!editing && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-xs text-blue-700 dark:text-blue-300">
              <Fingerprint size={18} className="shrink-0 text-blue-600 dark:text-blue-400" />
              <span>
                Member save hote hi <strong>Fingerprint Enrolment</strong> ka scan popup automatically open ho jaye ga.
              </span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className={`flex-1 ${secondaryButton}`}>
              Cancel
            </button>
            <button type="submit" disabled={saving || duplicate !== null} className={`flex-1 ${primaryButton}`}>
              {saving ? 'Saving...' : editing ? 'Update Member' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
