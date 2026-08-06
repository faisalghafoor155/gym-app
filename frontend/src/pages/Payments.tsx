import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import api, { apiError } from '../api/client';
import type { Payment, Member, PaymentMethod, PaymentStatus } from '../types';
import toast from 'react-hot-toast';

interface PaymentForm {
  memberId: string;
  amount: string;
  method: PaymentMethod;
  notes: string;
  status: PaymentStatus;
}

const emptyForm: PaymentForm = {
  memberId: '', amount: '', method: 'cash', notes: '', status: 'paid',
};

type Filter = 'all' | PaymentStatus;

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = (status: Filter) => {
    const query = status !== 'all' ? `?status=${status}` : '';
    return api.get<Payment[]>(`/payments${query}`)
      .then(r => setPayments(r.data))
      .catch(err => toast.error(apiError(err, 'Could not load payments')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { void load(filter); }, [filter]);

  // The member list never changes with the filter, so it loads once.
  useEffect(() => {
    api.get<Member[]>('/members')
      .then(r => setMembers(r.data))
      .catch(() => { /* the payments error toast already covers a dead API */ });
  }, []);

  const set = (k: keyof PaymentForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/payments', form);
      toast.success('Payment recorded');
      setShowModal(false);
      setForm(emptyForm);
      await load(filter);
    } catch (err) {
      toast.error(apiError(err, 'Could not record the payment'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Payments</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">
          <Plus size={16} /> <span className="hidden sm:inline">Record Payment</span><span className="sm:hidden">Record</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'paid', 'due'] as const).map(f => (
          <button key={f} onClick={() => { setFilter(f); setLoading(true); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {payments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="font-medium">No payments found</p>
        </div>
      ) : (
        <>
          {/* Mobile: cards — a six-column table cannot fit a phone screen */}
          <div className="space-y-3 md:hidden">
            {payments.map(p => (
              <div key={p.id} className={`bg-white rounded-xl border p-4 ${
                p.status === 'due' ? 'border-red-200 bg-red-50/40' : 'border-gray-200'
              }`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-semibold text-gray-900 truncate">{p.member.name}</p>
                  <p className="font-bold text-gray-900 shrink-0">Rs. {p.amount.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge status={p.status} />
                  <Badge status={p.method} />
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(p.paymentDate).toLocaleDateString()}
                  </span>
                </div>
                {p.notes && <p className="text-xs text-gray-500 mt-2">{p.notes}</p>}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Member', 'Amount', 'Method', 'Date', 'Status', 'Notes'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 ${p.status === 'due' ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.member.name}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">Rs. {p.amount.toLocaleString()}</td>
                    <td className="px-4 py-3"><Badge status={p.method} /></td>
                    <td className="px-4 py-3 text-gray-500">{new Date(p.paymentDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3"><Badge status={p.status} /></td>
                    <td className="px-4 py-3 text-gray-500">{p.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showModal && (
        <Modal title="Record Payment" onClose={() => setShowModal(false)}>
          <form onSubmit={e => void handleSave(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Member *</label>
              <select required value={form.memberId} onChange={set('memberId')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select member...</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.) *</label>
              <input type="number" required min="1" value={form.amount} onChange={set('amount')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="2500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                <select value={form.method} onChange={set('method')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="cash">Cash</option>
                  <option value="online">Online</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={set('status')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="paid">Paid</option>
                  <option value="due">Due</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={set('notes')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional note..." />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Saving...' : 'Record'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
