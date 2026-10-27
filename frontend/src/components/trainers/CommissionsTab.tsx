import { IndianRupee } from 'lucide-react';
import { Card, EmptyState, DataRow } from '../ui';
import type { TrainerCommissionReport } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

export default function CommissionsTab({ report }: { report: TrainerCommissionReport[] }) {
  const { t } = useLanguage();
  return (
    report.length === 0 ? (
      <EmptyState
        icon={IndianRupee}
        title={t('No commission records')}
        hint={t('Complete PT sessions to see commission payouts.')}
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
                  <th className="px-6 py-4 font-bold">{t('Sessions Completed')}</th>
                  <th className="px-6 py-4 font-bold">{t('Gross Revenue')}</th>
                  <th className="px-6 py-4 font-bold">{t('Trainer Share')}</th>
                  <th className="px-6 py-4 font-bold text-right">{t('Gym Net Share')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {report.map(r => {
                  const gymShare = r.totalRevenue - r.totalCommission;
                  return (
                    <tr key={r.trainerId} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/20">
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-200">
                        {r.trainerName}
                      </td>
                      <td className="px-6 py-4">
                        {r.commissionPercentage}%
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {t('{count} sessions', { count: r.totalSessions })}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-200">
                        {t('Rs. {amount}', { amount: r.totalRevenue.toLocaleString() })}
                      </td>
                      <td className="px-6 py-4 text-red-600 dark:text-red-400 font-bold">
                        {t('Rs. {amount}', { amount: r.totalCommission.toLocaleString() })}
                      </td>
                      <td className="px-6 py-4 text-right text-green-700 dark:text-green-400 font-extrabold">
                        {t('Rs. {amount}', { amount: gymShare.toLocaleString() })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-800">
            {report.map(r => (
              <div key={r.trainerId} className="p-4 space-y-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-gray-900 dark:text-slate-200 truncate">
                    {r.trainerName}
                  </p>
                  <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
                    {r.commissionPercentage}% · {t('{count} sessions', { count: r.totalSessions })}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <DataRow label={t('Gross revenue')} value={t('Rs. {amount}', { amount: r.totalRevenue.toLocaleString() })} />
                  <DataRow label={t('Trainer share')} value={t('Rs. {amount}', { amount: r.totalCommission.toLocaleString() })} />
                  <DataRow
                    label={t('Gym net share')}
                    value={t('Rs. {amount}', { amount: (r.totalRevenue - r.totalCommission).toLocaleString() })}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    )
  );
}
