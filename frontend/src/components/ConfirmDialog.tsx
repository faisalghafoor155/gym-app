import Modal from './Modal';
import { dangerButton, secondaryButton, primaryButton } from './ui';
import { useLanguage } from '../context/LanguageContext';

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
  title, message, confirmLabel, tone = 'danger', busy, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const { t } = useLanguage();
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-gray-600 dark:text-slate-300">{message}</p>
      <div className="flex gap-3 pt-5">
        <button type="button" onClick={onCancel} className={`flex-1 ${secondaryButton}`}>
          {t('Cancel')}
        </button>
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={onConfirm}
          className={`flex-1 ${tone === 'danger' ? dangerButton : primaryButton}`}
        >
          {busy ? t('Working...') : confirmLabel ?? t('Delete')}
        </button>
      </div>
    </Modal>
  );
}
