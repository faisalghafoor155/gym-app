import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Award, IndianRupee, BookOpen, Clock } from 'lucide-react';
import Badge from '../components/Badge';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, PageLoader, EmptyState, SegmentedControl,
  FieldLabel, inputClass, primaryButton, secondaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import toast from 'react-hot-toast';
import type { Trainer, PtSession, TrainerCommissionReport, Member, GymSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';


interface TrainerForm {
  name: string;
  phone: string;
  specialization: string;
  commissionPercentage: number;
  /** Empty means "use the gym default", which is not the same as 0. */
  ptFee: string;
}

const emptyTrainerForm: TrainerForm = {
  name: '',
  phone: '',
  specialization: '',
  commissionPercentage: 10,
  ptFee: '',
};

interface PtSessionForm {
  memberId: string;
  trainerId: string;
  sessionDate: string;
  priceCharged: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid';
}

const emptyPtForm = (): PtSessionForm => ({
  memberId: '',
  trainerId: '',
  sessionDate: new Date().toISOString().substring(0, 16),
  priceCharged: 2000,
  status: 'scheduled',
  paymentStatus: 'unpaid',
});

type TabType = 'trainers' | 'bookings' | 'commissions' | 'payouts';

export default function Trainers() {
  const { user } = useAuth();
  const canViewPayouts = hasPermission(user?.role || null, user?.staffPermission, 'canViewPayments');
  const canManagePayouts = hasPermission(user?.role || null, user?.staffPermission, 'canManagePayments');

  const [activeTab, setActiveTab] = useState<TabType>('trainers');
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [sessions, setSessions] = useState<PtSession[]>([]);
  const [report, setReport] = useState<TrainerCommissionReport[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [members, setMembers] = useState<Member[]>([]);


  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals state
  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [editingTrainerId, setEditingTrainerId] = useState<string | null>(null);
  const [trainerForm, setTrainerForm] = useState<TrainerForm>(emptyTrainerForm);

  const [showPtModal, setShowPtModal] = useState(false);
  const [ptForm, setPtForm] = useState<PtSessionForm>(emptyPtForm());

  const [deactivatingTrainer, setDeactivatingTrainer] = useState<Trainer | null>(null);
  const [gymDefaultPtFee, setGymDefaultPtFee] = useState<number | null>(null);

  const loadData = async (isStale: () => boolean = () => false) => {
    try {
      const [tRes, mRes, settingsRes] = await Promise.all([
        api.get<Trainer[]>('/trainers'),
        api.get<{ data: Member[] }>('/members?all=true'),
        // Shown as the placeholder on a blank fee field, so "leave blank" says
        // what it will actually charge rather than leaving staff to guess.
        api.get<GymSettings>('/gym-settings'),
      ]);
      if (isStale()) return;
      setTrainers(tRes.data.filter(t => t.isActive));
      setMembers(mRes.data.data);
      setGymDefaultPtFee(settingsRes.data.defaultPtFee);

      if (activeTab === 'bookings') {
        const sRes = await api.get<PtSession[]>('/pt-sessions');
        if (isStale()) return;
        setSessions(sRes.data);
      } else if (activeTab === 'commissions') {
        const rRes = await api.get<TrainerCommissionReport[]>('/pt-sessions/commissions');
        if (isStale()) return;
        setReport(rRes.data);
      } else if (activeTab === 'payouts' && canViewPayouts) {
        const pRes = await api.get<any[]>('/payouts');
        if (isStale()) return;
        setPayouts(pRes.data);
      }
    } catch (err) {
      if (!isStale()) toast.error(apiError(err, 'Failed to fetch data'));
    } finally {
      if (!isStale()) setLoading(false);
    }
  };

  useEffect(() => {
    // Switching tabs mid-load must not let the old tab's rows land under the
    // new one — the sessions and commissions calls are issued per tab.
    let cancelled = false;
    setLoading(true);
    void loadData(() => cancelled);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleTrainerSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // A blank field means "use the gym default" and has to reach the API as
      // null; Number('') would send 0, which means "charge nothing" instead.
      const payload = {
        ...trainerForm,
        ptFee: trainerForm.ptFee.trim() === '' ? null : Number(trainerForm.ptFee),
      };
      if (editingTrainerId) {
        await api.put(`/trainers/${editingTrainerId}`, payload);
        toast.success('Trainer updated');
      } else {
        await api.post('/trainers', payload);
        toast.success('Trainer added successfully');
      }
      setShowTrainerModal(false);
      setTrainerForm(emptyTrainerForm);
      setEditingTrainerId(null);
      await loadData();
    } catch (err) {
      toast.error(apiError(err, 'Error saving trainer'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivatingTrainer) return;
    setSaving(true);
    try {
      await api.delete(`/trainers/${deactivatingTrainer.id}`);
      toast.success('Trainer deactivated successfully');
      setDeactivatingTrainer(null);
      await loadData();
    } catch (err) {
      toast.error(apiError(err, 'Failed to deactivate trainer'));
    } finally {
      setSaving(false);
    }
  };

  const handlePtSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/pt-sessions', ptForm);
      toast.success('PT Session logged successfully');
      setShowPtModal(false);
      setPtForm(emptyPtForm());
      await loadData();
    } catch (err) {
      toast.error(apiError(err, 'Error logging session'));
    } finally {
      setSaving(false);
    }
  };

  const updateSessionStatus = async (sessionId: string, status: 'completed' | 'cancelled') => {
    try {
      await api.put(`/pt-sessions/${sessionId}`, { status });
      toast.success('Session status updated');
      await loadData();
    } catch (err) {
      toast.error(apiError(err, 'Failed to update session'));
    }
  };

  const updateSessionPayment = async (sessionId: string, paymentStatus: 'paid') => {
    try {
      await api.put(`/pt-sessions/${sessionId}`, { paymentStatus });
      toast.success('Session marked as paid (payment logged)');
      await loadData();
    } catch (err) {
      toast.error(apiError(err, 'Failed to update payment status'));
    }
  };

  const payTrainer = async (trainerId: string) => {
    setSaving(true);
    try {
      await api.post(`/payouts/${trainerId}/pay`);
      toast.success('Trainer payout marked as paid');
      await loadData();
    } catch (err) {
      toast.error(apiError(err, 'Failed to process trainer payout'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <Page>
      <PageHeader
        icon={Award}
        title="Personal Training & Staff"
        subtitle="Manage personal trainers, schedule 1-on-1 PT sessions, and track payouts."
        action={
          activeTab === 'trainers' ? (
            <button
              onClick={() => {
                setEditingTrainerId(null);
                setTrainerForm(emptyTrainerForm);
                setShowTrainerModal(true);
              }}
              className={primaryButton}
            >
              <Plus size={16} /> Add Trainer
            </button>
          ) : (
            <button
              onClick={() => {
                setPtForm(emptyPtForm());
                setShowPtModal(true);
              }}
              className={primaryButton}
            >
              <Plus size={16} /> Book PT Session
            </button>
          )
        }
      />

      <Card className="p-4 mb-6">
        <SegmentedControl
          value={activeTab}
          onChange={v => setActiveTab(v as TabType)}
          options={[
            { value: 'trainers', label: 'Trainers Roster' },
            { value: 'bookings', label: 'PT Bookings & Logs' },
            { value: 'commissions', label: 'Trainer Commissions' },
            ...(canViewPayouts ? [{ value: 'payouts', label: 'Payouts Tracker' }] : []),
          ]}
        />
      </Card>

      {/* TAB 1: Trainers Roster */}
      {activeTab === 'trainers' && (
        trainers.length === 0 ? (
          <EmptyState
            icon={Award}
            title="No trainers found"
            hint="Create trainer profiles to assign them to gym members."
            action={
              <button
                onClick={() => {
                  setEditingTrainerId(null);
                  setTrainerForm(emptyTrainerForm);
                  setShowTrainerModal(true);
                }}
                className={primaryButton}
              >
                Add first trainer
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {trainers.map(t => (
              <Card key={t.id} className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">{t.name}</h3>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                        {t.specialization || 'General Fitness'}
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                      {t.commissionPercentage}% Comm.
                    </span>
                  </div>

                  <div className="mt-5 space-y-2 text-sm text-gray-600 dark:text-slate-400">
                    <p className="flex items-center gap-2">
                      <span className="text-gray-400">📞</span> {t.phone || 'No phone number'}
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-gray-400">👥</span> {t.activeMembersCount} Active Members Assigned
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-gray-400">💰</span>
                      {t.ptFee === null
                        ? `Assignment fee: gym default${gymDefaultPtFee === null ? '' : ` (Rs. ${gymDefaultPtFee.toLocaleString()})`}`
                        : t.ptFee === 0
                          ? 'Assignment fee: none'
                          : `Assignment fee: Rs. ${t.ptFee.toLocaleString()}`}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 flex gap-3">
                  <button
                    onClick={() => {
                      setEditingTrainerId(t.id);
                      setTrainerForm({
                        name: t.name,
                        phone: t.phone || '',
                        specialization: t.specialization || '',
                        commissionPercentage: t.commissionPercentage,
                        // Null becomes the empty field that means "use the gym
                        // default"; a stored 0 becomes "0", because charging
                        // nothing is a real choice and must not read back as
                        // an unset field.
                        ptFee: t.ptFee === null ? '' : String(t.ptFee),
                      });
                      setShowTrainerModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    onClick={() => setDeactivatingTrainer(t)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={13} /> Deactivate
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* TAB 2: Bookings & Sessions */}
      {activeTab === 'bookings' && (
        sessions.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No PT sessions booked yet"
            hint="Click Book PT Session to record training slots."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500 dark:text-slate-400">
                <thead className="text-xs uppercase bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300 border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-4 font-bold">Member</th>
                    <th className="px-6 py-4 font-bold">Trainer</th>
                    <th className="px-6 py-4 font-bold">Date & Time</th>
                    <th className="px-6 py-4 font-bold">Price</th>
                    <th className="px-6 py-4 font-bold">Trainer Comm.</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold">Payment</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {sessions.map(s => {
                    const sessionDate = new Date(s.sessionDate);
                    return (
                      <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/20">
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-200">
                          {s.member.name}
                        </td>
                        <td className="px-6 py-4">
                          {s.trainer.name}
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1.5">
                            <Clock size={13} className="text-gray-400" />
                            {sessionDate.toLocaleDateString()} {sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-slate-200">
                          Rs. {s.priceCharged.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-indigo-600 dark:text-indigo-400 font-semibold">
                          Rs. {s.trainerCommission.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <Badge status={s.status} />
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            s.paymentStatus === 'paid'
                              ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                              : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400'
                          }`}>
                            {s.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {s.status === 'scheduled' && (
                            <>
                              <button
                                onClick={() => updateSessionStatus(s.id, 'completed')}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/30 dark:hover:bg-green-950/50 dark:text-green-400"
                              >
                                Complete
                              </button>
                              <button
                                onClick={() => updateSessionStatus(s.id, 'cancelled')}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/30 dark:hover:bg-red-950/50 dark:text-red-400"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {s.paymentStatus === 'unpaid' && (
                            <button
                              onClick={() => updateSessionPayment(s.id, 'paid')}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 dark:text-indigo-400"
                            >
                              Mark Paid
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* TAB 3: Commissions & Revenue Split */}
      {activeTab === 'commissions' && (
        report.length === 0 ? (
          <EmptyState
            icon={IndianRupee}
            title="No commission records"
            hint="Complete PT sessions to see commission payouts."
          />
        ) : (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-slate-400">
                  <thead className="text-xs uppercase bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300 border-b border-gray-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4 font-bold">Trainer</th>
                      <th className="px-6 py-4 font-bold">Rate</th>
                      <th className="px-6 py-4 font-bold">Sessions Completed</th>
                      <th className="px-6 py-4 font-bold">Gross Revenue</th>
                      <th className="px-6 py-4 font-bold">Trainer Share</th>
                      <th className="px-6 py-4 font-bold text-right">Gym Net Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                    {report.map(r => {
                      const gymShare = r.totalRevenue - r.totalCommission;
                      return (
                        <tr key={r.trainerId} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/20">
                          <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-200">
                            {r.trainerName}
                          </td>
                          <td className="px-6 py-4">
                            {r.commissionPercentage}%
                          </td>
                          <td className="px-6 py-4 font-medium">
                            {r.totalSessions} sessions
                          </td>
                          <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-200">
                            Rs. {r.totalRevenue.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-red-600 dark:text-red-400 font-bold">
                            Rs. {r.totalCommission.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right text-green-700 dark:text-green-400 font-extrabold">
                            Rs. {gymShare.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )
      )}

      {/* TAB 4: Payouts Tracker */}
      {activeTab === 'payouts' && (
        payouts.length === 0 ? (
          <EmptyState
            icon={IndianRupee}
            title="No payouts found"
            hint="Create trainers and complete sessions to track payouts."
          />
        ) : (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-slate-400">
                  <thead className="text-xs uppercase bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300 border-b border-gray-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4 font-bold">Trainer</th>
                      <th className="px-6 py-4 font-bold">Rate</th>
                      <th className="px-6 py-4 font-bold">Total Sessions</th>
                      <th className="px-6 py-4 font-bold">Total Earned</th>
                      <th className="px-6 py-4 font-bold text-green-600">Paid</th>
                      <th className="px-6 py-4 font-bold text-yellow-600">Unpaid</th>
                      <th className="px-6 py-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                    {payouts.map(p => (
                      <tr key={p.trainerId} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/20">
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-200">
                          {p.trainerName}
                        </td>
                        <td className="px-6 py-4">
                          {p.commissionPercentage}%
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {p.totalSessionsCount} sessions
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-200">
                          Rs. {p.totalEarned.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-green-700 dark:text-green-400 font-bold">
                          Rs. {p.paidCommission.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-yellow-700 dark:text-yellow-400 font-bold">
                          Rs. {p.unpaidCommission.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {p.unpaidCommission > 0 ? (
                            canManagePayouts ? (
                              <button
                                onClick={() => void payTrainer(p.trainerId)}
                                disabled={saving}
                                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800 disabled:opacity-50"
                              >
                                Clear Unpaid
                              </button>
                            ) : (
                              <span className="text-xs text-yellow-600 font-semibold">Unpaid</span>
                            )
                          ) : (
                            <span className="text-xs text-gray-400 font-semibold">Fully Paid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )
      )}

      {/* MODAL: Trainer Add/Edit */}
      {showTrainerModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-4">
              {editingTrainerId ? 'Edit Trainer Profile' : 'Add New Trainer'}
            </h3>
            <form onSubmit={handleTrainerSave} className="space-y-4">
              <div>
                <FieldLabel>Full Name</FieldLabel>
                <input
                  required
                  value={trainerForm.name}
                  onChange={e => setTrainerForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Trainer Zain"
                  className={inputClass}
                />
              </div>

              <div>
                <FieldLabel>Phone Number</FieldLabel>
                <input
                  value={trainerForm.phone}
                  onChange={e => setTrainerForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. 03001234567"
                  className={inputClass}
                />
              </div>

              <div>
                <FieldLabel>Specialization / Skills</FieldLabel>
                <input
                  value={trainerForm.specialization}
                  onChange={e => setTrainerForm(prev => ({ ...prev, specialization: e.target.value }))}
                  placeholder="e.g. Bodybuilding, Yoga, Strength Training"
                  className={inputClass}
                />
              </div>

              <div>
                <FieldLabel>Trainer Commission Percentage (%)</FieldLabel>
                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  value={trainerForm.commissionPercentage}
                  onChange={e => setTrainerForm(prev => ({ ...prev, commissionPercentage: Number(e.target.value) }))}
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1">Trainer earns this percentage on every personal training session booked.</p>
              </div>

              <div>
                <FieldLabel>Assignment Fee (Rs.)</FieldLabel>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Gym default${gymDefaultPtFee === null ? '' : ` — Rs. ${gymDefaultPtFee.toLocaleString()}`}`}
                  value={trainerForm.ptFee}
                  onChange={e => setTrainerForm(prev => ({ ...prev, ptFee: e.target.value }))}
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Charged once when this trainer is assigned to a member. Leave blank to use the
                  gym default; enter 0 to charge nothing.
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowTrainerModal(false)}
                  className={secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={primaryButton}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Book PT Session */}
      {showPtModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-4">Book Personal Training Session</h3>
            <form onSubmit={handlePtSave} className="space-y-4">
              <div>
                <FieldLabel>Select Member</FieldLabel>
                <select
                  required
                  value={ptForm.memberId}
                  onChange={e => setPtForm(prev => ({ ...prev, memberId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">-- Choose Member --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.memberNo})</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Select Trainer</FieldLabel>
                <select
                  required
                  value={ptForm.trainerId}
                  onChange={e => setPtForm(prev => ({ ...prev, trainerId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">-- Choose Trainer --</option>
                  {trainers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.commissionPercentage}% Comm)</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Session Date & Time</FieldLabel>
                <input
                  required
                  type="datetime-local"
                  value={ptForm.sessionDate}
                  onChange={e => setPtForm(prev => ({ ...prev, sessionDate: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <FieldLabel>Price Charged (Rs.)</FieldLabel>
                <input
                  required
                  type="number"
                  min="0"
                  value={ptForm.priceCharged}
                  onChange={e => setPtForm(prev => ({ ...prev, priceCharged: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Initial Status</FieldLabel>
                  <select
                    value={ptForm.status}
                    onChange={e => setPtForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className={inputClass}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Payment</FieldLabel>
                  <select
                    value={ptForm.paymentStatus}
                    onChange={e => setPtForm(prev => ({ ...prev, paymentStatus: e.target.value as any }))}
                    className={inputClass}
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowPtModal(false)}
                  className={secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={primaryButton}
                >
                  {saving ? 'Booking…' : 'Book Session'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Confirm Deactivate Dialog */}
      {!!deactivatingTrainer && (
        <ConfirmDialog
          title="Deactivate Trainer"
          message={`Are you sure you want to deactivate trainer ${deactivatingTrainer.name}? They will no longer be available for assigning new members or scheduling sessions, but all historical commissions will remain intact.`}
          confirmLabel="Deactivate"
          onConfirm={handleDeactivate}
          onCancel={() => setDeactivatingTrainer(null)}
          busy={saving}
          tone="danger"
        />
      )}
    </Page>
  );
}
