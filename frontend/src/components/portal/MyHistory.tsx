import { useEffect, useState } from 'react';
import { History, Receipt, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { apiError } from '../../api/client';
import { Card, InlineEmpty, Spinner, secondaryButton } from '../ui';
import Badge from '../Badge';
import ReceiptModal from '../ReceiptModal';
import type {
  Membership, MyPurchase, Paginated, Payment,
} from '../../types';
import { useLanguage } from '../../context/LanguageContext';

/** How many rows a section loads at a time. */
const PAGE_SIZE = 10;

/**
 * A paged list that starts closed and grows.
 *
 * Both sections here are "everything since I joined", which is unbounded and
 * mostly uninteresting — the member wants the last few and occasionally the
 * lot. So each loads a page and offers more, rather than fetching a history
 * that could be years long to render five rows of it.
 */
function usePagedList<T>(url: string, failMessage: string) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);

  const fetchPage = async (page: number): Promise<void> => {
    try {
      const { data } = await api.get<Paginated<T>>(
        `${url}?limit=${PAGE_SIZE}&page=${page}`,
      );
      setRows(prev => (page === 1 ? data.data : [...prev, ...data.data]));
      setTotal(data.total);
    } catch (err) {
      toast.error(apiError(err, t(failMessage)));
    } finally {
      setLoading(false);
      setMore(false);
    }
  };

  useEffect(() => {
    void fetchPage(1);
    // The url is a literal at both call sites, so this runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const loadMore = (): void => {
    setMore(true);
    void fetchPage(Math.floor(rows.length / PAGE_SIZE) + 1);
  };

  return { rows, total, loading, more, loadMore, hasMore: rows.length < total };
}

/** Shared footer: how much is left, and a way to see it. */
function ShowMore({
  hasMore, busy, left, onClick,
}: { hasMore: boolean; busy: boolean; left: number; onClick: () => void }) {
  const { t } = useLanguage();
  if (!hasMore) return null;
  return (
    <div className="flex justify-center pt-3">
      <button onClick={onClick} disabled={busy} className={secondaryButton}>
        {busy ? t('Loading…') : t('Show more · {left} left', { left })}
      </button>
    </div>
  );
}

/** Every membership the member has bought, newest first. */
export function MyMemberships() {
  const { t } = useLanguage();
  const { rows, total, loading, more, loadMore, hasMore } =
    usePagedList<Membership>('/me/memberships', 'Could not load your membership history');

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
        <History size={16} className="text-blue-600" /> {t('Membership history')}
        {total > 0 && (
          <span className="text-xs font-normal text-gray-400 dark:text-slate-500">
            {total}
          </span>
        )}
      </h2>

      {loading ? (
        <div className="flex justify-center py-6"><Spinner className="w-6 h-6" /></div>
      ) : rows.length === 0 ? (
        <InlineEmpty message={t('No memberships recorded yet.')} />
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map(m => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 dark:border-slate-800 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {m.planName}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {new Date(m.startDate).toLocaleDateString()} –{' '}
                    {new Date(m.expiryDate).toLocaleDateString()}
                    {' · '}Rs. {m.pricePaid.toLocaleString()}
                  </p>
                </div>
                <Badge status={m.status} />
              </li>
            ))}
          </ul>
          <ShowMore
            hasMore={hasMore}
            busy={more}
            left={total - rows.length}
            onClick={loadMore}
          />
        </>
      )}
    </Card>
  );
}

/** What the member has bought over the counter. */
export function MyPurchases() {
  const { t } = useLanguage();
  const { rows, total, loading, more, loadMore, hasMore } =
    usePagedList<MyPurchase>('/me/purchases', 'Could not load your purchases');

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
        <ShoppingBag size={16} className="text-blue-600" /> {t('Supplement purchases')}
        {total > 0 && (
          <span className="text-xs font-normal text-gray-400 dark:text-slate-500">
            {total}
          </span>
        )}
      </h2>

      {loading ? (
        <div className="flex justify-center py-6"><Spinner className="w-6 h-6" /></div>
      ) : rows.length === 0 ? (
        <InlineEmpty message={t('Nothing bought from the counter yet.')} />
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map(p => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 dark:border-slate-800 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {p.supplementName}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {new Date(p.soldAt).toLocaleDateString()} · {p.quantity} ×
                    Rs. {p.unitPrice.toLocaleString()}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-gray-900 dark:text-slate-100">
                  Rs. {p.total.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
          <ShowMore
            hasMore={hasMore}
            busy={more}
            left={total - rows.length}
            onClick={loadMore}
          />
        </>
      )}
    </Card>
  );
}

/**
 * The payments already on the profile, with a receipt behind each.
 *
 * The rows come from `/me` rather than being fetched again — the profile
 * already carries them, and asking twice would only risk the two disagreeing.
 * What is new is the receipt: `ReceiptModal` is the same component the staff
 * payments page prints from, so a member's copy and the desk's copy cannot
 * drift apart.
 */
export function MyPayments({
  payments,
  member,
}: {
  payments: Omit<Payment, 'member'>[];
  /** The member the receipt is made out to. Carried in rather than read off
   *  the payment: `/me` strips the member from its own rows, since every one
   *  of them belongs to the person reading the page. */
  member: { name: string; phone: string | null; memberNo: string };
}) {
  const { t } = useLanguage();
  const [receipt, setReceipt] = useState<Payment | null>(null);

  return (
    <>
      <Card className="p-5">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <Receipt size={16} className="text-blue-600" /> {t('Payment history')}
        </h2>

        {payments.length === 0 ? (
          <InlineEmpty message={t('No payments recorded yet.')} />
        ) : (
          <ul className="space-y-2">
            {payments.map(p => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 dark:border-slate-800 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    Rs. {p.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {new Date(p.paymentDate).toLocaleDateString()} · {p.method}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge status={p.status} />
                  {/* Only for money actually taken: a receipt for an unpaid
                      due would be a receipt for nothing. */}
                  {p.status === 'paid' && (
                    <button
                      onClick={() => setReceipt({ ...p, member })}
                      className={secondaryButton}
                    >
                      {t('Receipt')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {receipt && (
        <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />
      )}
    </>
  );
}
