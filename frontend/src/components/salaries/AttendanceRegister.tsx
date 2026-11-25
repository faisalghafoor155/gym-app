import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { apiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useFetch } from '../../hooks/useFetch';
import { Card, EmptyState, FieldLabel, LoadFailed, PageLoader, Refetching, inputClass, primaryButton } from '../ui';
import { monthName } from '../../utils/dates';
import type { GymSettings, StaffAttendanceMonth, StaffDayStatus } from '../../types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** A tap moves a day on to the next state, round to absent. */
const NEXT: Record<StaffDayStatus | 'absent', StaffDayStatus | 'absent'> = {
  absent: 'present', present: 'half', half: 'leave', leave: 'absent',
};

const CELL: Record<StaffDayStatus | 'absent' | 'off' | 'future', string> = {
  present: 'bg-green-500 text-white',
  half: 'bg-lime-300 text-lime-900 dark:bg-lime-500/60 dark:text-white',
  leave: 'bg-sky-400 text-white',
  absent: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  off: 'bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-500',
  future: 'bg-transparent text-gray-300 dark:text-slate-600',
};
const LETTER: Record<StaffDayStatus | 'absent' | 'off' | 'future', string> = {
  present: 'P', half: '½', leave: 'L', absent: 'A', off: '–', future: '',
};

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

/** The gym's weekly off and whether absences are cut. The owner's to change. */
function Rules({ onSaved }: { onSaved: () => void }) {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [weeklyOff, setWeeklyOff] = useState('');
  const [deduct, setDeduct] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api.get<GymSettings>('/gym-settings').then(r => {
      setSettings(r.data);
      setWeeklyOff(r.data.staffWeeklyOff == null ? '' : String(r.data.staffWeeklyOff));
      setDeduct(!!r.data.staffAbsenceDeduction);
    }).catch(() => { /* the card simply stays hidden */ });
  }, []);

  if (!settings) return null;

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/gym-settings', {
        // The settings endpoint always takes the PT fee; send it back unchanged.
        defaultPtFee: settings.defaultPtFee,
        staffWeeklyOff: weeklyOff === '' ? null : Number(weeklyOff),
        staffAbsenceDeduction: deduct,
      });
      toast.success(t('Saved'));
      onSaved();
    } catch (err) {
      toast.error(apiError(err, t('Could not save')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-3 items-end">
        <div>
          <FieldLabel htmlFor="staff-off">{t('Weekly day off')}</FieldLabel>
          <select id="staff-off" value={weeklyOff} onChange={e => setWeeklyOff(e.target.value)} className={inputClass}>
            <option value="">{t('None — staff work every day')}</option>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{t(d)}</option>)}
          </select>
        </div>
        <label className="flex items-start gap-2 text-sm pb-2">
          <input type="checkbox" className="mt-0.5" checked={deduct} onChange={e => setDeduct(e.target.checked)} />
          <span>
            {t('Cut salary for absent days')}
            <span className="block text-xs text-gray-500 dark:text-slate-400">
              {t('Each working day not marked present or leave costs a day’s pay (salary ÷ days in the month). Only turn this on once staff are checked in every day.')}
            </span>
          </span>
        </label>
        <button onClick={() => void save()} disabled={saving} className={primaryButton}>{saving ? t('Saving…') : t('Save')}</button>
      </div>
    </Card>
  );
}

/**
 * The month's register: a row per person, a cell per day.
 *
 * Tapping a cell steps it present → half day → leave → absent. A paid month is
 * shown but locked, since the slip already counts it.
 */
