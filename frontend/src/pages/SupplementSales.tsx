import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ArrowLeft, TrendingUp, Package, ShoppingCart } from 'lucide-react';
import {
  Page, PageHeader, Card, StatTile, PageLoader, EmptyState, BarChart, SegmentedControl,
  secondaryButton,
} from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import ProfitByProduct from '../components/supplements/ProfitByProduct';
import { downloadFromServer } from '../utils/csv';
import type { SalesReport } from '../types';
import toast from 'react-hot-toast';

const money = (n: number): string => `Rs. ${n.toLocaleString('en-PK')}`;

/** How far back the report looks. Six months is the default the gym asked for;
 *  the others are there because "is this month unusual?" needs a comparison. */
const RANGES = [
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year' },
] as const;

export default function SupplementSales() {
  const [months, setMonths] = useState<string>('6');
  const { data: report, loading } = useFetch<SalesReport>(
    `/supplements/sales/report?months=${months}`,
    'Could not load the sales report',
  );

  const [exporting, setExporting] = useState(false);

  /**
   * Built by the server from every sale in the window.
   *
   * The report on screen shows the fifty most recent, which is a list a person
   * can read. A file built from those fifty would look complete and not be,
   * and nothing in it would say which sales were left out.
   */
  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadFromServer(`/api/supplements/sales/export?months=${months}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not export sales');
    } finally {
      setExporting(false);
    }
  };

  if (loading && !report) return <PageLoader />;

  // A month with no sales still gets a bar, so a quiet month reads as quiet
  // rather than as missing data.
  const chartData = (report?.byMonth ?? []).map(m => ({
    label: m.label.split(' ')[0]!,
    value: m.revenue,
    title: `${m.label}: ${money(m.revenue)} from ${m.units} units`,
  }));

  const best = report?.byMonth.reduce(
    (top, m) => (m.revenue > top.revenue ? m : top),
    report.byMonth[0] ?? { label: '', revenue: 0, units: 0, sales: 0, month: '' },
  );

  return (
    <Page>
      <PageHeader
        icon={BarChart3}
        title="Supplement Sales"
        subtitle="What sold, when, and for how much"
        action={
          <div className="flex gap-2">
            <Link to="/supplements" className={secondaryButton}>
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Supplements</span>
            </Link>
            <button
              onClick={() => void handleExport()}
              disabled={exporting || !report || report.totalUnits === 0}
              className={secondaryButton}
              title="Exports every sale in the window, not just the recent ones shown"
            >
              <span className="hidden sm:inline">{exporting ? 'Exporting…' : 'Export CSV'}</span>
              <span className="sm:hidden">CSV</span>
            </button>
          </div>
        }
      />

      <div className="mb-5">
        <SegmentedControl
          value={months}
          onChange={setMonths}
          options={RANGES.map(r => ({ value: r.value, label: r.label }))}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <StatTile icon={TrendingUp} label="Revenue" value={money(report?.totalRevenue ?? 0)} tone="green" />
        <StatTile icon={Package} label="Units sold" value={report?.totalUnits ?? 0} tone="blue" />
        <StatTile icon={ShoppingCart} label="Sales" value={report?.recent.length ?? 0} tone="purple" />
        <StatTile
          icon={BarChart3}
          label="Best month"
          value={best && best.revenue > 0 ? best.label : '—'}
          tone="yellow"
          hint={best && best.revenue > 0 ? money(best.revenue) : 'No sales yet'}
        />
      </div>

      {report && report.totalUnits === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No sales in this period"
          hint="Sell something from the Supplements page and it will show up here."
        />
      ) : (
        <>
          <Card className="p-5 mb-5">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4">Revenue by month</h2>
            <BarChart data={chartData} format={money} />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-5">
              <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4">Top sellers</h2>
              {report && report.byProduct.length > 0 ? (
                <div className="space-y-2.5">
                  {report.byProduct.slice(0, 8).map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{p.units} units</p>
                      </div>
                      <span className="text-sm font-bold text-green-700 shrink-0">
                        {money(p.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-slate-500">Nothing sold yet.</p>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4">Recent sales</h2>
              {report && report.recent.length > 0 ? (
                <div className="space-y-2.5 max-h-96 overflow-y-auto">
                  {report.recent.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-3 pb-2.5 border-b border-gray-50 dark:border-slate-800 last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">
                          {s.supplementName} <span className="text-gray-400 dark:text-slate-500">x{s.quantity}</span>
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                          {s.buyer} · {new Date(s.soldAt).toLocaleDateString('en-PK', {
                            day: 'numeric', month: 'short',
                          })}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-slate-100 shrink-0">{money(s.total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-slate-500">No sales yet.</p>
              )}
            </Card>
          </div>
        </>
      )}

      <div className="mt-5">
        <ProfitByProduct />
      </div>
    </Page>
  );
}
