import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockApi, renderPage } from '../helpers';

/**
 * Turning the second factor on and off.
 *
 * The setup is a three-step handshake and each step can strand somebody: the
 * backup codes are shown once and never again, the confirmation carries them
 * back so the server can hash them, and turning 2FA off costs the account
 * password. What is asserted is the request, because that is where each of
 * those rules lives — the screen would look correct while sending a body that
 * locks the owner out of their own gym.
 */

const api = vi.hoisted(() => ({ current: null as ReturnType<typeof import('../helpers')['mockApi']> | null }));

vi.mock('../../src/api/client', () => ({
  default: {
    get: (url: string) => api.current!.get(url),
    post: (...args: unknown[]) => api.current!.post(...args as []),
    put: (...args: unknown[]) => api.current!.put(...args as []),
    delete: (...args: unknown[]) => api.current!.delete(...args as []),
  },
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const Security = (await import('../../src/pages/Security')).default;

const BACKUP_CODES = ['1111-2222', '3333-4444'];

const setup = (enabled: boolean) => {
  api.current = mockApi({
    '/auth/two-factor/status': { enabled, remainingBackupCodes: enabled ? 6 : 0 },
    '/auth/two-factor/setup': {
      secret: 'JBSWY3DPEHPK3PXP',
      qrCode: 'data:image/png;base64,iVBORw0KGgo=',
      backupCodes: BACKUP_CODES,
    },
  });
  return api.current;
};

describe('Security — turning 2FA on', () => {
  it('shows the QR code and the manual key beside it', async () => {
    setup(false);

    renderPage(<Security />);
    await userEvent.click(await screen.findByRole('button', { name: /enable two-factor/i }));

    // The key is the fallback for a phone that cannot scan; without it a
    // camera problem is a dead end.
    expect(await screen.findByAltText(/qr code/i)).toBeInTheDocument();
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
  });

  it('shows the backup codes, which are never shown again', async () => {
    setup(false);

    renderPage(<Security />);
    await userEvent.click(await screen.findByRole('button', { name: /enable two-factor/i }));

    for (const code of BACKUP_CODES) {
      expect(await screen.findByText(code)).toBeInTheDocument();
    }
  });

  it('sends only the code — the server keeps the backup codes it issued', async () => {
    const stub = setup(false);

    renderPage(<Security />);
    await userEvent.click(await screen.findByRole('button', { name: /enable two-factor/i }));
    await userEvent.type(await screen.findByPlaceholderText('123456'), '123456');
    await userEvent.click(screen.getByRole('button', { name: /verify & enable/i }));

    await waitFor(() => expect(stub.post).toHaveBeenCalledWith(
      '/auth/two-factor/verify-setup',
      // The server hashed and stored the backup codes at setup, so the client
      // must not choose them: it sends the authenticator code alone.
      { code: '123456' },
    ));
  });

  it('will not submit a half-typed code', async () => {
    const stub = setup(false);

    renderPage(<Security />);
    await userEvent.click(await screen.findByRole('button', { name: /enable two-factor/i }));
    await userEvent.type(await screen.findByPlaceholderText('123456'), '123');

    expect(screen.getByRole('button', { name: /verify & enable/i })).toBeDisabled();
    expect(stub.post).not.toHaveBeenCalled();
  });

  it('keeps letters out of the code box', async () => {
    setup(false);

    renderPage(<Security />);
    await userEvent.click(await screen.findByRole('button', { name: /enable two-factor/i }));
    const box = await screen.findByPlaceholderText('123456');
    await userEvent.type(box, '12ab34');

    expect(box).toHaveValue('1234');
  });
});

describe('Security — when it is already on', () => {
  it('says how many backup codes are left', async () => {
    setup(true);

    renderPage(<Security />);

    // The count is the only warning before somebody runs out and finds their
    // authenticator is the only way in.
    expect(await screen.findByText(/6 backup codes left/i)).toBeInTheDocument();
  });

  it('warns when the backup codes are running low', async () => {
    api.current = mockApi({
      '/auth/two-factor/status': { enabled: true, remainingBackupCodes: 1 },
    });

    renderPage(<Security />);

    // Amber and explicit, because the count is the only warning before
    // somebody runs out and finds the authenticator is the only way in.
    const warning = await screen.findByText(/1 backup code left/i);
    expect(warning).toHaveTextContent(/generate a new set/i);
  });

  it('sends the password when regenerating the backup codes', async () => {
    const stub = setup(true);
    stub.post = vi.fn(() => Promise.resolve({ data: { backupCodes: ['9999-8888'] } }));

    renderPage(<Security />);
    await userEvent.click(await screen.findByRole('button', { name: /new backup codes/i }));
    await userEvent.type(await screen.findByLabelText(/confirm your password/i), 'hunter2hunter2');
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /generate new codes/i }));

    // Password-gated like disabling, and for a sharper reason: these codes
    // bypass the second factor, so a stolen cookie that could mint a set
    // would get exactly what 2FA withholds.
    await waitFor(() => expect(stub.post).toHaveBeenCalledWith(
      '/auth/two-factor/backup-codes',
      { password: 'hunter2hunter2' },
    ));
  });

  it('shows the new codes, which are the only copy', async () => {
    const stub = setup(true);
    stub.post = vi.fn(() => Promise.resolve({
      data: { backupCodes: ['9999-8888', '7777-6666'] },
    }));

    renderPage(<Security />);
    await userEvent.click(await screen.findByRole('button', { name: /new backup codes/i }));
    await userEvent.type(await screen.findByLabelText(/confirm your password/i), 'hunter2hunter2');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /generate new codes/i }),
    );

    // The old set is already dead by now, so failing to show these would
    // leave the account worse off than before it was asked.
    expect(await screen.findByText('9999-8888')).toBeInTheDocument();
    expect(screen.getByText('7777-6666')).toBeInTheDocument();
  });

  it('will not regenerate without a password', async () => {
    const stub = setup(true);

    renderPage(<Security />);
    await userEvent.click(await screen.findByRole('button', { name: /new backup codes/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /generate new codes/i })).toBeDisabled();
    expect(stub.post).not.toHaveBeenCalled();
  });

  it('sends the password when turning it off', async () => {
    const stub = setup(true);

    renderPage(<Security />);
    await userEvent.click(await screen.findByRole('button', { name: /disable 2fa/i }));
    await userEvent.type(await screen.findByLabelText(/confirm your password/i), 'hunter2hunter2');
    // Scoped to the dialog: the card behind it carries a button of the same
    // name, and clicking that one would only reopen what is already open.
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^disable 2fa$/i }));

    // In the config form, because axios `delete` has no (url, body) overload
    // — getting this wrong sends no password and the server refuses.
    await waitFor(() => expect(stub.delete).toHaveBeenCalledWith(
      '/auth/two-factor',
      { data: { password: 'hunter2hunter2' } },
    ));
  });

  it('will not disable without a password', async () => {
    const stub = setup(true);

    renderPage(<Security />);
    await userEvent.click(await screen.findByRole('button', { name: /disable 2fa/i }));

    // A stolen cookie must not be able to strip the protection that stops it
    // being used, so the button stays dead until the password is typed.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /^disable 2fa$/i })).toBeDisabled();
    expect(stub.delete).not.toHaveBeenCalled();
  });
});
