import { IndianRupee } from 'lucide-react';
import { Card, EmptyState, DataRow } from '../ui';
import type { TrainerPayout } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface Props {
  payouts: TrainerPayout[];
  canManagePayouts: boolean;
  saving: boolean;
  onPayOut: (payout: TrainerPayout) => void;
}

export default function PayoutsTab({ payouts, canManagePayouts, saving, onPayOut }: Props) {
  const { t } = useLanguage();
  return (
    payouts.length === 0 ? (
      <EmptyState
        icon={IndianRupee}
        title={t('No payouts found')}
        hint={t('Create trainers and complete sessions to track payouts.')}
      />
    ) : (
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-slate-400">
              <thead className="text-xs uppercase bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300 border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-bold">{t('Trainer')}</th>
                  <th className="px-6 py-4 font-bold">{t('Rate')}</th>
                  <th className="px-6 py-4 font-bold">{t('Total Sessions')}</th>
                  <th className="px-6 py-4 font-bold">{t('Total Earned')}</th>
                  <th className="px-6 py-4 font-bold text-green-600">{t('Paid')}</th>
                  <th className="px-6 py-4 font-bold text-yellow-600">{t('Unpaid')}</th>
                  <th className="px-6 py-4 font-bold text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {payouts.map(p => (
                  <tr key={p.trainerId} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/20">
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-200">
                      {p.trainerName}
                    </td>
                    <td className="px-6 py-4">
                      {p.commissionPercentage}%
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {t('{count} sessions', { count: p.totalSessionsCount })}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-200">
                      {t('Rs. {amount}', { amount: p.totalEarned.toLocaleString() })}
                    </td>
                    <td className="px-6 py-4 text-green-700 dark:text-green-400 font-bold">
                      {t('Rs. {amount}', { amount: p.paidCommission.toLocaleString() })}
                    </td>
                    <td className="px-6 py-4 text-yellow-700 dark:text-yellow-400 font-bold">
                      {t('Rs. {amount}', { amount: p.unpaidCommission.toLocaleString() })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {p.unpaidCommission > 0 ? (
                        canManagePayouts ? (
                          <button
                            onClick={() => onPayOut(p)}
                            disabled={saving}
                            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800 disabled:opacity-50"
                          >
                            {t('Clear Unpaid')}
                          </button>
                        ) : (
                          <span className="text-xs text-yellow-600 font-semibold">{t('Unpaid')}</span>
                        )
                      ) : (
                        <span className="text-xs text-gray-400 font-semibold">{t('Fully Paid')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Seven columns do not survive a phone. The same figures as
              stacked rows, with the amount owed kept prominent because it
              is the number the button acts on. */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-800">
            {payouts.map(p => (
              <div key={p.trainerId} className="p-4 space-y-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-gray-900 dark:text-slate-200 truncate">
                    {p.trainerName}
                  </p>
                  <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
                    {p.commissionPercentage}% · {t('{count} sessions', { count: p.totalSessionsCount })}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <DataRow label={t('Total earned')} value={t('Rs. {amount}', { amount: p.totalEarned.toLocaleString() })} />
                  <DataRow label={t('Paid')} value={t('Rs. {amount}', { amount: p.paidCommission.toLocaleString() })} />
                  <DataRow label={t('Unpaid')} value={t('Rs. {amount}', { amount: p.unpaidCommission.toLocaleString() })} />
                </div>
                {p.unpaidCommission > 0 ? (
                  canManagePayouts && (
                    <button
                      onClick={() => onPayOut(p)}
                      disabled={saving}
                      className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800 disabled:opacity-50"
                    >
                      {t('Clear Unpaid')}
                    </button>
                  )
                ) : (
                  <p className="text-xs text-gray-400 font-semibold">{t('Fully Paid')}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    )
  );
}
