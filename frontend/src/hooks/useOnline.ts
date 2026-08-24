import { useEffect, useState } from 'react';

/**
 * Whether the browser thinks it has a network.
 *
 * `navigator.onLine` is weaker than it sounds — it reports a live interface,
 * not a reachable server, so a phone on gym wifi with no uplink still reads as
 * online. That is the right trade here anyway: everything downstream of this
 * is presentational (a banner, a disabled button), and a request that fails
 * despite this saying `true` still surfaces its own error the way it always
 * did. Nothing is *gated* on it that a false positive could break.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // The events can fire between the initial render and this effect — on a
    // cold start from the launcher, before wifi has associated, that gap is
    // wide enough to matter.
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
