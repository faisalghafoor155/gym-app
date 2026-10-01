import { useState } from 'react';
import { Share, X, Smartphone, ArrowDownToLine } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallButtonProps {
  className?: string;
  variant?: 'navbar' | 'compact' | 'prominent' | 'sidebar';
}

export default function InstallButton({ className = '', variant = 'navbar' }: InstallButtonProps) {
  const { isInstalled, isIOS } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

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
        title="Install app on mobile or desktop"
      >
        <Smartphone size={14} className="animate-pulse shrink-0" />
        <span className="truncate hidden sm:inline">Install App</span>
        <span className="truncate sm:hidden">Install</span>
      </button>

      {/* Guide Modal for Android, iOS & Desktop */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 text-center">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
              {isIOS ? <Share size={26} /> : <ArrowDownToLine size={26} />}
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
              {isIOS ? 'Install on iPhone / iPad' : 'Install GymPro App'}
            </h3>

            <div className="mt-3 text-left space-y-2.5 bg-gray-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 text-xs text-gray-600 dark:text-slate-300">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <p>Safari browser mein neechay <strong>Share button</strong> (square with arrow) par tap karein.</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <p>Neechay scroll karke <strong>"Add to Home Screen"</strong> select karein.</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <p>Upar <strong>"Add"</strong> dabayein — app aapke phone mein save ho jayegi!</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <p>Mobile Chrome mein upar <strong>3 dots (⋮)</strong> Menu par tap karein.</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <p>Menu mein se <strong>"Install app"</strong> ya <strong>"Add to Home screen"</strong> select karein.</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <p><strong>"Install"</strong> par click karein — app direct aapke phone mein install ho jayegi!</p>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95"
            >
              Samajh Aa Gaya (Got It)
            </button>
          </div>
        </div>
      )}
    </>
  );
}
