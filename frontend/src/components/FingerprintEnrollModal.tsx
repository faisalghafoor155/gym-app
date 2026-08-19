import { useEffect, useState } from 'react';
import { Fingerprint, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { apiError } from '../api/client';
import { primaryButton, secondaryButton, focusRing, inputClass } from './ui';
import { useDialog } from '../hooks/useDialog';
import type { Member, FingerprintStatus, FingerprintEnrolment } from '../types';

/**
 * Enrol a member's fingerprint, or remove one already enrolled.
 *
 * Capture happens at the reader, not here — this asks the backend to take a
 * scan and hands the result back with the member id. Which is why there is no
 * device code in this file at all: when a real reader is wired up, the
 * `/fingerprint/capture` call below starts returning templates and nothing on
 * this page changes.
 *
 * Kept out of `Members.tsx` deliberately. That file is already past a thousand
 * lines and this is a self-contained dialog with its own device states.
 */
export default function FingerprintEnrollModal({
  member,
  existing,
  justRegistered = false,
  onClose,
  onChanged,
}: {
  member: Member;
  /** The member's current enrolment, when they have one. */
  existing: FingerprintEnrolment | null;
  /**
   * Opened straight after registering this member, rather than from the
   * roster. Only changes the wording: the desk is mid-errand and has not asked
   * for this dialog, so the close button reads "Skip" and says the enrolment
   * can be done later.
   */
  justRegistered?: boolean;
  onClose: () => void;
  /** Called after a successful enrol or removal, so the list can refresh. */
  onChanged: () => void;
}) {
  const ref = useDialog(true, onClose);
  const [status, setStatus] = useState<FingerprintStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [finger, setFinger] = useState(existing?.finger ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<FingerprintStatus>('/fingerprint/status')
      .then(r => setStatus(r.data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  const handleEnroll = async () => {
    setBusy(true);
    setError(null);
    try {
      // The reader takes the scan and returns its template. Until hardware is
      // configured this 503s, which is the branch the "not set up" panel below
      // already covers — so this button is never reachable without a device.
      const { data: captured } = await api.post<{ template: string; format: string }>(
        '/fingerprint/capture', {},
      );

      await api.post('/fingerprint/enroll', {
        memberId: member.id,
        template: captured.template,
        format: captured.format,
        finger: finger.trim() || undefined,
      });

      toast.success(
        existing
          ? `${member.name}'s fingerprint updated`
          : `${member.name} enrolled`,
      );
      onChanged();
      onClose();
    } catch (err) {
      setError(apiError(err, 'Could not enrol the fingerprint'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/fingerprint/${member.id}`);
      toast.success(`${member.name}'s fingerprint removed`);
      onChanged();
      onClose();
    } catch (err) {
      setError(apiError(err, 'Could not remove the fingerprint'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fingerprint-modal-title"
        className="w-full max-w-sm p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mx-auto mb-3">
            <Fingerprint size={28} className="text-blue-600" />
          </div>
          <h3 id="fingerprint-modal-title" className="font-bold text-gray-900 dark:text-slate-100 text-lg">
            {existing ? 'Fingerprint enrolled' : 'Enrol fingerprint'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {member.name} · {member.memberNo}
          </p>
          {justRegistered && (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
              Member registered. Take their fingerprint now, or skip and do it
              later from the members list.
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-8">
            Checking reader…
          </p>
        ) : !status?.configured ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-600 dark:text-slate-300 font-medium mb-1">
              No fingerprint reader is set up
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Connect a reader before enrolling members.
            </p>
          </div>
        ) : !status.online ? (
          <div className="text-center py-6">
            <AlertCircle size={28} className="text-red-500 mx-auto mb-2" />
            <p className="text-sm text-gray-900 dark:text-slate-100 font-medium mb-1">
              {status.label} is not responding
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Check that it is powered on and connected.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {existing && (
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-500/20 flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-green-800 dark:text-green-300">
                    Enrolled {new Date(existing.enrolledAt).toLocaleDateString('en-PK', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                  {existing.finger && (
                    <p className="text-green-700 dark:text-green-400">{existing.finger}</p>
                  )}
                  <p className="text-green-700/70 dark:text-green-400/70 mt-1">
                    Scanning again replaces the stored fingerprint.
                  </p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="fingerprint-finger" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Which finger <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="fingerprint-finger"
                value={finger}
                onChange={e => setFinger(e.target.value)}
                placeholder="e.g. right thumb"
                maxLength={30}
                className={inputClass}
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                Noted so the desk can remind the member which finger to use.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}

            <button
              onClick={() => void handleEnroll()}
              disabled={busy}
              className={`w-full ${primaryButton}`}
            >
              {busy
                ? 'Reading fingerprint…'
                : existing ? 'Scan again to replace' : 'Scan fingerprint'}
            </button>

            <p className="text-xs text-center text-gray-400 dark:text-slate-500">
              Ask the member to place a finger on the reader and hold it still.
            </p>
          </div>
        )}

        <div className="flex gap-2 mt-5 pt-4 border-t border-gray-100 dark:border-slate-800">
          <button onClick={onClose} className={`flex-1 ${secondaryButton}`}>
            {justRegistered ? 'Skip for now' : 'Close'}
          </button>
          {existing && (
            <button
              onClick={() => void handleRemove()}
              disabled={busy}
              aria-label={`Remove ${member.name}'s fingerprint`}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-red-100 dark:border-red-500/20 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors ${focusRing}`}
            >
              <Trash2 size={13} /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
