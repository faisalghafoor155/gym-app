import { useEffect, useRef } from 'react';
import { CalendarClock } from 'lucide-react';
import { FieldLabel, inputClass } from '../ui';
import { useLanguage } from '../../context/LanguageContext';
import type { InstallmentDraft } from '../../types';
import { round, splitEvenly } from './installments';

/** How many parts the desk can pick from the list. The server takes up to 12. */
const PART_CHOICES = [2, 3, 4, 6];

/**
 * "Pay the rest in parts": the balance a sale leaves, or one still owed,
 * split into installments with due dates. An empty list means no plan — the
 * balance is simply owed.
 *
 * Laid out evenly a month apart, then every amount and date can be changed.
 * When `owed` changes (the desk edits what is paid today) an existing split is
 * laid out again for the new figure.
 */
export default function InstallmentPlanFields({ owed, parts, onChange, idPrefix }: {
  owed: number;
  parts: InstallmentDraft[];
  onChange: (parts: InstallmentDraft[]) => void;
  idPrefix: string;
}) {
  const { t } = useLanguage();
  const count = parts.length;

  // Re-split when the balance moves under an existing plan. Skips the first
  // render so a plan handed in (an existing schedule being edited) is kept.
  const lastOwed = useRef(owed);
  useEffect(() => {
    if (lastOwed.current === owed) return;
    lastOwed.current = owed;
    if (count > 0) onChange(owed > 0 ? splitEvenly(owed, count) : []);
  }, [owed]); // eslint-disable-line react-hooks/exhaustive-deps

  if (owed <= 0) return null;

  const total = round(parts.reduce((t, p) => t + (Number(p.amount) || 0), 0));
  const update = (i: number, patch: Partial<InstallmentDraft>) =>
    onChange(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-3 space-y-3">
      <div>
        <FieldLabel htmlFor={`${idPrefix}-parts`}>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock size={14} className="text-blue-500" />
            {t('Pay Rs. {amount} in installments', { amount: owed.toLocaleString('en-PK') })}
          </span>
        </FieldLabel>
        <select
          id={`${idPrefix}-parts`}
          value={count}
          onChange={e => {
            const n = Number(e.target.value);
            onChange(n > 0 ? splitEvenly(owed, n) : []);
          }}
          className={inputClass}
        >
          <option value={0}>{t('No plan — owed as one balance')}</option>
          {[...new Set([...PART_CHOICES, ...(count > 0 ? [count] : [])])].sort((a, b) => a - b).map(n => (
            <option key={n} value={n}>{t('{count} installments', { count: n })}</option>
          ))}
        </select>
      </div>

      {count > 0 && (
        <>
          <ol className="space-y-2">
            {parts.map((p, i) => (
              <li key={i} className="grid grid-cols-[1.5rem_1fr_1fr] items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 text-center">{i + 1}</span>
                <input
                  type="number" min={1} step={1} required
                  aria-label={t('Installment {n} amount (Rs.)', { n: i + 1 })}
                  value={p.amount}
                  onChange={e => update(i, { amount: Number(e.target.value) })}
                  className={inputClass}
                />
                <input
                  type="date" required
                  aria-label={t('Installment {n} due date', { n: i + 1 })}
                  value={p.dueDate}
                  onChange={e => update(i, { dueDate: e.target.value })}
                  className={inputClass}
                />
              </li>
            ))}
          </ol>
          {total !== round(owed) ? (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              {t('The installments add up to Rs. {total}, but Rs. {owed} is owed.', {
                total: total.toLocaleString('en-PK'), owed: owed.toLocaleString('en-PK'),
              })}
            </p>
          ) : (
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {t('Each installment shows on Pending Dues and is reminded on WhatsApp two days before it is due.')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
