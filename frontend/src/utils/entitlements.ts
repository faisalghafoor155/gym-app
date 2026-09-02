import type { GymPlan } from '../types';
import {
  ENTITLEMENTS,
  PLAN_LABELS,
  PLAN_ORDER,
  type Entitlements,
  type Limit,
  type PlanFeatures,
  type PlanLimits,
} from './entitlements.generated';

/**
 * What the gym's subscription allows, as the client understands it.
 *
 * The table itself is not here: it is generated from
 * `backend/src/services/subscription.ts`, which is the only copy anybody edits.
 * This file holds what is genuinely client-side — turning a tier into the copy
 * a page renders.
 *
 * None of this is a security boundary. Hiding a button the API would refuse is
 * a courtesy: every limit and every feature is enforced again server-side, and
 * that check is the one that counts. What this buys is the difference between
 * a button that fails and a button that explains itself.
 */

export type { Entitlements, Limit, PlanFeatures, PlanLimits };
export { ENTITLEMENTS, PLAN_LABELS, PLAN_ORDER };

export const entitlementsFor = (plan: GymPlan): Entitlements => ENTITLEMENTS[plan];

export const planHasFeature = (plan: GymPlan, feature: keyof PlanFeatures): boolean =>
  ENTITLEMENTS[plan]?.features[feature] ?? false;

/** The cheapest tier that includes a feature — the one an upgrade prompt names. */
export const cheapestPlanWith = (feature: keyof PlanFeatures): GymPlan | null =>
  PLAN_ORDER.find(p => ENTITLEMENTS[p].features[feature]) ?? null;

/** `null` is uncapped, which reads better as a word than as an empty cell. */
export const showLimit = (limit: Limit): string =>
  limit === null ? 'Unlimited' : limit.toLocaleString();

/** What each limit is called on screen. */
export const LIMIT_LABELS: Record<keyof PlanLimits, string> = {
  members: 'Active members',
  staff: 'Staff accounts',
  trainers: 'Trainers',
  classes: 'Classes',
};

/** What each feature is called on screen. */
export const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  whatsapp: 'WhatsApp reminders',
  biometrics: 'Fingerprint check-in',
  analytics: 'Reports & analytics',
  onlinePayments: 'Online payments',
};

/**
 * How full a limit is, 0–1, for a progress bar.
 *
 * An uncapped limit has no fullness — a bar for it would either sit at zero
 * for ever or imply a ceiling that is not there — so this returns null and the
 * caller renders a count instead.
 */
export const fillOf = (limit: Limit, used: number): number | null =>
  limit === null || limit === 0 ? null : Math.min(1, used / limit);

/** Whether a limit is close enough to matter. Used to colour a bar amber. */
export const isNearLimit = (limit: Limit, used: number): boolean => {
  const fill = fillOf(limit, used);
  return fill !== null && fill >= 0.8;
};

export const isAtLimit = (limit: Limit, used: number): boolean =>
  limit !== null && used >= limit;
