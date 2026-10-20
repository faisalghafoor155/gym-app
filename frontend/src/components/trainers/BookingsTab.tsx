import { BookOpen, Clock } from 'lucide-react';
import Badge from '../Badge';
import { Card, EmptyState, DataRow } from '../ui';
import type { PtSession } from '../../types';

interface Props {
  sessions: PtSession[];
  onComplete: (sessionId: string) => void;
  onCancel: (session: PtSession) => void;
  onMarkPaid: (sessionId: string) => void;
}

export default function BookingsTab({ sessions, onComplete, onCancel, onMarkPaid }: Props) {
  return (
    sessions.length === 0 ? (
      <EmptyState
        icon={BookOpen}
        title="No PT sessions booked yet"
        hint="Click Book PT Session to record training slots."
      />
    ) : (
      <Card className="overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-slate-400">
            <thead className="text-xs uppercase bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300 border-b border-gray-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-bold">Member</th>
                <th className="px-6 py-4 font-bold">Trainer</th>
                <th className="px-6 py-4 font-bold">Date & Time</th>
                <th className="px-6 py-4 font-bold">Price</th>
                <th className="px-6 py-4 font-bold">Trainer Comm.</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Payment</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
              {sessions.map(s => {
                const sessionDate = new Date(s.sessionDate);
                return (
                  <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/20">
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-200">
                      {s.member.name}
                    </td>
                    <td className="px-6 py-4">
                      {s.trainer.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-gray-400" />
                        {sessionDate.toLocaleDateString()} {sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-slate-200">
                      Rs. {s.priceCharged.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-indigo-600 dark:text-indigo-400 font-semibold">
                      Rs. {s.trainerCommission.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={s.status} />
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        s.paymentStatus === 'paid'
                          ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                          : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400'
                      }`}>
                        {/* Whose money this is, said out loud: the trainer's
                            commission is tracked separately on the Payouts
                            page, and "Paid" alone read as either. */}
                        {s.paymentStatus === 'paid' ? 'Member paid' : 'Member unpaid'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {s.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => onComplete(s.id)}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/30 dark:hover:bg-green-950/50 dark:text-green-400"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => onCancel(s)}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/30 dark:hover:bg-red-950/50 dark:text-red-400"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {s.paymentStatus === 'unpaid' && (
                        <button
                          onClick={() => onMarkPaid(s.id)}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 dark:text-indigo-400"
                        >
                          Member paid
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Eight columns as a stacked card. The actions go full-width at the
            bottom rather than in a scrolled-off right-hand cell. */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-800">
          {sessions.map(s => {
            const sessionDate = new Date(s.sessionDate);
            return (
              <div key={s.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-slate-200 truncate">
                      {s.member.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                      with {s.trainer.name}
                    </p>
                  </div>
                  <Badge status={s.status} />
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock size={12} className="text-gray-400" />
                  {sessionDate.toLocaleDateString()}{' '}
                  {sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="space-y-1.5">
                  <DataRow label="Price" value={`Rs. ${s.priceCharged.toLocaleString()}`} />
                  <DataRow label="Trainer commission" value={`Rs. ${s.trainerCommission.toLocaleString()}`} />
                  <DataRow
                    label="Payment"
                    value={s.paymentStatus === 'paid' ? 'Member paid' : 'Member unpaid'}
                  />
                </div>
                {(s.status === 'scheduled' || s.paymentStatus === 'unpaid') && (
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {s.status === 'scheduled' && (
                      <>
                        <button
                          onClick={() => onComplete(s.id)}
                          className="flex-1 px-2.5 py-2 rounded-lg text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/30 dark:hover:bg-green-950/50 dark:text-green-400"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => onCancel(s)}
                          className="flex-1 px-2.5 py-2 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/30 dark:hover:bg-red-950/50 dark:text-red-400"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {s.paymentStatus === 'unpaid' && (
                      <button
                        onClick={() => onMarkPaid(s.id)}
                        className="flex-1 px-2.5 py-2 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 dark:text-indigo-400"
                      >
                        Member paid
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    )
  );
}
