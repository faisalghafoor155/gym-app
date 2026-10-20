import { IndianRupee } from 'lucide-react';
import { Card, EmptyState, DataRow } from '../ui';
import type { TrainerCommissionReport } from '../../types';

export default function CommissionsTab({ report }: { report: TrainerCommissionReport[] }) {
  return (
    report.length === 0 ? (
      <EmptyState
        icon={IndianRupee}
        title="No commission records"
        hint="Complete PT sessions to see commission payouts."
      />
    ) : (
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-slate-400">
              <thead className="text-xs uppercase bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300 border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-bold">Trainer</th>
                  <th className="px-6 py-4 font-bold">Rate</th>
                  <th className="px-6 py-4 font-bold">Sessions Completed</th>
                  <th className="px-6 py-4 font-bold">Gross Revenue</th>
                  <th className="px-6 py-4 font-bold">Trainer Share</th>
                  <th className="px-6 py-4 font-bold text-right">Gym Net Share</th>
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
                        {r.totalSessions} sessions
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-200">
                        Rs. {r.totalRevenue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-red-600 dark:text-red-400 font-bold">
                        Rs. {r.totalCommission.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-green-700 dark:text-green-400 font-extrabold">
                        Rs. {gymShare.toLocaleString()}
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
                    {r.commissionPercentage}% · {r.totalSessions} sessions
                  </span>
                </div>
                <div className="space-y-1.5">
                  <DataRow label="Gross revenue" value={`Rs. ${r.totalRevenue.toLocaleString()}`} />
                  <DataRow label="Trainer share" value={`Rs. ${r.totalCommission.toLocaleString()}`} />
                  <DataRow
                    label="Gym net share"
                    value={`Rs. ${(r.totalRevenue - r.totalCommission).toLocaleString()}`}
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
