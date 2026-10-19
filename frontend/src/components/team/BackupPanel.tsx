import { useEffect, useState } from 'react';
import { DatabaseBackup, FolderOpen, HardDriveDownload, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { primaryButton, secondaryButton } from '../ui';
import type { BackupStatus } from '../../electron';

const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Back up and restore the data stored on this PC.
 *
 * Only exists in the desktop app: the website has no `electronAPI`, and there
 * the data is on the server. The buttons call the desktop shell, which owns the
 * file dialogs and the database tools — nothing here touches the data itself.
 */
export default function BackupPanel() {
  const api = typeof window === 'undefined' ? undefined : window.electronAPI?.backup;
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState<'create' | 'restore' | null>(null);

  const refresh = () => { void api?.status().then(setStatus).catch(() => setStatus(null)); };
  useEffect(refresh, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!api) return null;

  const backUp = async () => {
    setBusy('create');
    try {
      const r = await api.create();
      if (r.ok) toast.success(`Backup saved (${formatSize(r.size ?? 0)})`);
      else if (!r.canceled) toast.error(r.error ?? 'The backup could not be made');
    } finally { setBusy(null); }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const r = await api.restore();
      if (r.ok) toast.success('Backup restored. Your data is back as it was in that backup.');
      else if (!r.canceled) toast.error(r.error ?? 'The restore failed');
      refresh();
    } finally { setBusy(null); }
  };

  const lastAuto = status?.lastAutoAt
    ? new Date(status.lastAutoAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <section
      aria-label="Backup and restore"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 mb-5"
    >
      <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-1 flex items-center gap-2">
        <DatabaseBackup size={18} className="text-blue-600" /> Backup &amp; restore
      </h3>

      {status && !status.supported ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">{status.reason}</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
            Save a copy of all members, payments and attendance to a USB drive or another
            PC. A backup that stays only on this PC is lost if the PC is.
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => void backUp()} disabled={busy !== null} className={`${primaryButton} inline-flex items-center gap-2`}>
              <HardDriveDownload size={16} /> {busy === 'create' ? 'Saving…' : 'Back up now'}
            </button>
            <button onClick={() => void restore()} disabled={busy !== null} className={`${secondaryButton} inline-flex items-center gap-2`}>
              <RotateCcw size={16} /> {busy === 'restore' ? 'Restoring…' : 'Restore from backup…'}
            </button>
            <button onClick={() => void api.openFolder()} className={`${secondaryButton} inline-flex items-center gap-2`}>
              <FolderOpen size={16} /> Automatic backups
            </button>
          </div>

          <p className="text-xs text-gray-400 dark:text-slate-500">
            {lastAuto
              ? `A copy is also saved automatically each day on this PC — last one ${lastAuto}, ${status?.autoCount} kept.`
              : 'A copy is also saved automatically each day on this PC.'}
            {' '}Restoring replaces everything with the backup you pick; a copy of today&apos;s data is saved first.
          </p>
        </>
      )}
    </section>
  );
}
