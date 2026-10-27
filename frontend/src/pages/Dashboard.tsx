import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserCheck, CreditCard, CalendarCheck,
  AlertTriangle, TrendingUp, TrendingDown, Zap, Trophy, Wallet,
  UserPlus, PhoneCall, Clock, UserMinus, ArrowRight, UserCog, MessageCircle,
} from 'lucide-react';
import Badge from '../components/Badge';
import CelebrationsCard from '../components/dashboard/CelebrationsCard';
import LowStockCard from '../components/dashboard/LowStockCard';
import {
  Page, Card, StatTile, PageLoader, LoadFailed, EmptyState, BarChart, LineChart,
  primaryButton, focusRing,
} from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { openWhatsApp, createExpiryMessage } from '../utils/whatsapp';
import type { DashboardStats } from '../types';

const GYM_IMAGES = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
  'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&q=80',
  'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=800&q=80',
  'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&q=80',
];

/** English; each is translated where it is shown. */
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
  const { t } = useLanguage();
  return (
    <Link
      to={to}
      className={`group flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800
        text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500/40 hover:text-blue-600 dark:hover:text-blue-400
        hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 ${focusRing}`}
    >
      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200 shadow-2xs">
        <Icon size={16} />
      </div>
      <span className="truncate font-semibold tracking-tight">{t(label)}</span>
    </Link>
  );
}

