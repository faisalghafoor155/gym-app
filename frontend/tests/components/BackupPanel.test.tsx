import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BackupResult, BackupStatus, ElectronBackupApi } from '../../src/electron';

/**
 * The backup panel is the desk's only handle on the data's safety, so what it
 * says has to be true: it is absent where there is nothing to back up, it
 * explains itself where backups are off, and a refused or cancelled restore is
 * never reported as a success.
 */

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toast }));

const BackupPanel = (await import('../../src/components/team/BackupPanel')).default;

const install = (over: Partial<ElectronBackupApi> = {}, status: BackupStatus = { supported: true, folder: 'C:\backups', lastAutoAt: null, autoCount: 0 }) => {
  const api: ElectronBackupApi = {
    status: vi.fn().mockResolvedValue(status),
    create: vi.fn().mockResolvedValue({ ok: true, path: 'E:\b.dump', size: 2048 } satisfies BackupResult),
    restore: vi.fn().mockResolvedValue({ ok: true } satisfies BackupResult),
    openFolder: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  window.electronAPI = { isElectron: true, backup: api };
  return api;
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => { delete window.electronAPI; });

describe('BackupPanel', () => {
  it('renders nothing in the browser, where there is no desktop shell', () => {
    delete window.electronAPI;
    const { container } = render(<BackupPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says why backups are off instead of offering buttons that cannot work', async () => {
    install({}, { supported: false, reason: 'Your data is on the online server.' });
    render(<BackupPanel />);

    expect(await screen.findByText(/your data is on the online server/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /back up now/i })).not.toBeInTheDocument();
  });

  it('backs up and reports the size', async () => {
    const api = install();
    render(<BackupPanel />);

    await userEvent.click(await screen.findByRole('button', { name: /back up now/i }));

    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/backup saved \(2 KB\)/i));
  });

  it('stays quiet when the save dialog is cancelled', async () => {
    install({ create: vi.fn().mockResolvedValue({ ok: false, canceled: true }) });
    render(<BackupPanel />);

    await userEvent.click(await screen.findByRole('button', { name: /back up now/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /back up now/i })).toBeEnabled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('reports a failed restore as a failure, never as a success', async () => {
    install({ restore: vi.fn().mockResolvedValue({ ok: false, error: 'That file is not a GymPro backup, or it is damaged.' }) });
    render(<BackupPanel />);

    await userEvent.click(await screen.findByRole('button', { name: /restore from backup/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/not a gympro backup/i)));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('confirms a successful restore', async () => {
    install();
    render(<BackupPanel />);

    await userEvent.click(await screen.findByRole('button', { name: /restore from backup/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/backup restored/i)));
  });

  it('shows when the last automatic copy was made', async () => {
    install({}, { supported: true, folder: 'C:\b', lastAutoAt: '2026-10-19T10:00:00.000Z', autoCount: 5 });
    render(<BackupPanel />);

    expect(await screen.findByText(/last one .*5 kept/i)).toBeInTheDocument();
  });
});
