import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';
import { Link } from 'react-router-dom';
import { MessageSquareHeart, ArrowRight } from 'lucide-react';
import { Card } from '../ui';
import Stars from '../feedback/Stars';
import api from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import type { FeedbackSummary } from '../../types';

/**
 * This month's member satisfaction against last month's, and complaints
 * still open. Hidden for staff without the members permission, and for a gym
 * nobody has rated yet.
 */
export default function SatisfactionCard() {
  const { t } = useLanguage();
  const { user, isOwner } = useAuth();
  const allowed = isOwner || (!!user?.staffPermission && hasPermission(user.role, user.staffPermission, 'canManageMembers'));
  const [data, setData] = useState<FeedbackSummary | null>(null);
  useEffect(() => {
    if (!allowed) return;
    void api.get<FeedbackSummary>('/feedback/summary').then(r => setData(r.data)).catch(() => setData(null));
  }, [allowed]);
  if (!data || (data.thisMonth.count === 0 && data.lastMonth.count === 0 && data.open === 0)) return null;

  const now = data.thisMonth.average;
  const before = data.lastMonth.average;
  const diff = now != null && before != null ? Math.round((now - before) * 10) / 10 : null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
          <MessageSquareHeart size={16} className="text-pink-500" /> {t('Member satisfaction')}
        </h2>
        <Link to="/feedback" className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
          {t('Open')} <ArrowRight size={12} />
        </Link>
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums">
            {now ?? '—'}<span className="text-base font-semibold text-gray-400"> / 5</span>
          </p>
          <Stars value={Math.round(now ?? 0)} size={14} />
        </div>
        <div className="text-sm space-y-0.5">
          <p className="text-gray-600 dark:text-slate-300">
            {t('{count} ratings this month', { count: data.thisMonth.count })}
            {data.thisMonth.happyPct != null && ` · ${t('{pct}% happy', { pct: data.thisMonth.happyPct })}`}
          </p>
          {diff !== null && (
            <p className={`text-xs font-semibold ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {t('{sign}{diff} vs last month ({before})', { sign: diff >= 0 ? '+' : '', diff, before: before! })}
            </p>
          )}
          {data.open > 0 && (
            <Link to="/feedback" className="block text-xs font-semibold text-red-600 hover:underline">
              {t('{count} waiting for a reply', { count: data.open })}
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
