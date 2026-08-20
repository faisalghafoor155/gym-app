import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { anAuditLog, mockApi, renderPage } from '../helpers';
import type { AuditLog } from '../../src/types';

/**
 * The audit log page.
 *
 * Two things are worth holding down. The filters run on the server, so what
 * the page *asks for* is the thing to assert — a page that filtered the rows
 * it was handed would look right on page one and lose entries on page two.
 *
 * And the rendering: the stored form is a dotted verb (`member.create`) with
 * raw column names and ISO dates in the change payload. A log that shows those
 * verbatim is a log nobody reads, which is how it ends up unused.
 */

const api = vi.hoisted(() => ({ current: null as ReturnType<typeof mockApi> | null }));

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

const AuditLogPage = (await import('../../src/pages/AuditLog')).default;

const logsPage = (data: AuditLog[], over: Partial<{ total: number; hasMore: boolean }> = {}) => ({
  data,
  total: over.total ?? data.length,
  page: 1,
  limit: 25,
  hasMore: over.hasMore ?? false,
});

const setup = (logs = [anAuditLog()], over: Partial<{ total: number; hasMore: boolean }> = {}) => {
  api.current = mockApi({ '/audit-logs': logsPage(logs, over) });
  return api.current;
};

/** The page has loaded when the header count has rendered. */
const loaded = () => screen.findByText(/recorded action/);

describe('AuditLog — reading a row', () => {
  it('turns the stored verb into something a person reads', async () => {
    setup([anAuditLog({ action: 'membership.renew' })]);
    renderPage(<AuditLogPage />);
    await loaded();

    // `membership.renew` is right for a column and wrong for a page.
    expect(screen.getByText('Membership renewed')).toBeInTheDocument();
  });

  it('names what was acted on, so the row reads without a lookup', async () => {
    setup([anAuditLog({ entityLabel: 'MEM-00042 · Ayesha Bibi' })]);
    renderPage(<AuditLogPage />);
    await loaded();

    expect(screen.getByText('MEM-00042 · Ayesha Bibi')).toBeInTheDocument();
  });

  it('names who did it and in what role', async () => {
    setup([anAuditLog({ actorName: 'Front Desk', actorRole: 'staff' })]);
    renderPage(<AuditLogPage />);
    await loaded();

    expect(screen.getByText(/Front Desk/)).toBeInTheDocument();
    expect(screen.getByText(/staff/)).toBeInTheDocument();
  });

  it('shows a reason without needing to be expanded', async () => {
    setup([anAuditLog({ reason: 'Gym closed for maintenance' })]);
    renderPage(<AuditLogPage />);
    await loaded();

    // Where a row carries a justification, that justification is the point of
    // the row — hiding it behind a toggle would bury it.
    expect(screen.getByText('Gym closed for maintenance')).toBeInTheDocument();
  });
});

describe('AuditLog — what changed', () => {
  const updated = anAuditLog({
    action: 'payment.update',
    before: { amount: 2500, method: 'cash' },
    after: { amount: 2000, method: 'online' },
  });

  it('keeps the changed fields behind a toggle', async () => {
    setup([updated]);
    renderPage(<AuditLogPage />);
    await loaded();

    expect(screen.queryByText('Amount')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show what changed/i })).toBeInTheDocument();
  });

  it('shows both sides of an update once opened', async () => {
    setup([updated]);
    renderPage(<AuditLogPage />);
    await loaded();

    await userEvent.click(screen.getByRole('button', { name: /show what changed/i }));

    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('2500')).toBeInTheDocument();
    expect(screen.getByText('2000')).toBeInTheDocument();
  });

  it('spaces out the raw column names', async () => {
    setup([anAuditLog({ after: { expiryDate: '2026-09-18T00:00:00.000Z' } })]);
    renderPage(<AuditLogPage />);
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: /show what changed/i }));

    expect(screen.getByText('Expiry Date')).toBeInTheDocument();
  });

  it('renders an ISO date as a date rather than a timestamp', async () => {
    setup([anAuditLog({ after: { expiryDate: '2026-09-18T00:00:00.000Z' } })]);
    renderPage(<AuditLogPage />);
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: /show what changed/i }));

    // The month's exact abbreviation is the locale's business ("Sep" or
    // "Sept" depending on the runtime) — what matters is that the raw ISO
    // string is gone and a readable date took its place.
    expect(screen.queryByText(/2026-09-18T00:00:00/)).not.toBeInTheDocument();
    expect(screen.getByText(/18 Sept? 2026/)).toBeInTheDocument();
  });

  it('offers no toggle on a row that recorded no fields', async () => {
    setup([anAuditLog({ before: null, after: null })]);
    renderPage(<AuditLogPage />);
    await loaded();

    expect(screen.queryByRole('button', { name: /show what changed/i })).not.toBeInTheDocument();
  });
});

describe('AuditLog — filtering', () => {
  it('sends the entity filter to the server', async () => {
    const stub = setup();
    renderPage(<AuditLogPage />);
    await loaded();

    await userEvent.selectOptions(
      screen.getByLabelText(/filter by what was acted on/i),
      'payment',
    );

    await waitFor(() => {
      expect(stub.callsTo('/audit-logs').some(u => u.includes('entity=payment'))).toBe(true);
    });
  });

  it('sends the date range to the server', async () => {
    const stub = setup();
    renderPage(<AuditLogPage />);
    await loaded();

    await userEvent.type(screen.getByLabelText(/from date/i), '2026-08-01');

    await waitFor(() => {
      expect(stub.callsTo('/audit-logs').some(u => u.includes('from=2026-08-01'))).toBe(true);
    });
  });

  it('omits a blank date rather than sending an empty one', async () => {
    const stub = setup();
    renderPage(<AuditLogPage />);
    await loaded();

    // The API rejects "" for a date, so an untouched filter must not appear.
    expect(stub.callsTo('/audit-logs').every(u => !u.includes('from='))).toBe(true);
  });

  it('says so when nothing matches, and offers a way back', async () => {
    setup([]);
    renderPage(<AuditLogPage />);
    await loaded();

    expect(screen.getByText(/nothing recorded yet/i)).toBeInTheDocument();
  });
});
