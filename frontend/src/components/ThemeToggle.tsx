import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type ThemePreference } from '../context/ThemeContext';
import { focusRing } from './ui';
import { useLanguage } from '../context/LanguageContext';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * All three choices at once rather than a single cycling button.
 *
 * "System" is the interesting one and a cycling button hides it: the user has
 * to guess how many presses reach it, and cannot see which of the three they
 * are currently on. Three targets cost a little more width and answer both.
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <div
      role="radiogroup"
      aria-label={t('Colour theme')}
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100 dark:bg-slate-800"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        const text = t(label);
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={text}
            title={text}
            onClick={() => setTheme(value)}
            className={`p-1.5 rounded-md transition-colors ${focusRing} ${
              active
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
            }`}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