/** A card heading with an optional count chip and "see all" link. */
function PanelHeader({ icon: Icon, tone, title, count, to }: {
  icon: typeof Users; tone: string; title: string; count?: number; to?: string;
}) {
  const { t } = useLanguage();
  return (
    <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2 text-sm">
      <Icon size={16} className={tone} />
      {t(title)}
      {count !== undefined && count > 0 && (
        <span className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-xs font-semibold px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
      {to && (
        <Link to={to} className={`ml-auto text-xs font-medium text-blue-600 hover:underline flex items-center gap-1 ${focusRing}`}>
          {t('View all')} <ArrowRight size={12} />
        </Link>
      )}
    </h2>
  );
}

export default function Dashboard() {
  const [imgIndex] = useState(() => Math.floor(Math.random() * GYM_IMAGES.length));
  const [quoteIndex] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length));
  const { gym, isOwner } = useAuth();
  const { t } = useLanguage();

  const { data: stats, loading } = useFetch<DashboardStats>(
    '/dashboard',
    t('Could not load the dashboard'),
  );

  if (loading) return <PageLoader />;

  // A failed load leaves stats null; render the shell rather than crashing on
  // stats.totalMembers.
  if (!stats) {
    return (
      <LoadFailed
        title={t('Could not load the dashboard')}
        hint={t('The server did not answer. Check the connection and try again.')}
      />
    );
  }

  const hasMembers = stats.totalMembers > 0;
  // Staff never receive the revenue key, so every money section keys off this
  // rather than off the role alone.
  const revenue = stats.revenue;
  const revenueGrowth = revenue ? growth(revenue.thisMonth, revenue.lastMonth) : null;
  const collection = revenue?.collection;
  // Guarded: a month where nothing was owed would divide by zero, and "NaN%"
  // in a progress bar reads as a broken page rather than as an empty month.
  const collectedPercent = collection && collection.expected > 0
    ? Math.round((collection.collected / collection.expected) * 100)
    : 0;

  return (
    <Page>
      <div className="space-y-5 sm:space-y-6">

      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden h-44 sm:h-52 shadow-md ring-1 ring-black/5 dark:ring-white/10 group">
        <img
          src={GYM_IMAGES[imgIndex]}
          alt={t('Gym')}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
        <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-8">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md">
              <Zap size={12} className="fill-yellow-400" />
              {t('Gym Dashboard')}
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight pr-24 sm:pr-0 font-heading tracking-tight drop-shadow-sm">
            {gym?.name || 'GymPro'}
          </h1>
          <p className="text-white/80 text-xs sm:text-sm mt-1.5 italic max-w-lg line-clamp-2 drop-shadow-sm font-medium">
            "{t(MOTIVATIONAL_QUOTES[quoteIndex] ?? '')}"
          </p>
        </div>
        <div className="absolute top-4 right-4 sm:top-5 sm:right-6 bg-white/10 backdrop-blur-md rounded-2xl px-3.5 py-2 text-right border border-white/20 max-w-[45%] sm:max-w-none shadow-sm">
          <p className="text-white/60 text-[11px] font-medium uppercase tracking-wider">{t('Owner')}</p>
          <p className="text-white font-bold text-xs sm:text-sm truncate font-heading">{gym?.ownerName || t('Admin')}</p>
        </div>
      </div>

      {/* An empty gym has no stats worth drawing — one instruction beats a
          wall of zeroes and blank charts. */}
      {!hasMembers ? (
        <EmptyState
          icon={UserPlus}
          title={t('No members yet')}
          hint={t('Register the first member and this dashboard fills in: revenue, check-ins, renewals and everything expiring.')}
          action={
            <Link to="/members?new=1" className={primaryButton}>
              <UserPlus size={16} /> {t('Add the first member')}
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
          hint={stats.peakHour !== null ? t('Busiest {hour}', { hour: hourLabel(stats.peakHour) }) : undefined}
        />
        {revenue ? (
          <StatTile
            icon={Wallet}
            label="This Month"
            value={money(revenue.thisMonth)}
            tone="purple"
            hint={revenueGrowth === null
              ? undefined
              : t('{change}% vs last month', { change: `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth}` })}
          />
        ) : (
          // Named for what it counts. "Payments Due" read as a number of
          // unpaid receipts, or as an amount of money — it is neither. It is
          // how many members' memberships have run out.
          <StatTile icon={CreditCard} label="Expired Memberships" value={stats.duePayments} tone="red" />
        )}
      </div>

      <CelebrationsCard />
      <LowStockCard />

      {/* This month's takings, broken down by what they were for. The whole
          block keys off `revenue`, which the server omits for staff — so there
          is nothing here to hide from them client-side. */}
      {revenue && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-purple-600" />
              <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm">
                {t('This month so far')}
              </h2>
            </div>
            <span className="text-xs text-gray-400 dark:text-slate-500">
              {new Date(revenue.monthToDate.from).toLocaleDateString('en-PK', {
                day: 'numeric', month: 'short',
              })}
              {' – '}
              {new Date(revenue.monthToDate.to).toLocaleDateString('en-PK', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
              {' · '}
              {t(revenue.monthToDate.count === 1 ? '{count} payment' : '{count} payments', { count: revenue.monthToDate.count })}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/20 px-4 py-3">
              <p className="text-xs font-medium text-blue-700">{t('Membership fees')}</p>
              <p className="text-lg font-bold text-blue-900 mt-0.5">
                {money(revenue.monthToDate.membership)}
              </p>
            </div>
            <div className="rounded-xl bg-green-50 dark:bg-green-500/15 border border-green-100 dark:border-green-500/20 px-4 py-3">
              <p className="text-xs font-medium text-green-700">{t('Supplement sales')}</p>
              <p className="text-lg font-bold text-green-900 mt-0.5">
                {money(revenue.monthToDate.supplement)}
              </p>
            </div>
            {/* Only worth a tile when there is something in it — an always-zero
                box trains the eye to skip the row. */}
            {revenue.monthToDate.locker > 0 && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/20 px-4 py-3">
                <p className="text-xs font-medium text-amber-700">{t('Locker rent')}</p>
                <p className="text-lg font-bold text-amber-900 mt-0.5">
                  {money(revenue.monthToDate.locker)}
                </p>
              </div>
            )}
            {revenue.monthToDate.other > 0 && (
              <div className="rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 px-4 py-3">
                <p className="text-xs font-medium text-gray-600 dark:text-slate-300">{t('Other')}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-0.5">
                  {money(revenue.monthToDate.other)}
                </p>
              </div>
            )}
            <div className="rounded-xl bg-purple-600 px-4 py-3 col-span-2 lg:col-span-1 lg:ml-auto lg:w-full">
              <p className="text-xs font-medium text-purple-100">{t('Grand total')}</p>
              <p className="text-xl font-bold text-white mt-0.5">
                {money(revenue.monthToDate.total)}
              </p>
            </div>
          </div>

          {/* What the month left after spending. Shown whenever anything has
              been recorded either way — a gym that has entered no expenses
              yet would otherwise see a "profit" equal to its revenue, which
              reads as a claim rather than as a missing input. */}
          {(revenue.expensesThisMonth > 0 || revenue.thisMonth > 0) && (
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <div className="rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/20 px-4 py-3">
                <p className="text-xs font-medium text-red-700 dark:text-red-300">{t('Expenses')}</p>
                <p className="text-lg font-bold text-red-900 dark:text-red-200 mt-0.5">
                  {money(revenue.expensesThisMonth)}
                </p>
                {revenue.expensesThisMonth === 0 && (
                  <p className="text-[11px] text-red-600/70 dark:text-red-300/70 mt-0.5">
                    {t('None recorded yet')}
                  </p>
                )}
              </div>
              <div
                className={`rounded-xl px-4 py-3 border ${
                  revenue.profitThisMonth >= 0
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-100 dark:border-emerald-500/20'
                    : 'bg-amber-50 dark:bg-amber-500/15 border-amber-100 dark:border-amber-500/20'
                }`}
              >
                <p className={`text-xs font-medium ${
                  revenue.profitThisMonth >= 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}>
                  {revenue.profitThisMonth >= 0 ? t('Profit') : t('Loss')}
                </p>
                <p className={`text-lg font-bold mt-0.5 ${
                  revenue.profitThisMonth >= 0
                    ? 'text-emerald-900 dark:text-emerald-200'
                    : 'text-amber-900 dark:text-amber-200'
                }`}>
                  {money(Math.abs(revenue.profitThisMonth))}
                </p>
              </div>
            </div>
          )}

          {revenue.dueTotal > 0 && (
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-3">
              {t('Not counted above:')} <span className="font-semibold text-red-600 dark:text-red-400">
                {money(revenue.dueTotal)}
              </span>{' '}
              {t('in entries marked due, across all time.')}
            </p>
          )}
        </Card>
      )}

      {/* Who has paid this month and who has not.
          Kept apart from the takings block above because it answers a different
          question: that one is how much came in, this one is how many members
          it came from — and, more to the point, how many are still to come. */}
      {revenue && collection && (collection.settled + collection.pending) > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-blue-600 dark:text-blue-400" />
              <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm">
                {t("This month's fees")}
              </h2>
            </div>
            <Link
              to="/monthly-collection"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('See the full list')} →
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-green-50 dark:bg-green-500/15 border border-green-100 dark:border-green-500/20 px-4 py-3">
              <p className="text-xs font-medium text-green-700 dark:text-green-300">{t('Paid')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-0.5">
                {t(collection.settled === 1 ? '{count} member' : '{count} members', { count: collection.settled })}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{money(collection.collected)}</p>
            </div>

            <div className={`rounded-xl px-4 py-3 border ${
              collection.pending > 0
                ? 'bg-red-50 dark:bg-red-500/15 border-red-100 dark:border-red-500/20'
                : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-800'
            }`}>
              <p className={`text-xs font-medium ${
                collection.pending > 0
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-gray-600 dark:text-slate-300'
              }`}>
                {t('Still to pay')}
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-0.5">
                {t(collection.pending === 1 ? '{count} member' : '{count} members', { count: collection.pending })}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{money(collection.shortfall)}</p>
            </div>

            <div className="rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 px-4 py-3">
              <p className="text-xs font-medium text-gray-600 dark:text-slate-300">{t('Expected')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-0.5">
                {money(collection.expected)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {t('from {count} members', { count: collection.settled + collection.pending })}
              </p>
            </div>

            <div className="rounded-xl bg-blue-600 px-4 py-3">
              <p className="text-xs font-medium text-blue-100">{t('Collected')}</p>
              <p className="text-xl font-bold text-white mt-0.5">{collectedPercent}%</p>
              <div className="w-full bg-blue-500/40 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-white h-full rounded-full transition-all"
                  style={{ width: `${collectedPercent}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Activity Overview Bar */}
      <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{t('Membership Health')}</h2>
            </div>
            <span className="text-xs text-gray-400 dark:text-slate-500">
              {t('{percent}% active', { percent: Math.round((stats.activeMembers / stats.totalMembers) * 100) })}
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden flex gap-0.5">
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
            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {t('Active')}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> {t('Expiring soon')}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> {t('Expired')}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" /> {t('Lapsed')}
              <span className="text-gray-400 dark:text-slate-500">({stats.lapsedMembers})</span>
            </span>
          </div>
      </Card>

      {/* Charts */}
      <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${revenue ? 'lg:grid-cols-2' : ''}`}>

          {/* Revenue — owner only; staff never receive the data behind it. */}
          {revenue && (
            <Card className="p-5">
              <div className="flex items-start justify-between mb-4 gap-3">
                <h2 className="font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 text-sm">
                  <Wallet size={16} className="text-purple-600" />
                  {t('Revenue')}
                </h2>
                {revenueGrowth !== null && (
                  <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    revenueGrowth >= 0
                      ? 'bg-green-50 dark:bg-green-500/15 text-green-700'
                      : 'bg-red-50 dark:bg-red-500/15 text-red-700'
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
              <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{t('Collected this month')}</p>
                  <p className="font-bold text-gray-900 dark:text-slate-100">{money(revenue.thisMonth)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{t('Outstanding dues')}</p>
                  <p className="font-bold text-red-600">{money(revenue.dueTotal)}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Attendance trend */}
          <Card className="p-5">
            <div className="flex items-start justify-between mb-4 gap-3">
              <h2 className="font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 text-sm">
                <CalendarCheck size={16} className="text-blue-600" />
                {t('Check-ins · last 30 days')}
              </h2>
              {stats.peakHour !== null && (
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/60 px-2 py-0.5 rounded-full">
                  <Clock size={12} /> {t('Peak {hour}', { hour: hourLabel(stats.peakHour) })}
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
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              {t('{count} check-ins in the last 30 days', { count: stats.attendanceByDay.reduce((s, d) => s + d.count, 0) })}
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
                <Users size={32} className="text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400 dark:text-slate-500">{t('No members yet')}</p>
              </div>
            ) : (
              <>
                {/* Mobile: stacked rows */}
                <ul className="divide-y divide-gray-50 dark:divide-slate-800 sm:hidden">
                  {stats.recentMembers.map(m => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-slate-100 text-sm truncate">{m.name}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {m.currentMembership?.planName ?? t('No membership')}
                        </p>
                      </div>
                      {m.currentMembership && <Badge status={m.currentMembership.status} />}
                    </li>
                  ))}
                </ul>

                {/* Desktop: table */}
                <table className="w-full text-sm hidden sm:table">
                  <thead>
                    <tr className="text-left text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-800">
                      <th className="pb-2 font-medium text-xs uppercase tracking-wider">{t('Name')}</th>
                      <th className="pb-2 font-medium text-xs uppercase tracking-wider">{t('Plan')}</th>
                      <th className="pb-2 font-medium text-xs uppercase tracking-wider">{t('Status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                    {stats.recentMembers.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                        <td className="py-3 font-medium text-gray-900 dark:text-slate-100">{m.name}</td>
                        <td className="py-3 text-gray-500 dark:text-slate-400">
                          {m.currentMembership?.planName ?? '—'}
                        </td>
                        <td className="py-3">
                          {m.currentMembership
                            ? <Badge status={m.currentMembership.status} />
                            : <span className="text-gray-400 dark:text-slate-500 text-xs">{t('No membership')}</span>}
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
            <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2 text-sm">
              <AlertTriangle size={16} className="text-yellow-500" />
              {t('Expiring Soon')}
              {stats.expiringMembers.length > 0 && (
                <span className="ml-auto bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {stats.expiringMembers.length}
                </span>
              )}
            </h2>
            {stats.expiringMembers.length === 0 ? (
              <div className="text-center py-8">
                <Trophy size={32} className="text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400 dark:text-slate-500">{t('No memberships expiring in 7 days')}</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {stats.expiringMembers.map(m => (
                  <li key={m.id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-500/15 rounded-lg border border-yellow-100 dark:border-yellow-500/20">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">{m.name}</p>
                      <p className="text-gray-500 dark:text-slate-400 text-xs">{m.memberNo} · {m.phone || t('No phone')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {/* daysLeft is counted server-side from midnight, so it
                            does not drift with the hour the page is open. */}
                        <p className="text-yellow-700 font-semibold text-sm">
                          {m.membership.daysLeft === 0 ? t('Today!') : t('{days}d left', { days: m.membership.daysLeft })}
                        </p>
                        <p className="text-gray-400 dark:text-slate-500 text-xs">
                          {new Date(m.membership.expiryDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      {m.phone && (
                        <button
                          type="button"
                          onClick={() => {
                            const text = createExpiryMessage({
                              memberName: m.name,
                              gymName: gym?.name,
                              daysLeft: m.membership.daysLeft,
                              expiryDate: m.membership.expiryDate,
                            });
                            openWhatsApp(m.phone, text);
                          }}
                          title={t('WhatsApp reminder to {name}', { name: m.name })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
                        >
                          <MessageCircle size={13} />
                          <span>{t('WhatsApp')}</span>
                        </button>
                      )}
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
            tone="text-orange-500"
            title="Renewal follow-up"
            count={stats.followUpMembers.length}
            to="/members?status=expired"
          />
          <p className="text-xs text-gray-400 dark:text-slate-500 -mt-2 mb-4">
            {t('Expired within the last 60 days — still worth a call.')}
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {stats.followUpMembers.map(m => (
              <li key={m.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-lg border border-gray-100 dark:border-slate-700/60">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-slate-100 text-sm truncate">{m.name}</p>
                  <p className="text-gray-500 dark:text-slate-400 text-xs truncate">
                    {m.memberNo} · {m.membership.planName}
                  </p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <p className="text-orange-600 dark:text-orange-400 font-semibold text-xs">
                      {t('{days}d ago', { days: Math.abs(m.membership.daysLeft) })}
                    </p>
                    {m.phone ? (
                      <a
                        href={`tel:${m.phone}`}
                        className={`text-xs text-blue-600 font-medium hover:underline inline-flex items-center gap-1 ${focusRing}`}
                      >
                        <PhoneCall size={10} /> {m.phone}
                      </a>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-slate-500">{t('No phone')}</p>
                    )}
                  </div>
                  {m.phone && (
                    <button
                      type="button"
                      onClick={() => {
                        const text = createExpiryMessage({
                          memberName: m.name,
                          gymName: gym?.name,
                          planName: m.membership.planName,
                          daysLeft: m.membership.daysLeft,
                        });
                        openWhatsApp(m.phone, text);
                      }}
                      title={t('Send WhatsApp message to {name}', { name: m.name })}
                      className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700/40 transition-colors"
                    >
                      <MessageCircle size={13} />
                    </button>
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
          className={`flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-gray-300 transition-colors ${focusRing}`}
        >
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <UserMinus size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">
              {t(stats.lapsedMembers === 1 ? '{count} lapsed member' : '{count} lapsed members', { count: stats.lapsedMembers })}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {t('Expired more than 60 days ago and marked inactive.')}
            </p>
          </div>
          <ArrowRight size={16} className="ml-auto text-gray-300 dark:text-slate-600 shrink-0" />
        </Link>
      )}

      </>
      )}

      </div>
    </Page>
  );
}
