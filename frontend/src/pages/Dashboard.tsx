import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserCheck, CreditCard, CalendarCheck,
  AlertTriangle, TrendingUp, TrendingDown, Zap, Trophy, Wallet,
  UserPlus, PhoneCall, Clock, UserMinus, ArrowRight, UserCog,
} from 'lucide-react';
import Badge from '../components/Badge';
import {
  Page, Card, StatTile, PageLoader, EmptyState, BarChart, LineChart,
  primaryButton, secondaryButton, focusRing,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { DashboardStats } from '../types';
import toast from 'react-hot-toast';

const GYM_IMAGES = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
  'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&q=80',
  'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=800&q=80',
  'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&q=80',
];

const MOTIVATIONAL_QUOTES = [
  "Push yourself, because no one else is going to do it for you.",
  "Success starts with self-discipline.",
  "The body achieves what the mind believes.",
  "Train insane or remain the same.",
];

/** Rupees, short enough to sit under a chart bar: 1.2L, 45k, 900. */
const shortMoney = (n: number): string => {
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
};

const money = (n: number): string => `Rs. ${n.toLocaleString('en-PK')}`;

/** 14 → "2 PM". */
const hourLabel = (h: number): string => {
  const suffix = h < 12 ? 'AM' : 'PM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
};

/** Percentage change, or null when there is no baseline to change from. */
const growth = (now: number, before: number): number | null =>
  before === 0 ? null : Math.round(((now - before) / before) * 100);

