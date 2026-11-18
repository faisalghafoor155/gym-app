import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, type LucideIcon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export interface PaletteItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** The sidebar section it lives under, shown beside it. */
  group?: string;
}

/**
 * Jump to any page by typing part of its name — Ctrl+K (⌘K) from anywhere.
 *
 * Matches the label in both languages, so "haz" finds Attendance in Urdu mode
 * and "atte" finds it in either. Arrow keys move, Enter goes, Esc closes.
 */
export default function CommandPalette({ items, open, onClose }: {
  items: PaletteItem[];
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    setTimeout(() => input.current?.focus(), 0);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      [i.label, t(i.label), i.group ?? '', i.group ? t(i.group) : ''].some(s => s.toLowerCase().includes(q)));
  }, [items, query, t]);

  if (!open) return null;

  const go = (i: PaletteItem | undefined) => {
    if (!i) return;
    navigate(i.to);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh] bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm animate-fade-in"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="palette-label"
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <label id="palette-label" className="flex items-center gap-3 px-4 border-b border-slate-100 dark:border-slate-800">
          <Search size={18} className="text-slate-400 shrink-0" />
          <span className="sr-only">{t('Go to a page')}</span>
          <input
            ref={input}
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
              if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
              if (e.key === 'Escape') onClose();
            }}
            placeholder={t('Search pages…')}
            className="w-full py-4 bg-transparent text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="hidden sm:block text-[10px] font-semibold text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">Esc</kbd>
        </label>
        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">{t('No page matches')}</li>}
          {results.map((i, n) => {
            const Icon = i.icon;
            return (
              <li key={i.to} role="option" aria-selected={n === active} className="animate-rise" style={{ animationDelay: `${Math.min(n, 8) * 20}ms` }}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(n)}
                  onClick={() => go(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                    n === active ? 'bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    n === active ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    <Icon size={16} />
                  </span>
                  <span className="flex-1 font-medium">{t(i.label)}</span>
                  {i.group && <span className="text-xs text-slate-400">{t(i.group)}</span>}
                  {n === active && <CornerDownLeft size={14} className="text-blue-500" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
