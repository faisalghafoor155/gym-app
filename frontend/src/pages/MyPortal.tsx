import { useEffect, useState } from 'react';
import {
  CalendarCheck, CreditCard, Dumbbell, Utensils, Clock, ShieldCheck, Sparkles,
} from 'lucide-react';
import Badge from '../components/Badge';
import {
  Page, Card, PageLoader, LoadFailed, InlineEmpty, SegmentedControl,
  primaryButton, secondaryButton,
} from '../components/ui';
import MyClasses from '../components/portal/MyClasses';
import MyCheckInCode from '../components/portal/MyCheckInCode';
import { MyMemberships, MyPayments, MyPurchases } from '../components/portal/MyHistory';
import MyProfileForm from '../components/portal/MyProfileForm';
import api, { apiError } from '../api/client';
import type { MyProfile, MembershipPlan, PaymentProviderOption, CheckoutStarted } from '../types';
import toast from 'react-hot-toast';

/**
 * Hands the browser to the payment provider with a real form POST.
 *
 * A redirect would not do: providers expect their signed fields as form data,
 * and posting from a form we build and immediately submit means the member's
 * payment credentials are entered on the provider's page rather than ours.
 */
const postToProvider = (url: string, fields: Record<string, string>): void => {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
};

/**
 * The portal's sections.
 *
 * Tabs rather than one long scroll, which is what this was: adding classes,
 * history and a check-in code to a page that already stacked six cards would
 * have buried the two things a member opens it for — when their membership
 * ends, and the code to get in.
 */
type PortalTab = 'overview' | 'classes' | 'checkin' | 'history' | 'profile';

const TABS: readonly { value: PortalTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'classes', label: 'Classes' },
  { value: 'checkin', label: 'Check-in' },
  { value: 'history', label: 'History' },
  { value: 'profile', label: 'Profile' },
];

