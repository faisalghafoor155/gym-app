import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, InlineEmpty, SegmentedControl, Spinner } from '../ui';
import { useFetch } from '../../hooks/useFetch';
import type { SupplementProfit } from '../../types';

const money = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`;

/**
 * Revenue, cost and profit per product. Cost is what each sale recorded at
 * the time; products sold before a cost price was entered say so instead of
 * looking like pure profit.
 */
export default function ProfitByProduct() {
  const [months, setMonths] = useState<'1' | '3' | '6' | '12'>('1');
  const { data, loading } = useFetch<SupplementProfit>(`/supplements/profit?months=${months}`, 'Could not load profit');

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
          <TrendingUp size={16} className="text-lime-600" /> Profit by product
        </h2>
        <SegmentedControl value={months} onChange={setMonths} options={[
          { value: '1', label: 'This month' }, { value: '3', label: '3 months' },
          { value: '6', label: '6 months' }, { value: '12', label: '12 months' },
        ]} />
      </div>

      {loading || !data ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : data.data.length === 0 ? (
        <InlineEmpty message="No supplement sales in this period." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4 text-center">
            {[['Revenue', data.totals.revenue, 'text-gray-900 dark:text-slate-100'],
              ['Cost', data.totals.cost, 'text-gray-600 dark:text-slate-300'],
              ['Profit', data.totals.profit, 'text-lime-700 dark:text-lime-400']].map(([label, value, tone]) => (
              <div key={label as string} className="rounded-xl bg-gray-50 dark:bg-slate-800/60 py-2.5">
                <p className={`text-base sm:text-lg font-extrabold ${tone as string}`}>{money(value as number)}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{label as string}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
                  <th className="py-2 pr-3 font-medium">Product</th>
                  <th className="py-2 px-3 font-medium text-right">Sold</th>
                  <th className="py-2 px-3 font-medium text-right">Revenue</th>
                  <th className="py-2 px-3 font-medium text-right">Profit</th>
                  <th className="py-2 pl-3 font-medium text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map(r => (
                  <tr key={r.supplementId} className="border-b border-gray-50 dark:border-slate-800/60">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-gray-800 dark:text-slate-200">{r.name}</p>
                      {r.uncostedUnits > 0 && (
                        <p className="text-[11px] text-yellow-700 dark:text-yellow-400">
                          {r.uncostedUnits} unit{r.uncostedUnits === 1 ? '' : 's'} sold without a cost price
                        </p>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600 dark:text-slate-300">{r.unitsSold}</td>
                    <td className="py-2 px-3 text-right text-gray-600 dark:text-slate-300">{money(r.revenue)}</td>
                    <td className={`py-2 px-3 text-right font-semibold ${r.profit < 0 ? 'text-red-600' : 'text-lime-700 dark:text-lime-400'}`}>
                      {r.marginPct == null ? '—' : money(r.profit)}
                    </td>
                    <td className="py-2 pl-3 text-right text-gray-500 dark:text-slate-400">
                      {r.marginPct == null ? 'No cost' : `${r.marginPct}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.totals.uncostedUnits > 0 && (
            <p className="text-xs text-gray-400 mt-3">
              Add a cost price to each product (Supplements → Edit) so future sales count towards profit.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
