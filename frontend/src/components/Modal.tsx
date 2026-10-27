import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDialog } from '../hooks/useDialog';
import { useLanguage } from '../context/LanguageContext';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ title, onClose, children }: ModalProps) {
  const ref = useDialog(true, onClose);
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Heavier in dark mode: a 40% scrim over an already-dark page leaves the
          dialog barely distinguishable from what it is covering. */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/70" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative bg-white dark:bg-slate-900 w-full sm:max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl shadow-xl max-h-[90dvh] flex flex-col"
      >
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-200 dark:border-slate-800 shrink-0">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} aria-label={t('Close')} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1 -mr-1">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
