import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck, ShieldOff, KeyRound, Copy, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { apiError } from '../api/client';
import Modal from '../components/Modal';
import {
  Page, PageHeader, Card, IconTile, Spinner,
  inputClass, primaryButton, secondaryButton, dangerButton,
} from '../components/ui';

interface TwoFactorStatus {
  enabled: boolean;
  remainingBackupCodes: number;
}

interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

/**
 * Two-factor authentication settings. Every role lands here — the second
 * factor protects an account, and members' logins deserve it as much as the
 * owner's. The setup walks QR scan → backup codes → first code, because
 * enabling without proving the authenticator works would lock people out of
 * their own accounts.
 */
export default function Security() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  /** Turning the second factor off costs the first one. */
  const [disablePassword, setDisablePassword] = useState('');
  /** The regenerate flow: the password prompt, then the codes it returned.
   *  Separate from `setup` because no QR is involved — the secret does not
   *  change, so nobody has to re-scan anything. */
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [regeneratePassword, setRegeneratePassword] = useState('');
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);

  const load = () => {
    api.get<TwoFactorStatus>('/auth/two-factor/status')
      .then(r => setStatus(r.data))
      .catch(err => toast.error(apiError(err, 'Could not load security settings')));
  };
  useEffect(load, []);

  const beginSetup = async () => {
    setBusy(true);
    try {
      const { data } = await api.get<TwoFactorSetup>('/auth/two-factor/setup');
      setSetup(data);
      setCode('');
    } catch (err) {
      toast.error(apiError(err, 'Could not start 2FA setup'));
    } finally {
      setBusy(false);
    }
  };

  const finishSetup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!setup) return;
    setBusy(true);
    try {
      // The codes go back with the confirmation: the server stores only their
      // hashes, and sending them along is what ties this exact set to the
      // account being enabled.
      await api.post('/auth/two-factor/verify-setup', { code: code.trim(), backupCodes: setup.backupCodes });
      toast.success('Two-factor authentication enabled');
      setSetup(null);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Invalid code'));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      // The password travels in the body, so `delete` needs the config form —
      // axios has no (url, body) overload for it.
      await api.delete('/auth/two-factor', { data: { password: disablePassword } });
      toast.success('Two-factor authentication disabled');
      setConfirmDisable(false);
      setDisablePassword('');
      load();
    } catch (err) {
      // The field is kept, not cleared: a mistyped password should cost one
      // character, not the whole entry.
      toast.error(apiError(err, 'Could not disable 2FA'));
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = (codes: string[]) => {
    void navigator.clipboard.writeText(codes.join('\n'))
      .then(() => toast.success('Backup codes copied'))
      .catch(() => toast.error('Copy failed — select and copy them manually'));
  };

  /**
   * Replaces the remaining codes with a fresh set.
   *
   * The old ones stop working immediately, so the new list is held in state
   * and shown until dismissed — closing without saving them is the one way
   * this leaves somebody worse off than before.
   */
  const regenerate = async () => {
    setBusy(true);
    try {
      const { data } = await api.post<{ backupCodes: string[] }>(
        '/auth/two-factor/backup-codes',
        { password: regeneratePassword },
      );
      setFreshCodes(data.backupCodes);
      setConfirmRegenerate(false);
      setRegeneratePassword('');
      load();
    } catch (err) {
      // The field survives a wrong password, same as disabling.
      toast.error(apiError(err, 'Could not generate new backup codes'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader
        icon={ShieldCheck}
        title="Security"
        subtitle="Two-factor authentication for your account"
      />

      <Card className="p-5 sm:p-6 max-w-xl">
        {!status ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <div className="flex items-start gap-4">
            <IconTile icon={status.enabled ? ShieldCheck : ShieldOff} tone={status.enabled ? 'green' : 'gray'} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 dark:text-slate-100">
                Two-factor authentication is {status.enabled ? 'on' : 'off'}
              </p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                {status.enabled
                  ? 'Signing in asks for a code from your authenticator app after the password.'
                  : 'After your password, signing in will also ask for a code from an authenticator app.'}
              </p>
              {status.enabled && (
                // Amber below three: the count is the only warning before
                // somebody runs out and finds the authenticator is the sole
                // way in. Grey text nobody reads would not be a warning.
                <p className={`text-xs mt-2 flex items-center gap-1.5 ${
                  status.remainingBackupCodes <= 2
                    ? 'text-amber-600 dark:text-amber-400 font-medium'
                    : 'text-gray-400 dark:text-slate-500'
                }`}>
                  <KeyRound size={12} />
                  {status.remainingBackupCodes} backup {status.remainingBackupCodes === 1 ? 'code' : 'codes'} left
                  {status.remainingBackupCodes <= 2 && ' — generate a new set'}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {status.enabled ? (
                  <>
                    <button onClick={() => setConfirmRegenerate(true)} className={secondaryButton}>
                      <RefreshCw size={14} /> New backup codes
                    </button>
                    <button onClick={() => setConfirmDisable(true)} className={dangerButton}>
                      Disable 2FA
                    </button>
                  </>
                ) : (
                  <button onClick={beginSetup} disabled={busy} className={primaryButton}>
                    Enable Two-Factor Authentication
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {setup && (
        <Modal title="Set up two-factor authentication" onClose={() => setSetup(null)}>
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                1. Scan with your authenticator app
              </p>
              <div className="flex justify-center bg-white rounded-xl p-3 border border-gray-200 dark:border-slate-700">
                <img src={setup.qrCode} alt="2FA QR code" className="w-44 h-44" />
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                Cannot scan? Enter this key manually:{' '}
                <code className="font-mono text-gray-600 dark:text-slate-300 break-all">{setup.secret}</code>
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  2. Save your backup codes
                </p>
                <button onClick={() => copyCodes(setup.backupCodes)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1">
                  <Copy size={12} /> Copy
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3">
                {setup.backupCodes.map(c => (
                  <code key={c} className="font-mono text-xs text-center text-gray-700 dark:text-slate-300 py-1">{c}</code>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                Each works once, in place of the authenticator code. They are shown only now.
              </p>
            </div>

            <form onSubmit={finishSetup} className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  3. Enter the 6-digit code to confirm
                </p>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  className={`${inputClass} tracking-widest`}
                  placeholder="123456"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setSetup(null)} className={secondaryButton}>
                  Cancel
                </button>
                <button type="submit" disabled={busy || code.length !== 6} className={primaryButton}>
                  {busy ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {confirmRegenerate && (
        <Modal
          title="Generate new backup codes?"
          onClose={() => { setConfirmRegenerate(false); setRegeneratePassword(''); }}
        >
          <form onSubmit={e => { e.preventDefault(); void regenerate(); }}>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              You will get eight fresh codes and the ones you have now will stop
              working. Your authenticator app is unaffected — the secret does not
              change, so there is nothing to re-scan.
            </p>
            <div className="mt-4">
              <label
                htmlFor="regenerate-2fa-password"
                className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1"
              >
                Confirm your password
              </label>
              <input
                id="regenerate-2fa-password"
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                value={regeneratePassword}
                onChange={e => setRegeneratePassword(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                Asked for because these codes bypass the second factor — a stolen
                session must not be able to issue itself a set.
              </p>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={() => { setConfirmRegenerate(false); setRegeneratePassword(''); }}
                className={secondaryButton}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !regeneratePassword}
                className={primaryButton}
              >
                {busy ? 'Generating...' : 'Generate new codes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {freshCodes && (
        // Not dismissable by accident: the old codes are already dead, so
        // closing this without saving these is the one path that leaves the
        // account worse off than before it was asked.
        <Modal title="Your new backup codes" onClose={() => setFreshCodes(null)}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Save these now
              </p>
              <button
                onClick={() => copyCodes(freshCodes)}
                className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3">
              {freshCodes.map(c => (
                <code key={c} className="font-mono text-xs text-center text-gray-700 dark:text-slate-300 py-1">{c}</code>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Each works once, in place of the authenticator code. Your previous
              codes no longer work, and these are shown only now.
            </p>
            <div className="flex justify-end">
              <button onClick={() => setFreshCodes(null)} className={primaryButton}>
                I have saved them
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDisable && (
        <Modal
          title="Disable two-factor authentication?"
          onClose={() => { setConfirmDisable(false); setDisablePassword(''); }}
        >
          <form
            onSubmit={e => { e.preventDefault(); void disable(); }}
          >
            <p className="text-sm text-gray-600 dark:text-slate-300">
              Signing in will need only the password again. Turn this off only if you are
              switching authenticator apps — you can set it up again right after.
            </p>
            <div className="mt-4">
              <label
                htmlFor="disable-2fa-password"
                className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1"
              >
                Confirm your password
              </label>
              <input
                id="disable-2fa-password"
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                value={disablePassword}
                onChange={e => setDisablePassword(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                Asked for because a stolen session should not be able to remove the
                protection that stops it being used.
              </p>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={() => { setConfirmDisable(false); setDisablePassword(''); }}
                className={secondaryButton}
              >
                Keep it on
              </button>
              <button
                type="submit"
                disabled={busy || !disablePassword}
                className={dangerButton}
              >
                {busy ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Page>
  );
}
