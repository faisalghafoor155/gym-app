import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { FieldLabel, inputClass, primaryButton, secondaryButton } from '../ui';
import api, { apiError } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import type { Member } from '../../types';

/** The longest freeze the API accepts — `MAX_FREEZE_DAYS` on the server. */
const MAX_FREEZE_DAYS = 90;

const QUICK_DAYS = [7, 15, 30] as const;

const REASONS = ['Travel', 'Injury', 'Ramadan', 'Illness', 'Exams'] as const;

const toInput = (d: Date): string => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().split('T')[0]!;
};

const longDate = (d: Date): string =>
  d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

interface Props {
  member: Member & { currentMembership: NonNullable<Member['currentMembership']> };
  onClose: () => void;
  onFrozen: () => void;
}

/**
 * Stops a membership's clock for N days: the expiry moves out by exactly N,
 * so a member away for travel, injury or Ramadan loses nothing.
 */
export default function FreezeModal({ member, onClose, onFrozen }: Props) {
  const { t } = useLanguage();
  const ms = member.currentMembership;
  const [days, setDays] = useState('15');
  const [startDate, setStartDate] = useState(() => toInput(new Date()));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const n = Math.floor(Number(days)) || 0;
  const valid = n >= 1 && n <= MAX_FREEZE_DAYS;

  const start = new Date(startDate);
  const backOn = new Date(start);
  backOn.setDate(backOn.getDate() + n);
  const newExpiry = new Date(ms.expiryDate);
  newExpiry.setDate(newExpiry.getDate() + n);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) {
      toast.error(t('Choose between 1 and {max} days', { max: MAX_FREEZE_DAYS }));
      return;
    }
    setSaving(true);
    try {
      await api.post(`/members/${member.id}/memberships/${ms.id}/freeze`, {
        days: n,
        startDate,
        reason: reason.trim() || undefined,
      });
      toast.success(n === 1
        ? t('Membership frozen for {count} day', { count: n })
        : t('Membership frozen for {count} days', { count: n }));
      onFrozen();
    } catch (err) {
      toast.error(apiError(err, t('Could not freeze membership')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('Freeze membership')} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {member.name} · {ms.planName}. {t('The expiry moves forward by the days frozen, so no days are lost.')}
        </p>

        <div>
          <FieldLabel htmlFor="freeze-days" required>{t('Days')}</FieldLabel>
          <div className="flex gap-2">
            <input
              id="freeze-days" type="number" min={1} max={MAX_FREEZE_DAYS} step={1} required
              value={days} onChange={e => setDays(e.target.value)}
              className={inputClass}
            />
            {QUICK_DAYS.map(d => (
              <button
                key={d} type="button" onClick={() => setDays(String(d))}
                className={`${secondaryButton} !px-3 ${n === d ? '!border-blue-500 !text-blue-600' : ''}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="freeze-start">{t('Starting')}</FieldLabel>
          <input
            id="freeze-start" type="date" min={toInput(new Date())} required
            value={startDate} onChange={e => setStartDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <FieldLabel htmlFor="freeze-reason">{t('Reason')}</FieldLabel>
          <input
            id="freeze-reason" type="text" maxLength={200} list="freeze-reasons"
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder={t('e.g. Travel')}
            className={inputClass}
          />
          <datalist id="freeze-reasons">
            {REASONS.map(r => <option key={r} value={t(r)} />)}
          </datalist>
        </div>

        {valid && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/20 px-3 py-2.5 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-blue-800 dark:text-blue-300">{t('Back on')}</span>
              <span className="font-bold text-blue-900 dark:text-blue-200">{longDate(backOn)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-800 dark:text-blue-300">{t('New expiry')}</span>
              <span className="font-bold text-blue-900 dark:text-blue-200">{longDate(newExpiry)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving || !valid} className={`flex-1 ${primaryButton}`}>
            {saving ? t('Freezing…') : valid ? t('Freeze {count} days', { count: n }) : t('Freeze')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
