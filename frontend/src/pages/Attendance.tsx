import { useEffect, useState } from 'react';
import { Search, CheckCircle2, Clock, Users, CalendarCheck, UserX } from 'lucide-react';
import {
  Page, PageHeader, Card, PageLoader, inputClass, focusRing,
} from '../components/ui';
import api, { apiError } from '../api/client';
import type { Member, AttendanceRecord, CheckinResult, Paginated } from '../types';
import toast from 'react-hot-toast';

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function Attendance() {
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [todayList, setTodayList] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);

  const loadToday = () =>
    api.get<AttendanceRecord[]>('/attendance/today').then(r => setTodayList(r.data));

  useEffect(() => {
    Promise.all([
      // Every member, not a page of them: this list is searched here to find
      // whoever is standing at the desk.
      api.get<Paginated<Member>>('/members?all=true').then(r => setMembers(r.data.data)),
      loadToday(),
    ])
      .catch(err => toast.error(apiError(err, 'Could not load attendance')))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim().length > 0
    ? members.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.phone && m.phone.includes(search))
      )
    : [];

  const checkedInIds = new Set(todayList.map(r => r.memberId));

  const handleCheckin = async (member: Member) => {
    if (checkedInIds.has(member.id)) {
      toast('Already checked in today', { icon: 'ℹ️' });
      return;
    }
    setChecking(member.id);
    try {
      const { data } = await api.post<CheckinResult>(
        '/attendance/checkin', { memberId: member.id },
      );

      // The server is the authority on whether this was a fresh arrival: this
      // page's own guard reads a list fetched seconds ago, so a second
      // receptionist can beat it. Saying "checked in!" for a row somebody else
      // created an hour ago would be a small lie the desk acts on.
      if (data.alreadyCheckedIn) {
        toast(`${member.name} was already checked in today`, { icon: 'ℹ️' });
      } else {
        toast.success(`${member.name} checked in!`);
      }

      // Said separately, and after: an expired membership is not a failed
      // check-in, and the desk can only do something about it while the member
      // is still standing there.
      const ms = data.membership;
      if (!ms) {
        toast(`${member.name} has no membership`, { icon: '⚠️', duration: 6000 });
      } else if (ms.status === 'expired') {
        toast(
          `${member.name}'s membership expired ${Math.abs(ms.daysLeft)} day${
            Math.abs(ms.daysLeft) === 1 ? '' : 's'} ago`,
          { icon: '⚠️', duration: 6000 },
        );
      } else if (ms.status === 'expiring') {
        toast(
          ms.daysLeft === 0
            ? `${member.name}'s membership expires today`
            : `${member.name}'s membership expires in ${ms.daysLeft} day${
              ms.daysLeft === 1 ? '' : 's'}`,
          { icon: '⏳', duration: 5000 },
        );
      }

      await loadToday();
      setSearch('');
    } catch (err) {
      toast.error(apiError(err, 'Check-in failed'));
    } finally {
      setChecking(null);
    }
  };

  if (loading) return <PageLoader />;

  const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Page>
      <PageHeader
        icon={CalendarCheck}
        title="Attendance"
        subtitle={today}
        action={
          <div className="flex gap-3">
            <Card className="px-4 py-2.5 text-center">
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{todayList.length}</p>
              <p className="text-xs text-gray-500">Checked in</p>
            </Card>
            <Card className="px-4 py-2.5 text-center">
              <p className="text-xl sm:text-2xl font-bold text-gray-400">
                {Math.max(0, members.length - todayList.length)}
              </p>
              <p className="text-xs text-gray-500">Absent</p>
            </Card>
          </div>
        }
      />

      <div className="space-y-5 sm:space-y-6">
      {/* Check-in Panel */}
      <Card className="p-4 sm:p-5">
        <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Search size={16} className="text-blue-600" />
          Quick Check-In
        </h2>
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Type member name or phone number..."
            aria-label="Search member to check in"
            className={`${inputClass} pl-10 py-3`}
            autoFocus
          />
        </div>

        {/* Search Results */}
        {search.trim().length > 0 && (
          <div className="mt-3 space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <UserX size={24} className="mx-auto mb-1" />
                <p className="text-sm">No member found</p>
              </div>
            ) : (
              filtered.slice(0, 8).map(m => {
                const isIn = checkedInIds.has(m.id);
                const isLoading = checking === m.id;
                return (
                  <div key={m.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isIn ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-blue-50/30'
                    }`}>
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 overflow-hidden">
                      {m.photo
                        ? <img src={m.photo} alt={m.name} className="w-full h-full object-cover" />
                        : <span className="text-white text-xs font-bold">{getInitials(m.name)}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{m.name}</p>
                      <p className="text-xs text-gray-400">
                        {m.memberNo} · {m.phone || 'No phone'}
                      </p>
                      {/* The front desk needs the membership state before it
                          waves somebody through, not after. */}
                      {m.currentMembership ? (
                        m.currentMembership.status === 'expired' ? (
                          <p className="text-xs font-semibold text-red-600 mt-0.5">
                            Expired {Math.abs(m.currentMembership.daysLeft)}d ago
                          </p>
                        ) : m.currentMembership.status === 'expiring' ? (
                          <p className="text-xs font-semibold text-yellow-700 mt-0.5">
                            Expires in {m.currentMembership.daysLeft}d
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {m.currentMembership.planName}
                          </p>
                        )
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">No membership</p>
                      )}
                    </div>
                    <button
                      onClick={() => void handleCheckin(m)}
                      disabled={isIn || isLoading}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${focusRing} ${
                        isIn
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                      }`}>
                      <CheckCircle2 size={13} />
                      {isIn ? 'Done' : isLoading ? '...' : 'Check In'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {search.trim().length === 0 && (
          <p className="text-center text-gray-400 text-xs mt-4">
            Start typing to search a member
          </p>
        )}
      </Card>

      {/* Today's Log */}
      <Card className="p-4 sm:p-5">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Users size={16} className="text-blue-600" />
          Today's Log
          <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {todayList.length}
          </span>
        </h2>

        {todayList.length === 0 ? (
          <div className="text-center py-10">
            <CalendarCheck size={36} className="text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No check-ins yet today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayList.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <span className="text-xs text-gray-400 font-mono w-5 text-center">{i + 1}</span>
                <div className="w-9 h-9 rounded-lg bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center overflow-hidden shrink-0">
                  {r.member?.photo
                    ? <img src={r.member.photo} alt={r.member.name} className="w-full h-full object-cover" />
                    : <span className="text-white text-xs font-bold">{getInitials(r.member?.name || '?')}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{r.member?.name}</p>
                  <p className="text-xs text-gray-400">{r.member?.phone || '—'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    <Clock size={11} />
                    {new Date(r.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    <span className="text-xs text-green-600 font-medium">Present</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      </div>
    </Page>
  );
}
