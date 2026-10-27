import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';
import type { GymPlan, SubscriptionStatus } from '../types';
import type { PlanFeatures, PlanLimits } from '../utils/entitlements';
import { isAtLimit } from '../utils/entitlements';

interface SubscriptionValue {
  status: SubscriptionStatus | null;
  loading: boolean;
  /** Whether the gym's tier includes a feature. False while still loading, so
   *  a page never flashes a control it is about to hide. */
  has: (feature: keyof PlanFeatures) => boolean;
  /** Whether a limit is already reached, for disabling an Add button before
   *  somebody fills in a form the server will refuse. */
  atLimit: (of: keyof PlanLimits) => boolean;
  plan: GymPlan | null;
  /** Refetches. Called after anything that changes a count — adding a member
   *  moves the bar the settings page draws. */
  reload: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionValue | null>(null);

const CACHE_KEY = 'subscription';

const readCached = (): SubscriptionStatus | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as SubscriptionStatus) : null;
  } catch {
    return null;
  }
};

/**
 * The gym's subscription, fetched once and shared.
 *
 * Sits inside `AuthProvider` because there is nothing to fetch until somebody
 * is signed in, and the endpoint is behind `auth`. A signed-out visitor gets
 * the null status and every gate answers "no", which is the right answer for a
 * login screen that renders none of them.
 *
 * Deliberately not merged into `AuthContext`. A session says who you are and
 * is re-checked on every load; a plan says what the gym bought and changes when
 * somebody pays, out of band. Keeping them apart means an upgrade shows up on
 * the next `reload()` rather than requiring a sign-out.
 */
export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { isAuth } = useAuth();
  // The last answer, so a reload can draw the menu and open the page at once
  // instead of holding every route behind this request. Plan and limits only —
  // nothing a shared screen should not show — and the server enforces both
  // regardless of what the menu believes.
  const [status, setStatus] = useState<SubscriptionStatus | null>(readCached);
  const [loading, setLoading] = useState(() => readCached() === null);

  const load = useCallback(async (): Promise<void> => {
    if (!isAuth) {
      setStatus(null);
      setLoading(false);
      try { localStorage.removeItem(CACHE_KEY); } catch { /* nothing to forget */ }
      return;
    }
    try {
      const { data } = await api.get<SubscriptionStatus>('/subscription');
      setStatus(data);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* still works, just slower */ }
    } catch {
      // Left null rather than reported. A failure here costs the upgrade
      // prompts and the usage bars; the limits themselves are enforced on the
      // server regardless, so a toast would be announcing the loss of a hint.
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [isAuth]);

  useEffect(() => { void load(); }, [load]);

  const has = useCallback(
    (feature: keyof PlanFeatures): boolean => status?.features[feature] ?? false,
    [status],
  );

  const atLimit = useCallback(
    (of: keyof PlanLimits): boolean => {
      const limit = status?.limits[of];
      return limit ? isAtLimit(limit.limit, limit.used) : false;
    },
    [status],
  );

  return (
    <SubscriptionContext.Provider
      value={{ status, loading, has, atLimit, plan: status?.plan ?? null, reload: load }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = (): SubscriptionValue => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside a SubscriptionProvider');
  return ctx;
};
