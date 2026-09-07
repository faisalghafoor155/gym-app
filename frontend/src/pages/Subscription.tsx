import { Check, CreditCard, Minus, Sparkles } from 'lucide-react';
import { Card, Page, PageHeader, PageLoader, LoadFailed } from '../components/ui';
import BillingPanel from '../components/subscription/BillingPanel';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import {
  FEATURE_LABELS,
  LIMIT_LABELS,
  fillOf,
  isAtLimit,
  isNearLimit,
  showLimit,
  type PlanFeatures,
  type PlanLimits,
} from '../utils/entitlements';
import type { LimitStatus } from '../types';

const LIMIT_ORDER: (keyof PlanLimits)[] = ['members', 'staff', 'trainers', 'classes'];
const FEATURE_ORDER: (keyof PlanFeatures)[] = [
  'whatsapp',
  'analytics',
  'biometrics',
  'onlinePayments',
];

/**
 * One limit as a bar, or as a count when the tier does not cap it.
 *
 * An uncapped limit gets no bar on purpose: one would either sit at zero for
 * ever or imply a ceiling that is not there, and both read as a bug to
 * somebody who has paid for "unlimited".
 */
function LimitBar({ label, status }: { label: string; status: LimitStatus }) {
  const fill = fillOf(status.limit, status.used);
  const full = isAtLimit(status.limit, status.used);
  const near = isNearLimit(status.limit, status.used);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">
          {label}
        </span>
        <span
          className={`text-xs font-bold tabular-nums ${
            full
              ? 'text-red-600 dark:text-red-400'
              : near
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-500 dark:text-slate-400'
          }`}
        >
          {status.used.toLocaleString()}
          <span className="text-gray-400 dark:text-slate-500 font-medium">
            {' / '}
            {showLimit(status.limit)}
          </span>
        </span>
      </div>

      {fill === null ? (
        <div className="h-1.5 rounded-full bg-gradient-to-r from-blue-500/30 to-emerald-500/30" />
      ) : (
        <div
          className="h-1.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden"
          role="progressbar"
          aria-valuenow={status.used}
          aria-valuemin={0}
          aria-valuemax={status.limit ?? undefined}
          aria-label={label}
        >
          <div
            className={`h-full rounded-full transition-all ${
              full ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.max(2, fill * 100)}%` }}
          />
        </div>
      )}

      {full && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          At the limit — nothing more can be added until a place is freed or the
          plan changes.
        </p>
      )}
    </div>
  );
}

export default function Subscription() {
  const { status, loading, reload } = useSubscription();
  const { isOwner } = useAuth();

  if (loading) return <PageLoader />;
  if (!status) {
    return (
      <Page>
        <LoadFailed
          title="Could not load the plan"
          hint="The limits still apply — this page just could not read them."
          onRetry={() => void reload()}
        />
      </Page>
    );
  }

  const current = status.plans.find(p => p.plan === status.plan);

  return (
    <Page>
      <PageHeader
        icon={CreditCard}
        title="Plan & usage"
        subtitle="What this gym is on, and how much of it is in use"
      />

      {/* Above the usage bars deliberately. An owner who came here because they
          were warned about an invoice should not have to scroll past four
          progress bars to find the thing they came to pay. Owner-only, like the
          route behind it — a receptionist has no reason to see an invoice. */}
      {isOwner && <BillingPanel />}

      <Card className="p-5 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center">
            <Sparkles size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
              {status.planLabel}
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Current plan
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {LIMIT_ORDER.map(key => (
            <LimitBar key={key} label={LIMIT_LABELS[key]} status={status.limits[key]} />
          ))}
        </div>

        {current && (
          <div className="mt-5 pt-5 border-t border-gray-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-2.5">
              Included
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8">
              {FEATURE_ORDER.map(key => {
                const on = current.features[key];
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    {on ? (
                      <Check size={14} className="text-emerald-600 shrink-0" />
                    ) : (
                      <Minus size={14} className="text-gray-300 dark:text-slate-600 shrink-0" />
                    )}
                    <span
                      className={
                        on
                          ? 'text-gray-700 dark:text-slate-300'
                          : 'text-gray-400 dark:text-slate-500'
                      }
                    >
                      {FEATURE_LABELS[key]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Every tier, so the numbers behind an upgrade are visible rather than
          something the gym has to ask for. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {status.plans.map(p => {
          const isCurrent = p.plan === status.plan;
          return (
            <Card
              key={p.plan}
              className={`p-5 ${
                isCurrent ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-slate-100">
                  {p.label}
                </h3>
                {isCurrent && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20">
                    Current
                  </span>
                )}
              </div>

              <dl className="space-y-1.5 mb-4">
                {LIMIT_ORDER.map(key => (
                  <div key={key} className="flex justify-between text-xs">
                    <dt className="text-gray-400 dark:text-slate-500">
                      {LIMIT_LABELS[key]}
                    </dt>
                    <dd className="font-semibold text-gray-700 dark:text-slate-300">
                      {showLimit(p.limits[key])}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="space-y-1.5 pt-3 border-t border-gray-100 dark:border-slate-800">
                {FEATURE_ORDER.map(key => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    {p.features[key] ? (
                      <Check size={13} className="text-emerald-600 shrink-0" />
                    ) : (
                      <Minus size={13} className="text-gray-300 dark:text-slate-600 shrink-0" />
                    )}
                    <span
                      className={
                        p.features[key]
                          ? 'text-gray-600 dark:text-slate-400'
                          : 'text-gray-400 dark:text-slate-500'
                      }
                    >
                      {FEATURE_LABELS[key]}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Changing tier mid-term is still arranged by hand: it has to reconcile
          a period already paid for, which is a decision worth making
          deliberately rather than with a formula. Starting a subscription is
          self-serve; moving between them is not. */}
      <p className="mt-5 text-xs text-gray-500 dark:text-slate-400 text-center">
        To move between plans, get in touch — a change mid-term is arranged by
        hand so the period you have already paid for is not lost.
      </p>
    </Page>
  );
}
