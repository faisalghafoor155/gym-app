import { FieldLabel, inputClass, focusRing } from '../ui';
import { useLanguage } from '../../context/LanguageContext';
import type { AccountMethod } from './types';

/**
 * Picks how the new account gets a password, and renders the password field
 * only when the owner has chosen to set one. Shared by both create forms so
 * the two cannot drift apart.
 */
export default function PasswordMethod({ method, onMethod, password, onPassword }: {
  method: AccountMethod;
  onMethod: (m: AccountMethod) => void;
  password: string;
  onPassword: (p: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-3">
      {/* Names the pair of choices below rather than a single field. */}
      <FieldLabel id="access-mode-label" required>{t('How should they get in?')}</FieldLabel>
      <div
        role="group"
        aria-labelledby="access-mode-label"
        className="grid grid-cols-2 gap-2"
      >
        {([
          { value: 'invite', title: 'Email an invite', hint: 'They pick their own password' },
          { value: 'password', title: 'Set a password', hint: 'You share it with them' },
        ] as const).map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => onMethod(o.value)}
            aria-pressed={method === o.value}
            className={`border rounded-xl py-2.5 px-3 text-left transition-all ${focusRing} ${
              method === o.value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700'
                : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:border-gray-300'
            }`}
          >
            <p className="font-semibold text-xs">{t(o.title)}</p>
            <p className="text-xs opacity-60 mt-0.5 leading-snug">{t(o.hint)}</p>
          </button>
        ))}
      </div>

      {method === 'password' ? (
        <div>
          <FieldLabel htmlFor="team-temporary-password" required>{t('Temporary password')}</FieldLabel>
          <input id="team-temporary-password"
            type="password" required minLength={8} value={password}
            onChange={e => onPassword(e.target.value)}
            placeholder={t('Min 8 characters')}
            className={inputClass}
          />
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            {t('Share this with them; they can change it after signing in.')}
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-slate-400 bg-blue-50/60 border border-blue-100 dark:border-blue-500/20 rounded-xl px-3 py-2.5 leading-relaxed">
          {t('They get an email with a link to choose their own password. The link lasts 48 hours and works once — you never see the password.')}
        </p>
      )}
    </div>
  );
}
