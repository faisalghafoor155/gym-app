import { useState, type FormEvent } from 'react';
import {
  FieldLabel, inputClass, secondaryButton,
} from '../ui';
import { Dumbbell, UserCheck, UserX, AlertTriangle } from 'lucide-react';
import api, { apiError } from '../../api/client';
import { useDialog } from '../../hooks/useDialog';
import { useLanguage } from '../../context/LanguageContext';
import type { Member, Trainer } from '../../types';
import toast from 'react-hot-toast';

interface Props {
  member: Member;
  trainers: Trainer[];
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignTrainerModal({ member, trainers, onClose, onAssigned }: Props) {
  const { t } = useLanguage();
  const currentTrainer = member.trainer;
  const hasCurrentTrainer = Boolean(member.trainerId || currentTrainer);

  const [mode, setMode] = useState<'assign' | 'remove'>(() => 'assign');
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>(() => {
    return member.trainerId || currentTrainer?.id || (trainers[0]?.id ?? '');
  });

  // Default to 10,000 as requested, or the trainer's set fee if present
  const [ptFee, setPtFee] = useState<string>(() => {
    const tr = trainers.find(item => item.id === (member.trainerId || currentTrainer?.id));
    if (tr?.ptFee != null && Number(tr.ptFee) > 0) return String(tr.ptFee);
    return '10000';
  });

  const [ptFeePaid, setPtFeePaid] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const dialogRef = useDialog(true, onClose);

  const selectedTrainer = trainers.find(tr => tr.id === selectedTrainerId);

  const handleSelectTrainer = (id: string) => {
    setSelectedTrainerId(id);
    const tr = trainers.find(item => item.id === id);
    if (tr?.ptFee != null && Number(tr.ptFee) > 0) {
      setPtFee(String(tr.ptFee));
    } else {
      setPtFee('10000');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === 'remove') {
        await api.put(`/members/${member.id}`, {
          trainerId: null,
        });
        toast.success(t("Trainer ({trainer}) removed from {name}'s card", { trainer: currentTrainer?.name || t('Assigned'), name: member.name }));
      } else {
        if (!selectedTrainerId) {
          toast.error(t('Please select a trainer'));
          setSaving(false);
          return;
        }

        const feeNum = Number(ptFee) || 0;
        await api.put(`/members/${member.id}`, {
          trainerId: selectedTrainerId,
          ptFee: feeNum,
          ptFeePaid,
        });

        toast.success(t('Trainer ({trainer}) assigned to {name} (Fee: Rs. {fee})', {
          trainer: selectedTrainer?.name ?? '', name: member.name, fee: feeNum.toLocaleString('en-PK'),
        }));
      }

      onAssigned();
      onClose();
    } catch (err) {
      toast.error(apiError(err, t('Could not update trainer assignment')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-trainer-modal-title"
        className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md sm:mx-4 max-h-[92dvh] flex flex-col"
      >
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
              <Dumbbell size={18} />
            </div>
            <div>
              <h2 id="assign-trainer-modal-title" className="text-base font-bold text-gray-900 dark:text-slate-100">
                {hasCurrentTrainer ? t('Manage Personal Trainer') : t('Add Personal Trainer')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {member.name} · {member.memberNo}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={e => void handleSubmit(e)} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Mode Switcher if member already has a trainer */}
          {hasCurrentTrainer && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('assign')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  mode === 'assign'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500'
                    : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50'
                }`}
              >
                <UserCheck size={14} />
                <span>{t('Change Trainer')}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('remove')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  mode === 'remove'
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500'
                    : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50'
                }`}
              >
                <UserX size={14} />
                <span>{t('Remove Trainer')}</span>
              </button>
            </div>
          )}

          {mode === 'remove' ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold">
                <AlertTriangle size={16} />
                <span>{t('Remove trainer?')}</span>
              </div>
              <p className="text-rose-800 dark:text-rose-300 leading-relaxed">
                {t("Are you sure you want to remove {trainer} from this member's card? The member will have no trainer assigned.", { trainer: currentTrainer?.name ?? '' })}
              </p>
            </div>
          ) : (
            <>
              {/* Select Trainer */}
              <div>
                <FieldLabel htmlFor="trainer-select" required>{t('Select Personal Trainer')}</FieldLabel>
                <select
                  id="trainer-select"
                  value={selectedTrainerId}
                  onChange={e => handleSelectTrainer(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">{t('Select a trainer')}</option>
                  {trainers.map(tr => (
                    <option key={tr.id} value={tr.id}>
                      {tr.name} ({tr.specialization || t('Trainer')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Trainer Fee (Default 10,000, Editable) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <FieldLabel htmlFor="trainer-pt-fee" required>{t('Trainer Fee (Rs.)')}</FieldLabel>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800/40">
                    {t('Default: Rs. 10,000 (Adjustable)')}
                  </span>
                </div>
                <input
                  id="trainer-pt-fee"
                  type="number"
                  min={0}
                  step={100}
                  value={ptFee}
                  onChange={e => setPtFee(e.target.value)}
                  placeholder="10000"
                  className={inputClass}
                  required
                />
                <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                  {t('You can raise or lower the trainer fee by hand. Enter 0 if free.')}
                </p>
              </div>

              {/* Payment Status Checkbox */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 space-y-2">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ptFeePaid}
                    onChange={e => setPtFeePaid(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span>{t('Fee Collected Now (Mark as Paid)')}</span>
                </label>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 pl-6">
                  {ptFeePaid
                    ? t('Payment record will be created immediately with status Paid.')
                    : t('Fee will sit as Due in member balance until settled.')}
                </p>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 ${secondaryButton}`}
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`flex-1 font-bold rounded-xl py-2.5 px-4 text-xs text-white transition shadow-sm ${
                mode === 'remove'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {saving
                ? t('Saving...')
                : mode === 'remove'
                ? t('Remove Trainer')
                : t('Assign Trainer (Rs. {fee})', { fee: Number(ptFee || 0).toLocaleString('en-PK') })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
