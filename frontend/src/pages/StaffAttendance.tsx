import { useState } from 'react';
import { UserCheck, LogIn, LogOut, Users, Clock, Palmtree } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Page, PageHeader, Card, StatTile, PageLoader, LoadFailed, EmptyState, Refetching,
  primaryButton, secondaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useLanguage } from '../context/LanguageContext';
import type { StaffAttendanceDay } from '../types';

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Karachi' });

/** "8h 15m" between two instants. */
const span = (from: string, to: string) => {
  const mins = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

/**
 * Today's staff at the desk: one tap in, one tap out.
 *
 * Open to whoever checks members in. Fixing a past day or marking leave is on
 * the Staff Salaries page, because it changes pay.
 */
export default function StaffAttendance() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<string | null>(null);
  const { data, loading, refetching, reload } = useFetch<StaffAttendanceDay>(
    '/staff-attendance', t('Could not load staff attendance'),
  );

  const act = async (staffMemberId: string, name: string, action: 'check-in' | 'check-out') => {
    setBusy(staffMemberId);
    try {
      await api.post(`/staff-attendance/${action}`, { staffMemberId });
      toast.success(action === 'check-in' ? t('{name} checked in', { name }) : t('{name} checked out', { name }));
      await reload();
    } catch (err) {
      toast.error(apiError(err, t('Could not save')));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title={t('Could not load staff attendance')} onRetry={() => void reload()} />;

  return (
    <Page>
      <PageHeader icon={UserCheck} title={t('Staff Attendance')}
        subtitle={new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Karachi' })} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatTile icon={Users} label={t('Staff')} value={data.totals.staff} tone="blue" />
        <StatTile icon={UserCheck} label={t('Came today')} value={data.totals.present} tone="green" />
        <StatTile icon={Clock} label={t('In the gym now')} value={data.totals.in} tone="purple" />
        <StatTile icon={Palmtree} label={t('On leave')} value={data.totals.leave} tone="yellow" />
      </div>

      <Refetching busy={refetching}>
        {data.rows.length === 0 ? (
          <EmptyState icon={Users} title={t('No staff yet')}
            hint={t('Staff are added on the Staff Salaries page — they do not need a login.')} />
        ) : (
          <div className="space-y-2">
            {data.rows.map(({ staffMember: s, record: r }) => {
              const onLeave = r?.status === 'leave';
              const isIn = !!r && !onLeave && !r.checkOutAt;
              const done = !!r?.checkOutAt;
              return (
                <Card key={s.id} className="p-3 sm:p-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{s.name}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate capitalize">
                      {[
                        t(s.role),
                        r?.checkInAt && t('In {time}', { time: time(r.checkInAt) }),
                        r?.checkOutAt && t('Out {time}', { time: time(r.checkOutAt) }),
                        r?.checkInAt && r.checkOutAt && span(r.checkInAt, r.checkOutAt),
                        r?.status === 'half' && t('Half day'),
                        onLeave && t('On leave'),
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {isIn ? (
                    <button disabled={busy === s.id} onClick={() => void act(s.id, s.name, 'check-out')} className={secondaryButton}>
                      <LogOut size={15} /> {t('Check out')}
                    </button>
                  ) : done ? (
                    <span className="text-xs font-semibold text-green-600">{t('Done for today')}</span>
                  ) : (
                    <button disabled={busy === s.id} onClick={() => void act(s.id, s.name, 'check-in')} className={primaryButton}>
                      <LogIn size={15} /> {t('Check in')}
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Refetching>
    </Page>
  );
}
