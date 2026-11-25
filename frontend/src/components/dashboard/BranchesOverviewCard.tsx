import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';
import { Building2 } from 'lucide-react';
import { Card } from '../ui';
import api from '../../api/client';
import { useBranch } from '../../context/BranchContext';
import { useLanguage } from '../../context/LanguageContext';
import type { BranchOverview } from '../../types';

const money = (n: number) => `Rs. ${n.toLocaleString()}`;

/**
 * Every branch side by side — the owner's combined view. Shown only with
 * "All branches" selected and more than one branch; at one branch the rest of
 * the dashboard is already that branch.
 */
export default function BranchesOverviewCard() {
  const { t } = useLanguage();
  const { multi, current, switchTo } = useBranch();
  const { user, isOwner } = useAuth();
  const allowed = isOwner || (!!user?.staffPermission && hasPermission(user.role, user.staffPermission, 'canViewReports'));
  const [data, setData] = useState<BranchOverview | null>(null);
  useEffect(() => {
    if (!multi || current || !allowed) return;
    void api.get<BranchOverview>('/branches/overview').then(r => setData(r.data)).catch(() => setData(null));
  }, [multi, current, allowed]);
  if (!multi || current || !data) return null;

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2 mb-3">
        <Building2 size={16} className="text-emerald-600" /> {t('Branches this month')}
      </h2>
      {/* Phones: a small block per branch — five columns do not fit. */}
      <ul className="sm:hidden divide-y divide-gray-100 dark:divide-slate-800">
        {data.branches.map(b => (
          <li key={b.id} className="py-2.5">
            <button onClick={() => switchTo(b.id)} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-left py-1">
              {b.name}
            </button>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-slate-400">
              <span>{t('Members')}: <span className="tabular-nums text-gray-900 dark:text-slate-100">{b.members}</span></span>
              <span>{t('Check-ins today')}: <span className="tabular-nums text-gray-900 dark:text-slate-100">{b.checkinsToday}</span></span>
              <span>{t('Collected')}: <span className="tabular-nums font-semibold text-green-700 dark:text-green-400">{money(b.collectedThisMonth)}</span></span>
              <span>{t('Spent')}: <span className="tabular-nums text-red-600">{money(b.spentThisMonth)}</span></span>
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-slate-400">
              <th className="py-1.5 pr-3 font-semibold">{t('Branch')}</th>
              <th className="py-1.5 px-3 font-semibold text-right">{t('Members')}</th>
              <th className="py-1.5 px-3 font-semibold text-right">{t('Check-ins today')}</th>
              <th className="py-1.5 px-3 font-semibold text-right">{t('Collected')}</th>
              <th className="py-1.5 pl-3 font-semibold text-right">{t('Spent')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {data.branches.map(b => (
              <tr key={b.id}>
                <td className="py-2 pr-3">
                  <button onClick={() => switchTo(b.id)} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-left">
                    {b.name}
                  </button>
                </td>
                <td className="py-2 px-3 text-right tabular-nums">{b.members}</td>
                <td className="py-2 px-3 text-right tabular-nums">{b.checkinsToday}</td>
                <td className="py-2 px-3 text-right tabular-nums font-semibold text-green-700 dark:text-green-400">{money(b.collectedThisMonth)}</td>
                <td className="py-2 pl-3 text-right tabular-nums text-red-600">{money(b.spentThisMonth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.sharedSpentThisMonth > 0 && (
        <p className="mt-2 text-xs text-gray-500">{t('Plus {amount} spent for the whole gym.', { amount: money(data.sharedSpentThisMonth) })}</p>
      )}
    </Card>
  );
}
