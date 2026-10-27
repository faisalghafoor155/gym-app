import { useEffect, useState } from 'react';
import { Gift, X } from 'lucide-react';
import { FieldLabel, inputClass } from '../ui';
import api from '../../api/client';
import { useDebounced } from '../../hooks/useDebounced';
import { useLanguage } from '../../context/LanguageContext';
import type { PaginatedMembers } from '../../types';

export interface Referrer { id: string; name: string; memberNo: string }

/**
 * "Who sent you?" — finds the existing member who referred this one. Searched
 * on the server as the desk types, so it works for a roster of any size.
 */
export default function ReferrerPicker({ value, onChange }: {
  value: Referrer | null;
  onChange: (r: Referrer | null) => void;
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const [results, setResults] = useState<Referrer[]>([]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) { setResults([]); return; }
    let stale = false;
    void api.get<PaginatedMembers>('/members', { params: { search: q, limit: 6 } })
      .then(r => { if (!stale) setResults(r.data.data.map(m => ({ id: m.id, name: m.name, memberNo: m.memberNo }))); })
      .catch(() => { if (!stale) setResults([]); });
    return () => { stale = true; };
  }, [debounced]);

  if (value) {
    return (
      <div>
        <FieldLabel>{t('Referred by')}</FieldLabel>
        <div className="rounded-xl bg-purple-50 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/20 px-3 py-2.5 flex items-center gap-2 text-sm">
          <Gift size={15} className="text-purple-600 dark:text-purple-300 shrink-0" />
          <span className="flex-1 text-purple-800 dark:text-purple-200">{value.name} · {value.memberNo}</span>
          <button type="button" aria-label={t('Clear referrer')} onClick={() => onChange(null)} className="text-purple-600 dark:text-purple-300 p-0.5">
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <FieldLabel htmlFor="referrer-search">{t('Referred by')} <span className="font-normal text-gray-400">{t('(optional)')}</span></FieldLabel>
      <input
        id="referrer-search"
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={t('Search the member who sent them…')}
        autoComplete="off"
        className={inputClass}
      />
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
          {results.map(r => (
            <li key={r.id}>
              <button type="button" onClick={() => { onChange(r); setQuery(''); setResults([]); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
                <span className="font-medium text-gray-800 dark:text-slate-100">{r.name}</span>{' '}
                <span className="text-xs text-gray-400">{r.memberNo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
