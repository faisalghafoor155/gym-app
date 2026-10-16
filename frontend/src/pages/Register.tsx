import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Dumbbell, Check, Sparkles, Users, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { inputClass, primaryButton } from '../components/ui';
import api, { apiError } from '../api/client';
import type { AuthResponse, GymPlan } from '../types';
import { SUBSCRIPTIONS_ENABLED } from '../utils/entitlements';
import toast from 'react-hot-toast';

interface RegisterForm {
  gymName: string;
  ownerName: string;
  email: string;
  password: string;
  phone: string;
  plan: GymPlan;
}

interface PlanOption {
  id: GymPlan;
  name: string;
  members: string;
  price: string;
  period: string;
  badge?: string;
  description: string;
  features: string[];
  icon: typeof Users;
  popular?: boolean;
}

const PLAN_OPTIONS: PlanOption[] = [
  {
    id: 'free',
    name: 'Free Trial',
    members: '50 Members',
    price: 'Rs. 0',
    period: 'forever trial',
    description: 'Perfect for testing the waters and exploring the software.',
    features: ['Up to 50 active members', '2 staff accounts', 'Basic attendance & payments', 'Email reminders'],
    icon: Dumbbell,
  },
  {
    id: 'basic',
    name: 'Starter Plan',
    members: '200 Members',
    price: 'Rs. 3,000',
    period: 'per month',
    description: 'Ideal for small to medium fitness clubs and neighborhood gyms.',
    features: ['Up to 200 active members', '6 staff accounts & 10 trainers', 'WhatsApp notices & receipts', 'Financial reports & analytics'],
    icon: Users,
  },
  {
    id: 'growth',
    name: 'Growth Plan',
    members: '400 Members',
    price: 'Rs. 5,000',
    period: 'per month',
    badge: 'Most Popular',
    popular: true,
    description: 'Designed for rapidly growing gyms needing higher member capacity.',
    features: ['Up to 400 active members', '10 staff accounts & 20 trainers', 'WhatsApp notifications', 'Full business analytics', 'Online fee collection'],
    icon: Zap,
  },
  {
    id: 'pro',
    name: 'Pro Unlimited',
    members: 'Unlimited Members',
    price: 'Rs. 8,000',
    period: 'per month',
    badge: 'Full Power',
    description: 'Complete gym automation with biometric door hardware and unlimited capacity.',
    features: ['Unlimited members & trainers', 'Biometric fingerprint check-in', 'Online fees (JazzCash / EasyPaisa)', '25 staff accounts & priority support'],
    icon: Sparkles,
  },
];

export default function Register() {
  const [form, setForm] = useState<RegisterForm>({
    gymName: '',
    ownerName: '',
    email: '',
    password: '',
    phone: '',
    plan: 'growth', // default to popular growth plan
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const set = (key: keyof RegisterForm) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const selectPlan = (plan: GymPlan) => {
    setForm(f => ({ ...f, plan }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post<AuthResponse>('/auth/register', form);
      login(data.user, data.gym);
      toast.success('Gym registered successfully! Welcome aboard.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(apiError(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-slate-950 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Dumbbell size={22} />
            </div>
            <span className="text-2xl font-black tracking-tight text-gray-900 dark:text-slate-100">GymPro</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">
            Register Your Gym
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm sm:text-base">
            {SUBSCRIPTIONS_ENABLED
              ? 'Select your member capacity plan and start managing your gym effortlessly'
              : 'Create your account and start managing your gym effortlessly'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Choose Plan — skipped while subscriptions are switched off */}
          {SUBSCRIPTIONS_ENABLED && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center">1</span>
                  Select Subscription Plan
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                  Choose the plan that best fits your gym size. You can upgrade anytime.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {PLAN_OPTIONS.map((opt) => {
                const isSelected = form.plan === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => selectPlan(opt.id)}
                    className={`relative text-left rounded-xl p-4 transition-all border flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 ring-2 ring-blue-500/20 shadow-sm'
                        : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
                    }`}
                  >
                    {opt.badge && (
                      <span className={`absolute -top-2.5 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        opt.popular
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-emerald-600 text-white'
                      }`}>
                        {opt.badge}
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
                        }`}>
                          <Icon size={16} />
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-gray-300 dark:border-slate-700'
                        }`}>
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>

                      <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                        {opt.name}
                      </h3>
                      
                      <div className="mt-1">
                        <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                          {opt.members}
                        </span>
                      </div>

                      <div className="mt-2 text-xs">
                        <span className="text-lg font-black text-gray-900 dark:text-slate-100">
                          {opt.price}
                        </span>
                        <span className="text-gray-500 dark:text-slate-400 ml-1">
                          /{opt.period.includes('trial') ? 'trial' : 'mo'}
                        </span>
                      </div>

                      <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-2 line-clamp-2">
                        {opt.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/80 space-y-1">
                      {opt.features.slice(0, 3).map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-slate-300">
                          <Check size={12} className="text-emerald-500 shrink-0" />
                          <span className="truncate">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* Step 2: Gym Details */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center">{SUBSCRIPTIONS_ENABLED ? 2 : 1}</span>
              Gym & Owner Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Gym Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.gymName}
                  onChange={set('gymName')}
                  placeholder="e.g. Iron Strong Fitness"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Owner Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.ownerName}
                  onChange={set('ownerName')}
                  placeholder="e.g. Faisal Ghafoor"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={set('email')}
                  placeholder="owner@yourgym.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="0300 1234567"
                  className={inputClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Account Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Minimum 8 characters"
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  Make sure your password is secure and at least 8 characters long.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              {SUBSCRIPTIONS_ENABLED ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                  <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                  <span>Selected: <strong className="text-gray-900 dark:text-slate-200">{PLAN_OPTIONS.find(p => p.id === form.plan)?.name} ({PLAN_OPTIONS.find(p => p.id === form.plan)?.members})</strong></span>
                </div>
              ) : <span />}

              <button
                type="submit"
                disabled={loading}
                className={`w-full sm:w-auto px-8 ${primaryButton}`}
              >
                {loading ? 'Creating account...' : 'Create Account & Continue'}
              </button>
            </div>
          </div>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
