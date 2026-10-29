import { FieldLabel, inputClass } from '../ui';
import { useLanguage } from '../../context/LanguageContext';
import type { Trainer } from '../../types';

/**
 * Who a plan comes from. The member sees this name next to the plan in their
 * portal, so only active trainers are offered — plus the current choice, in
 * case it was set before that trainer left.
 */
export default function TrainerSelect({ id, trainers, value, onChange }: {
  id: string;
  trainers: Trainer[];
  value: string;
  onChange: (trainerId: string) => void;
}) {
  const { t } = useLanguage();
  const shown = trainers.filter(tr => tr.isActive || tr.id === value);
  return (
    <div>
      <FieldLabel htmlFor={id}>{t('Trainer')}</FieldLabel>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} className={inputClass}>
        <option value="">{t('No trainer named')}</option>
        {shown.map(tr => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
      </select>
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
        {t('The member sees this name with the plan in their app.')}
      </p>
    </div>
  );
}
