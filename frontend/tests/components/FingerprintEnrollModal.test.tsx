import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { aMember } from '../helpers';
import type { FingerprintStatus } from '../../src/types';

/**
 * Enrolling a member's fingerprint.
 *
 * The reader is a physical thing that can be missing, unplugged, or simply not
 * answering, and each of those is a different message rather than a failure —
 * a gym with no reader is not in an error state, it just has no reader. What
 * this holds down is that the scan button is reachable only when a device is
 * actually there to take the scan, because the alternative is a front desk
 * asking a member to place their thumb on nothing.
 *
 * The enrol call is the other half. It is two requests, not one: the reader is
 * asked for a template and only then is the member enrolled against it, so an
 * enrolment that skipped the capture would store whatever happened to be in
 * the request body.
 */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/api/client', () => ({
  default: api,
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const FingerprintEnrollModal = (await import('../../src/components/FingerprintEnrollModal')).default;

const aStatus = (over: Partial<FingerprintStatus> = {}): FingerprintStatus => ({
  configured: true,
  // Licensed by default: a gym without the feature never reaches this modal,
  // so every case here is about the reader rather than the plan.
  licensed: true,
  plan: 'pro',
  online: true,
  label: 'ZKTeco SLK20R',
  format: 'zkteco-v10',
  matchesLocally: false,
  enrolledCount: 12,
  ...over,
});

const member = aMember({ id: 'member-1', name: 'Ali Khan', memberNo: 'M-004' });

const renderModal = (props: Partial<Parameters<typeof FingerprintEnrollModal>[0]> = {}) => {
  const onClose = vi.fn();
  const onChanged = vi.fn();
  render(
    <FingerprintEnrollModal
      member={member}
      existing={null}
      onClose={onClose}
      onChanged={onChanged}
      {...props}
    />,
  );
  return { onClose, onChanged };
};

/** The reader answer has landed when the dialog has stopped saying so. */
const settled = () =>
  waitFor(() => expect(screen.queryByText(/checking reader/i)).not.toBeInTheDocument());

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: aStatus() });
});

describe('FingerprintEnrollModal — what the reader is doing', () => {
  it('offers no scan when no reader is set up', async () => {
    api.get.mockResolvedValue({ data: aStatus({ configured: false, online: false }) });
    renderModal();
    await settled();

    expect(screen.getByText(/no fingerprint reader is set up/i)).toBeInTheDocument();
    // The button is absent rather than disabled: there is nothing to press it
    // against, and a greyed-out control invites waiting for it to come back.
    expect(screen.queryByRole('button', { name: /scan/i })).not.toBeInTheDocument();
  });

  it('names the reader that is not responding, rather than blaming the gym', async () => {
    api.get.mockResolvedValue({ data: aStatus({ configured: true, online: false }) });
    renderModal();
    await settled();

    // Configured but silent is a different problem from having no reader —
    // one is "plug something in", the other is "check the thing you have".
    expect(screen.getByText(/ZKTeco SLK20R is not responding/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /scan/i })).not.toBeInTheDocument();
  });

  it('treats a failed lookup as no reader', async () => {
    api.get.mockRejectedValue(new Error('network'));
    renderModal();
    await settled();

    // Nothing is known about the device, so nothing is offered. A gym that
    // cannot reach its own backend should not be told to scan a finger.
    expect(screen.getByText(/no fingerprint reader is set up/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /scan/i })).not.toBeInTheDocument();
  });

  it('offers the scan once a reader is there and answering', async () => {
    renderModal();
    await settled();

    expect(screen.getByRole('button', { name: /scan fingerprint/i })).toBeInTheDocument();
  });
});

