import { useLanguage, type Language } from '../context/LanguageContext';
import { focusRing } from './ui';

const OPTIONS: { value: Language; label: string; title: string }[] = [
  { value: 'en', label: 'EN', title: 'English' },
  { value: 'ur', label: 'اردو', title: 'Urdu' },
];

/** English / Urdu, side by side like the theme toggle, so the current choice
 *  is always visible. */
export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <div role="radiogroup" aria-label="Language"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100 dark:bg-slate-800">
      {OPTIONS.map(o => {
        const active = lang === o.value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={active} title={o.title}
            lang={o.value} onClick={() => setLang(o.value)}
            className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${focusRing} ${
              active
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
            }`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
