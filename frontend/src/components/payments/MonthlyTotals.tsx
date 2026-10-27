/** @format */

import { Card } from "../ui";
import { useLanguage } from "../../context/LanguageContext";
import type { PaymentSummary } from "../../types";

export default function MonthlyTotals({
  summary,
}: {
  summary: PaymentSummary;
}) {
  const { t } = useLanguage();
  return (
    <Card className="p-4 sm:p-5 mb-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-slate-100">
            {t("Monthly totals")}
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            {t("Settled payments only · last {months} months", {
              months: summary.months,
            })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 dark:text-slate-500">
            {t("This month")}
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
            Rs. {summary.thisMonth.toLocaleString()}
          </p>
          {summary.lastMonth > 0 && (
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {t("vs Rs. {amount} last month", {
                amount: summary.lastMonth.toLocaleString(),
              })}
            </p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-125">
          <thead className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-slate-300">
                {t("Month")}
              </th>
              {["Membership", "Supplements", "Lockers", "Other"].map((h) => (
                <th
                  key={h}
                  className="text-right px-3 py-2 font-semibold text-gray-600 dark:text-slate-300"
                >
                  {t(h)}
                </th>
              ))}
              <th className="text-right px-3 py-2 font-semibold text-gray-600 dark:text-slate-300">
                {t("Total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.byMonth.map((m, i) => (
              <tr
                key={m.month}
                className={`border-b border-gray-100 dark:border-slate-800 last:border-0 ${
                  // The current month is still being earned, so it reads as
                  // a running figure rather than a closed one.
                  i === summary.byMonth.length - 1 ? "bg-blue-50/40" : ""
                }`}
              >
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-slate-100 whitespace-nowrap">
                  {m.label}
                  {i === summary.byMonth.length - 1 && (
                    <span className="ml-2 text-xs font-normal text-blue-600">
                      {t("so far")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-gray-600 dark:text-slate-300 tabular-nums">
                  {m.membership.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-gray-600 dark:text-slate-300 tabular-nums">
                  {m.supplement.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-gray-600 dark:text-slate-300 tabular-nums">
                  {m.locker.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-gray-600 dark:text-slate-300 tabular-nums">
                  {m.other.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                  Rs. {m.total.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 dark:border-slate-800">
            <tr>
              <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-slate-100">
                {t("Grand total")}
              </td>
              {(["membership", "supplement", "locker", "other"] as const).map((k) => (
                <td
                  key={k}
                  className="px-3 py-2.5 text-right font-semibold text-gray-700 dark:text-slate-300 tabular-nums"
                >
                  {summary.byMonth
                    .reduce((s, m) => s + m[k], 0)
                    .toLocaleString()}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right font-bold text-gray-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                Rs. {summary.grandTotal.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {summary.dueTotal > 0 && (
        // Outstanding is the whole ledger, not just this window — money owed
        // from four months ago is still owed today. Kept out of the totals
        // above: it is a debt the gym is owed, not income it has received.
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
          {t(
            summary.dueCount === 1
              ? "Rs. {amount} still outstanding across {count} unpaid entry, not counted above."
              : "Rs. {amount} still outstanding across {count} unpaid entries, not counted above.",
            {
              amount: summary.dueTotal.toLocaleString(),
              count: summary.dueCount,
            },
          )}
        </p>
      )}
    </Card>
  );
}
