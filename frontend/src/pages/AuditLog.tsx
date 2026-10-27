import { useEffect, useMemo, useState } from 'react';
import {
  ScrollText, ChevronDown, UserCog, Filter, X,
} from 'lucide-react';
import {
  Page, PageHeader, Card, PageLoader, EmptyState, Refetching,
  inputClass, secondaryButton, focusRing,
} from '../components/ui';
import api, { apiError } from '../api/client';
import type { AuditLog, Paginated } from '../types';
import toast from 'react-hot-toast';
import { translate, useLanguage, type Language } from '../context/LanguageContext';

/**
 * The trail: who did what, and when.
 *
 * The app tells people three separate times that a deletion "is recorded in
 * the audit log" — this is the page that makes that true rather than a
 * promise nobody can check. Owner-only, because the log names which member of
 * staff did the thing.
 *
 * Rows are read, never written. There is deliberately no way to edit or delete
 * one from here: a trail somebody can tidy up is not a trail.
 */

/** Rows per request. The one table that only ever grows, so this is paged from
 *  the start rather than when it becomes a problem. */
const PAGE_SIZE = 25;

/**
 * The kinds of thing that get logged, for the filter.
 *
 * Hardcoded rather than derived from the rows on screen: a filter built from
 * the current page would offer fewer options the further back you looked, and
 * the entity you are hunting is precisely the one not in front of you.
 */
const ENTITIES = [
  'member', 'membership', 'payment', 'expense', 'plan', 'staff',
  'trainer', 'supplement', 'class', 'classSchedule', 'classBooking',
  'fingerprint', 'gym', 'onlinePayment', 'memberLogin', 'ownership',
] as const;

/**
 * How each verb reads to a person, and how it should look.
 *
 * `create`/`delete` are the two worth colouring — money and members appearing
 * or vanishing is what an owner scans this page for. Everything else stays
 * neutral so the page does not turn into a wall of colour.
 */
const verbTone = (action: string): string => {
  const verb = action.split('.')[1] ?? '';
  if (/delete|remove|deactivate/.test(verb)) {
    return 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300';
  }
  if (/create|sell|restock|initiated/.test(verb)) {
    return 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300';
  }
  return 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300';
};

/** `member.create` → `Member created`. The stored form is a dotted verb, which
 *  is right for a column and wrong for a page. */
const readableAction = (action: string, lang: Language): string => {
  const [entity = '', verb = ''] = action.split('.');
  const spaced = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  const past: Record<string, string> = {
    create: 'created', update: 'updated', delete: 'deleted',
    remove: 'removed', deactivate: 'deactivated', renew: 'renewed',
    sell: 'sold', restock: 'restocked', transfer: 'transferred',
    settingsUpdate: 'settings updated', confirmedManually: 'confirmed manually',
    checkoutCart: 'cart checked out', initiated: 'initiated',
  };
  const head = spaced(entity);
  return `${translate(lang, `${head.charAt(0).toUpperCase()}${head.slice(1)}`)} ${translate(lang, past[verb] ?? spaced(verb))}`;
};

/** Field names come from the database, so `expiryDate` needs spacing out. */
const readableField = (key: string): string =>
  key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

/**
 * A changed value as a line of text.
 *
 * Dates are the case worth handling: they arrive as ISO strings and a raw
 * `2026-09-18T00:00:00.000Z` in a list of changes is noise rather than
 * information.
 */
