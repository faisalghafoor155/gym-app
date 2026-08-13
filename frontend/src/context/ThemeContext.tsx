import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from 'react';

/**
 * What the user asked for — which is not the same as what is on screen.
 * `system` defers to the OS, so it resolves to light or dark at render time and
 * changes under the app if the OS theme changes while it is open.
 */
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeValue {
  /** The stored choice, which is what the toggle should show as selected. */
  theme: ThemePreference;
  /** What is actually painted — `system` already resolved against the OS. */
  resolved: ResolvedTheme;
  setTheme: (t: ThemePreference) => void;
  /** Flips between light and dark, settling `system` to whichever it is not. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const STORAGE_KEY = 'theme';

const isPreference = (v: unknown): v is ThemePreference =>
  v === 'light' || v === 'dark' || v === 'system';

const stored = (): ThemePreference => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isPreference(raw) ? raw : 'system';
  } catch {
    // Private browsing and blocked storage both throw here. The app still has
    // to render, so an unreadable preference is treated as none.
    return 'system';
  }
};

const systemPrefersDark = (): boolean =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

const resolve = (pref: ThemePreference): ResolvedTheme =>
  pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(stored);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(stored()));

  // The class on <html> is what every `dark:` rule keys off, so it is applied
  // here rather than left to any one component. index.html sets it before
  // React mounts too — this keeps it in step afterwards.
  useEffect(() => {
    const next = resolve(theme);
    setResolved(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  }, [theme]);

  // Only while following the system: an explicit choice should not be undone
  // by the OS switching to night mode at sunset.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next: ResolvedTheme = mq.matches ? 'dark' : 'light';
      setResolved(next);
      document.documentElement.classList.toggle('dark', next === 'dark');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = (next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Unwritable storage costs the preference on the next load, which is a
      // far smaller failure than refusing to change the theme at all.
    }
  };

  // Deliberately resolves `system` rather than cycling through three states:
  // a toggle that sometimes appears to do nothing (system → light, when the OS
  // was already light) is a toggle nobody trusts.
  const toggle = () => setTheme(resolved === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = (): ThemeValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside a ThemeProvider');
  return ctx;
};