export default function AttendanceRegister() {
  const { t } = useLanguage();
  const { isOwner } = useAuth();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [saving, setSaving] = useState<string | null>(null);
  const { data, loading, refetching, reload, setData } = useFetch<StaffAttendanceMonth>(
    `/staff-attendance/month?month=${month}`, t('Could not load staff attendance'),
  );

  const toggle = async (staffMemberId: string, day: string, current: StaffDayStatus | 'absent') => {
    const status = NEXT[current];
    const key = `${staffMemberId}:${day}`;
    setSaving(key);
    try {
      await api.put('/staff-attendance/mark', { staffMemberId, day, status });
      // Shown at once; the summary catches up with the reload.
      if (data) {
        setData({
          ...data,
          rows: data.rows.map(r => {
            if (r.staffMember.id !== staffMemberId) return r;
            const days = { ...r.days };
            if (status === 'absent') delete days[day];
            else days[day] = status;
            return { ...r, days };
          }),
        });
      }
      void reload();
    } catch (err) {
      toast.error(apiError(err, t('Could not save')));
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title={t('Could not load staff attendance')} onRetry={() => void reload()} />;

  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const days = Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  const now = today();

  return (
    <>
      {isOwner && <Rules onSaved={() => void reload()} />}

      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <FieldLabel htmlFor="reg-month">{t('Month')}</FieldLabel>
          <input id="reg-month" type="month" max={now.slice(0, 7)} value={month}
            onChange={e => setMonth(e.target.value || now.slice(0, 7))} className={inputClass} />
        </div>
        <div className="flex flex-wrap gap-2 text-xs pb-2">
          {(['present', 'half', 'leave', 'absent', 'off'] as const).map(k => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className={`w-5 h-5 rounded grid place-items-center font-bold ${CELL[k]}`}>{LETTER[k]}</span>
              {t({ present: 'Present', half: 'Half day', leave: 'Leave', absent: 'Absent', off: 'Day off' }[k])}
            </span>
          ))}
        </div>
      </div>

      <Refetching busy={refetching}>
        {data.rows.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t('No staff on the payroll for {month}', { month: monthName(month) })}
            hint={t('Add the people you pay a monthly salary — they do not need a login.')} />
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="text-gray-500 dark:text-slate-400">
                  <th className="sticky left-0 z-10 bg-white dark:bg-slate-900 text-left px-3 py-2 font-semibold min-w-28 sm:min-w-36">{t('Name')}</th>
                  {days.map(d => <th key={d} className="px-0.5 py-2 font-medium w-7 text-center">{Number(d.slice(8))}</th>)}
                  <th className="px-2 py-2 font-semibold text-center">P</th>
                  <th className="px-2 py-2 font-semibold text-center">L</th>
                  <th className="px-2 py-2 font-semibold text-center">A</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(row => {
                  const joined = row.staffMember.joinedOn?.slice(0, 10);
                  return (
                    <tr key={row.staffMember.id} className="border-t border-gray-100 dark:border-slate-800">
                      <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 py-1.5">
                        <p className="font-semibold text-gray-900 dark:text-slate-100 truncate max-w-28 sm:max-w-40">{row.staffMember.name}</p>
                        {row.paid && <p className="text-[10px] text-green-600 font-semibold">{t('Paid · locked')}</p>}
                      </td>
                      {days.map(d => {
                        const status = row.days[d];
                        const isOff = data.weeklyOff !== null && new Date(`${d}T00:00:00Z`).getUTCDay() === data.weeklyOff;
                        const notYet = d > now || (!!joined && d < joined);
                        const look = notYet ? 'future' : status ?? (isOff ? 'off' : 'absent');
                        const key = `${row.staffMember.id}:${d}`;
                        return (
                          <td key={d} className="p-0.5">
                            <button
                              disabled={notYet || row.paid || saving === key}
                              onClick={() => void toggle(row.staffMember.id, d, status ?? 'absent')}
                              aria-label={`${row.staffMember.name} ${d}`}
                              className={`w-6 h-6 rounded font-bold grid place-items-center transition-opacity disabled:cursor-default ${CELL[look]} ${saving === key ? 'opacity-50' : ''}`}
                            >
                              {LETTER[look]}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-2 text-center font-semibold text-green-700 dark:text-green-400">{row.summary.presentDays}</td>
                      <td className="px-2 text-center font-semibold text-sky-600">{row.summary.leaveDays}</td>
                      <td className="px-2 text-center font-semibold text-red-600">{row.summary.absentDays}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </Refetching>
    </>
  );
}
