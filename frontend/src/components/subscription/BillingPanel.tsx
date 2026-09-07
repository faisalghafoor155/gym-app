import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Receipt, ShieldAlert } from 'lucide-react';
import api, { apiError } from '../../api/client';
import { Card, Spinner } from '../ui';
import { useFetch } from '../../hooks/useFetch';
import type { BillingResponse } from '../../types';

/**
 * What this gym pays, and the button that pays it.
 *
 * Kept apart from the plan-and-usage panel it sits under because the two
 * answer different questions with different audiences: limits explain why a
 * button is missing and every member of staff needs them, while an invoice is
 * money and the route behind this is owner-only.
 *
 * A gym that has never been billed renders nothing at all rather than an empty
 * term — there is no subscription to describe, and saying so twice on one page
 * would only be noise under the "Free" card already there.
 */

const money = (n: number): string => `Rs. ${n.toLocaleString('en-PK')}`;

const day = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

/** Posts the checkout form the provider expects, as a real form submission.
 *
 *  A redirect cannot carry the signed fields, and fetch would follow it into a
 *  page the browser then has nowhere to render. The provider's own page has to
 *  be a top-level navigation, which only a form POST gives. */
const postToProvider = (url: string, fields: Record<string, string>): void => {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
};

export default function BillingPanel() {
  const { data, loading, reload } = useFetch<BillingResponse>(
    '/billing',
    'Could not load billing',
  );
  const [paying, setPaying] = useState(false);

  /**
   * The provider drops the browser back here with `?payment=…`. Read once and
   * cleared from the URL, so a refresh does not re-announce a payment that
   * happened ten minutes ago.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (!payment) return;

    if (payment === 'success') toast.success('Payment received — thank you.');
    else if (payment === 'pending')
      toast('Payment is still being confirmed. This page will update shortly.');
    else toast.error('That payment did not go through.');

    window.history.replaceState({}, '', window.location.pathname);
    void reload();
  }, [reload]);

  if (loading) {
    return (
      <Card className="p-5 mb-5 flex justify-center">
        <Spinner className="w-6 h-6" />
      </Card>
    );
  }

  // Either the request failed — `useFetch` has already said so — or this gym
  // has never been billed. Neither wants a panel.
  if (!data?.billing) return null;

  const { billing, providers } = data;
  const invoice = billing.openInvoice;
  const overdue = billing.overdueSince !== null;

  const pay = async (provider: string): Promise<void> => {
    setPaying(true);
    try {
      const { data: started } = await api.post<{
        url: string;
        fields: Record<string, string>;
      }>('/billing/checkout', { provider });

      // `manual` comes back with no url: there is nowhere to send the browser,
      // because the money arrives by bank transfer and an operator settles it.
      if (!started.url) {
        toast.success(
          'Noted. Send the payment as arranged and it will be confirmed here.',
        );
        await reload();
        return;
      }

      postToProvider(started.url, started.fields);
    } catch (err) {
      toast.error(apiError(err, 'Could not start the payment'));
    } finally {
      setPaying(false);
    }
  };

  return (
    <Card
      className={`p-5 mb-5 ${
        overdue ? 'ring-2 ring-red-500 dark:ring-red-400' : ''
      }`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${
            overdue
              ? 'bg-red-50 dark:bg-red-500/15 border-red-100 dark:border-red-500/20'
              : 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-100 dark:border-emerald-500/20'
          }`}
        >
          {overdue ? (
            <ShieldAlert size={20} className="text-red-600 dark:text-red-400" />
          ) : (
            <Receipt size={20} className="text-emerald-600 dark:text-emerald-400" />
          )}
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
            Billing
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {money(billing.amount)} every {billing.periodDays} days
            {billing.paidThrough && ` · paid through ${day(billing.paidThrough)}`}
          </p>
        </div>
      </div>

      {/* The one thing an owner on this page most needs to know: what is owed,
          by when, and what happens if it is not paid. */}
      {invoice ? (
        <div
          className={`rounded-xl p-4 mb-4 border ${
            overdue
              ? 'bg-red-50/60 dark:bg-red-500/10 border-red-100 dark:border-red-500/20'
              : 'bg-amber-50/60 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              size={16}
              className={`mt-0.5 shrink-0 ${
                overdue
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                {money(invoice.amount)}{' '}
                {overdue ? 'overdue' : `due ${day(invoice.dueDate)}`}
              </p>
              <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                Covers {day(invoice.periodStart)} to {day(invoice.periodEnd)}.
                {billing.suspendsOn && (
                  <>
                    {' '}
                    {overdue ? 'Access stops' : 'If unpaid, access stops'} on{' '}
                    <strong>{day(billing.suspendsOn)}</strong> — nothing is
                    deleted, and paying restores it.
                  </>
                )}
              </p>

              <div className="flex flex-wrap gap-2 mt-3">
                {providers.map(p => (
                  <button
                    key={p.provider}
                    type="button"
                    onClick={() => void pay(p.provider)}
                    disabled={paying}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700
                      disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    {p.redirects ? `Pay with ${p.label}` : p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
          Nothing outstanding.
          {billing.paidThrough &&
            ` The next invoice is issued as ${day(billing.paidThrough)} approaches.`}
        </p>
      )}

      {billing.invoices.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-2">
            Invoices
          </p>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 dark:text-slate-500">
                  <th className="font-medium pb-1.5 pr-3">Period</th>
                  <th className="font-medium pb-1.5 pr-3">Amount</th>
                  <th className="font-medium pb-1.5">Status</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-slate-300">
                {billing.invoices.map(i => (
                  <tr
                    key={i.id}
                    className="border-t border-gray-100 dark:border-slate-800"
                  >
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {day(i.periodStart)} – {day(i.periodEnd)}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums whitespace-nowrap">
                      {money(i.amount)}
                    </td>
                    <td className="py-1.5 whitespace-nowrap">
                      {i.status === 'paid' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Paid {day(i.paidAt)}
                        </span>
                      ) : i.status === 'void' ? (
                        <span className="text-gray-400 dark:text-slate-500">
                          Cancelled
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Due {day(i.dueDate)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
