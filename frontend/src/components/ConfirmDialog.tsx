import Modal from './Modal';
import { dangerButton, secondaryButton, primaryButton } from './ui';

interface ConfirmDialogProps {
  title: string;
  /** What is about to happen, in the words the user would use. */
  message: string;
  confirmLabel?: string;
  /** Destructive by default — the only thing this is used for so far. */
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Replaces window.confirm, which cannot be styled, cannot be tested, and blocks
 * the whole tab. Focus trapping and Escape come from Modal.
 */
export default function ConfirmDialog({
  title, message, confirmLabel = 'Delete', tone = 'danger', busy, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-gray-600">{message}</p>
      <div className="flex gap-3 pt-5">
        <button type="button" onClick={onCancel} className={`flex-1 ${secondaryButton}`}>
          Cancel
        </button>
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={onConfirm}
          className={`flex-1 ${tone === 'danger' ? dangerButton : primaryButton}`}
        >
          {busy ? 'Working...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
