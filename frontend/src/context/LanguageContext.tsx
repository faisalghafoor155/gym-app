import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { UR } from '../i18n/ur';

export type Language = 'en' | 'ur';

interface LanguageState {
  lang: Language;
  setLang: (lang: Language) => void;
  /** The Roman Urdu for an English string when Urdu is on and it has one; the
   *  English otherwise. `{name}` placeholders are filled from `vars` in either
   *  language, so a sentence with a number in it is still one dictionary key. */
  t: (english: string, vars?: TVars) => string;
}

export type TVars = Record<string, string | number>;

const fill = (text: string, vars?: TVars): string =>
  vars ? text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole)) : text;

/**
 * `t` for code outside a component — calculators, data tables, message
 * builders — which is handed the language rather than reading the context.
 */
export const translate = (lang: Language, english: string, vars?: TVars): string =>
  fill(lang === 'ur' ? UR[english] ?? english : english, vars);

const STORAGE_KEY = 'gym_language';

/**
 * The default is English with `t` as the identity, so a component rendered
 * outside the provider — a test, a portal — still renders its English text
 * instead of throwing.
 */
const LanguageContext = createContext<LanguageState>({
  lang: 'en',
  setLang: () => {},
  t: (s, vars) => fill(s, vars),
});

const readStored = (): Language => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ur' ? 'ur' : 'en';
  } catch {
    return 'en';
  }
};

/**
 * The staff screens' language, remembered per device: the desk computer can
 * be in Urdu while the owner's phone stays in English.
 *
 * The page stays left-to-right. Flipping every margin and icon for a
 * translation of labels would trade a familiar layout for a broken one; the
 * Urdu words themselves still read right-to-left inside their own boxes.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(readStored);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.classList.toggle('lang-ur', lang === 'ur');
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* the choice just is not remembered */ }
  }, []);

  const t = useCallback((english: string, vars?: TVars) => translate(lang, english, vars), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = (): LanguageState => useContext(LanguageContext);
