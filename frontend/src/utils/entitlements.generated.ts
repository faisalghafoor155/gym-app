/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Written from backend/src/services/subscription.ts by
 * backend/scripts/generateEntitlements.ts. Change the table there and run
 * `npm run gen:permissions` in backend/, then commit both files.
 *
 * The backend test suite fails if this stops matching its source.
 */

import type { GymPlan } from '../types';

/** `null` means uncapped — see the server table for why not `Infinity`. */
export type Limit = number | null;

export interface PlanLimits {
  classes: Limit;
  members: Limit;
  staff: Limit;
  trainers: Limit;
}

export interface PlanFeatures {
  analytics: boolean;
  biometrics: boolean;
  onlinePayments: boolean;
  whatsapp: boolean;
}

export interface Entitlements {
  limits: PlanLimits;
  features: PlanFeatures;
}

/** The tiers, cheapest first. */
export const PLAN_ORDER: readonly GymPlan[] = ['free', 'basic', 'growth', 'pro'] as const;

export const ENTITLEMENTS: Record<GymPlan, Entitlements> = {
  free: {
    limits: {
      classes: 3,
      members: 50,
      staff: 2,
      trainers: 2,
    },
    features: {
      analytics: false,
      biometrics: false,
      onlinePayments: false,
      whatsapp: false,
    },
  },
  basic: {
    limits: {
      classes: 20,
      members: 200,
      staff: 6,
      trainers: 10,
    },
    features: {
      analytics: true,
      biometrics: false,
      onlinePayments: false,
      whatsapp: true,
    },
  },
  growth: {
    limits: {
      classes: 35,
      members: 400,
      staff: 10,
      trainers: 20,
    },
    features: {
      analytics: true,
      biometrics: false,
      onlinePayments: true,
      whatsapp: true,
    },
  },
  pro: {
    limits: {
      classes: null,
      members: null,
      staff: 25,
      trainers: null,
    },
    features: {
      analytics: true,
      biometrics: true,
      onlinePayments: true,
      whatsapp: true,
    },
  },
};

export const PLAN_LABELS: Record<GymPlan, string> = {
  free: "Free",
  basic: "Basic",
  growth: "Growth",
  pro: "Pro",
};
