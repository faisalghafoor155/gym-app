import { useCallback, useEffect, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { apiError } from '../../api/client';
import { Card, InlineEmpty, Spinner, focusRing, secondaryButton } from '../ui';
import ConfirmDialog from '../ConfirmDialog';
import type { MyBooking, MyScheduleSlot, Paginated } from '../../types';
import { translate, useLanguage, type Language } from '../../context/LanguageContext';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** A date as the API wants it, and as a day the member reads. In Urdu the
 *  weekday comes from the dictionary, since the browser's locale names it in
 *  English. */
const iso = (d: Date): string => d.toISOString();
const dayLabel = (d: Date, lang: Language): string =>
  lang === 'ur'
    ? `${translate(lang, WEEKDAYS[d.getDay()]!)}, ${d.getDate()} ${d.toLocaleDateString('en', { month: 'short' })}`
    : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

const isToday = (d: Date): boolean => {
  const today = new Date();
  return d.toDateString() === today.toDateString();
};

/** Midnight, so a day is compared as a day rather than as an instant. */
const atMidnight = (d: Date): Date => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

/**
 * The member's own class timetable, and the bookings they hold.
 *
 * One day at a time rather than a week: a phone at the gym shows a day
 * legibly and a week only as something to pinch at. The arrows move the day,
 * and the server decides which sessions recur on it.
 */
export default function MyClasses({ onChange }: { onChange?: () => void }) {
  const { lang, t } = useLanguage();
  const [day, setDay] = useState(() => atMidnight(new Date()));
  const [slots, setSlots] = useState<MyScheduleSlot[] | null>(null);
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<MyBooking | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [schedule, mine] = await Promise.all([
        api.get<MyScheduleSlot[]>(`/me/schedule?date=${iso(day)}`),
        api.get<Paginated<MyBooking>>('/me/bookings?limit=25'),
      ]);
      setSlots(schedule.data);
      setBookings(mine.data.data);
    } catch (err) {
      toast.error(apiError(err, t('Could not load classes')));
      // Left as an empty timetable rather than null, so the day still renders
      // its own "nothing on" state instead of spinning for ever.
      setSlots([]);
    }
  }, [day, t]);

  useEffect(() => { void load(); }, [load]);

  const book = async (slot: MyScheduleSlot): Promise<void> => {
    setBusy(slot.id);
    try {
      await api.post('/me/bookings', { scheduleId: slot.id, bookingDate: iso(day) });
      toast.success(t('Booked into {name}', { name: slot.className }));
      await load();
      onChange?.();
    } catch (err) {
      // The server's message is the useful one — it distinguishes a full class
      // from a lapsed membership, and says to renew in the second case.
      toast.error(apiError(err, t('Could not book that class')));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (booking: MyBooking): Promise<void> => {
    setBusy(booking.id);
    try {
      await api.delete(`/me/bookings/${booking.id}`);
      toast.success(t('Booking cancelled'));
      setCancelling(null);
      await load();
      onChange?.();
    } catch (err) {
      toast.error(apiError(err, t('Could not cancel that booking')));
    } finally {
      setBusy(null);
    }
  };

  const shiftDay = (by: number): void => {
    const next = new Date(day);
    next.setDate(next.getDate() + by);
    setDay(atMidnight(next));
  };

  /** Bookings still ahead, which is what a member checks before leaving home. */
  const upcoming = bookings.filter(
    b => b.status === 'booked' && atMidnight(new Date(b.bookingDate)) >= atMidnight(new Date()),
  );

  return (
    <div className="space-y-5">
      {upcoming.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-blue-600" /> {t('Your next classes')}
          </h2>
          <ul className="space-y-2">
            {upcoming.map(b => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 dark:border-slate-800 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {b.className}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {new Date(b.bookingDate).toLocaleDateString()} · {b.startTime}–{b.endTime}
                    {b.trainerName && ` · ${b.trainerName}`}
                  </p>
                </div>
                <button
                  onClick={() => setCancelling(b)}
                  disabled={busy === b.id}
                  className={`shrink-0 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 ${focusRing} rounded-lg px-2 py-1`}
                >
                  {t('Cancel')}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 min-w-0">
            <Calendar size={16} className="text-blue-600" />
            <span className="truncate">{dayLabel(day, lang)}</span>
            {isToday(day) && (
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0">
                {t('Today')}
              </span>
            )}
          </h2>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => shiftDay(-1)}
              aria-label={t('Previous day')}
              className={`p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 ${focusRing}`}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => shiftDay(1)}
              aria-label={t('Next day')}
              className={`p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 ${focusRing}`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {slots === null ? (
          <div className="flex justify-center py-8">
            <Spinner className="w-6 h-6" />
          </div>
        ) : slots.length === 0 ? (
          <InlineEmpty message={t('No classes scheduled for this day.')} />
        ) : (
          <ul className="space-y-3">
            {slots.map(slot => {
              const full = slot.remainingCapacity === 0 && !slot.booked;
              return (
                <li
                  key={slot.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 dark:border-slate-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                      {slot.className}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      {slot.startTime}–{slot.endTime}
                      {slot.trainerName && ` · ${slot.trainerName}`}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                      <Users size={11} />
                      {/* What is left, not who is in it: the API counts the
                          others and never names them. */}
                      {t('{left} of {capacity} places left', { left: slot.remainingCapacity, capacity: slot.capacity })}
                    </p>
                  </div>

                  {slot.booked ? (
                    <span className="shrink-0 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300">
                      {t('Booked')}
                    </span>
                  ) : (
                    <button
                      onClick={() => void book(slot)}
                      disabled={full || busy === slot.id}
                      className={`shrink-0 ${secondaryButton} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {busy === slot.id ? t('Booking…') : full ? t('Full') : t('Book')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {cancelling && (
        <ConfirmDialog
          title={t('Give up this place?')}
          message={t('Cancel your place in {name} on {date}? Someone else can take it.', { name: cancelling.className, date: new Date(cancelling.bookingDate).toLocaleDateString() })}
          confirmLabel={t('Cancel booking')}
          tone="danger"
          busy={busy === cancelling.id}
          onConfirm={() => void cancel(cancelling)}
          onCancel={() => setCancelling(null)}
        />
      )}
    </div>
  );
}
