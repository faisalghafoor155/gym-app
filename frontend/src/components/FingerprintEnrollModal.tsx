import { useState } from 'react';
import { Fingerprint, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { apiError } from '../api/client';
import { primaryButton, secondaryButton, focusRing, inputClass } from './ui';
import { useDialog } from '../hooks/useDialog';
import { useLanguage } from '../context/LanguageContext';
import { useFingerprintReader } from '../hooks/useFingerprintReader';
import type { Member, FingerprintEnrolment } from '../types';

/** How many times the same finger is placed on the reader. */
const SCANS_NEEDED = 3;
/** Gap between scans, so the member can lift the finger and put it back. */
const LIFT_PAUSE_MS = 900;

/**
 * Enrol a member's fingerprint, or remove one already enrolled.
 *
 * Capture happens at the reader, not here — this asks the backend to take a
 * scan and hands the result back with the member id. Which is why there is no
 * device code in this file at all: when a real reader is wired up, the
 * `/fingerprint/capture` call below starts returning templates and nothing on
 * this page changes.
 *
 * Kept out of `Members.tsx` deliberately: this is a self-contained dialog with
 * its own device states, and the page has no use for any of them.
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
  const { t } = useLanguage();
  const ref = useDialog(true, onClose);
  // Asked here rather than taken from the caller: the page's answer is from
  // whenever it loaded, and a reader can be unplugged since. What this dialog
  // reports has to be current, because it is about to try using the thing.
  const { status, loading } = useFingerprintReader();
  const [busy, setBusy] = useState(false);
  const [finger, setFinger] = useState(existing?.finger ?? '');
  const [error, setError] = useState<string | null>(null);
  /** Scans the reader has accepted so far in this attempt, out of SCANS_NEEDED. */
  const [scansDone, setScansDone] = useState(0);
  /** The member's number on the machine, once it has been told to start taking
   *  their finger. Null until then. */
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const handleEnroll = async () => {
    setBusy(true);
    setError(null);
    setScansDone(0);
    try {
      // Readers want the same finger several times to build a reliable
      // template, and the desk needs to see each one land. A failed scan stops
      // the run — it is retried from the start rather than leaving a member
      // half-enrolled. Until hardware is configured the capture 503s, which is
      // the branch the "not set up" panel below already covers.
      let captured: { template: string; format: string } | null = null;
      for (let i = 0; i < SCANS_NEEDED; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, LIFT_PAUSE_MS));
        const res = await api.post<{ template: string; format: string }>(
          '/fingerprint/capture', {},
        );
        captured = res.data;
        setScansDone(i + 1);
      }
      if (!captured) throw new Error('no scan');

      await api.post('/fingerprint/enroll', {
        memberId: member.id,
        template: captured.template,
        format: captured.format,
        finger: finger.trim() || undefined,
      });

      toast.success(
        existing
          ? t("{name}'s fingerprint updated", { name: member.name })
          : t('{name} enrolled', { name: member.name }),
      );
      onChanged();
      onClose();
    } catch (err) {
      setError(apiError(err, t('Could not enrol the fingerprint')));
    } finally {
      setBusy(false);
    }
  };

  /** Puts the member on the machine and opens its enrolment screen. */
  const handleDeviceStart = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<{ deviceUserId: string }>(
        '/fingerprint/device-enrol/start', { memberId: member.id },
      );
      setDeviceId(data.deviceUserId);
    } catch (err) {
      setError(apiError(err, t('Could not start enrolment on the machine')));
    } finally {
      setBusy(false);
    }
  };

  /** Records the enrolment once the machine has said it took the finger. */
  const handleDeviceConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/fingerprint/device-enrol/confirm', {
        memberId: member.id,
        finger: finger.trim() || undefined,
      });
      toast.success(existing
        ? t("{name}'s fingerprint updated", { name: member.name })
        : t('{name} enrolled', { name: member.name }));
      onChanged();
      onClose();
    } catch (err) {
      setError(apiError(err, t('Could not confirm the enrolment')));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/fingerprint/${member.id}`);
      toast.success(t("{name}'s fingerprint removed", { name: member.name }));
      onChanged();
      onClose();
    } catch (err) {
      setError(apiError(err, t('Could not remove the fingerprint')));
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
            {existing ? t('Fingerprint enrolled') : t('Enrol fingerprint')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {member.name} · {member.memberNo}
          </p>
          {justRegistered && (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
              {t('Member registered. Take their fingerprint now, or skip and do it later from the members list.')}
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-8">
            {t('Checking reader…')}
          </p>
        ) : !status?.configured ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-600 dark:text-slate-300 font-medium mb-1">
              {t('No fingerprint reader is set up')}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {t('Connect a reader before enrolling members.')}
            </p>
          </div>
        ) : !status.online ? (
          <div className="text-center py-6">
            <AlertCircle size={28} className="text-red-500 mx-auto mb-2" />
            <p className="text-sm text-gray-900 dark:text-slate-100 font-medium mb-1">
              {t('{reader} is not responding', { reader: status.label })}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {t('Check that it is powered on and connected.')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {existing && (
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-500/20 flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-green-800 dark:text-green-300">
                    {t('Enrolled {date}', {
                      date: new Date(existing.enrolledAt).toLocaleDateString('en-PK', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      }),
                    })}
                  </p>
                  {existing.finger && (
                    <p className="text-green-700 dark:text-green-400">{existing.finger}</p>
                  )}
                  <p className="text-green-700/70 dark:text-green-400/70 mt-1">
                    {t('Scanning again replaces the stored fingerprint.')}
                  </p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="fingerprint-finger" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                {t('Which finger')} <span className="font-normal text-gray-400">{t('(optional)')}</span>
              </label>
              <input
                id="fingerprint-finger"
                value={finger}
                onChange={e => setFinger(e.target.value)}
                placeholder={t('e.g. right thumb')}
                maxLength={30}
                className={inputClass}
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                {t('Noted so the desk can remind the member which finger to use.')}
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}

            {status.enrolOnDevice ? (
              /* The machine takes the finger itself, three times, and its own
                 screen says whether each one was right. This only starts that
                 and records it afterwards. */
              deviceId === null ? (
                <>
                  <button
                    onClick={() => void handleDeviceStart()}
                    disabled={busy}
                    className={`w-full ${primaryButton}`}
                  >
                    {busy
                      ? t('Contacting machine…')
                      : existing ? t('Start again on the machine') : t('Start on the machine')}
                  </button>
                  <p className="text-xs text-center text-gray-400 dark:text-slate-500">
                    {t('{reader} will open enrolment for this member. The finger is placed on the machine itself, three times.', { reader: status.label })}
                  </p>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-sm text-blue-900 dark:text-blue-200 space-y-1">
                    <p className="font-semibold">{t('Now have them place a finger on the machine')}</p>
                    <ol className="list-decimal list-inside text-xs space-y-0.5">
                      <li>{t('Enrolment is open on the machine for ID')} <strong>{deviceId}</strong> ({member.name}).</li>
                      <li>{t('The member places the same finger 3 times.')}</li>
                      <li>{t('Each time, the machine shows right / OK on its screen — if a scan is wrong it asks again.')}</li>
                      <li>{t('When the machine shows "Enrolment OK", press Done below.')}</li>
                    </ol>
                  </div>
                  <button
                    onClick={() => void handleDeviceConfirm()}
                    disabled={busy}
                    className={`w-full ${primaryButton}`}
                  >
                    {busy ? t('Saving…') : t('Done — the machine took the finger')}
                  </button>
                  <button
                    onClick={() => void handleDeviceStart()}
                    disabled={busy}
                    className={`w-full ${secondaryButton}`}
                  >
                    {t('Start again on the machine')}
                  </button>
                </>
              )
            ) : (
            <>
            {/* One dot per scan: grey until taken, green with a tick once the
                reader has accepted it. */}
            <ol
              aria-label={t('Scan progress')}
              className="flex items-center justify-center gap-3"
            >
              {Array.from({ length: SCANS_NEEDED }, (_, i) => {
                const done = i < scansDone;
                const current = busy && i === scansDone;
                return (
                  <li
                    key={i}
                    aria-label={done
                      ? t('Scan {n} done', { n: i + 1 })
                      : current ? t('Scan {n} in progress', { n: i + 1 }) : t('Scan {n} waiting', { n: i + 1 })}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                      done
                        ? 'bg-green-50 dark:bg-green-950/30 border-green-500 text-green-600'
                        : current
                          ? 'border-blue-500 text-blue-600 animate-pulse'
                          : 'border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500'
                    }`}
                  >
                    {done ? <CheckCircle2 size={18} /> : i + 1}
                  </li>
                );
              })}
            </ol>

            <p role="status" className="text-sm text-center font-medium text-gray-700 dark:text-slate-300">
              {busy
                ? scansDone === 0
                  ? t('Place the finger on the reader (1 of {total})…', { total: SCANS_NEEDED })
                  : scansDone < SCANS_NEEDED
                    ? t('Scan {done} right ✓ — lift the finger and place it again ({next} of {total})…', {
                        done: scansDone, next: scansDone + 1, total: SCANS_NEEDED,
                      })
                    : t('Saving…')
                : scansDone === SCANS_NEEDED
                  ? t('All {total} scans right ✓', { total: SCANS_NEEDED })
                  : t('The same finger goes on {total} times.', { total: SCANS_NEEDED })}
            </p>

            <button
              onClick={() => void handleEnroll()}
              disabled={busy}
              className={`w-full ${primaryButton}`}
            >
              {busy
                ? t('Reading fingerprint…')
                : existing ? t('Scan again to replace') : t('Scan fingerprint')}
            </button>

            <p className="text-xs text-center text-gray-400 dark:text-slate-500">
              {t('Ask the member to place a finger on the reader and hold it still. Each scan is confirmed here before the next one starts.')}
            </p>
            </>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-5 pt-4 border-t border-gray-100 dark:border-slate-800">
          <button onClick={onClose} className={`flex-1 ${secondaryButton}`}>
            {justRegistered ? t('Skip for now') : t('Close')}
          </button>
          {existing && (
            <button
              onClick={() => void handleRemove()}
              disabled={busy}
              aria-label={t("Remove {name}'s fingerprint", { name: member.name })}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-red-100 dark:border-red-500/20 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors ${focusRing}`}
            >
              <Trash2 size={13} /> {t('Remove')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
