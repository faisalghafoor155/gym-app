import { WifiOff } from 'lucide-react';
import { useOnline } from '../hooks/useOnline';

/**
 * Says the app is offline, and — more usefully — that nothing typed will save.
 *
 * The second half is the part worth the strip. Losing the network is obvious
 * from the failed loads; what is not obvious is that the form still on screen
 * is now a dead end, and finding that out after filling it in is how a member
 * ends up paying twice.
 */
export default function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-amber-900 bg-amber-100 border-b border-amber-200 dark:text-amber-200 dark:bg-amber-500/15 dark:border-amber-500/25 shrink-0"
    >
      <WifiOff size={14} className="shrink-0" />
      <span>You're offline — showing the last loaded view. Changes can't be saved.</span>
    </div>
  );
}
