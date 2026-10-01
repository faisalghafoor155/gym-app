import { useState } from 'react';
import { Check, CreditCard, Minus, Sparkles, MessageCircle, AlertCircle } from 'lucide-react';
import { Card, Page, PageHeader, PageLoader, LoadFailed, primaryButton, secondaryButton } from '../components/ui';
import Modal from '../components/Modal';
import BillingPanel from '../components/subscription/BillingPanel';
import AdminBillingPanel from '../components/subscription/AdminBillingPanel';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import api, { apiError } from '../api/client';
import toast from 'react-hot-toast';
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
import type { LimitStatus, GymPlan } from '../types';

const LIMIT_ORDER: (keyof PlanLimits)[] = ['members', 'staff', 'trainers', 'classes'];
const FEATURE_ORDER: (keyof PlanFeatures)[] = [
  'whatsapp',
  'analytics',
  'biometrics',
  'onlinePayments',
];

const PLAN_DESCRIPTIONS: Record<GymPlan, string> = {
  free: 'Free trial to test features with up to 50 members.',
  basic: 'Perfect for small gyms with up to 200 active members.',
  growth: 'Most popular for expanding gyms with up to 400 active members.',
  pro: 'Unlimited capacity with biometric fingerprint check-in.',
};

/**
 * One limit as a bar, or as a count when the tier does not cap it.
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
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<GymPlan | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

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

  const handleSubscribe = async (plan: GymPlan) => {
    if (plan === 'free') return;
    setSubscribing(true);
    try {
      await api.post('/billing/subscribe', { plan });
      toast.success(`Invoice issued for ${status.plans.find(p => p.plan === plan)?.label}! Pay below to activate.`);
      setSelectedPlanForUpgrade(null);
      await reload();
      // Scroll to billing section
      const billingEl = document.getElementById('billing-panel-section');
      if (billingEl) {
        billingEl.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err: unknown) {
      const msg = apiError(err, 'Could not start subscription');
      if (msg.includes('already has a subscription')) {
        setSelectedPlanForUpgrade(null);
        setSupportModalOpen(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setSubscribing(false);
    }
  };

  const getPriceDisplay = (plan: GymPlan, price?: number) => {
    if (plan === 'free' || !price) return 'Free';
    return `Rs. ${price.toLocaleString('en-PK')}`;
  };

  const selectedPlanDetails = status.plans.find(p => p.plan === selectedPlanForUpgrade);

  return (
    <Page>
      <PageHeader
        icon={CreditCard}
        title="Plan & Usage"
        subtitle="Manage your gym's subscription tier, member limits, and billing"
      />

      {/* Super Admin Management Panel (Visible to Platform Owner) */}
      {isOwner && (
        <AdminBillingPanel onApproved={() => void reload()} />
      )}

      {/* Billing Panel */}
      {isOwner && (
        <div id="billing-panel-section">
          <BillingPanel />
        </div>
      )}

      {/* Current Plan Overview */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center">
              <Sparkles size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                  {status.planLabel}
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20">
                  Active
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {PLAN_DESCRIPTIONS[status.plan] ?? 'Your current subscription plan'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {LIMIT_ORDER.map(key => (
            <LimitBar
              key={key}
              label={LIMIT_LABELS[key]}
              status={status.limits[key]}
            />
          ))}
        </div>
      </Card>

      {/* All Available Plans Grid */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
          Available Subscription Plans
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Select a 200, 400, or Unlimited member plan tailored for your gym's growth.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {status.plans.map(p => {
          const isCurrent = p.plan === status.plan;
          const isPro = p.plan === 'pro';
          const isGrowth = p.plan === 'growth';

          return (
            <Card
              key={p.plan}
              className={`p-5 flex flex-col justify-between transition-all relative ${
                isCurrent
                  ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50/20 dark:bg-blue-500/5'
                  : isGrowth
                    ? 'border-blue-200 dark:border-blue-500/30'
                    : ''
              }`}
            >
              {isGrowth && !isCurrent && (
                <span className="absolute -top-2.5 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase tracking-wider">
                  Popular
                </span>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base">
                    {p.label}
                  </h3>
                  {isCurrent && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20">
                      Current
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className="mb-3">
                  <span className="text-xl font-black text-gray-900 dark:text-slate-100">
                    {getPriceDisplay(p.plan, p.price)}
                  </span>
                  {p.plan !== 'free' && (
                    <span className="text-xs text-gray-500 dark:text-slate-400 ml-1">
                      /month
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-500 dark:text-slate-400 mb-4 min-h-[32px]">
                  {PLAN_DESCRIPTIONS[p.plan]}
                </p>

                {/* Member Limit Highlight */}
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 mb-4 flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">Capacity</span>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {p.limits.members === null ? 'Unlimited Members' : `${p.limits.members} Members`}
                  </span>
                </div>

                {/* Limits breakdown */}
                <dl className="space-y-1.5 mb-4 text-xs">
                  {LIMIT_ORDER.filter(k => k !== 'members').map(key => (
                    <div key={key} className="flex justify-between">
                      <dt className="text-gray-400 dark:text-slate-500">
                        {LIMIT_LABELS[key]}
                      </dt>
                      <dd className="font-semibold text-gray-700 dark:text-slate-300">
                        {showLimit(p.limits[key])}
                      </dd>
                    </div>
                  ))}
                </dl>

                {/* Features breakdown */}
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
                            ? 'text-gray-600 dark:text-slate-300'
                            : 'text-gray-400 dark:text-slate-500'
                        }
                      >
                        {FEATURE_LABELS[key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              {isOwner && (
                <div className="mt-5 pt-3 border-t border-gray-100 dark:border-slate-800">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <Check size={14} />
                      Current Plan
                    </button>
                  ) : p.plan === 'free' ? (
                    <button
                      disabled
                      className="w-full py-2 px-3 rounded-xl text-xs font-medium bg-gray-50 dark:bg-slate-800/40 text-gray-400 dark:text-slate-500 cursor-not-allowed text-center"
                    >
                      Trial Tier
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedPlanForUpgrade(p.plan)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold text-center transition-all ${
                        isGrowth || isPro
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20'
                          : 'bg-gray-900 hover:bg-black text-white dark:bg-slate-700 dark:hover:bg-slate-600'
                      }`}
                    >
                      Select {p.limits.members ? `${p.limits.members} Members` : 'Unlimited'}
                    </button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Help & Custom Adjustments Note */}
      <div className="mt-8 p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <h4 className="text-sm font-bold text-gray-900 dark:text-slate-200">
            Need a custom capacity or plan adjustment?
          </h4>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Our team can arrange custom limits, multi-branch gyms, or manual bank payment invoices.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSupportModalOpen(true)}
          className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1.5 shadow-sm"
        >
          <MessageCircle size={14} className="text-emerald-500" />
          Contact Support / WhatsApp
        </button>
      </div>

      {/* Confirmation Modal for Plan Upgrade */}
      {selectedPlanForUpgrade && selectedPlanDetails && (
        <Modal
          onClose={() => setSelectedPlanForUpgrade(null)}
          title={`Subscribe to ${selectedPlanDetails.label}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-300">
              You are selecting the <strong>{selectedPlanDetails.label}</strong> for your gym.
            </p>

            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-slate-400">Member Limit:</span>
                <span className="font-bold text-gray-900 dark:text-slate-100">
                  {selectedPlanDetails.limits.members === null ? 'Unlimited' : `${selectedPlanDetails.limits.members} active members`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-slate-400">Monthly Subscription:</span>
                <span className="font-black text-blue-600 dark:text-blue-400">
                  {getPriceDisplay(selectedPlanDetails.plan, selectedPlanDetails.price)} / month
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-slate-400">Billing Cycle:</span>
                <span className="font-medium text-gray-900 dark:text-slate-100">Every 30 days</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400">
              Clicking below will issue your official subscription invoice. You can then settle it instantly via JazzCash, EasyPaisa, or direct Bank Transfer.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedPlanForUpgrade(null)}
                className={secondaryButton}
                disabled={subscribing}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSubscribe(selectedPlanForUpgrade)}
                disabled={subscribing}
                className={primaryButton}
              >
                {subscribing ? 'Generating Invoice...' : 'Confirm & Proceed to Payment'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Support / Mid-term change Modal */}
      {supportModalOpen && (
        <Modal
          onClose={() => setSupportModalOpen(false)}
          title="Plan Change & Support"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
              <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                To switch between paid tiers mid-term, our support team will prorate your existing days so your previously paid amount is completely preserved.
              </p>
            </div>

            <p className="text-sm text-gray-600 dark:text-slate-300">
              You can reach out to our gym support hotline or WhatsApp with your Gym ID:
            </p>

            <div className="p-3 rounded-lg bg-gray-100 dark:bg-slate-800 text-xs font-mono text-gray-800 dark:text-slate-200 break-all select-all">
              Gym Name: {status.planLabel} · Current Plan
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSupportModalOpen(false)}
                className={secondaryButton}
              >
                Close
              </button>
              <a
                href="https://wa.me/923001234567?text=Hi%2C%20I%20would%20like%20to%20upgrade%20my%20gym%20plan"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                <MessageCircle size={14} />
                Open WhatsApp
              </a>
            </div>
          </div>
        </Modal>
      )}
    </Page>
  );
}
