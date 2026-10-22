import { useState } from 'react';
import { UserX, MessageCircle, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Page, PageHeader, Card, PageLoader, LoadFailed, EmptyState, Refetching, SegmentedControl,
  secondaryButton,
} from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { openWhatsApp, createMissYouMessage } from '../utils/whatsapp';
import type { InactiveMember } from '../types';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });

const CHOICES = ['default', '7', '14', '21', '30'] as const;
type Choice = (typeof CHOICES)[number];

/**
 * Members who are paying but have stopped coming — the people most likely
 * not to renew, and the ones a call this week can still bring back.
 */
export default function InactiveMembers() {
  const { gym } = useAuth();
  const [choice, setChoice] = useState<Choice>('default');
  const { data, loading, refetching } = useFetch<{ days: number; defaultDays: number; data: InactiveMember[] }>(
    `/attendance/inactive${choice === 'default' ? '' : `?days=${choice}`}`, 'Could not load inactive members',
  );

  const message = (m: InactiveMember) => {
    if (!m.phone) { toast.error('No phone number recorded for this member'); return; }
    openWhatsApp(m.phone, createMissYouMessage(m.name, gym?.name, m.daysAway));
  };

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title="Could not load inactive members" />;

  return (
    <Page>
      <PageHeader icon={UserX} title="Inactive Members"
        subtitle={`Active memberships with no check-in for ${data.days}+ days`} />

      <div className="mb-4">
        <SegmentedControl<Choice>
          value={choice}
          onChange={setChoice}
          options={CHOICES.map(c => ({
            value: c,
            label: c === 'default' ? `${data.defaultDays} days (default)` : `${c} days`,
          }))}
        />
      </div>

      {data.data.length === 0 ? (
        <EmptyState icon={UserX} title="Everyone is coming in"
          hint={`No member with a running membership has been away for ${data.days} days or more.`} />
      ) : (
        <Refetching busy={refetching}>
          <Card className="p-2 sm:p-4">
            <ul className="divide-y divide-gray-100 dark:divide-slate-800">
              {data.data.map(m => (
                <li key={m.id} className="py-3 px-2 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                      {m.name} <span className="text-xs font-medium text-gray-400">{m.memberNo}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                      <Phone size={11} /> {m.phone || 'No phone'} · {m.planName} · {m.daysLeft}d left
                    </p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className={`text-sm font-bold ${m.daysAway >= 21 ? 'text-red-600 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                      {m.daysAway} days away
                    </p>
                    <p className="text-xs text-gray-400">
                      {m.lastVisit ? `Last visit ${shortDate(m.lastVisit)}` : 'Never checked in'}
                    </p>
                  </div>
                  {m.phone && (
                    <button onClick={() => message(m)} className={`${secondaryButton} !py-1.5 !px-3 text-emerald-600 shrink-0`}>
                      <MessageCircle size={14} /> We miss you
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </Refetching>
      )}
    </Page>
  );
}