describe('FingerprintEnrollModal — enrolling', () => {
  it('captures from the reader, then enrols the member against that template', async () => {
    api.post.mockImplementation((url: string) => {
      if (url === '/fingerprint/capture') {
        return Promise.resolve({ data: { template: 'TPL-abc', format: 'zkteco-v10' } });
      }
      return Promise.resolve({ data: {} });
    });
    const user = userEvent.setup();
    const { onChanged, onClose } = renderModal();
    await settled();

    await user.type(screen.getByLabelText(/which finger/i), 'right thumb');
    await user.click(screen.getByRole('button', { name: /scan fingerprint/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    // The capture has to come first: enrolling without it would store a
    // template nobody scanned.
    expect(api.post.mock.calls[0]![0]).toBe('/fingerprint/capture');
    const [url, body] = api.post.mock.calls[1] as [string, Record<string, unknown>];
    expect(url).toBe('/fingerprint/enroll');
    expect(body).toMatchObject({
      memberId: 'member-1',
      template: 'TPL-abc',
      format: 'zkteco-v10',
      finger: 'right thumb',
    });

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('sends no finger at all when the field is left blank', async () => {
    api.post.mockImplementation((url: string) => {
      if (url === '/fingerprint/capture') {
        return Promise.resolve({ data: { template: 'TPL-abc', format: 'zkteco-v10' } });
      }
      return Promise.resolve({ data: {} });
    });
    const user = userEvent.setup();
    renderModal();
    await settled();

    await user.click(screen.getByRole('button', { name: /scan fingerprint/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    const [, body] = api.post.mock.calls[1] as [string, Record<string, unknown>];
    // The note is optional, and an empty string is not a finger — it would
    // show up on the desk as a blank label rather than as "not recorded".
    expect(body.finger).toBeUndefined();
  });

  it('keeps the dialog open and says why when the scan fails', async () => {
    api.post.mockRejectedValue(new Error('reader timeout'));
    const user = userEvent.setup();
    const { onClose, onChanged } = renderModal();
    await settled();

    await user.click(screen.getByRole('button', { name: /scan fingerprint/i }));

    expect(await screen.findByText(/could not enrol the fingerprint/i)).toBeInTheDocument();
    // A finger that did not read is retried, not started over — closing here
    // would send the desk back through the roster to find the member again.
    expect(onClose).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /scan fingerprint/i })).toBeEnabled();
  });
});

describe('FingerprintEnrollModal — a member who is already enrolled', () => {
  const existing = {
    id: 'enrol-1',
    enrolledAt: '2026-08-01T10:00:00.000Z',
    finger: 'right thumb',
    format: 'zkteco-v10',
  };

  it('says what is on file and offers to replace it', async () => {
    renderModal({ existing });
    await settled();

    expect(screen.getByText(/right thumb/i)).toBeInTheDocument();
    // Wording matters here: the desk needs to know a second scan overwrites
    // rather than adding a finger.
    expect(screen.getByRole('button', { name: /scan again to replace/i })).toBeInTheDocument();
  });

  it('prefills the finger already recorded, so replacing keeps the label', async () => {
    renderModal({ existing });
    await settled();

    expect(screen.getByLabelText(/which finger/i)).toHaveValue('right thumb');
  });

  it('removes the enrolment against the member, not the enrolment id', async () => {
    api.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    const { onChanged, onClose } = renderModal({ existing });
    await settled();

    await user.click(screen.getByRole('button', { name: /remove ali khan's fingerprint/i }));

    await waitFor(() => expect(api.delete).toHaveBeenCalled());
    expect(api.delete).toHaveBeenCalledWith('/fingerprint/member-1');
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('offers no removal to a member who has none', async () => {
    renderModal();
    await settled();

    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });
});

describe('FingerprintEnrollModal — opened straight after registering', () => {
  it('offers to skip, since the desk did not ask for this', async () => {
    renderModal({ justRegistered: true });
    await settled();

    expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
    expect(screen.getByText(/member registered/i)).toBeInTheDocument();
  });

  it('says Close when opened from the roster, where it was asked for', async () => {
    renderModal();
    await settled();

    expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument();
    expect(screen.queryByText(/member registered/i)).not.toBeInTheDocument();
  });
});
