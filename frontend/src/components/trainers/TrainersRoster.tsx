import { Pencil, Trash2, Award } from 'lucide-react';
import { Card, EmptyState, primaryButton } from '../ui';
import type { Trainer } from '../../types';

interface Props {
  trainers: Trainer[];
  gymDefaultPtFee: number | null;
  onAdd: () => void;
  onEdit: (t: Trainer) => void;
  onDeactivate: (t: Trainer) => void;
}

export default function TrainersRoster({ trainers, gymDefaultPtFee, onAdd, onEdit, onDeactivate }: Props) {
  return (
    trainers.length === 0 ? (
      <EmptyState
        icon={Award}
        title="No trainers found"
        hint="Create trainer profiles to assign them to gym members."
        action={
          <button
            onClick={onAdd}
            className={primaryButton}
          >
            Add first trainer
          </button>
        }
      />
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {trainers.map(t => (
          <Card key={t.id} className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">{t.name}</h3>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                    {t.specialization || 'General Fitness'}
                  </span>
                </div>
                <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                  {t.commissionPercentage}% Comm.
                </span>
              </div>

              <div className="mt-5 space-y-2 text-sm text-gray-600 dark:text-slate-400">
                <p className="flex items-center gap-2">
                  <span className="text-gray-400">📞</span> {t.phone || 'No phone number'}
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-gray-400">👥</span> {t.activeMembersCount} Active Members Assigned
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-gray-400">💰</span>
                  {t.ptFee === null
                    ? `Assignment fee: gym default${gymDefaultPtFee === null ? '' : ` (Rs. ${gymDefaultPtFee.toLocaleString()})`}`
                    : t.ptFee === 0
                      ? 'Assignment fee: none'
                      : `Assignment fee: Rs. ${t.ptFee.toLocaleString()}`}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 flex gap-3">
              <button
                onClick={() => onEdit(t)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <Pencil size={13} /> Edit
              </button>
              <button
                onClick={() => onDeactivate(t)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={13} /> Deactivate
              </button>
            </div>
          </Card>
        ))}
      </div>
    )
  );
}
