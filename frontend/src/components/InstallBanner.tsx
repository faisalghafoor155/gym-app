import { useEffect, useRef, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * Offers to install the app, once.
 *
 * Chrome will nag on its own schedule if left alone; capturing the event and
 * asking at a moment of our choosing converts better and, more to the point,
 * lets "Not now" actually mean it. The dismissal is remembered forever rather
 * than snoozed — a gym owner who said no does not want to be asked again every
 * Monday, and the Security page keeps a way in for anyone who changes their
 * mind later.
 *
 * iOS is a separate path because Safari implements none of this: there is no
 * `beforeinstallprompt` and no programmatic install, only a menu item the user
 * has to find. All we can do there is point at it.
 */

/** Not in lib.dom yet — Chromium-only, and still behind a spec that keeps moving. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'installPromptDismissed';

/** Already installed — either launched from the home screen, or iOS's own flag. */
const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // Non-standard, iOS Safari only, and the sole way to detect it there.
  (navigator as { standalone?: boolean }).standalone === true;

const isIos = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS reports itself as a Mac; the touch check is what separates them.
  (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/** Safari is the only iOS browser that can add to the home screen at all. */
const isIosSafari = (): boolean =>
  isIos() && !/crios|fxios|edgios|opios/i.test(navigator.userAgent);

const wasDismissed = (): boolean => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    // Private mode or blocked storage. Better to show the banner than to
    // crash the layout over a preference.
    return false;
  }
};

const remember = () => {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch { /* nothing to do; the banner just reappears next visit */ }
};

export default function InstallBanner() {
  const [visible, setVisible] = useState(false);
  // The event has to be replayed later, and it is single-use — held in a ref
  // so re-renders neither drop it nor re-trigger the prompt.
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;

    // iOS never fires the event, so the hint is all there is. Shown straight
    // away rather than waiting for something that is not coming.
    if (isIosSafari()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    const onPrompt = (e: Event) => {
      // Without this Chrome shows its own mini-infobar and the event is spent.
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setVisible(true);
    };

    // Fires when the install completes by any route, including the browser's
    // own menu — the banner should not linger over an app already installed.
    const onInstalled = () => {
      remember();
      setVisible(false);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    remember();
    setVisible(false);
  };

  const install = async () => {
    const evt = deferred.current;
    if (!evt) return;
    // Spent either way once shown, so the banner goes now: leaving it up
    // behind the browser's dialog only invites a second, dead click.
    deferred.current = null;
    setVisible(false);
    try {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      // Declining Chrome's dialog is as much an answer as declining ours.
      if (outcome === 'dismissed') remember();
    } catch {
      // The prompt can reject if the browser decides it is no longer eligible.
      // Nothing to tell the user — they never asked for anything to happen.
    }
  };

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label={t('Install GymPro')}
      className="fixed z-40 bottom-4 inset-x-4 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-80 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
          {iosHint
            ? <Share className="text-white" size={16} />
            : <Download className="text-white" size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{t('Install GymPro')}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
            {iosHint
              ? t('Tap Share, then "Add to Home Screen".')
              : t('Add it to your home screen for quicker access.')}
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label={t('Dismiss install prompt')}
          className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1 -m-1 shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={dismiss}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
        >
          {t('Not now')}
        </button>
        {/* On iOS there is nothing to call, so the only action is the hint above. */}
        {!iosHint && (
          <button
            onClick={install}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            {t('Install')}
          </button>
        )}
      </div>
    </div>
  );
}
