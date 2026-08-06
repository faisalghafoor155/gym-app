import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import Modal from '../components/Modal';
import api, { apiError } from '../api/client';
import type { Plan, Member } from '../types';
import toast from 'react-hot-toast';

type Tab = 'workout' | 'diet';

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
      api.get<Member[]>('/members').then(r => setMembers(r.data)),
    ])
      .catch(err => toast.error(apiError(err, 'Could not load plans')))
      .finally(() => setLoading(false));

  useEffect(() => { void load(); }, []);

  const plans = tab === 'workout' ? workoutPlans : dietPlans;

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Plans</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAssign(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            Assign to Member
          </button>
          <button onClick={() => setShowCreate(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={16} /> New Plan
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(['workout', 'diet'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}>
            {t} Plans
          </button>
        ))}
      </div>

      {plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="font-medium">No {tab} plans yet</p>
          <p className="text-sm mt-1">Create your first plan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-1">{p.name}</h3>
              <p className="text-sm text-gray-500 whitespace-pre-wrap">{p.description || 'No description'}</p>
              <p className="text-xs text-gray-400 mt-3">{new Date(p.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title={`Create ${tab === 'workout' ? 'Workout' : 'Diet'} Plan`} onClose={() => setShowCreate(false)}>
          <form onSubmit={e => void handleCreate(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Beginner Weight Loss" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Describe the exercises, meals, or schedule..." />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Member *</label>
              <select required value={assignForm.memberId} onChange={e => setAssignForm(f => ({ ...f, memberId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select member...</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Workout Plan</label>
              <select value={assignForm.workoutPlanId} onChange={e => setAssignForm(f => ({ ...f, workoutPlanId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">None</option>
                {workoutPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Diet Plan</label>
              <select value={assignForm.dietPlanId} onChange={e => setAssignForm(f => ({ ...f, dietPlanId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">None</option>
                {dietPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAssign(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
