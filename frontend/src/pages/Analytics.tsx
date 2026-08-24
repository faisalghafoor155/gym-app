import { TrendingUp, Users, CalendarCheck, BarChart3, Clock } from 'lucide-react';
import { Page, PageHeader, Card, StatTile, PageLoader, BarChart, LineChart } from '../components/ui';
import { useFetch } from '../hooks/useFetch';

interface AnalyticsData {
  dailyTrends: { date: string; count: number }[];
  peakHours: { hour: string; count: number }[];
  stats: {
    activeMembers: number;
    todayCheckins: number;
    attendanceRate: number;
  };
}

export default function Analytics() {
  const { data: analytics, loading } = useFetch<AnalyticsData>(
    '/analytics/attendance',
    'Could not load attendance analytics',
  );

  if (loading) return <PageLoader />;

  if (!analytics) {
    return (
      <Page>
        <div className="text-center py-10">
          <p className="text-gray-500">Failed to load analytics data.</p>
        </div>
      </Page>
    );
  }

  // Format daily trends data for LineChart
  const dailyTrendsChartData = analytics.dailyTrends.map(d => ({
    label: new Date(d.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    value: d.count,
  }));

  // Format peak hours data for BarChart (filter only hours with check-ins to prevent clutter, or show active ones)
  const peakHoursChartData = analytics.peakHours
    .filter(h => h.count > 0)
    .map(h => ({
      label: h.hour,
      value: h.count,
    }));

  return (
    <Page>
      <PageHeader
        icon={BarChart3}
        title="Attendance Analytics"
        subtitle="Visual statistics of daily attendance and peak hours check-in times"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <StatTile
          icon={Users}
          tone="blue"
          label="Active Members"
          value={analytics.stats.activeMembers.toLocaleString()}
          hint="Members currently enrolled and active"
        />
        <StatTile
          icon={CalendarCheck}
          tone="green"
          label="Today's Checkins"
          value={analytics.stats.todayCheckins.toLocaleString()}
          hint="Checked-in today"
        />
        <StatTile
          icon={TrendingUp}
          tone="purple"
          label="Attendance Rate"
          value={`${analytics.stats.attendanceRate}%`}
          hint="Active members attending today"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trends Chart */}
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-sm mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            Check-ins Trend (Last 30 Days)
          </h3>
          {dailyTrendsChartData.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-10">No attendance records in the last 30 days</p>
          ) : (
            <div className="h-64 flex flex-col justify-end pt-5">
              <LineChart data={dailyTrendsChartData} height={200} />
            </div>
          )}
        </Card>

        {/* Peak Hours Chart */}
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-sm mb-4 flex items-center gap-2">
            <Clock size={16} className="text-indigo-600" />
            Peak Check-in Hours
          </h3>
          {peakHoursChartData.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-10">No check-in hour logs recorded yet</p>
          ) : (
            <div className="pt-5">
              <BarChart data={peakHoursChartData} height={200} />
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
