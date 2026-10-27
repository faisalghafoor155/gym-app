import { useState } from 'react';
import { Share, X, Smartphone, ArrowDownToLine } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../context/LanguageContext';

/** Renders the `**bold**` spans of a translated step, so the emphasis survives
 *  translation without splitting the sentence around it. */
const withBold = (text: string) =>
  text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));

interface InstallButtonProps {
  className?: string;
  variant?: 'navbar' | 'compact' | 'prominent' | 'sidebar';
}

export default function InstallButton({ className = '', variant = 'navbar' }: InstallButtonProps) {
  const { isInstalled, isIOS } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const { t } = useLanguage();

  // If already running inside installed standalone PWA app, hide it
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    // If native prompt is available, trigger it
    if (window.__pwaInstallPrompt) {
      try {
        await window.__pwaInstallPrompt.prompt();
        const choice = await window.__pwaInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          return;
        }
      } catch (err) {
        console.warn('Native prompt failed, showing guide modal:', err);
      }
    }

    // Otherwise show the visual guide modal
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        type="button"
        className={`inline-flex items-center justify-center gap-1 sm:gap-1.5 font-semibold transition-all active:scale-95 cursor-pointer shadow-sm ${
          variant === 'navbar'
            ? 'px-2 sm:px-3 py-1.5 text-xs rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-blue-500/30 ring-1 ring-white/20'
            : variant === 'sidebar'
            ? 'w-full px-3 py-2 text-xs rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/20'
            : variant === 'compact'
            ? 'p-2 text-xs rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100'
            : 'px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-600/30'
        } ${className}`}
        title={t('Install app on mobile or desktop')}
      >
        <Smartphone size={14} className="animate-pulse shrink-0" />
        <span className="truncate hidden sm:inline">{t('Install App')}</span>
        <span className="truncate sm:hidden">{t('Install')}</span>
      </button>

      {/* Guide Modal for Android, iOS & Desktop */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 text-center">
            <button
              onClick={() => setShowGuideModal(false)}
              aria-label={t('Close')}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
              {isIOS ? <Share size={26} /> : <ArrowDownToLine size={26} />}
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
              {isIOS ? t('Install on iPhone / iPad') : t('Install GymPro App')}
            </h3>

            <div className="mt-3 text-left space-y-2.5 bg-gray-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 text-xs text-gray-600 dark:text-slate-300">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <p>{withBold(t('In Safari, tap the **Share button** (the square with an arrow) at the bottom.'))}</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <p>{withBold(t('Scroll down and choose **"Add to Home Screen"**.'))}</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <p>{withBold(t('Tap **"Add"** at the top — the app is saved on your phone!'))}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <p>{withBold(t('In mobile Chrome, tap the **3 dots (⋮)** menu at the top.'))}</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <p>{withBold(t('From the menu, choose **"Install app"** or **"Add to Home screen"**.'))}</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <p>{withBold(t('Tap **"Install"** — the app installs straight onto your phone!'))}</p>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95"
            >
              {t('Got it')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
