import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { Card, FieldLabel, inputClass, primaryButton, secondaryButton } from '../ui';
import type { Member, Trainer } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import type { PtSessionForm } from './types';

interface Props {
  form: PtSessionForm;
  setForm: Dispatch<SetStateAction<PtSessionForm>>;
  members: Member[];
  trainers: Trainer[];
  saving: boolean;
  onSave: (e: FormEvent) => void;
  onClose: () => void;
}

export default function PtSessionModal({ form: ptForm, setForm: setPtForm, members, trainers, saving, onSave, onClose }: Props) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-4">{t('Book Personal Training Session')}</h3>
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <FieldLabel htmlFor="trainers-select-member">{t('Select Member')}</FieldLabel>
            <select id="trainers-select-member"
              required
              value={ptForm.memberId}
              onChange={e => setPtForm(prev => ({ ...prev, memberId: e.target.value }))}
              className={inputClass}
            >
              <option value="">{t('-- Choose Member --')}</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.memberNo})</option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel htmlFor="trainers-select-trainer">{t('Select Trainer')}</FieldLabel>
            <select id="trainers-select-trainer"
              required
              value={ptForm.trainerId}
              onChange={e => setPtForm(prev => ({ ...prev, trainerId: e.target.value }))}
              className={inputClass}
            >
              <option value="">{t('-- Choose Trainer --')}</option>
              {trainers.map(tr => (
                <option key={tr.id} value={tr.id}>{t('{name} ({rate}% Comm)', { name: tr.name, rate: tr.commissionPercentage })}</option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel htmlFor="trainers-session-date-time">{t('Session Date & Time')}</FieldLabel>
            <input id="trainers-session-date-time"
              required
              type="datetime-local"
              value={ptForm.sessionDate}
              onChange={e => setPtForm(prev => ({ ...prev, sessionDate: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <FieldLabel htmlFor="trainers-price-charged-rs">{t('Price Charged (Rs.)')}</FieldLabel>
            <input id="trainers-price-charged-rs"
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
              <FieldLabel htmlFor="trainers-initial-status">{t('Initial Status')}</FieldLabel>
              <select id="trainers-initial-status"
                value={ptForm.status}
                onChange={e => setPtForm(prev => ({ ...prev, status: e.target.value as any }))}
                className={inputClass}
              >
                <option value="scheduled">{t('Scheduled')}</option>
                <option value="completed">{t('Completed')}</option>
                <option value="cancelled">{t('Cancelled')}</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="trainers-payment">{t('Payment')}</FieldLabel>
              <select id="trainers-payment"
                value={ptForm.paymentStatus}
                onChange={e => setPtForm(prev => ({ ...prev, paymentStatus: e.target.value as any }))}
                className={inputClass}
              >
                <option value="unpaid">{t('Unpaid')}</option>
                <option value="paid">{t('Paid')}</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={() => onClose()}
              className={secondaryButton}
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className={primaryButton}
            >
              {saving ? t('Booking…') : t('Book Session')}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
