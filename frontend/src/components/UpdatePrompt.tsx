import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Tells the user a new build is waiting, and reloads only when they say so.
 *
 * `autoUpdate` installs the new worker immediately but does not take over the
 * page, which is the behaviour worth keeping: an owner halfway through a
 * payment form should not lose it because a deploy landed. So the swap is
 * offered rather than performed, and the old bundle keeps running until the
 * click.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;

    const id = toast(
      (t) => (
        <div className="flex items-center gap-3">
          <span className="text-sm">A new version is available.</span>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              // Activates the waiting worker and reloads once it is in charge.
              void updateServiceWorker(true);
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shrink-0"
          >
            Reload
          </button>
        </div>
      ),
      // No auto-dismiss: a five-second window is not a choice, and the update
      // is not urgent enough to interrupt anything either.
      { duration: Infinity, id: 'sw-update' },
    );

    return () => {
      toast.dismiss(id);
      setNeedRefresh(false);
    };
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
