import { X } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';
import ProgressPanel from '../progress/ProgressPanel';
import type { Member } from '../../types';

/**
 * A member's weigh-ins, opened from their card on the roster.
 *
 * Wider than the stock Modal: a chart and a two-photo comparison squeezed into
 * a form-width dialog are too small to read.
 */
export default function ProgressModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const ref = useDialog(true, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/70" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="progress-modal-title"
        className="relative bg-gray-50 dark:bg-slate-950 w-full sm:max-w-3xl sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-slate-800 shrink-0">
          <div>
            <h2 id="progress-modal-title" className="text-lg font-bold text-gray-900 dark:text-slate-100">
              Progress tracking
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">{member.name} · {member.memberNo}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1 -mr-1">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto">
          {/* Staff reach this from the roster, which already needs member
              management — the same permission the API asks for to delete. */}
          <ProgressPanel url={`/members/${member.id}/measurements`} canDelete={() => true} />
        </div>
      </div>
    </div>
  );
}
