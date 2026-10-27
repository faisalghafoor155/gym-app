import { useState, useEffect } from 'react';
import { Crown, CheckCircle2, ArrowRight, RefreshCw, Building2 } from 'lucide-react';
import api, { apiError } from '../../api/client';
import { Card, Spinner, primaryButton } from '../ui';
import toast from 'react-hot-toast';
import type { GymPlan } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface PendingRequest {
  invoiceId: string;
  gymId: string;
  gymName: string;
  ownerName: string;
  email: string;
  phone: string | null;
  currentPlan: GymPlan;
  currentPlanLabel: string;
  requestedPlan: GymPlan;
  requestedPlanLabel: string;
  amount: number;
  issuedAt: string;
  dueDate: string;
}

interface GymSummary {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string | null;
  plan: GymPlan;
  planLabel: string;
  activeMembers: number;
}

interface AdminBillingResponse {
  isMasterAdmin: boolean;
  pendingRequests: PendingRequest[];
  allGyms: GymSummary[];
}

export default function AdminBillingPanel({ onApproved }: { onApproved?: () => void }) {
  const { t } = useLanguage();
  const [data, setData] = useState<AdminBillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [selectedGymId, setSelectedGymId] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<GymPlan>('growth');
  const [savingPlan, setSavingPlan] = useState(false);

  const fetchAdminData = async () => {
    try {
      const res = await api.get<AdminBillingResponse>('/billing/admin/requests');
      setData(res.data);
      if (res.data.allGyms && res.data.allGyms.length > 0 && !selectedGymId) {
        setSelectedGymId(res.data.allGyms[0].id);
      }
    } catch {
      // Non-admins will get 403 or empty data, gracefully ignore
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAdminData();
  }, []);

  if (loading) return null;
  if (!data || !data.isMasterAdmin) return null;

  const handleApprove = async (req: PendingRequest) => {
    setApprovingId(req.invoiceId);
    try {
      await api.post('/billing/admin/approve', { invoiceId: req.invoiceId });
      toast.success(t('Plan activated for {gym}! {plan} is now live.', { gym: req.gymName, plan: req.requestedPlanLabel }));
      await fetchAdminData();
      if (onApproved) onApproved();
    } catch (err) {
      toast.error(apiError(err, t('Failed to approve subscription')));
    } finally {
      setApprovingId(null);
    }
  };

  const handleSetPlan = async () => {
    if (!selectedGymId) return;
    setSavingPlan(true);
    try {
      await api.post('/billing/admin/set-plan', { gymId: selectedGymId, plan: selectedPlan });
      toast.success(t('Gym plan updated successfully!'));
      await fetchAdminData();
      if (onApproved) onApproved();
    } catch (err) {
      toast.error(apiError(err, t('Failed to update plan')));
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <Card className="p-6 mb-8 border-2 border-amber-500/40 dark:border-amber-500/30 bg-gradient-to-br from-amber-50/40 via-white to-white dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 shadow-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-amber-200/60 dark:border-amber-500/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Crown size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-gray-900 dark:text-slate-100">
                {t('Master Platform Admin')}
              </h2>
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                {t('Super Admin Access')}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
              {t('Review and approve incoming gym subscription requests or directly grant plan access.')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { setLoading(true); void fetchAdminData(); }}
          className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-100/50 dark:hover:bg-amber-500/10 transition-colors"
        >
          <RefreshCw size={13} />
          {t('Refresh Requests')}
        </button>
      </div>

      {/* Section 1: Pending Upgrade Requests */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-200 flex items-center gap-2">
            {t('Incoming Upgrade Requests')}
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              data.pendingRequests.length > 0
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
            }`}>
              {t('{count} Pending', { count: data.pendingRequests.length })}
            </span>
          </h3>
        </div>

        {data.pendingRequests.length === 0 ? (
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 text-center py-6 text-xs text-gray-500 dark:text-slate-400">
            {t('No pending plan requests right now. When a gym requests an upgrade, it will appear here for one-click approval.')}
          </div>
        ) : (
          <div className="space-y-3">
            {data.pendingRequests.map((req) => (
              <div
                key={req.invoiceId}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-gray-900 dark:text-slate-100">
                      {req.gymName}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium">
                      {t('Owner: {name}', { name: req.ownerName })}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {t('Email:')} <strong>{req.email}</strong> {req.phone ? `· ${t('Phone: {phone}', { phone: req.phone })}` : ''}
                  </p>

                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className="text-gray-400">{t('Current:')}</span>
                    <span className="font-semibold text-gray-700 dark:text-slate-300">{req.currentPlanLabel}</span>
                    <ArrowRight size={14} className="text-amber-500" />
                    <span className="text-gray-400">{t('Requested:')}</span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-400">{req.requestedPlanLabel}</span>
                    <span className="font-black text-gray-900 dark:text-slate-100 ml-2">
                      (Rs. {req.amount.toLocaleString('en-PK')})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={approvingId === req.invoiceId}
                    onClick={() => handleApprove(req)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                  >
                    {approvingId === req.invoiceId ? (
                      <Spinner className="w-4 h-4 text-white" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    {t('Accept & Activate Plan')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Direct Gym Plan Override / Management */}
      <div className="pt-5 border-t border-gray-100 dark:border-slate-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-200 mb-3 flex items-center gap-2">
          <Building2 size={16} className="text-blue-500" />
          {t('Direct Gym Plan Manager (Instant Override)')}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
              {t('Select Gym')}
            </label>
            <select
              value={selectedGymId}
              onChange={(e) => setSelectedGymId(e.target.value)}
              className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {data.allGyms.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.planLabel}) — {t('{count} Members', { count: g.activeMembers })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
              {t('Assign Plan')}
            </label>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value as GymPlan)}
              className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="free">{t('Free Trial (50 Members)')}</option>
              <option value="basic">{t('Starter Plan (200 Members)')}</option>
              <option value="growth">{t('Growth Plan (400 Members)')}</option>
              <option value="pro">{t('Pro Plan (Unlimited Members)')}</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              disabled={savingPlan || !selectedGymId}
              onClick={handleSetPlan}
              className={`w-full py-2 text-xs font-bold ${primaryButton} flex items-center justify-center gap-1.5`}
            >
              {savingPlan ? t('Updating...') : t('Assign Plan Instantly')}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
