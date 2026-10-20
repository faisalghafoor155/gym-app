import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { Card, FieldLabel, inputClass, primaryButton, secondaryButton } from '../ui';
import type { TrainerForm } from './types';

interface Props {
  editing: boolean;
  form: TrainerForm;
  setForm: Dispatch<SetStateAction<TrainerForm>>;
  gymDefaultPtFee: number | null;
  saving: boolean;
  onSave: (e: FormEvent) => void;
  onClose: () => void;
}

export default function TrainerModal({ editing, form: trainerForm, setForm: setTrainerForm, gymDefaultPtFee, saving, onSave, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-4">
          {editing ? 'Edit Trainer Profile' : 'Add New Trainer'}
        </h3>
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <FieldLabel htmlFor="trainers-full-name">Full Name</FieldLabel>
            <input id="trainers-full-name"
              required
              value={trainerForm.name}
              onChange={e => setTrainerForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Trainer Zain"
              className={inputClass}
            />
          </div>

          <div>
            <FieldLabel htmlFor="trainers-phone-number">Phone Number</FieldLabel>
            <input id="trainers-phone-number"
              value={trainerForm.phone}
              onChange={e => setTrainerForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="e.g. 03001234567"
              className={inputClass}
            />
          </div>

          <div>
            <FieldLabel htmlFor="trainers-specialization-skills">Specialization / Skills</FieldLabel>
            <input id="trainers-specialization-skills"
              value={trainerForm.specialization}
              onChange={e => setTrainerForm(prev => ({ ...prev, specialization: e.target.value }))}
              placeholder="e.g. Bodybuilding, Yoga, Strength Training"
              className={inputClass}
            />
          </div>

          <div>
            <FieldLabel htmlFor="trainers-trainer-commission-percentage">Trainer Commission Percentage (%)</FieldLabel>
            <input id="trainers-trainer-commission-percentage"
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
            <FieldLabel htmlFor="trainers-assignment-fee-rs">Assignment Fee (Rs.)</FieldLabel>
            <input id="trainers-assignment-fee-rs"
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
              onClick={() => onClose()}
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
  );
}
