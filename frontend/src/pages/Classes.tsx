import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2, Calendar, Clock, Users, BookOpen, User } from 'lucide-react';
import Badge from '../components/Badge';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, PageLoader, EmptyState, SegmentedControl,
  FieldLabel, inputClass, primaryButton, secondaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import toast from 'react-hot-toast';
import type {
  Class, ClassSchedule, ClassBooking, Member, Trainer, Paginated,
} from '../types';

interface ClassForm {
  name: string;
  description: string;
}

const emptyClassForm: ClassForm = {
  name: '',
  description: '',
};

interface ScheduleForm {
  classId: string;
  trainerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number;
}

const emptyScheduleForm = (): ScheduleForm => ({
  classId: '',
  trainerId: '',
  dayOfWeek: 1, // Monday
  startTime: '09:00',
  endTime: '10:00',
  capacity: 20,
});

interface BookingForm {
  scheduleId: string;
  memberId: string;
  bookingDate: string;
}

const emptyBookingForm = (): BookingForm => ({
  scheduleId: '',
  memberId: '',
  bookingDate: new Date().toISOString().split('T')[0]!,
});

type TabType = 'schedule' | 'classes' | 'bookings';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Classes() {
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [classes, setClasses] = useState<Class[]>([]);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [bookings, setBookings] = useState<ClassBooking[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]!);

  // Modals state
  const [showClassModal, setShowClassModal] = useState(false);
  const [classForm, setClassForm] = useState<ClassForm>(emptyClassForm);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(emptyScheduleForm());

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState<BookingForm>(emptyBookingForm());

  const [deactivatingSchedule, setDeactivatingSchedule] = useState<ClassSchedule | null>(null);
  /** A booking awaiting cancel confirmation — the button sits beside "Attended",
   *  and cancelling frees the slot to someone else. */
  const [cancellingBooking, setCancellingBooking] = useState<ClassBooking | null>(null);

  const loadData = async (isStale: () => boolean = () => false) => {
    try {
      const [cRes, tRes, mRes] = await Promise.all([
        // All three feed pickers on this page — the schedule form picks a class
        // and a trainer, the booking form picks a member — so each asks for the
        // complete list rather than a page of it.
        api.get<Paginated<Class>>('/classes?all=true'),
        api.get<Paginated<Trainer>>('/trainers?all=true'),
        api.get<Paginated<Member>>('/members?all=true'),
      ]);
      if (isStale()) return;
      setClasses(cRes.data.data.filter(c => c.isActive));
      setTrainers(tRes.data.data);
      setMembers(mRes.data.data);

      const sRes = await api.get<ClassSchedule[]>(`/classes/schedules?date=${targetDate}`);
      if (isStale()) return;
      setSchedules(sRes.data);

      if (activeTab === 'bookings') {
        // One day's bookings, which is already a narrow slice — the page cap
        // is a backstop rather than something a gym reaches in a day.
        const bRes = await api.get<Paginated<ClassBooking>>(
          `/class-bookings?date=${targetDate}&limit=100`,
        );
        if (isStale()) return;
        setBookings(bRes.data.data);
      }
    } catch (err) {
      if (!isStale()) toast.error(apiError(err, 'Failed to fetch data'));
    } finally {
      if (!isStale()) setLoading(false);
    }
  };

  useEffect(() => {
    // Changing the date or the tab mid-load must not let the previous day's
    // schedules and bookings land under the new one — both calls carry the
    // date they were issued for.
    let cancelled = false;
    setLoading(true);
    void loadData(() => cancelled);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, targetDate]);

  const handleClassSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/classes', classForm);
      toast.success('Class program added successfully');
      setShowClassModal(false);
      setClassForm(emptyClassForm);
      await loadData();
    } catch (err) {
      toast.error(apiError(err, 'Error saving class'));
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/classes/schedules', scheduleForm);
      toast.success('Weekly slot scheduled successfully');
      setShowScheduleModal(false);
      setScheduleForm(emptyScheduleForm());
      await loadData();
    } catch (err) {
      toast.error(apiError(err, 'Error scheduling slot'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateSchedule = async () => {
    if (!deactivatingSchedule) return;
    setSaving(true);
    try {
      await api.delete(`/classes/schedules/${deactivatingSchedule.id}`);
      toast.success('Schedule slot deleted');
      setDeactivatingSchedule(null);
      await loadData();
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete schedule'));
    } finally {
      setSaving(false);
    }
  };

  const handleBookingSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/class-bookings', bookingForm);
      toast.success('Slot booked successfully');
      setShowBookingModal(false);
      setBookingForm(emptyBookingForm());
      await loadData();
    } catch (err) {
      toast.error(apiError(err, 'Error booking class slot'));
    } finally {
      setSaving(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: 'attended' | 'cancelled') => {
    try {
      await api.put(`/class-bookings/${bookingId}`, { status });
      toast.success(`Booking status updated to ${status}`);
      await loadData();
    } catch (err) {
      toast.error(apiError(err, 'Failed to update booking status'));
    }
  };

  // Helper to pre-fill booking form schedule and date
  const prefillBooking = (scheduleId: string) => {
    const defaultBooking = emptyBookingForm();
    defaultBooking.scheduleId = scheduleId;
    defaultBooking.bookingDate = targetDate;
    setBookingForm(defaultBooking);
    setShowBookingModal(true);
  };

  if (loading) return <PageLoader />;

  return (
    <Page>
      <PageHeader
        icon={Calendar}
        title="Group Classes & Schedule"
        subtitle="Manage group classes, weekly repeating slot timetables, and seat reservations."
        action={
          activeTab === 'classes' ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setClassForm(emptyClassForm);
                  setShowClassModal(true);
                }}
                className={secondaryButton}
              >
                <Plus size={16} /> Create Class
              </button>
              <button
                onClick={() => {
                  setScheduleForm(emptyScheduleForm());
                  setShowScheduleModal(true);
                }}
                className={primaryButton}
              >
                <Plus size={16} /> Add Schedule Slot
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setBookingForm(emptyBookingForm());
                setShowBookingModal(true);
              }}
              className={primaryButton}
            >
              <Plus size={16} /> Book Class Slot
            </button>
          )
        }
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <Card className="p-2 shrink-0">
          <SegmentedControl
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'schedule', label: 'Schedule timetable' },
              { value: 'classes', label: 'Programs Directory' },
              { value: 'bookings', label: 'Attending roster' },
            ]}
          />
        </Card>

        {(activeTab === 'schedule' || activeTab === 'bookings') && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar size={14} /> Selected Date:
            </span>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className={`${inputClass} max-w-xs`}
            />
          </div>
        )}
      </div>

      {/* TAB 1: Timetable */}
      {activeTab === 'schedule' && (
        schedules.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No scheduled classes for this date"
            hint="Switch to the Programs Directory to schedule class timetable slots."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {schedules.map(s => {
              const dayName = DAYS[s.dayOfWeek];
              return (
                <Card key={s.id} className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">{s.className}</h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-xs truncate">
                          {s.classDescription || 'No description'}
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                        {dayName}
                      </span>
                    </div>

                    <div className="mt-5 space-y-2 text-sm text-gray-600 dark:text-slate-400">
                      <p className="flex items-center gap-2">
                        <span className="text-gray-400"><Clock size={14} /></span> {s.startTime} - {s.endTime}
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="text-gray-400"><User size={14} /></span> Instructor: {s.trainer?.name || 'Assigned Staff'}
                      </p>
                      <div className="flex items-center justify-between mt-4 p-2 bg-gray-50 dark:bg-slate-800/60 rounded-lg">
                        <span className="text-xs font-semibold flex items-center gap-1"><Users size={12} /> Seats booked</span>
                        <span className={`font-bold text-xs ${s.remainingCapacity === 0 ? 'text-red-600' : 'text-green-700'}`}>
                          {s.bookingsCount} / {s.capacity} ({s.remainingCapacity} left)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 flex gap-3">
                    <button
                      disabled={s.remainingCapacity === 0}
                      onClick={() => prefillBooking(s.id)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold text-center transition-colors ${
                        s.remainingCapacity === 0
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500'
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400'
                      }`}
                    >
                      {s.remainingCapacity === 0 ? 'Class Full' : 'Book Seat'}
                    </button>
                    <button
                      onClick={() => setDeactivatingSchedule(s)}
                      className="px-3 py-2 rounded-lg text-xs font-medium border border-red-100 text-red-600 hover:bg-red-50 dark:border-red-500/10 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* TAB 2: Class Directory */}
      {activeTab === 'classes' && (
        classes.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No class programs registered"
            hint="Create programs like Yoga or Zumba to map them to timeslots."
            action={
              <button
                onClick={() => {
                  setClassForm(emptyClassForm);
                  setShowClassModal(true);
                }}
                className={primaryButton}
              >
                Create first class
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {classes.map(c => (
              <Card key={c.id} className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">{c.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                    {c.description || 'No description provided.'}
                  </p>
                </div>
                <div className="mt-5 text-xs text-gray-400">
                  Registered on: {new Date(c.createdAt).toLocaleDateString()}
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* TAB 3: Bookings List */}
      {activeTab === 'bookings' && (
        bookings.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No bookings logged for this date"
            hint="Book seats for members inside schedules or click Book Class Slot."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500 dark:text-slate-400">
                <thead className="text-xs uppercase bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300 border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-4 font-bold">Member</th>
                    <th className="px-6 py-4 font-bold">Class Program</th>
                    <th className="px-6 py-4 font-bold">Scheduled Time</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {bookings.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/20">
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-200">
                        {b.member.name}
                      </td>
                      <td className="px-6 py-4">
                        {b.schedule.className}
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1">
                          <Clock size={13} className="text-gray-400" />
                          {b.schedule.startTime} - {b.schedule.endTime} ({DAYS[b.schedule.dayOfWeek]})
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={b.status} />
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {b.status === 'booked' && (
                          <>
                            <button
                              onClick={() => updateBookingStatus(b.id, 'attended')}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/30 dark:hover:bg-green-950/50 dark:text-green-400"
                            >
                              Attended
                            </button>
                            <button
                              onClick={() => setCancellingBooking(b)}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/30 dark:hover:bg-red-950/50 dark:text-red-400"
                            >
                              Cancel Booking
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* The action buttons sat in the right-hand cell, which is exactly
                what scrolls out of reach on a phone. Stacked, they stay put. */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-800">
              {bookings.map(b => (
                <div key={b.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-slate-200 truncate">
                        {b.member.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {b.schedule.className}
                      </p>
                    </div>
                    <Badge status={b.status} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Clock size={12} className="text-gray-400" />
                    {b.schedule.startTime} - {b.schedule.endTime} ({DAYS[b.schedule.dayOfWeek]})
                  </p>
                  {b.status === 'booked' && (
                    <div className="flex gap-2 pt-0.5">
                      <button
                        onClick={() => updateBookingStatus(b.id, 'attended')}
                        className="flex-1 px-2.5 py-2 rounded-lg text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/30 dark:hover:bg-green-950/50 dark:text-green-400"
                      >
                        Attended
                      </button>
                      <button
                        onClick={() => setCancellingBooking(b)}
                        className="flex-1 px-2.5 py-2 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/30 dark:hover:bg-red-950/50 dark:text-red-400"
                      >
                        Cancel Booking
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )
      )}

      {/* MODAL: Class Create */}
      {showClassModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-4">Create Class Program</h3>
            <form onSubmit={handleClassSave} className="space-y-4">
              <div>
                <FieldLabel htmlFor="classes-class-name">Class Name</FieldLabel>
                <input id="classes-class-name"
                  required
                  value={classForm.name}
                  onChange={e => setClassForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Yoga Vinyasa Flow"
                  className={inputClass}
                />
              </div>

              <div>
                <FieldLabel htmlFor="classes-description">Description</FieldLabel>
                <textarea id="classes-description"
                  value={classForm.description}
                  onChange={e => setClassForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe focus, target skills, level requirements..."
                  rows={4}
                  className={inputClass}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className={secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={primaryButton}
                >
                  {saving ? 'Creating…' : 'Create Class'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Schedule Create */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-4">Add Weekly Schedule Slot</h3>
            <form onSubmit={handleScheduleSave} className="space-y-4">
              <div>
                <FieldLabel htmlFor="classes-select-class-program">Select Class Program</FieldLabel>
                <select id="classes-select-class-program"
                  required
                  value={scheduleForm.classId}
                  onChange={e => setScheduleForm(prev => ({ ...prev, classId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">-- Choose Class --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="classes-instructor-trainer">Instructor (Trainer)</FieldLabel>
                <select id="classes-instructor-trainer"
                  value={scheduleForm.trainerId}
                  onChange={e => setScheduleForm(prev => ({ ...prev, trainerId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">No specific instructor</option>
                  {trainers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.specialization || 'Fitness'})</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="classes-day-of-the-week">Day of the Week</FieldLabel>
                <select id="classes-day-of-the-week"
                  value={scheduleForm.dayOfWeek}
                  onChange={e => setScheduleForm(prev => ({ ...prev, dayOfWeek: Number(e.target.value) }))}
                  className={inputClass}
                >
                  {DAYS.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="classes-start-time">Start Time</FieldLabel>
                  <input id="classes-start-time"
                    required
                    type="time"
                    value={scheduleForm.startTime}
                    onChange={e => setScheduleForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="classes-end-time">End Time</FieldLabel>
                  <input id="classes-end-time"
                    required
                    type="time"
                    value={scheduleForm.endTime}
                    onChange={e => setScheduleForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="classes-booking-capacity-seats">Booking Capacity (Seats)</FieldLabel>
                <input id="classes-booking-capacity-seats"
                  required
                  type="number"
                  min="1"
                  value={scheduleForm.capacity}
                  onChange={e => setScheduleForm(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className={secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={primaryButton}
                >
                  {saving ? 'Scheduling…' : 'Schedule Slot'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Book Slot */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-4">Book Group Class Slot</h3>
            <form onSubmit={handleBookingSave} className="space-y-4">
              <div>
                <FieldLabel htmlFor="classes-select-member">Select Member</FieldLabel>
                <select id="classes-select-member"
                  required
                  value={bookingForm.memberId}
                  onChange={e => setBookingForm(prev => ({ ...prev, memberId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">-- Choose Member --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.memberNo})</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="classes-select-schedule-slot">Select Schedule Slot</FieldLabel>
                <select id="classes-select-schedule-slot"
                  required
                  value={bookingForm.scheduleId}
                  onChange={e => setBookingForm(prev => ({ ...prev, scheduleId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">-- Choose Schedule Slot --</option>
                  {schedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.className} on {DAYS[s.dayOfWeek]} at {s.startTime} ({s.remainingCapacity} seats left)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="classes-booking-target-date">Booking Target Date</FieldLabel>
                <input id="classes-booking-target-date"
                  required
                  type="date"
                  value={bookingForm.bookingDate}
                  onChange={e => setBookingForm(prev => ({ ...prev, bookingDate: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className={secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={primaryButton}
                >
                  {saving ? 'Booking…' : 'Book Session'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Confirm Deactivate Schedule Dialog */}
      {!!deactivatingSchedule && (
        <ConfirmDialog
          title="Delete Schedule Slot"
          message={`Are you sure you want to remove this weekly scheduled slot for class "${deactivatingSchedule.className}"? Members will no longer be able to book this slot, but historical bookings will remain preserved.`}
          confirmLabel="Delete"
          onConfirm={handleDeactivateSchedule}
          onCancel={() => setDeactivatingSchedule(null)}
          busy={saving}
          tone="danger"
        />
      )}

      {!!cancellingBooking && (
        <ConfirmDialog
          title="Cancel booking"
          message={`Cancel ${cancellingBooking.member.name}'s booking for ${cancellingBooking.schedule.className} at ${cancellingBooking.schedule.startTime}? The slot is freed for another member.`}
          confirmLabel="Cancel booking"
          onConfirm={() => {
            void updateBookingStatus(cancellingBooking.id, 'cancelled');
            setCancellingBooking(null);
          }}
          onCancel={() => setCancellingBooking(null)}
          busy={saving}
          tone="danger"
        />
      )}
    </Page>
  );
}
