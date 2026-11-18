import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { FieldLabel, inputClass, primaryButton, secondaryButton } from '../ui';
import api, { apiError } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Report a fault: staff from the Equipment page, members from the portal
 * (`endpoint`). The machine may come already chosen.
 */
export default function ReportFaultModal({ machines, machineId, endpoint = '/equipment/faults', onClose, onDone }: {
  machines: { id: string; name: string; location: string | null }[];
  machineId?: string;
  endpoint?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const [equipmentId, setEquipmentId] = useState(machineId ?? '');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(endpoint, { equipmentId, description: description.trim() });
      toast.success(t('Fault reported. Thank you!'));
      onDone();
    } catch (err) {
      toast.error(apiError(err, t('Could not report the fault')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('Report a fault')} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <div>
          <FieldLabel htmlFor="ft-machine" required>{t('Machine')}</FieldLabel>
          <select id="ft-machine" required value={equipmentId} onChange={e => setEquipmentId(e.target.value)} className={inputClass}>
            <option value="" disabled>{t('Choose a machine')}</option>
            {machines.map(m => <option key={m.id} value={m.id}>{m.name}{m.location ? ` — ${m.location}` : ''}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="ft-desc" required>{t('What is wrong?')}</FieldLabel>
          <textarea id="ft-desc" required minLength={3} maxLength={500} rows={3} value={description} onChange={e => setDescription(e.target.value)}
            placeholder={t('e.g. Belt slips at high speed')} className={inputClass} />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>{saving ? t('Saving…') : t('Report')}</button>
        </div>
      </form>
    </Modal>
  );
}
