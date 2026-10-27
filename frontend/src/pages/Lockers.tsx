import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Plus, Trash2, UserPlus, LogOut, AlertTriangle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, StatTile, PageLoader, LoadFailed, EmptyState, Refetching, SegmentedControl,
  FieldLabel, IconButton, inputClass, primaryButton, secondaryButton, focusRing,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useDebounced } from '../hooks/useDebounced';
import { useLanguage } from '../context/LanguageContext';
import type { Locker, LockerList, PaginatedMembers } from '../types';

type Filter = 'all' | 'free' | 'taken' | 'expired';

function AddLockersModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'range' | 'single'>('range');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('20');
  const [prefix, setPrefix] = useState('');
  const [number, setNumber] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post<{ added: number; skipped: number }>('/lockers', mode === 'single'
        ? { number: number.trim(), location: location.trim() || undefined }
        : { from: Number(from), to: Number(to), prefix: prefix.trim() || undefined, location: location.trim() || undefined });
      const added = t(data.added === 1 ? '{count} locker added' : '{count} lockers added', { count: data.added });
      toast.success(data.skipped
        ? `${added} · ${t('{count} already existed', { count: data.skipped })}`
        : added);
      onDone();
    } catch (err) {
      toast.error(apiError(err, t('Could not add lockers')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('Add lockers')} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <SegmentedControl value={mode} onChange={setMode}
          options={[{ value: 'range', label: t('A numbered run') }, { value: 'single', label: t('One locker') }]} />
        {mode === 'range' ? (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <FieldLabel htmlFor="lk-prefix">{t('Prefix')}</FieldLabel>
              <input id="lk-prefix" maxLength={10} value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="A-" className={inputClass} />
            </div>
            <div>
              <FieldLabel htmlFor="lk-from" required>{t('From')}</FieldLabel>
              <input id="lk-from" type="number" min={0} required value={from} onChange={e => setFrom(e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel htmlFor="lk-to" required>{t('To')}</FieldLabel>
              <input id="lk-to" type="number" min={0} required value={to} onChange={e => setTo(e.target.value)} className={inputClass} />
            </div>
          </div>
        ) : (
          <div>
            <FieldLabel htmlFor="lk-number" required>{t('Locker number')}</FieldLabel>
            <input id="lk-number" required maxLength={20} value={number} onChange={e => setNumber(e.target.value)} placeholder="12" className={inputClass} />
          </div>
        )}
        <div>
          <FieldLabel htmlFor="lk-loc">{t('Location')}</FieldLabel>
          <input id="lk-loc" maxLength={100} value={location} onChange={e => setLocation(e.target.value)} placeholder={t("e.g. Men's changing room")} className={inputClass} />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>{saving ? t('Adding…') : t('Add')}</button>
        </div>
      </form>
    </Modal>
  );
}

function AssignModal({ locker, onClose, onDone }: { locker: Locker; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const [results, setResults] = useState<{ id: string; name: string; memberNo: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // The rent taken at the counter, if any. Left blank, the locker is handed
  // over free — and a member whose plan includes a locker is never charged,
  // whatever is typed here; the server checks the plan.
  const [fee, setFee] = useState('');
  const [method, setMethod] = useState<'cash' | 'online'>('cash');
  const [channel, setChannel] = useState<'easypaisa' | 'jazzcash' | 'bank'>('easypaisa');

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) { setResults([]); return; }
    let stale = false;
    void api.get<PaginatedMembers>('/members', { params: { search: q, limit: 8 } })
      .then(r => { if (!stale) setResults(r.data.data); })
      .catch(() => { if (!stale) setResults([]); });
    return () => { stale = true; };
  }, [debounced]);

  const assign = async (memberId: string) => {
    setBusy(memberId);
    try {
      const amount = Number(fee);
      const { data } = await api.post<{ coveredByPlan: boolean; feeRecorded: boolean }>(
        `/lockers/${locker.id}/assign`,
        {
          memberId,
          ...(amount > 0 && {
            feeAmount: amount,
            feeMethod: method,
            ...(method === 'online' && { channel }),
          }),
        },
      );
      toast.success(
        data.coveredByPlan
          ? t('Locker {number} assigned · included in their plan, no fee', { number: locker.number })
          : data.feeRecorded
            ? t('Locker {number} assigned · Rs. {amount} recorded', { number: locker.number, amount: amount.toLocaleString() })
            : t('Locker {number} assigned', { number: locker.number }),
      );
      onDone();
    } catch (err) {
      toast.error(apiError(err, t('Could not assign locker')));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title={t('Assign locker {number}', { number: locker.number })} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="lk-fee">{t('Locker fee (Rs.)')}</FieldLabel>
            <input id="lk-fee" type="number" min={0} inputMode="numeric" value={fee}
              onChange={e => setFee(e.target.value)} placeholder={t('0 = free')} className={inputClass} />
          </div>
          <div>
            <FieldLabel htmlFor="lk-method">{t('Paid by')}</FieldLabel>
            <select id="lk-method" value={method === 'cash' ? 'cash' : channel} disabled={!(Number(fee) > 0)}
              onChange={e => {
                const v = e.target.value;
                if (v === 'cash') setMethod('cash');
                else { setMethod('online'); setChannel(v as typeof channel); }
              }}
              className={inputClass}>
              <option value="cash">{t('Cash')}</option>
              <option value="easypaisa">{t('Easypaisa')}</option>
              <option value="jazzcash">{t('JazzCash')}</option>
              <option value="bank">{t('Bank')}</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          {t('Members whose plan includes a locker are not charged.')}
        </p>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input type="search" autoFocus value={query} onChange={e => setQuery(e.target.value)}
            placeholder={t('Search member by name, ID or phone…')} aria-label={t('Search members')} className={`${inputClass} pl-9`} />
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-slate-800">
          {results.map(m => (
            <li key={m.id} className="py-2 flex items-center justify-between gap-3">
              <span className="text-sm"><strong>{m.name}</strong> <span className="text-xs text-gray-400">{m.memberNo}</span></span>
              <button onClick={() => void assign(m.id)} disabled={busy !== null} className={`${primaryButton} !py-1 !px-3 text-xs`}>
                {busy === m.id ? t('Assigning…') : t('Assign')}
              </button>
            </li>
          ))}
        </ul>
        {query.trim().length >= 2 && results.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-3">{t('No members found')}</p>
        )}
      </div>
    </Modal>
  );
}

/**
 * The gym's lockers and who holds each. A locker held by somebody whose
 * membership has run out is flagged, so the desk can free it for a paying
 * member — one at a time or all at once.
 */
export default function Lockers() {
  const { t } = useLanguage();
  const { data, loading, refetching, reload } = useFetch<LockerList>('/lockers', t('Could not load lockers'));
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const [assigning, setAssigning] = useState<Locker | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'release' | 'delete'; locker: Locker } | { kind: 'releaseExpired' } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'releaseExpired') {
        const { data: r } = await api.post<{ released: number }>('/lockers/release-expired');
        toast.success(t(r.released === 1 ? '{count} locker freed' : '{count} lockers freed', { count: r.released }));
      } else if (confirm.kind === 'release') {
        await api.post(`/lockers/${confirm.locker.id}/release`);
        toast.success(t('Locker {number} is free', { number: confirm.locker.number }));
      } else {
        await api.delete(`/lockers/${confirm.locker.id}`);
        toast.success(t('Locker {number} removed', { number: confirm.locker.number }));
      }
      setConfirm(null);
      await reload();
    } catch (err) {
      toast.error(apiError(err, t('Could not update locker')));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title={t('Could not load lockers')} />;

  const shown = data.data.filter(l =>
    filter === 'all' ? true : filter === 'free' ? !l.member : filter === 'taken' ? !!l.member : l.holderExpired);

  return (
    <Page>
      <PageHeader icon={KeyRound} title={t('Lockers')} subtitle={t('Who holds which locker')}
        action={<button onClick={() => setAdding(true)} className={primaryButton}><Plus size={16} /> {t('Add lockers')}</button>} />

      {data.counts.total === 0 ? (
        <EmptyState icon={KeyRound} title={t('No lockers yet')} hint={t('Add your lockers once — a numbered run like 1 to 40 takes one step.')}
          action={<button onClick={() => setAdding(true)} className={primaryButton}><Plus size={16} /> {t('Add lockers')}</button>} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <StatTile icon={KeyRound} label={t('Total')} value={data.counts.total} tone="blue" />
            <StatTile icon={KeyRound} label={t('Free')} value={data.counts.free} tone="green" />
            <StatTile icon={UserPlus} label={t('Taken')} value={data.counts.taken} tone="purple" />
            <StatTile icon={AlertTriangle} label={t('Held by expired')} value={data.counts.expired} tone="red" />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <SegmentedControl value={filter} onChange={setFilter} options={[
              { value: 'all', label: t('All'), count: data.counts.total },
              { value: 'free', label: t('Free'), count: data.counts.free },
              { value: 'taken', label: t('Taken'), count: data.counts.taken },
              { value: 'expired', label: t('Expired holder'), count: data.counts.expired },
            ]} />
            {data.counts.expired > 0 && (
              <button onClick={() => setConfirm({ kind: 'releaseExpired' })} className={`${secondaryButton} text-red-600`}>
                <LogOut size={14} /> {t('Free all expired ({count})', { count: data.counts.expired })}
              </button>
            )}
          </div>

          <Refetching busy={refetching}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {shown.map(l => (
                <Card key={l.id} className={`p-3 flex flex-col gap-2 ${
                  l.holderExpired ? 'border-red-200 dark:border-red-500/30 bg-red-50/40'
                    : l.member ? 'border-purple-200 dark:border-purple-500/20' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-extrabold text-gray-900 dark:text-slate-100 font-mono">{l.number}</p>
                      {l.location && <p className="text-[11px] text-gray-400 truncate">{l.location}</p>}
                    </div>
                    {!l.member && (
                      <IconButton icon={Trash2} label={t('Remove locker {number}', { number: l.number })} tone="red"
                        onClick={() => setConfirm({ kind: 'delete', locker: l })} />
                    )}
                  </div>
                  {l.member ? (
                    <div className="text-xs">
                      <p className="font-semibold text-gray-800 dark:text-slate-200 truncate">{l.member.name}</p>
                      <p className={l.holderExpired ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-500 dark:text-slate-400'}>
                        {l.holderExpired
                          ? (l.member.daysLeft != null ? t('Expired {days}d ago', { days: Math.abs(l.member.daysLeft) }) : t('No membership'))
                          : `${l.member.memberNo} · ${t('{days}d left', { days: String(l.member.daysLeft) })}`}
                      </p>
                      <button onClick={() => setConfirm({ kind: 'release', locker: l })}
                        className={`mt-2 w-full rounded-lg border border-gray-200 dark:border-slate-700 py-1 text-[11px] font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 ${focusRing}`}>
                        {t('Free locker')}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setAssigning(l)}
                      className={`mt-auto w-full rounded-lg bg-blue-600 hover:bg-blue-700 py-1.5 text-[11px] font-semibold text-white ${focusRing}`}>
                      {t('Assign')}
                    </button>
                  )}
                </Card>
              ))}
            </div>
          </Refetching>
        </>
      )}

      {adding && <AddLockersModal onClose={() => setAdding(false)} onDone={() => { setAdding(false); void reload(); }} />}
      {assigning && <AssignModal locker={assigning} onClose={() => setAssigning(null)} onDone={() => { setAssigning(null); void reload(); }} />}
      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'releaseExpired' ? t('Free expired lockers') : confirm.kind === 'release' ? t('Free locker') : t('Remove locker')}
          message={confirm.kind === 'releaseExpired'
            ? t('Free all {count} lockers held by members whose membership has run out? Make sure their belongings are cleared.', { count: data.counts.expired })
            : confirm.kind === 'release'
              ? t('Free locker {number} from {name}?', { number: confirm.locker.number, name: confirm.locker.member?.name ?? '' })
              : t('Remove locker {number}?', { number: confirm.locker.number })}
          confirmLabel={confirm.kind === 'delete' ? t('Remove') : t('Free locker')}
          tone={confirm.kind === 'delete' ? 'danger' : 'primary'}
          busy={busy}
          onConfirm={() => void run()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </Page>
  );
}