export default function MyPortal() {
  const [tab, setTab] = useState<PortalTab>('overview');
  const [data, setData] = useState<MyProfile | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Online checkout state
  const [checkoutItem, setCheckoutItem] = useState<{ type: 'due' | 'renew'; id: string; name: string; price: number } | null>(null);
  const [providers, setProviders] = useState<PaymentProviderOption[]>([]);
  const [provider, setProvider] = useState<string>('');
  const [paying, setPaying] = useState(false);

  const loadData = async () => {
    try {
      const [profileRes, plansRes, providersRes] = await Promise.all([
        api.get<MyProfile>('/me'),
        api.get<MembershipPlan[]>('/online-payments/plans'),
        api.get<PaymentProviderOption[]>('/online-payments/providers'),
      ]);
      setData(profileRes.data);
      setPlans(plansRes.data);
      setProviders(providersRes.data);
      setProvider(prev => prev || providersRes.data[0]?.provider || '');
    } catch (err) {
      toast.error(apiError(err, 'Could not load portal details'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  /**
   * The provider drops the member back here with `?payment=…` once they are
   * done. That parameter is only ever a hint for what to say — the server
   * decided the outcome from the gateway's signed callback, and `loadData`
   * above is what shows the real state.
   */
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('payment');
    if (!status) return;

    if (status === 'success') toast.success('Payment received — your membership is up to date.');
    else if (status === 'failed') toast.error('That payment did not go through. Nothing was charged.');
    else if (status === 'pending') toast('Payment is still being confirmed. This page will update shortly.');

    // Cleared so a refresh does not replay the message.
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  /**
   * Starts a payment and hands the member to their provider.
   *
   * Nothing here decides whether anything was paid. The server records a
   * pending intent and returns a signed form; the membership changes only
   * after the provider calls back. The previous version collected a card
   * number and CVV that were never sent anywhere — this takes no card details
   * at all, which is both the honest design and the one that keeps raw card
   * data out of the app entirely.
   */
  const handleCheckoutSubmit = async () => {
    if (!checkoutItem || !provider) return;

    setPaying(true);
    try {
      const payload = checkoutItem.type === 'due'
        ? { type: 'due', paymentId: checkoutItem.id, provider }
        : { type: 'renew', planId: checkoutItem.id, provider };

      const { data: started } = await api.post<CheckoutStarted>('/online-payments/checkout', payload);

      if (started.url) {
        // Handed over via a real form POST: providers expect their fields as
        // form data, and this leaves their page, not ours, holding the
        // payment credentials.
        postToProvider(started.url, started.fields);
        return;
      }

      // No gateway configured — the intent is a request the front desk settles.
      toast.success('Request sent. Please pay at the front desk to activate it.');
      setCheckoutItem(null);
      setLoading(true);
      await loadData();
    } catch (err) {
      toast.error(apiError(err, 'Could not start the payment'));
    } finally {
      setPaying(false);
    }
  };

  const hasRedirectProvider = providers.some(p => p.provider === provider && p.redirects);

  if (loading) return <PageLoader />;

  if (!data) {
    return (
      <LoadFailed
        title="Could not load your details"
        hint="The server did not answer. Check the connection and try again."
      />
    );
  }

  const { member, plan, attendance, payments, dueTotal } = data;
  const membership = member.currentMembership;

  // Find the outstanding payment due item
  const duePayment = payments.find(p => p.status === 'due');

  return (
    <Page>
      <div className="space-y-5">

      <SegmentedControl value={tab} onChange={setTab} options={TABS} />

      {tab === 'classes' && (
        // Reloads the profile after a booking: nothing on the overview
        // depends on it today, but a stale membership card behind a
        // "renew to book" refusal would be exactly the wrong thing to show.
        <MyClasses onChange={() => void loadData()} />
      )}

      {tab === 'checkin' && (
        <MyCheckInCode
          memberId={member.id}
          memberNo={member.memberNo}
          name={member.name}
        />
      )}

      {tab === 'history' && (
        <div className="space-y-5">
          <MyMemberships />
          <MyPayments
            payments={payments}
            member={{
              name: member.name,
              phone: member.phone,
              memberNo: member.memberNo,
            }}
          />
          <MyPurchases />
        </div>
      )}

      {tab === 'profile' && (
        // Updated from the PUT's own response rather than by reloading: the
        // server hands back the whole profile it just saved, so a refetch
        // would only ask for what is already in hand.
        <MyProfileForm member={member} onSaved={setData} />
      )}

      {tab === 'overview' && (
      <div className="space-y-5">
      
      {/* Membership status card */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            {member.photo
              ? <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
              : <span className="text-white font-bold">{member.name.slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 truncate">{member.name}</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {member.memberNo}
              {membership && ` · ${membership.planName}`}
            </p>
            {membership && <div className="mt-2"><Badge status={membership.status} /></div>}
          </div>
        </div>

        {membership ? (
          <div className={`mt-4 rounded-xl px-4 py-3 flex items-center justify-between ${
            membership.status === 'expired' ? 'bg-red-50 dark:bg-red-500/15' :
            membership.status === 'expiring' ? 'bg-yellow-50 dark:bg-yellow-500/15' : 'bg-green-50 dark:bg-green-500/15'
          }`}>
            <span className="text-sm text-gray-600 dark:text-slate-300">Membership expiry</span>
            <span className={`text-sm font-bold ${
              membership.status === 'expired' ? 'text-red-600' :
              membership.status === 'expiring' ? 'text-yellow-700' : 'text-green-700'
            }`}>
              {membership.status === 'expired'
                ? `Expired ${Math.abs(membership.daysLeft)}d ago`
                : `${membership.daysLeft}d left`}
            </span>
          </div>
        ) : (
          <div className="mt-4 rounded-xl px-4 py-3 bg-gray-50 dark:bg-slate-800/60 text-sm text-gray-500 dark:text-slate-400 text-center">
            No membership yet — ask the front desk to set one up.
          </div>
        )}

        {dueTotal > 0 && duePayment && (
          <div className="mt-3 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CreditCard size={18} className="text-red-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  Rs. {dueTotal.toLocaleString()} outstanding
                </p>
                <p className="text-xs text-red-600">Clear your unpaid invoices easily online.</p>
              </div>
            </div>
            <button
              onClick={() => setCheckoutItem({
                type: 'due',
                id: duePayment.id,
                name: 'Outstanding Gym Dues',
                price: dueTotal,
              })}
              className="py-1.5 px-3 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              Pay Dues Online
            </button>
          </div>
        )}
      </Card>

      {/* Online Renewal & Upgrades Section */}
      <Card className="p-5">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-600" />
          Renew or Upgrade Membership
        </h2>
        {plans.length === 0 ? (
          <InlineEmpty message="No plans are on sale right now. Ask at the front desk to renew." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(p => (
              <div key={p.id} className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm">{p.name}</h3>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{p.durationDays} Days duration</p>
                  <p className="text-lg font-black text-indigo-600 mt-2">Rs. {p.price.toLocaleString()}</p>
                </div>
                <button
                  onClick={() => setCheckoutItem({
                    type: 'renew',
                    id: p.id,
                    name: p.name,
                    price: p.price,
                  })}
                  className="mt-4 w-full py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                >
                  Renew / Purchase
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Dumbbell size={16} className="text-blue-600" /> Workout Plan
          </h2>
          {plan?.workoutPlan ? (
            <>
              <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">{plan.workoutPlan.name}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">
                {plan.workoutPlan.description || 'No description'}
              </p>
            </>
          ) : (
            <InlineEmpty message="No workout plan assigned yet. Your trainer sets this up for you." />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Utensils size={16} className="text-green-600" /> Diet Plan
          </h2>
          {plan?.dietPlan ? (
            <>
              <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">{plan.dietPlan.name}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">
                {plan.dietPlan.description || 'No description'}
              </p>
            </>
          ) : (
            <InlineEmpty message="No diet plan assigned yet. Your trainer sets this up for you." />
          )}
        </Card>
      </div>

      {/* Attendance */}
      <Card className="p-5">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <CalendarCheck size={16} className="text-blue-600" /> Recent Attendance
          <span className="ml-auto bg-blue-100 dark:bg-blue-500/15 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {attendance.length}
          </span>
        </h2>
        {attendance.length === 0 ? (
          <InlineEmpty message="No check-ins recorded yet. Your visits appear here once you scan in." />
        ) : (
          <ul className="space-y-2">
            {attendance.slice(0, 10).map(a => (
              <li key={a.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 dark:border-slate-800 last:border-0">
                <span className="text-gray-700 dark:text-slate-300">
                  {new Date(a.checkedInAt).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span className="text-gray-400 dark:text-slate-500 text-xs flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(a.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      </div>
      )}
      </div>

      {/* ONLINE CHECKOUT DIALOG MODAL */}
      {checkoutItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
             onClick={() => !paying && setCheckoutItem(null)}>
          <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-2">Checkout</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-5">
              {hasRedirectProvider
                ? 'You will be taken to your payment provider to complete this securely. Your membership updates once they confirm the payment.'
                : 'This gym takes payment at the front desk. We will let the staff know you want to pay.'}
            </p>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 mb-5">
              <span className="text-xs text-gray-400 font-semibold uppercase">Item to checkout</span>
              <p className="font-bold text-gray-800 dark:text-slate-200 mt-0.5">{checkoutItem.name}</p>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                <span className="text-xs font-bold text-gray-400 uppercase">Amount Due</span>
                <span className="text-lg font-black text-indigo-600">Rs. {checkoutItem.price.toLocaleString()}</span>
              </div>
            </div>

            {providers.length > 1 && (
              <div className="mb-5">
                <span className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">Pay with</span>
                <div className="grid grid-cols-2 gap-2">
                  {providers.map(p => (
                    <button
                      key={p.provider}
                      type="button"
                      onClick={() => setProvider(p.provider)}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-semibold transition ${
                        provider === p.provider
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                          : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-gray-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={() => setCheckoutItem(null)}
                disabled={paying}
                className={secondaryButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCheckoutSubmit()}
                disabled={paying || !provider}
                className={`flex items-center gap-1.5 ${primaryButton}`}
              >
                <ShieldCheck size={16} />
                {paying
                  ? 'Starting…'
                  : hasRedirectProvider
                    ? 'Continue to payment'
                    : 'Request at front desk'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
