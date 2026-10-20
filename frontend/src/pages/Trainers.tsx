import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Award } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, PageLoader, SegmentedControl, primaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import toast from 'react-hot-toast';
import type {
  Trainer, PtSession, TrainerCommissionReport, TrainerPayout, Member, GymSettings,
  Paginated,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';
import {
  emptyTrainerForm, emptyPtForm, type TrainerForm, type PtSessionForm, type TabType,
} from '../components/trainers/types';
import TrainersRoster from '../components/trainers/TrainersRoster';
import BookingsTab from '../components/trainers/BookingsTab';
import CommissionsTab from '../components/trainers/CommissionsTab';
import PayoutsTab from '../components/trainers/PayoutsTab';
import TrainerModal from '../components/trainers/TrainerModal';
import PtSessionModal from '../components/trainers/PtSessionModal';

export default function Trainers() {
  const { user } = useAuth();
  const canViewPayouts = hasPermission(user?.role || null, user?.staffPermission, 'canViewPayments');
  const canManagePayouts = hasPermission(user?.role || null, user?.staffPermission, 'canManagePayments');

  const [activeTab, setActiveTab] = useState<TabType>('trainers');
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [sessions, setSessions] = useState<PtSession[]>([]);
  const [report, setReport] = useState<TrainerCommissionReport[]>([]);
  const [payouts, setPayouts] = useState<TrainerPayout[]>([]);
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
  /** The payout row awaiting confirmation — clearing it moves money and cannot
   *  be undone from this screen, so it never fires straight off the click. */
  const [payingOut, setPayingOut] = useState<TrainerPayout | null>(null);
  /** A session awaiting cancel confirmation; the button sits beside "Complete". */
  const [cancellingSession, setCancellingSession] = useState<PtSession | null>(null);
  const [gymDefaultPtFee, setGymDefaultPtFee] = useState<number | null>(null);

  const loadData = async (isStale: () => boolean = () => false) => {
    try {
      const [tRes, mRes, settingsRes] = await Promise.all([
        // This page assigns trainers and lists them, so it wants every one —
        // the API defaults to the active ones, which is what it showed before.
        api.get<Paginated<Trainer>>('/trainers?all=true'),
        api.get<Paginated<Member>>('/members?all=true'),
        // Shown as the placeholder on a blank fee field, so "leave blank" says
        // what it will actually charge rather than leaving staff to guess.
        api.get<GymSettings>('/gym-settings'),
      ]);
      if (isStale()) return;
      setTrainers(tRes.data.data);
      setMembers(mRes.data.data);
      setGymDefaultPtFee(settingsRes.data.defaultPtFee);

      if (activeTab === 'bookings') {
        // The session log is paged; this tab shows the most recent page.
        const sRes = await api.get<Paginated<PtSession>>('/pt-sessions');
        if (isStale()) return;
        setSessions(sRes.data.data);
      } else if (activeTab === 'commissions') {
        const rRes = await api.get<TrainerCommissionReport[]>('/pt-sessions/commissions');
        if (isStale()) return;
        setReport(rRes.data);
      } else if (activeTab === 'payouts' && canViewPayouts) {
        const pRes = await api.get<Paginated<TrainerPayout>>('/payouts?all=true');
        if (isStale()) return;
        setPayouts(pRes.data.data);
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

  const payTrainer = async () => {
    if (!payingOut) return;
    setSaving(true);
    try {
      await api.post(`/payouts/${payingOut.trainerId}/pay`);
      toast.success('Trainer payout marked as paid');
      setPayingOut(null);
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
        <TrainersRoster
          trainers={trainers}
          gymDefaultPtFee={gymDefaultPtFee}
          onAdd={() => {
            setEditingTrainerId(null);
            setTrainerForm(emptyTrainerForm);
            setShowTrainerModal(true);
          }}
          onEdit={t => {
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
          onDeactivate={setDeactivatingTrainer}
        />
      )}

      {/* TAB 2: Bookings & Sessions */}
      {activeTab === 'bookings' && (
        <BookingsTab
          sessions={sessions}
          onComplete={id => updateSessionStatus(id, 'completed')}
          onCancel={setCancellingSession}
          onMarkPaid={id => updateSessionPayment(id, 'paid')}
        />
      )}

      {/* TAB 3: Commissions & Revenue Split */}
      {activeTab === 'commissions' && <CommissionsTab report={report} />}

      {/* TAB 4: Payouts Tracker */}
      {activeTab === 'payouts' && (
        <PayoutsTab
          payouts={payouts}
          canManagePayouts={canManagePayouts}
          saving={saving}
          onPayOut={setPayingOut}
        />
      )}

      {/* MODAL: Trainer Add/Edit */}
      {showTrainerModal && (
        <TrainerModal
          editing={!!editingTrainerId}
          form={trainerForm}
          setForm={setTrainerForm}
          gymDefaultPtFee={gymDefaultPtFee}
          saving={saving}
          onSave={handleTrainerSave}
          onClose={() => setShowTrainerModal(false)}
        />
      )}

      {/* MODAL: Book PT Session */}
      {showPtModal && (
        <PtSessionModal
          form={ptForm}
          setForm={setPtForm}
          members={members}
          trainers={trainers}
          saving={saving}
          onSave={handlePtSave}
          onClose={() => setShowPtModal(false)}
        />
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

      {/* Clearing a payout moves money, so the amount and the name are both in
          the question — this is the last point at which a misclick is free. */}
      {!!payingOut && (
        <ConfirmDialog
          title="Clear unpaid commission"
          message={`Mark Rs. ${payingOut.unpaidCommission.toLocaleString()} as paid to ${payingOut.trainerName}? This records the payout against every completed session they are still owed for, and cannot be undone from this page.`}
          confirmLabel="Mark as paid"
          onConfirm={() => void payTrainer()}
          onCancel={() => setPayingOut(null)}
          busy={saving}
          tone="primary"
        />
      )}

      {!!cancellingSession && (
        <ConfirmDialog
          title="Cancel PT session"
          message={`Cancel ${cancellingSession.member.name}'s session with ${cancellingSession.trainer.name} on ${new Date(cancellingSession.sessionDate).toLocaleDateString()}? The trainer earns no commission for a cancelled session.`}
          confirmLabel="Cancel session"
          onConfirm={() => {
            void updateSessionStatus(cancellingSession.id, 'cancelled');
            setCancellingSession(null);
          }}
          onCancel={() => setCancellingSession(null)}
          busy={saving}
          tone="danger"
        />
      )}
    </Page>
  );
}