const readableValue = (value: unknown, lang: Language): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return translate(lang, value ? 'yes' : 'no');
  if (typeof value === 'string') {
    const isoDate = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/.test(value);
    if (isoDate) {
      return new Date(value).toLocaleDateString('en-PK', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    }
    return value;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/** The fields worth showing for a row, paired old-to-new where both exist. */
const changedFields = (log: AuditLog): { key: string; before?: unknown; after?: unknown }[] => {
  const keys = [
    ...Object.keys(log.before ?? {}),
    ...Object.keys(log.after ?? {}),
  ];
  return [...new Set(keys)].map(key => ({
    key,
    before: log.before?.[key],
    after: log.after?.[key],
  }));
};

const timestamp = (iso: string): string =>
  new Date(iso).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

export default function AuditLogPage() {
  const { lang, t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Which rows have their changed-fields panel open. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (entity) q.set('entity', entity);
    // Blank values are omitted rather than sent — the API rejects "" for a date.
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    q.set('limit', String(PAGE_SIZE));
    return `?${q.toString()}`;
  }, [entity, from, to]);

  useEffect(() => {
    let cancelled = false;
    setRefetching(true);
    api.get<Paginated<AuditLog>>(`/audit-logs${query}`)
      .then(r => {
        if (cancelled) return;
        setLogs(r.data.data);
        setTotal(r.data.total);
        setHasMore(r.data.hasMore);
        setPage(1);
        // A row left open from the previous filter would be showing changes
        // for something no longer on screen.
        setExpanded(new Set());
      })
      .catch(err => {
        if (!cancelled) toast.error(apiError(err, translate(lang, 'Could not load the audit log')));
      })
      .finally(() => {
        if (!cancelled) { setLoading(false); setRefetching(false); }
      });
    return () => { cancelled = true; };
    // `lang` only words the error; a language change is no reason to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /** Appends the next page rather than replacing what is on screen. */
  const loadMore = () => {
    const next = page + 1;
    setLoadingMore(true);
    api.get<Paginated<AuditLog>>(`/audit-logs${query}&page=${next}`)
      .then(r => {
        setLogs(prev => [...prev, ...r.data.data]);
        setHasMore(r.data.hasMore);
        setPage(next);
      })
      .catch(err => toast.error(apiError(err, t('Could not load more'))))
      .finally(() => setLoadingMore(false));
  };

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const hasFilters = entity !== '' || from !== '' || to !== '';
  const clearFilters = () => { setEntity(''); setFrom(''); setTo(''); };

  if (loading) return <PageLoader />;

  return (
    <Page>
      <PageHeader
        icon={ScrollText}
        title="Audit Log"
        subtitle={t(total === 1 ? '{count} recorded action' : '{count} recorded actions', { count: total.toLocaleString() })}
      />

      <Card className="p-3 sm:p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={entity}
            onChange={e => setEntity(e.target.value)}
            aria-label={t('Filter by what was acted on')}
            className={`${inputClass} sm:w-auto`}
          >
            <option value="">{t('Everything')}</option>
            {ENTITIES.map(e => (
              <option key={e} value={e}>{t(readableField(e))}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 flex-1 min-w-60">
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={e => setFrom(e.target.value)}
              aria-label={t('From date')}
              className={`${inputClass} w-auto`}
            />
            <span className="text-xs text-gray-400 dark:text-slate-500">{t('to')}</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={e => setTo(e.target.value)}
              aria-label={t('To date')}
              className={`${inputClass} w-auto`}
            />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className={`${secondaryButton} sm:ml-auto`}>
              <X size={14} /> {t('Clear')}
            </button>
          )}
        </div>
      </Card>

      {logs.length === 0 ? (
        <EmptyState
          icon={hasFilters ? Filter : ScrollText}
          title={hasFilters ? t('Nothing matches those filters') : t('Nothing recorded yet')}
          hint={hasFilters
            ? t('Try a wider date range, or clear the filters.')
            : t('Actions that change members, money or staff are recorded here as they happen.')}
          {...(hasFilters && {
            action: (
              <button onClick={clearFilters} className={secondaryButton}>{t('Clear filters')}</button>
            ),
          })}
        />
      ) : (
        <Refetching busy={refetching}>
          <div className="space-y-2">
            {logs.map(log => {
              const fields = changedFields(log);
              const isOpen = expanded.has(log.id);
              return (
                <Card key={log.id} className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${verbTone(log.action)}`}>
                          {readableAction(log.action, lang)}
                        </span>
                        {log.entityLabel && (
                          <span className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                            {log.entityLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <UserCog size={12} />
                          {log.actorName}
                          <span className="text-gray-400 dark:text-slate-500">({t(log.actorRole)})</span>
                        </span>
                        <span>{timestamp(log.createdAt)}</span>
                      </div>

                      {/* A justification is the whole point of the rows that
                          carry one, so it is never hidden behind the toggle. */}
                      {log.reason && (
                        <p className="mt-2 text-xs text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-800/60 rounded-lg px-2.5 py-1.5">
                          {log.reason}
                        </p>
                      )}
                    </div>

                    {fields.length > 0 && (
                      <button
                        onClick={() => toggle(log.id)}
                        aria-expanded={isOpen}
                        aria-label={t(isOpen ? 'Hide what changed for {item}' : 'Show what changed for {item}', { item: log.entityLabel ?? log.action })}
                        className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors ${focusRing}`}
                      >
                        {t(fields.length === 1 ? '{count} field' : '{count} fields', { count: fields.length })}
                        <ChevronDown
                          size={12}
                          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                    )}
                  </div>

                  {isOpen && fields.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 space-y-1.5">
                      {fields.map(({ key, before, after }) => (
                        <div key={key} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                          <span className="text-gray-500 dark:text-slate-400 min-w-32">
                            {t(readableField(key))}
                          </span>
                          {/* An update shows both sides; a create or delete has
                              only one, and an arrow from nothing reads as a
                              value that was cleared. */}
                          {before !== undefined && after !== undefined ? (
                            <>
                              <span className="text-gray-400 dark:text-slate-500 line-through break-all">
                                {readableValue(before, lang)}
                              </span>
                              <span className="text-gray-400 dark:text-slate-500">→</span>
                              <span className="font-medium text-gray-800 dark:text-slate-200 break-all">
                                {readableValue(after, lang)}
                              </span>
                            </>
                          ) : (
                            <span className="font-medium text-gray-800 dark:text-slate-200 break-all">
                              {readableValue(after ?? before, lang)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </Refetching>
      )}

      {hasMore && (
        <div className="flex justify-center mt-5">
          <button onClick={loadMore} disabled={loadingMore} className={secondaryButton}>
            {loadingMore ? t('Loading…') : t('Show more · {count} left', { count: total - logs.length })}
          </button>
        </div>
      )}
    </Page>
  );
}
