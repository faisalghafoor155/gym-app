import { useEffect, useState } from 'react';
import {
  CalendarCheck, CreditCard, Dumbbell, Utensils, AlertTriangle, Clock,
} from 'lucide-react';
import Badge from '../components/Badge';
import { Page, Card, PageLoader } from '../components/ui';
import api, { apiError } from '../api/client';
import type { MyProfile } from '../types';
import toast from 'react-hot-toast';

export default function MyPortal() {
  const [data, setData] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<MyProfile>('/me')
      .then(r => setData(r.data))
      .catch(err => toast.error(apiError(err, 'Could not load your details')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh] p-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} />
          </div>
          <p className="font-semibold text-gray-700">Could not load your details</p>
          <p className="text-sm text-gray-400 mt-1">Please try again in a moment.</p>
        </div>
      </div>
    );
  }

  const { member, plan, attendance, payments, dueTotal } = data;
  const membership = member.currentMembership;

  return (
    <Page>
      <div className="space-y-5">
      {/* Membership card */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            {member.photo
              ? <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
              : <span className="text-white font-bold">{member.name.slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{member.name}</h1>
            <p className="text-sm text-gray-500">
              {member.memberNo}
              {membership && ` · ${membership.planName}`}
            </p>
            {membership && <div className="mt-2"><Badge status={membership.status} /></div>}
          </div>
        </div>

        {membership ? (
          <div className={`mt-4 rounded-xl px-4 py-3 flex items-center justify-between ${
            membership.status === 'expired' ? 'bg-red-50' :
            membership.status === 'expiring' ? 'bg-yellow-50' : 'bg-green-50'
          }`}>
            <span className="text-sm text-gray-600">Membership expiry</span>
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
          <div className="mt-4 rounded-xl px-4 py-3 bg-gray-50 text-sm text-gray-500 text-center">
            No membership yet — ask the front desk to set one up.
          </div>
        )}

        {dueTotal > 0 && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <CreditCard size={18} className="text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                Rs. {dueTotal.toLocaleString()} outstanding
              </p>
              <p className="text-xs text-red-600">Please clear your dues at the gym.</p>
            </div>
          </div>
        )}
      </Card>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Dumbbell size={16} className="text-blue-600" /> Workout Plan
          </h2>
          {plan?.workoutPlan ? (
            <>
              <p className="font-medium text-gray-900 text-sm">{plan.workoutPlan.name}</p>
              <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">
                {plan.workoutPlan.description || 'No description'}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">No workout plan assigned yet</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Utensils size={16} className="text-green-600" /> Diet Plan
          </h2>
          {plan?.dietPlan ? (
            <>
              <p className="font-medium text-gray-900 text-sm">{plan.dietPlan.name}</p>
              <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">
                {plan.dietPlan.description || 'No description'}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">No diet plan assigned yet</p>
          )}
        </Card>
      </div>

      {/* Attendance */}
      <Card className="p-5">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <CalendarCheck size={16} className="text-blue-600" /> Recent Attendance
          <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {attendance.length}
          </span>
        </h2>
        {attendance.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No check-ins recorded yet</p>
        ) : (
          <ul className="space-y-2">
            {attendance.slice(0, 10).map(a => (
              <li key={a.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <span className="text-gray-700">
                  {new Date(a.checkedInAt).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span className="text-gray-400 text-xs flex items-center gap-1">
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
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <CreditCard size={16} className="text-blue-600" /> Payment History
        </h2>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No payments recorded yet</p>
        ) : (
          <ul className="space-y-2">
            {payments.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">Rs. {p.amount.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">
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
    </Page>
  );
}
