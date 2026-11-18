import { useEffect, useState, type FormEvent } from 'react';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import ConfirmDialog from '../ConfirmDialog';
import { Card, FieldLabel, IconButton, inputClass, primaryButton, secondaryButton } from '../ui';
import api, { apiError } from '../../api/client';
import { useBranch } from '../../context/BranchContext';
import { useLanguage } from '../../context/LanguageContext';
import type { Branch } from '../../types';

type StaffRow = { id: string; name: string; email: string; branchId: string | null; isActive: boolean };

function BranchModal({ branch, onClose, onDone }: { branch: Branch | null; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [name, setName] = useState(branch?.name ?? '');
  const [address, setAddress] = useState(branch?.address ?? '');
  const [phone, setPhone] = useState(branch?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = { name: name.trim(), address: address.trim(), phone: phone.trim() };
    try {
      if (branch) await api.put(`/branches/${branch.id}`, body);
      else await api.post('/branches', body);
      toast.success(branch ? t('Saved') : t('{name} added', { name: body.name }));
      onDone();
    } catch (err) {
      toast.error(apiError(err, t('Could not save')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={branch ? t('Edit branch') : t('Add branch')} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <div>
          <FieldLabel htmlFor="br-name" required>{t('Name')}</FieldLabel>
          <input id="br-name" required autoFocus maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder={t('e.g. DHA Phase 6')} className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="br-address">{t('Address')}</FieldLabel>
          <input id="br-address" maxLength={200} value={address} onChange={e => setAddress(e.target.value)} className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="br-phone">{t('Phone')}</FieldLabel>
          <input id="br-phone" type="tel" maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>{saving ? t('Saving…') : t('Save')}</button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * The gym's branches and where each staff account works. Owner only, on the
 * Staff & Logins page.
 */
export default function BranchesCard() {
  const { t } = useLanguage();
  const { branches, reload } = useBranch();
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Branch | null>(null);
  const [busy, setBusy] = useState(false);
  const [staff, setStaff] = useState<StaffRow[]>([]);

  const loadStaff = () => api.get<StaffRow[]>('/branches/staff').then(r => setStaff(r.data)).catch(() => setStaff([]));
  useEffect(() => { void loadStaff(); }, []);

  const place = async (userId: string, branchId: string) => {
    try {
      await api.put(`/branches/staff/${userId}`, { branchId: branchId || null });
      toast.success(t('Saved'));
      void loadStaff();
    } catch (err) {
      toast.error(apiError(err, t('Could not save')));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/branches/${deleting.id}`);
      setDeleting(null);
      await reload();
    } catch (err) {
      toast.error(apiError(err, t('Could not delete')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <Building2 size={18} className="text-emerald-600" /> {t('Branches')}
        </h2>
        <button onClick={() => setEditing('new')} className={secondaryButton}><Plus size={15} /> {t('Add branch')}</button>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
        {t('Each member belongs to a branch. Pick the branch you are working in from the menu; "All branches" shows the whole gym.')}
      </p>
      <ul className="divide-y divide-gray-100 dark:divide-slate-800">
        {branches.map(b => (
          <li key={b.id} className="py-2 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 dark:text-slate-100">
                {b.name}{b.isMain && <span className="ml-2 text-[11px] text-emerald-600 font-semibold">{t('Main')}</span>}
              </p>
              <p className="text-xs text-gray-500">
                {[t('{count} members', { count: b.members }), t('{count} staff', { count: b.staff }), b.address].filter(Boolean).join(' · ')}
              </p>
            </div>
            <IconButton icon={Pencil} label={t('Edit {name}', { name: b.name })} onClick={() => setEditing(b)} />
            {!b.isMain && <IconButton icon={Trash2} label={t('Delete {name}', { name: b.name })} tone="red" onClick={() => setDeleting(b)} />}
          </li>
        ))}
      </ul>

      {branches.length > 1 && staff.length > 0 && (
        <div className="mt-4 border-t border-gray-100 dark:border-slate-800 pt-4">
          <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-1">{t('Where staff work')}</p>
          <p className="text-xs text-gray-500 mb-2">{t('Staff placed at a branch only see that branch.')}</p>
          <ul className="space-y-2">
            {staff.map(s => (
              <li key={s.id} className="flex items-center gap-3">
                <span className="flex-1 min-w-0 text-sm truncate">{s.name} <span className="text-xs text-gray-400">{s.email}</span></span>
                <select value={s.branchId ?? ''} onChange={e => void place(s.id, e.target.value)} className={`${inputClass} max-w-48`}>
                  <option value="">{t('All branches')}</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && <BranchModal branch={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
        onDone={() => { setEditing(null); void reload(); }} />}
      {deleting && (
        <ConfirmDialog title={t('Delete branch')}
          message={t('Delete {name}? Only a branch with no members, staff or check-ins can be deleted.', { name: deleting.name })}
          confirmLabel={t('Delete')} tone="danger" busy={busy}
          onConfirm={() => void remove()} onCancel={() => setDeleting(null)} />
      )}
    </Card>
  );
}
