import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDialog } from '../hooks/useDialog';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ title, onClose, children }: ModalProps) {
  const ref = useDialog(true, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative bg-white w-full sm:max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl shadow-xl max-h-[90dvh] flex flex-col"
      >
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-200 shrink-0">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 p-1 -mr-1">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
