import { useEffect, useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Search, User, Phone, Calendar, CreditCard, Camera } from 'lucide-react';
import Badge from '../components/Badge';
import api, { apiError } from '../api/client';
import { useDialog } from '../hooks/useDialog';
import type { Member, MembershipType, MemberStatus } from '../types';
import toast from 'react-hot-toast';

const MEMBERSHIP_DURATIONS: Record<MembershipType, number> = {
  monthly: 1, quarterly: 3, yearly: 12,
};

interface MemberForm {
  name: string;
  email: string;
  phone: string;
  photo: string;
  membershipType: MembershipType;
  feeAmount: string;
  startDate: string;
  /** Preview only — the API derives the real end date from startDate. */
  _endDate?: string;
}

const emptyForm: MemberForm = {
  name: '', email: '', phone: '', photo: '',
  membershipType: 'monthly', feeAmount: '', startDate: '',
};

type StatusFilter = 'all' | MemberStatus;

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function computeEndDate(startDate: string, membershipType: MembershipType): string {
  if (!startDate) return '';
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + (MEMBERSHIP_DURATIONS[membershipType] || 1));
  return d.toISOString().split('T')[0]!;
}

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const photoRef = useRef<HTMLInputElement>(null);
  const modalRef = useDialog(showModal, () => setShowModal(false));

  const load = () =>
    api.get<Member[]>('/members')
      .then(r => setMembers(r.data))
      .catch(err => toast.error(apiError(err, 'Could not load members')))
      .finally(() => setLoading(false));

  useEffect(() => { void load(); }, []);

  const set = <K extends keyof MemberForm>(k: K) => (v: MemberForm[K]) =>
    setForm(f => {
      const updated = { ...f, [k]: v };
      if (k === 'startDate' || k === 'membershipType') {
        updated._endDate = computeEndDate(
          k === 'startDate' ? (v as string) : f.startDate,
          k === 'membershipType' ? (v as MembershipType) : f.membershipType,
        );
      }
      return updated;
    });

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => set('photo')(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const openAdd = () => {
    const today = new Date().toISOString().split('T')[0]!;
    setEditing(null);
    setForm({ ...emptyForm, startDate: today, _endDate: computeEndDate(today, 'monthly') });
    setShowModal(true);
  };

  const openEdit = (m: Member) => {
    setEditing(m.id);
    setForm({
      name: m.name, email: m.email || '', phone: m.phone || '',
      photo: m.photo || '',
      membershipType: m.membershipType,
      feeAmount: m.feeAmount != null ? String(m.feeAmount) : '',
      startDate: m.startDate.split('T')[0]!,
      _endDate: m.endDate.split('T')[0]!,
    });
    setShowModal(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        photo: form.photo,
        membershipType: form.membershipType,
        // The API rejects "" for a numeric field, so omit an empty fee.
        ...(form.feeAmount !== '' && { feeAmount: form.feeAmount }),
        startDate: form.startDate,
      };
      if (editing) {
        await api.put(`/members/${editing}`, payload);
        toast.success('Member updated');
      } else {
        await api.post('/members', payload);
        toast.success('Member added successfully');
      }
      setShowModal(false);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Error saving member'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/members/${id}`);
      toast.success('Member deleted');
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete'));
    }
  };

  const filtered = members.filter(m => {
    const matchSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.phone && m.phone.includes(search));
    const matchStatus = filterStatus === 'all' || m.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts: Record<StatusFilter, number> = {
    all: members.length,
    active: members.filter(m => m.status === 'active').length,
    expiring: members.filter(m => m.status === 'expiring').length,
    expired: members.filter(m => m.status === 'expired').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-sm text-gray-500 mt-0.5">{members.length} total members</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shrink-0">
          <Plus size={16} /> <span className="hidden sm:inline">Add Member</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {([
          { key: 'all', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'expiring', label: 'Expiring' },
          { key: 'expired', label: 'Expired' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setFilterStatus(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filterStatus === key
                ? key === 'expired' ? 'bg-red-600 text-white'
                  : key === 'expiring' ? 'bg-yellow-500 text-white'
                  : 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
              filterStatus === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}>{counts[key]}</span>
          </button>
        ))}

        {/* Search */}
        <div className="relative w-full sm:w-auto sm:ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or phone..."
            aria-label="Search members"
            className="pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-56"
          />
        </div>
      </div>

      {/* Members Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <User size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">No members found</p>
          <p className="text-sm text-gray-400 mt-1">
            {members.length === 0 ? 'Add your first member to get started' : 'Try adjusting your search or filter'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(m => {
            const daysLeft = Math.ceil((new Date(m.endDate).getTime() - Date.now()) / 86400000);
            return (
              <div key={m.id} className={`bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow ${
                m.status === 'expired' ? 'border-red-200 bg-red-50/30' :
                m.status === 'expiring' ? 'border-yellow-200 bg-yellow-50/30' :
                'border-gray-200'
              }`}>
                <div className="flex items-start gap-3 mb-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    {m.photo
                      ? <img src={m.photo} alt={m.name} className="w-full h-full object-cover" />
                      : <span className="text-white font-bold text-sm">{getInitials(m.name)}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{m.name}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Phone size={11} /> {m.phone || 'No phone'}
                    </p>
                  </div>
                  <Badge status={m.status} />
                </div>

                <div className="space-y-2 text-xs text-gray-500">
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-1.5"><Calendar size={12} /> Plan</span>
                    <span className="font-semibold text-gray-800 capitalize">{m.membershipType}</span>
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-1.5"><CreditCard size={12} /> Fee</span>
                    <span className="font-semibold text-gray-800">
                      {m.feeAmount ? `Rs. ${Number(m.feeAmount).toLocaleString()}` : '—'}
                    </span>
                  </div>
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                    m.status === 'expired' ? 'bg-red-100' :
                    m.status === 'expiring' ? 'bg-yellow-100' : 'bg-green-50'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} /> Expiry
                    </span>
                    <span className={`font-bold text-xs ${
                      m.status === 'expired' ? 'text-red-600' :
                      m.status === 'expiring' ? 'text-yellow-700' : 'text-green-700'
                    }`}>
                      {m.status === 'expired'
                        ? `Expired ${Math.abs(daysLeft)}d ago`
                        : m.status === 'expiring'
                        ? `${daysLeft}d left`
                        : new Date(m.endDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
                      }
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button onClick={() => openEdit(m)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                    <Pencil size={12} /> Edit
                  </button>
                  <button onClick={() => void handleDelete(m.id, m.name)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-100 text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} aria-hidden="true" />
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-modal-title"
            className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg sm:mx-4 max-h-[92dvh] flex flex-col"
          >
            <div className="p-5 sm:p-6 border-b border-gray-100 shrink-0">
              <h2 id="member-modal-title" className="text-lg font-bold text-gray-900">
                {editing ? 'Edit Member' : 'Add New Member'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {editing ? 'Update member details' : 'Fill in details — expiry auto-calculated'}
              </p>
            </div>

            <form onSubmit={e => void handleSave(e)} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              {/* Photo Upload */}
              <div className="flex flex-col items-center gap-3">
                <div
                  onClick={() => photoRef.current?.click()}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center cursor-pointer overflow-hidden relative group"
                >
                  {form.photo
                    ? <img src={form.photo} alt="preview" className="w-full h-full object-cover" />
                    : <span className="text-white font-bold text-lg">
                        {form.name ? getInitials(form.name) : <Camera size={24} className="text-white/70" />}
                      </span>
                  }
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera size={18} className="text-white" />
                  </div>
                </div>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <button type="button" onClick={() => photoRef.current?.click()}
                  className="text-xs text-blue-600 font-medium hover:underline">
                  {form.photo ? 'Change photo' : 'Upload photo (optional)'}
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => set('name')(e.target.value)}
                  placeholder="Ahmed Khan"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone</label>
                <input
                  value={form.phone}
                  onChange={e => set('phone')(e.target.value)}
                  placeholder="03001234567"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Membership Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Membership Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'monthly', label: 'Monthly', sub: '1 month' },
                    { value: 'quarterly', label: 'Quarterly', sub: '3 months' },
                    { value: 'yearly', label: 'Yearly', sub: '12 months' },
                  ] as const).map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => set('membershipType')(opt.value)}
                      className={`border rounded-xl py-2.5 px-2 text-center transition-all ${
                        form.membershipType === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                      <p className="font-semibold text-xs">{opt.label}</p>
                      <p className="text-xs opacity-60 mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fee */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Fee Amount (Rs.)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">Rs.</span>
                  <input
                    type="number"
                    min="0"
                    value={form.feeAmount}
                    onChange={e => set('feeAmount')(e.target.value)}
                    placeholder="2500"
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Join / Fee Payment Date *</label>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={e => set('startDate')(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Auto Expiry Preview */}
              {form._endDate && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                  <Calendar size={15} className="text-blue-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-blue-800">Auto-calculated expiry</p>
                    <p className="text-sm font-bold text-blue-700">
                      {new Date(form._endDate).toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                  {saving ? 'Saving...' : editing ? 'Update Member' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
