import { useState } from 'react';
import { Ticket, X } from 'lucide-react';
import { FieldLabel, inputClass, secondaryButton } from '../ui';
import api, { apiError } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import type { PromoCheck } from '../../types';

/**
 * "Have a code?" — checks a promo code against the plan being sold and shows
 * what it takes off. Only a preview: the server applies the code again when
 * the sale is saved, so the price cannot be decided by this screen.
 */
export default function PromoCodeField({ planId, applied, onApplied }: {
  planId: string;
  applied: PromoCheck | null;
  onApplied: (check: PromoCheck | null) => void;
}) {
  const { t } = useLanguage();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const apply = async () => {
    if (!code.trim() || !planId) return;
    setChecking(true);
    setError(null);
    try {
      const { data } = await api.get<PromoCheck>('/promo-codes/check', { params: { code: code.trim(), planId } });
      onApplied(data);
    } catch (err) {
      setError(apiError(err, t('That code does not work')));
      onApplied(null);
    } finally {
      setChecking(false);
    }
  };

  if (applied) {
    return (
      <div className="rounded-xl bg-lime-50 dark:bg-lime-500/15 border border-lime-200 dark:border-lime-500/20 px-3 py-2.5 flex items-center gap-2 text-sm">
        <Ticket size={15} className="text-lime-700 dark:text-lime-300 shrink-0" />
        <span className="flex-1 text-lime-800 dark:text-lime-200">
          <strong className="font-mono">{applied.code}</strong> {t('applied — Rs. {amount} off', { amount: applied.discount.toLocaleString('en-PK') })}
          {applied.description ? ` (${applied.description})` : ''}
        </span>
        <button type="button" aria-label={t('Remove promo code')} onClick={() => { onApplied(null); setCode(''); }}
          className="text-lime-700 dark:text-lime-300 p-0.5"><X size={15} /></button>
      </div>
    );
  }

  return (
    <div>
      <FieldLabel htmlFor="promo-code-input">{t('Promo code')}</FieldLabel>
      <div className="flex gap-2">
        <input
          id="promo-code-input"
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setError(null); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void apply(); } }}
          placeholder={t('e.g. STUDENT')}
          className={`${inputClass} uppercase font-mono`}
        />
        <button type="button" onClick={() => void apply()} disabled={!code.trim() || !planId || checking} className={secondaryButton}>
          {checking ? t('Checking…') : t('Apply')}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  );
}
