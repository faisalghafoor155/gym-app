import { Pencil, Trash2, Award } from 'lucide-react';
import { Card, EmptyState, primaryButton } from '../ui';
import type { Trainer } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface Props {
  trainers: Trainer[];
  gymDefaultPtFee: number | null;
  onAdd: () => void;
  onEdit: (t: Trainer) => void;
  onDeactivate: (t: Trainer) => void;
}

export default function TrainersRoster({ trainers, gymDefaultPtFee, onAdd, onEdit, onDeactivate }: Props) {
  const { t } = useLanguage();
  return (
    trainers.length === 0 ? (
      <EmptyState
        icon={Award}
        title={t('No trainers found')}
        hint={t('Create trainer profiles to assign them to gym members.')}
        action={
          <button
            onClick={onAdd}
            className={primaryButton}
          >
            {t('Add first trainer')}
          </button>
        }
      />
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {trainers.map(tr => (
          <Card key={tr.id} className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">{tr.name}</h3>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                    {tr.specialization || t('General Fitness')}
                  </span>
                </div>
                <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                  {t('{rate}% Comm.', { rate: tr.commissionPercentage })}
                </span>
              </div>

              <div className="mt-5 space-y-2 text-sm text-gray-600 dark:text-slate-400">
                <p className="flex items-center gap-2">
                  <span className="text-gray-400">📞</span> {tr.phone || t('No phone number')}
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-gray-400">👥</span> {t('{count} Active Members Assigned', { count: tr.activeMembersCount })}
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-gray-400">💰</span>
                  {tr.ptFee === null
                    ? gymDefaultPtFee === null
                      ? t('Assignment fee: gym default')
                      : t('Assignment fee: gym default (Rs. {amount})', { amount: gymDefaultPtFee.toLocaleString() })
                    : tr.ptFee === 0
                      ? t('Assignment fee: none')
                      : t('Assignment fee: Rs. {amount}', { amount: tr.ptFee.toLocaleString() })}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 flex gap-3">
              <button
                onClick={() => onEdit(tr)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <Pencil size={13} /> {t('Edit')}
              </button>
              <button
                onClick={() => onDeactivate(tr)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={13} /> {t('Deactivate')}
              </button>
            </div>
          </Card>
        ))}
      </div>
    )
  );
}
