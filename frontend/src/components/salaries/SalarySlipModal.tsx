import { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import api, { apiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { channelLabel } from '../../utils/paymentChannels';
import { Spinner } from '../ui';
import type { SalarySlip } from '../../types';
import { monthName } from '../../utils/dates';

const money = (n: number) => `Rs. ${n.toLocaleString()}`;

/**
 * A printable salary slip for one paid month.
 *
 * Built like the payment receipt — the same print-only stylesheet hides the
 * rest of the app — so "Save as PDF" in the print dialog gives the PDF.
 */
export default function SalarySlipModal({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const { gym } = useAuth();
  const { t } = useLanguage();
  const [slip, setSlip] = useState<SalarySlip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    api.get<SalarySlip>(`/salaries/payments/${paymentId}`)
      .then(r => { if (!stale) setSlip(r.data); })
      .catch(err => { if (!stale) setError(apiError(err, t('Could not load salary slip'))); });
    return () => { stale = true; };
  }, [paymentId, t]);

  const line = (label: string, value: string, strong = false) => (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500 dark:text-slate-400 print:text-gray-600">{label}</span>
      <span className={strong ? 'font-bold text-gray-900 dark:text-white print:text-black' : 'font-medium'}>{value}</span>
    </div>
  );

  return (
    <div className="receipt-print-root fixed inset-0 z-50 animate-fade-in flex items-center justify-center p-4 bg-black/40 dark:bg-black/75 print:p-0 print:bg-transparent">
      <div className="relative bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in print:border-0 print:shadow-none print:max-w-none print:max-h-none print:bg-white">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800 print:hidden">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
            <Printer size={18} className="text-blue-600" /> {t('Salary slip')}
          </h3>
          <button onClick={onClose} aria-label={t('Close')}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        {!slip ? (
          <div className="p-10 flex justify-center text-sm text-red-600">{error ?? <Spinner />}</div>
        ) : (
          <div className="p-6 text-sm text-gray-800 dark:text-slate-200 print:p-0 print:text-black">
            <div className="text-center pb-4 border-b border-dashed border-gray-200 dark:border-slate-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white print:text-black">{gym?.name || 'GymFlow'}</h2>
              {gym?.address && <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{gym.address}</p>}
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {t('Salary slip')} · {monthName(slip.month)}
              </p>
            </div>

            <div className="my-4 space-y-1.5">
              {line(t('Name:'), slip.staffMember.name, true)}
              {line(t('Role:'), t(slip.staffMember.role))}
              {slip.staffMember.phone && line(t('Phone:'), slip.staffMember.phone)}
              {line(t('Paid on:'), new Date(slip.paidAt).toLocaleDateString('en-PK', { dateStyle: 'medium' }))}
              {line(t('Paid by:'), slip.method === 'cash' ? t('Cash') : (channelLabel(slip.channel) || t('Online')))}
              {slip.reference && line(t('Reference:'), slip.reference)}
              {line(t('Attendance:'), t('Present {p} · Leave {l} · Absent {a}', { p: slip.presentDays, l: slip.leaveDays, a: slip.absentDays }))}
            </div>

            <div className="border-t border-b border-gray-100 dark:border-slate-800 py-4 space-y-1.5">
              {line(t('Salary'), money(slip.baseSalary))}
              {slip.bonuses > 0 && line(t('Bonus'), `+ ${money(slip.bonuses)}`)}
              {slip.advances > 0 && line(t('Advance already given'), `− ${money(slip.advances)}`)}
              {slip.deductions > 0 && line(t('Deductions'), `− ${money(slip.deductions)}`)}
              {slip.absenceDeduction > 0 && line(t('Absent {days} days', { days: slip.absentDays }), `− ${money(slip.absenceDeduction)}`)}
              {slip.adjustments.filter(a => a.notes).map(a => (
                <p key={a.id} className="text-xs text-gray-400 print:text-gray-600">
                  {t(a.kind)} {money(a.amount)}: {a.notes}
                </p>
              ))}
            </div>

            <div className="flex justify-between items-center py-4 text-base">
              <span className="font-semibold">{t('Net paid')}</span>
              <span className="text-xl font-extrabold text-gray-900 dark:text-white print:text-black">{money(slip.netPay)}</span>
            </div>

            {slip.notes && <p className="text-xs text-gray-500 mb-4">{slip.notes}</p>}

            <div className="grid grid-cols-2 gap-8 pt-10 text-xs text-gray-500 text-center">
              <div className="border-t border-gray-300 pt-1">{t('Received by')}</div>
              <div className="border-t border-gray-300 pt-1">{t('Paid by')}</div>
            </div>

            <button onClick={() => window.print()}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 print:hidden">
              <Printer size={16} /> {t('Print / Save PDF')}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page { margin: 12mm; }
          body * { visibility: hidden !important; }
          .receipt-print-root, .receipt-print-root * { visibility: visible !important; }
          .receipt-print-root {
            position: absolute !important; left: 0 !important; top: 0 !important;
            width: 100% !important; height: auto !important; background: white !important;
            padding: 0 !important; margin: 0 !important; overflow: visible !important; display: block !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          .receipt-print-root > div {
            border: 0 !important; box-shadow: none !important; border-radius: 0 !important;
            max-width: 100% !important; width: 100% !important; margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
