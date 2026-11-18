import { Building2 } from 'lucide-react';
import { useBranch } from '../context/BranchContext';
import { useLanguage } from '../context/LanguageContext';

/**
 * Which branch the app is showing. Hidden for a gym with one branch; a label,
 * not a picker, for staff placed at one.
 */
export default function BranchSwitcher() {
  const { t } = useLanguage();
  const { branches, current, fixed, multi, switchTo, currentBranch } = useBranch();
  if (!multi && !fixed) return null;

  if (fixed) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
        <Building2 size={13} className="text-emerald-600" /> {currentBranch?.name}
      </p>
    );
  }
  return (
    <label className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5">
      <Building2 size={14} className="text-emerald-600 shrink-0" />
      <span className="sr-only">{t('Branch')}</span>
      <select
        value={current ?? ''}
        onChange={e => switchTo(e.target.value || null)}
        className="w-full bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
      >
        <option value="">{t('All branches')}</option>
        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
  );
}
