import { useEffect, useState, type FormEvent } from 'react';
import { Plus, ClipboardList, Dumbbell, Utensils, UserPlus } from 'lucide-react';
import Modal from '../components/Modal';
import {
  Page, PageHeader, Card, PageLoader, EmptyState, SegmentedControl, FieldLabel,
  inputClass, primaryButton, secondaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import type { Plan, Member, Paginated } from '../types';
import toast from 'react-hot-toast';

type Tab = 'workout' | 'diet';

const TABS = [
  { value: 'workout' as const, label: 'Workout' },
  { value: 'diet' as const, label: 'Diet' },
];

export default function Plans() {
  const [tab, setTab] = useState<Tab>('workout');
  const [workoutPlans, setWorkoutPlans] = useState<Plan[]>([]);
  const [dietPlans, setDietPlans] = useState<Plan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [assignForm, setAssignForm] = useState({ memberId: '', workoutPlanId: '', dietPlanId: '' });
  const [saving, setSaving] = useState(false);

  const load = () =>
    Promise.all([
      api.get<Plan[]>('/plans/workout').then(r => setWorkoutPlans(r.data)),
      api.get<Plan[]>('/plans/diet').then(r => setDietPlans(r.data)),
      // The assign-to picker has to offer everyone, not the first page.
      api.get<Paginated<Member>>('/members?all=true').then(r => setMembers(r.data.data)),
    ])
      .catch(err => toast.error(apiError(err, 'Could not load plans')))
      .finally(() => setLoading(false));

  useEffect(() => { void load(); }, []);

  const plans = tab === 'workout' ? workoutPlans : dietPlans;
  const TabIcon = tab === 'workout' ? Dumbbell : Utensils;

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/plans/${tab}`, form);
      toast.success('Plan created');
      setShowCreate(false);
      setForm({ name: '', description: '' });
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not create the plan'));
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Assigning nothing to nothing is a no-op the API would happily accept, so
    // it is caught here rather than reported as a success.
    if (!assignForm.workoutPlanId && !assignForm.dietPlanId) {
      toast.error('Pick a workout plan, a diet plan, or both');
      return;
    }
    setSaving(true);
    try {
      // The API rejects "" for the optional plan ids, so drop the empty ones.
      await api.post('/plans/assign', {
        memberId: assignForm.memberId,
        ...(assignForm.workoutPlanId && { workoutPlanId: assignForm.workoutPlanId }),
        ...(assignForm.dietPlanId && { dietPlanId: assignForm.dietPlanId }),
      });
      toast.success('Plans assigned to member');
      setShowAssign(false);
      setAssignForm({ memberId: '', workoutPlanId: '', dietPlanId: '' });
    } catch (err) {
      toast.error(apiError(err, 'Could not assign the plan'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <Page>
      <PageHeader
        icon={ClipboardList}
        title="Plans"
        subtitle="What members train to and eat by"
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowAssign(true)} className={secondaryButton}>
              <UserPlus size={15} />
              <span className="hidden sm:inline">Assign to Member</span>
              <span className="sm:hidden">Assign</span>
            </button>
            <button onClick={() => setShowCreate(true)} className={primaryButton}>
              <Plus size={16} />
              <span className="hidden sm:inline">New Plan</span><span className="sm:hidden">New</span>
            </button>
          </div>
        }
      />

      <div className="mb-5">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { ...TABS[0]!, count: workoutPlans.length },
            { ...TABS[1]!, count: dietPlans.length },
          ]}
        />
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={TabIcon}
          title={`No ${tab} plans yet`}
          hint={tab === 'workout'
            ? 'Write the routines your trainers hand out, then assign them to members.'
            : 'Write the meal plans your trainers hand out, then assign them to members.'}
          action={
            <button onClick={() => setShowCreate(true)} className={primaryButton}>
              <Plus size={16} /> Create a {tab} plan
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map(p => (
            <Card key={p.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  tab === 'workout' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                }`}>
                  <TabIcon size={16} />
                </div>
                <h3 className="font-bold text-gray-900 min-w-0 truncate pt-1.5">{p.name}</h3>
              </div>
              <p className="text-sm text-gray-500 whitespace-pre-wrap wrap-break-word">
                {p.description || 'No description'}
              </p>
              <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
                Added {new Date(p.createdAt).toLocaleDateString()}
              </p>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title={`Create ${tab === 'workout' ? 'Workout' : 'Diet'} Plan`} onClose={() => setShowCreate(false)}>
          <form onSubmit={e => void handleCreate(e)} className="space-y-4">
            <div>
              <FieldLabel required>Plan Name</FieldLabel>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inputClass} placeholder="e.g. Beginner Weight Loss" />
            </div>
            <div>
              <FieldLabel>Description</FieldLabel>
              <textarea rows={5} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className={`${inputClass} resize-none`}
                placeholder="Describe the exercises, meals, or schedule..." />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)}
                className={`flex-1 ${secondaryButton}`}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
                {saving ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showAssign && (
        <Modal title="Assign Plan to Member" onClose={() => setShowAssign(false)}>
          <form onSubmit={e => void handleAssign(e)} className="space-y-4">
            <div>
              <FieldLabel required>Member</FieldLabel>
              <select required value={assignForm.memberId}
                onChange={e => setAssignForm(f => ({ ...f, memberId: e.target.value }))}
                className={inputClass}>
                <option value="">Select member...</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.phone ? ` · ${m.phone}` : ''}
                  </option>
                ))}
              </select>
              {members.length === 0 && (
                <p className="text-xs text-yellow-700 mt-1.5">
                  No members yet — add a member before assigning a plan.
                </p>
              )}
            </div>
            <div>
              <FieldLabel>Workout Plan</FieldLabel>
              <select value={assignForm.workoutPlanId}
                onChange={e => setAssignForm(f => ({ ...f, workoutPlanId: e.target.value }))}
                className={inputClass}>
                <option value="">None</option>
                {workoutPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Diet Plan</FieldLabel>
              <select value={assignForm.dietPlanId}
                onChange={e => setAssignForm(f => ({ ...f, dietPlanId: e.target.value }))}
                className={inputClass}>
                <option value="">None</option>
                {dietPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAssign(false)}
                className={`flex-1 ${secondaryButton}`}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
                {saving ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Page>
  );
}
