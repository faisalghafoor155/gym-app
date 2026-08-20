import { useEffect, useState } from 'react';
import api from '../api/client';
import type { FingerprintStatus } from '../types';

interface UseFingerprintReaderResult {
  status: FingerprintStatus | null;
  /** True until the first answer lands, either way. */
  loading: boolean;
}

/**
 * Asks the backend what reader is attached, if any.
 *
 * Silent on failure, which is the whole reason this is not `useFetch`: most
 * gyms running this have no reader at all, and a toast on every page load
 * telling them so would be noise about a feature they are not using. `status`
 * stays null, and a caller reads that the same way it reads "no reader" —
 * which is what a failed lookup effectively means.
 *
 * Fetched per mount rather than cached: a reader is a physical thing that can
 * be unplugged between one dialog and the next, and `online` is only worth
 * anything if it was asked recently.
 */
export function useFingerprintReader(): UseFingerprintReaderResult {
  const [status, setStatus] = useState<FingerprintStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get<FingerprintStatus>('/fingerprint/status')
      .then(r => { if (!cancelled) setStatus(r.data); })
      .catch(() => { if (!cancelled) setStatus(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { status, loading };
}
