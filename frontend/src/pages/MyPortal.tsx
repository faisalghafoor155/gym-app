import { useEffect, useState, type FormEvent } from 'react';
import {
  CalendarCheck, CreditCard, Dumbbell, Utensils, AlertTriangle, Clock, ShieldCheck, Sparkles,
} from 'lucide-react';
import Badge from '../components/Badge';
import { Page, Card, PageLoader, inputClass, primaryButton, secondaryButton } from '../components/ui';
import api, { apiError } from '../api/client';
import type { MyProfile, MembershipPlan } from '../types';
import toast from 'react-hot-toast';

export default function MyPortal() {
  const [data, setData] = useState<MyProfile | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Online checkout state
  const [checkoutItem, setCheckoutItem] = useState<{ type: 'due' | 'renew'; id: string; name: string; price: number } | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [paying, setPaying] = useState(false);

  const loadData = async () => {
    try {
      const [profileRes, plansRes] = await Promise.all([
        api.get<MyProfile>('/me'),
        api.get<MembershipPlan[]>('/online-payments/plans'),
      ]);
      setData(profileRes.data);
      setPlans(plansRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Could not load portal details'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCheckoutSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!checkoutItem) return;

    if (!/^\d{16}$/.test(cardNumber.replace(/\s+/g, ''))) {
      toast.error('Card number must be 16 digits');
      return;
    }
    if (!/^\d{3}$/.test(cardCvv)) {
      toast.error('CVV must be 3 digits');
      return;
    }

    setPaying(true);
    try {
      const payload = checkoutItem.type === 'due'
        ? { type: 'due', paymentId: checkoutItem.id }
        : { type: 'renew', planId: checkoutItem.id };

      await api.post('/online-payments/checkout', payload);
      toast.success(
        checkoutItem.type === 'due'
          ? 'Outstanding dues paid successfully!'
          : 'Membership renewed successfully!'
      );
      setCheckoutItem(null);
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      
      setLoading(true);
      await loadData();
    } catch (err) {
      toast.error(apiError(err, 'Online checkout payment failed'));
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <PageLoader />;

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh] p-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} />
          </div>
          <p className="font-semibold text-gray-700 dark:text-slate-300">Could not load your details</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Please try again in a moment.</p>
        </div>
      </div>
    );
  }

  const { member, plan, attendance, payments, dueTotal } = data;
  const membership = member.currentMembership;

  // Find the outstanding payment due item
  const duePayment = payments.find(p => p.status === 'due');

  return (
    <Page>
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
          <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">No plans available at this time.</p>
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
            <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">No workout plan assigned yet</p>
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
            <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">No diet plan assigned yet</p>
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
          <p className="text-sm text-gray-400 dark:text-slate-500 py-6 text-center">No check-ins recorded yet</p>
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

      {/* Payments */}
      <Card className="p-5">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <CreditCard size={16} className="text-blue-600" /> Payment History
        </h2>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500 py-6 text-center">No payments recorded yet</p>
        ) : (
          <ul className="space-y-2">
            {payments.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 dark:border-slate-800 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Rs. {p.amount.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {new Date(p.paymentDate).toLocaleDateString()} · {p.method}
                  </p>
                </div>
                <Badge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      </div>

      {/* ONLINE CHECKOUT DIALOG MODAL */}
      {checkoutItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
             onClick={() => setCheckoutItem(null)}>
          <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-2">Secure Online Checkout</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-5">
              Confirm your checkout details below. Payments are encrypted and securely simulated.
            </p>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 mb-5">
              <span className="text-xs text-gray-400 font-semibold uppercase">Item to checkout</span>
              <p className="font-bold text-gray-800 dark:text-slate-200 mt-0.5">{checkoutItem.name}</p>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                <span className="text-xs font-bold text-gray-400 uppercase">Amount Due</span>
                <span className="text-lg font-black text-indigo-600">Rs. {checkoutItem.price.toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Cardholder Card Number</label>
                <input
                  required
                  placeholder="4000 1234 5678 9010"
                  maxLength={16}
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value.replace(/\D/g, ''))}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Expiry Date</label>
                  <input
                    required
                    placeholder="MM/YY"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={e => setCardExpiry(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">CVV / CVC</label>
                  <input
                    required
                    type="password"
                    placeholder="123"
                    maxLength={3}
                    value={cardCvv}
                    onChange={e => setCardCvv(e.target.value.replace(/\D/g, ''))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setCheckoutItem(null)}
                  className={secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className={`flex items-center gap-1.5 ${primaryButton}`}
                >
                  <ShieldCheck size={16} />
                  {paying ? 'Processing…' : 'Submit Secure Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Page>
  );
}