function QuickAction({ to, icon: Icon, label }: {
  to: string; icon: typeof Users; label: string;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white border border-gray-200
        text-sm font-semibold text-gray-700 hover:border-blue-300 hover:text-blue-700
        hover:bg-blue-50/50 transition-colors ${focusRing}`}
    >
      <Icon size={16} className="text-blue-600 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** A card heading with an optional count chip and "see all" link. */
function PanelHeader({ icon: Icon, tone, title, count, to }: {
  icon: typeof Users; tone: string; title: string; count?: number; to?: string;
}) {
  return (
    <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-sm">
      <Icon size={16} className={tone} />
      {title}
      {count !== undefined && count > 0 && (
        <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
      {to && (
        <Link to={to} className={`ml-auto text-xs font-medium text-blue-600 hover:underline flex items-center gap-1 ${focusRing}`}>
          View all <ArrowRight size={12} />
        </Link>
      )}
    </h2>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgIndex] = useState(() => Math.floor(Math.random() * GYM_IMAGES.length));
  const [quoteIndex] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length));
  const { gym, isOwner } = useAuth();

  useEffect(() => {
    api.get<DashboardStats>('/dashboard')
      .then(r => setStats(r.data))
      .catch(err => toast.error(apiError(err, 'Could not load the dashboard')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  // A failed load leaves stats null; render the shell rather than crashing on
  // stats.totalMembers.
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} />
          </div>
          <p className="font-semibold text-gray-700">Could not load the dashboard</p>
          <p className="text-sm text-gray-400 mt-1">The server did not answer. Check the connection and try again.</p>
          <button onClick={() => window.location.reload()} className={`mt-5 ${secondaryButton}`}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const hasMembers = stats.totalMembers > 0;
  // Staff never receive the revenue key, so every money section keys off this
  // rather than off the role alone.
  const revenue = stats.revenue;
  const revenueGrowth = revenue ? growth(revenue.thisMonth, revenue.lastMonth) : null;

  return (
    <Page>
      <div className="space-y-5 sm:space-y-6">

      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden h-40 sm:h-48 shadow-md">
        <img
          src={GYM_IMAGES[imgIndex]}
          alt="Gym"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-r from-black/70 via-black/40 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center px-5 sm:px-8">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-yellow-400" />
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">
              Gym Dashboard
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight pr-24 sm:pr-0">
            {gym?.name || 'GymPro'}
          </h1>
          <p className="text-white/70 text-xs sm:text-sm mt-1 italic max-w-md line-clamp-2">
            "{MOTIVATIONAL_QUOTES[quoteIndex]}"
          </p>
        </div>
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 text-right border border-white/20 max-w-[45%] sm:max-w-none">
          <p className="text-white/70 text-xs">Owner</p>
          <p className="text-white font-semibold text-xs sm:text-sm truncate">{gym?.ownerName}</p>
        </div>
      </div>

      {/* An empty gym has no stats worth drawing — one instruction beats a
          wall of zeroes and blank charts. */}
      {!hasMembers ? (
        <EmptyState
          icon={UserPlus}
          title="No members yet"
          hint="Register the first member and this dashboard fills in: revenue, check-ins, renewals and everything expiring."
          action={
            <Link to="/members?new=1" className={primaryButton}>
              <UserPlus size={16} /> Add the first member
            </Link>
          }
        />
      ) : (
      <>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <QuickAction to="/members?new=1" icon={UserPlus} label="Add Member" />
        <QuickAction to="/attendance" icon={CalendarCheck} label="Check-in" />
        {/* Taking a fee is counter work, so the shortcut is staff's too. What
            they can then see of the books is narrowed server-side. */}
        <QuickAction to="/payments?new=1" icon={CreditCard} label="Record Payment" />
        {/* Hiring a helper is a thing owners look for on day one and did not
            find, so it gets a shortcut rather than only a sidebar entry.
            `?new=1` opens the form on arrival, as the payments one does. */}
        {isOwner && <QuickAction to="/team?new=1" icon={UserCog} label="Add Staff" />}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile icon={Users} label="Total Members" value={stats.totalMembers} tone="blue" />
        <StatTile icon={UserCheck} label="Active Members" value={stats.activeMembers} tone="green" />
        <StatTile
          icon={CalendarCheck}
          label="Today's Check-ins"
          value={stats.todayAttendance}
          tone="yellow"
          hint={stats.peakHour !== null ? `Busiest ${hourLabel(stats.peakHour)}` : undefined}
        />
        {revenue ? (
          <StatTile
            icon={Wallet}
            label="This Month"
            value={money(revenue.thisMonth)}
            tone="purple"
            hint={revenueGrowth === null
              ? undefined
              : `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth}% vs last month`}
          />
        ) : (
          <StatTile icon={CreditCard} label="Payments Due" value={stats.duePayments} tone="red" />
        )}
      </div>

      {/* This month's takings, broken down by what they were for. The whole
          block keys off `revenue`, which the server omits for staff — so there
          is nothing here to hide from them client-side. */}
      {revenue && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-purple-600" />
              <h2 className="font-semibold text-gray-900 text-sm">
                This month so far
              </h2>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(revenue.monthToDate.from).toLocaleDateString('en-PK', {
                day: 'numeric', month: 'short',
              })}
              {' – '}
              {new Date(revenue.monthToDate.to).toLocaleDateString('en-PK', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
              {' · '}
              {revenue.monthToDate.count} payment{revenue.monthToDate.count === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
              <p className="text-xs font-medium text-blue-700">Membership fees</p>
              <p className="text-lg font-bold text-blue-900 mt-0.5">
                {money(revenue.monthToDate.membership)}
              </p>
            </div>
            <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3">
              <p className="text-xs font-medium text-green-700">Supplement sales</p>
              <p className="text-lg font-bold text-green-900 mt-0.5">
                {money(revenue.monthToDate.supplement)}
              </p>
            </div>
            {/* Only worth a tile when there is something in it — an always-zero
                box trains the eye to skip the row. */}
            {revenue.monthToDate.other > 0 && (
              <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                <p className="text-xs font-medium text-gray-600">Other</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">
                  {money(revenue.monthToDate.other)}
                </p>
              </div>
            )}
            <div className="rounded-xl bg-purple-600 px-4 py-3 col-span-2 lg:col-span-1 lg:ml-auto lg:w-full">
              <p className="text-xs font-medium text-purple-100">Grand total</p>
              <p className="text-xl font-bold text-white mt-0.5">
                {money(revenue.monthToDate.total)}
              </p>
            </div>
          </div>

          {revenue.dueTotal > 0 && (
            <p className="text-xs text-gray-500 mt-3">
              Not counted above: <span className="font-semibold text-red-600">
                {money(revenue.dueTotal)}
              </span> still outstanding.
            </p>
          )}
        </Card>
      )}

      {/* Activity Overview Bar */}
      <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              <h2 className="font-semibold text-gray-900 text-sm">Membership Health</h2>
            </div>
            <span className="text-xs text-gray-400">
              {Math.round((stats.activeMembers / stats.totalMembers) * 100)}% active
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden flex gap-0.5">
            <div
              className="bg-green-500 h-full rounded-l-full transition-all"
              style={{ width: `${(stats.activeMembers / stats.totalMembers) * 100}%` }}
            />
            <div
              className="bg-yellow-400 h-full transition-all"
              style={{ width: `${(stats.expiringMembers.length / stats.totalMembers) * 100}%` }}
            />
            <div
              className="bg-red-400 h-full transition-all"
              style={{ width: `${(stats.followUpMembers.length / stats.totalMembers) * 100}%` }}
            />
            <div
              className="bg-slate-400 h-full rounded-r-full transition-all"
              style={{ width: `${(stats.lapsedMembers / stats.totalMembers) * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Active
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Expiring soon
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Expired
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" /> Lapsed
              <span className="text-gray-400">({stats.lapsedMembers})</span>
            </span>
          </div>
      </Card>

      {/* Charts */}
      <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${revenue ? 'lg:grid-cols-2' : ''}`}>

          {/* Revenue — owner only; staff never receive the data behind it. */}
          {revenue && (
            <Card className="p-5">
              <div className="flex items-start justify-between mb-4 gap-3">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                  <Wallet size={16} className="text-purple-600" />
                  Revenue
                </h2>
                {revenueGrowth !== null && (
                  <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    revenueGrowth >= 0
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {revenueGrowth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(revenueGrowth)}%
                  </span>
                )}
              </div>
              <BarChart data={revenue.byMonth.map(m => ({
                label: m.label,
                value: m.total,
                title: `${m.label}: ${money(m.total)}`,
              }))} format={shortMoney} />
              <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-400">Collected this month</p>
                  <p className="font-bold text-gray-900">{money(revenue.thisMonth)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Outstanding dues</p>
                  <p className="font-bold text-red-600">{money(revenue.dueTotal)}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Attendance trend */}
          <Card className="p-5">
            <div className="flex items-start justify-between mb-4 gap-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                <CalendarCheck size={16} className="text-blue-600" />
                Check-ins · last 30 days
              </h2>
              {stats.peakHour !== null && (
                <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                  <Clock size={12} /> Peak {hourLabel(stats.peakHour)}
                </span>
              )}
            </div>
            <LineChart
              data={stats.attendanceByDay.map(d => ({
                // Axis ends only, so the day number is all the label needs.
                label: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }),
                value: d.count,
              }))}
            />
            <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
              {stats.attendanceByDay.reduce((s, d) => s + d.count, 0)} check-ins in the last 30 days
            </p>
          </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

          {/* Recent Members */}
          <Card className="p-5">
            <PanelHeader icon={Users} tone="text-blue-600" title="Recent Members" to="/members" />
            {stats.recentMembers.length === 0 ? (
              <div className="text-center py-8">
                <Users size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No members yet</p>
              </div>
            ) : (
              <>
                {/* Mobile: stacked rows */}
                <ul className="divide-y divide-gray-50 sm:hidden">
                  {stats.recentMembers.map(m => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{m.name}</p>
                        <p className="text-xs text-gray-500">
                          {m.currentMembership?.planName ?? 'No membership'}
                        </p>
                      </div>
                      {m.currentMembership && <Badge status={m.currentMembership.status} />}
                    </li>
                  ))}
                </ul>

                {/* Desktop: table */}
                <table className="w-full text-sm hidden sm:table">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      <th className="pb-2 font-medium text-xs uppercase tracking-wider">Name</th>
                      <th className="pb-2 font-medium text-xs uppercase tracking-wider">Plan</th>
                      <th className="pb-2 font-medium text-xs uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {stats.recentMembers.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 font-medium text-gray-900">{m.name}</td>
                        <td className="py-3 text-gray-500">
                          {m.currentMembership?.planName ?? '—'}
                        </td>
                        <td className="py-3">
                          {m.currentMembership
                            ? <Badge status={m.currentMembership.status} />
                            : <span className="text-gray-400 text-xs">No membership</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Card>

          {/* Expiring Soon */}
          <Card className="p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-sm">
              <AlertTriangle size={16} className="text-yellow-500" />
              Expiring Soon
              {stats.expiringMembers.length > 0 && (
                <span className="ml-auto bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {stats.expiringMembers.length}
                </span>
              )}
            </h2>
            {stats.expiringMembers.length === 0 ? (
              <div className="text-center py-8">
                <Trophy size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No memberships expiring in 7 days</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {stats.expiringMembers.map(m => (
                  <li key={m.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{m.name}</p>
                      <p className="text-gray-500 text-xs">{m.memberNo} · {m.phone || 'No phone'}</p>
                    </div>
                    <div className="text-right">
                      {/* daysLeft is counted server-side from midnight, so it
                          does not drift with the hour the page is open. */}
                      <p className="text-yellow-700 font-semibold text-sm">
                        {m.membership.daysLeft === 0 ? 'Today!' : `${m.membership.daysLeft}d left`}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {new Date(m.membership.expiryDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
      </div>

      {/* Follow-up: expired, but not yet gone for good. */}
      {stats.followUpMembers.length > 0 && (
        <Card className="p-5">
          <PanelHeader
            icon={PhoneCall}
            tone="text-red-500"
            title="Renewal follow-up"
            count={stats.followUpMembers.length}
            to="/members?status=expired"
          />
          <p className="text-xs text-gray-400 -mt-2 mb-4">
            Expired within the last 60 days — still worth a call.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {stats.followUpMembers.map(m => (
              <li key={m.id} className="flex items-center justify-between gap-3 p-3 bg-red-50/60 rounded-lg border border-red-100">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{m.name}</p>
                  <p className="text-gray-500 text-xs truncate">
                    {m.memberNo} · {m.membership.planName}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-red-600 font-semibold text-xs">
                    {Math.abs(m.membership.daysLeft)}d ago
                  </p>
                  {m.phone ? (
                    <a
                      href={`tel:${m.phone}`}
                      className={`text-xs text-blue-600 font-medium hover:underline inline-flex items-center gap-1 ${focusRing}`}
                    >
                      <PhoneCall size={10} /> {m.phone}
                    </a>
                  ) : (
                    <p className="text-xs text-gray-400">No phone</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Lapsed count — a footnote, not a panel: these are people who stopped
          coming two months ago, not today's work. */}
      {stats.lapsedMembers > 0 && (
        <Link
          to="/members?status=lapsed"
          className={`flex items-center gap-3 p-4 rounded-2xl bg-white border border-gray-200 hover:border-gray-300 transition-colors ${focusRing}`}
        >
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <UserMinus size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">
              {stats.lapsedMembers} lapsed {stats.lapsedMembers === 1 ? 'member' : 'members'}
            </p>
            <p className="text-xs text-gray-400">
              Expired more than 60 days ago and marked inactive.
            </p>
          </div>
          <ArrowRight size={16} className="ml-auto text-gray-300 shrink-0" />
        </Link>
      )}

      </>
      )}

      </div>
    </Page>
  );
}
