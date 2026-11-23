import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PhoneCall, ArrowRight, Ticket } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';
import { Card } from '../ui';
import api from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import type { LeadList } from '../../types';

/** Today in the gym's calendar, as yyyy-mm-dd. */
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

/**
 * Enquiries to call today, overdue ones first — the same list the Leads page
 * opens on, put where the day starts. Hidden for staff without the members
 * permission, and on a day with nobody to call.
 */
export default function FollowUpsCard() {
  const { t } = useLanguage();
  const { user, isOwner } = useAuth();
  const allowed = isOwner || (!!user?.staffPermission && hasPermission(user.role, user.staffPermission, 'canManageMembers'));
  const [data, setData] = useState<LeadList | null>(null);
  useEffect(() => {
    if (!allowed) return;
    void api.get<LeadList>('/leads?due=true&limit=5').then(r => setData(r.data)).catch(() => setData(null));
  }, [allowed]);
  if (!data || data.counts.due === 0) return null;

  const now = today();
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
          <PhoneCall size={16} className="text-blue-500" /> {t("Today's follow-ups")}
          <span className="text-xs font-bold rounded-md px-1.5 py-0.5 bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300">
            {data.counts.due}
          </span>
        </h2>
        <Link to="/leads" className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
          {t('Open')} <ArrowRight size={12} />
        </Link>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-slate-800">
        {data.data.map(l => {
          const late = !!l.followUpOn && l.followUpOn.slice(0, 10) < now;
          return (
            <li key={l.id} className="py-2 flex items-center gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                  {l.name}
                  {l.status === 'trial' && <Ticket size={12} className="inline ml-1.5 -mt-0.5 text-purple-500" aria-label={t('On trial')} />}
                </p>
                <p className={`text-xs ${late ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>
                  {late ? t('Overdue') : t('Today')}{l.interest ? ` · ${l.interest}` : ''}
                </p>
              </div>
              {l.phone && (
                <a href={`tel:${l.phone}`} className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                  {t('Call')}
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {data.counts.due > data.data.length && (
        <Link to="/leads" className="block mt-2 text-xs text-gray-500 dark:text-slate-400 hover:underline">
          {t('and {count} more', { count: data.counts.due - data.data.length })}
        </Link>
      )}
    </Card>
  );
}
