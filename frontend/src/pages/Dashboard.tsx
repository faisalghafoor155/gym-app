import { useEffect, useState } from 'react';
import {
  Users, UserCheck, CreditCard, CalendarCheck,
  AlertTriangle, TrendingUp, Zap, Trophy
} from 'lucide-react';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { DashboardStats, MemberStatus } from '../types';
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

function computeStatus(endDate: string): MemberStatus {
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 7) return 'expiring';
  return 'active';
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgIndex] = useState(() => Math.floor(Math.random() * GYM_IMAGES.length));
  const [quoteIndex] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length));
  const { gym } = useAuth();

  useEffect(() => {
    api.get<DashboardStats>('/dashboard')
      .then(r => setStats(r.data))
      .catch(err => toast.error(apiError(err, 'Could not load the dashboard')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // A failed load leaves stats null; render the shell rather than crashing on
  // stats.totalMembers.
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Could not load the dashboard.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-blue-600 font-medium hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">

      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden h-40 sm:h-48 shadow-md">
        <img
          src={GYM_IMAGES[imgIndex]}
          alt="Gym"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
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
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 text-right border border-white/20 max-w-[45%]">
          <p className="text-white/70 text-xs">Owner</p>
          <p className="text-white font-semibold text-xs sm:text-sm truncate">{gym?.ownerName}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Members" value={stats.totalMembers} color="blue" />
          <StatCard icon={UserCheck} label="Active Members" value={stats.activeMembers} color="green" />
          <StatCard icon={CreditCard} label="Payments Due" value={stats.duePayments} color="red" />
        <StatCard icon={CalendarCheck} label="Today's Check-ins" value={stats.todayAttendance} color="yellow" />
      </div>

      {/* Activity Overview Bar */}
      {stats.totalMembers > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
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
              className="bg-red-400 h-full rounded-r-full transition-all"
              style={{ width: `${(stats.duePayments / stats.totalMembers) * 100}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2.5">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Active
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Expiring soon
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Due payments
            </span>
          </div>
        </div>
      )}

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Recent Members */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users size={16} className="text-blue-600" />
              Recent Members
            </h2>
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
                        <p className="text-xs text-gray-500 capitalize">{m.membershipType}</p>
                      </div>
                      <Badge status={computeStatus(m.endDate)} />
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
                        <td className="py-3 text-gray-500 capitalize">{m.membershipType}</td>
                        <td className="py-3"><Badge status={computeStatus(m.endDate)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          {/* Expiring Soon */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
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
                {stats.expiringMembers.map(m => {
                  const daysLeft = Math.ceil((new Date(m.endDate).getTime() - Date.now()) / 86400000);
                  return (
                    <li key={m.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{m.name}</p>
                        <p className="text-gray-500 text-xs">{m.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-yellow-700 font-semibold text-sm">
                          {daysLeft === 0 ? 'Today!' : `${daysLeft}d left`}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {new Date(m.endDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
      </div>

    </div>
  );
}
