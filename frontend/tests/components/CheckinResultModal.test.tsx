import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CheckinResultModal from '../../src/components/attendance/CheckinResultModal';
import { aMembership } from '../helpers';

/**
 * The panel the front desk sees when somebody checks in.
 *
 * Its whole reason for being large is the membership standing: the member is
 * standing at the counter for a few seconds, and that is the only moment the
 * gym gets to say "this has run out". So what these check is that an expired
 * membership is impossible to miss, and that the expiry date itself is on
 * screen rather than left to be looked up.
 */

afterEach(() => vi.useRealTimers());

const show = (over: Partial<Parameters<typeof CheckinResultModal>[0]['result']> = {}) =>
  render(
    <CheckinResultModal
      result={{
        name: 'Ahmed Ali',
        memberNo: 'MEM-00042',
        photo: null,
        membership: aMembership(),
        alreadyCheckedIn: false,
        ...over,
      }}
      onClose={() => {}}
    />,
  );

describe('who is standing there', () => {
  it('names them and their member number', () => {
    show();

    expect(screen.getByText('Ahmed Ali')).toBeDefined();
    // Two Ahmeds in one gym is ordinary; the number is what settles it.
    expect(screen.getByText('MEM-00042')).toBeDefined();
  });

  it('falls back to initials when there is no photo', () => {
    show({ photo: null });

    expect(screen.getByText('AA')).toBeDefined();
  });

  it('says when they had already checked in today', () => {
    show({ alreadyCheckedIn: true });

    expect(screen.getByText(/already checked in today/i)).toBeDefined();
  });
});

describe('the membership standing', () => {
  it('shows an expired membership and how long ago it lapsed', () => {
    show({ membership: aMembership({ status: 'expired', daysLeft: -12 }) });

    expect(screen.getByText(/membership expired/i)).toBeDefined();
    expect(screen.getByText(/12 days ago/i)).toBeDefined();
  });

  it('reads a membership that ran out today as today, not as "0 days ago"', () => {
    show({ membership: aMembership({ status: 'expired', daysLeft: 0 }) });

    expect(screen.getByText(/ran out today/i)).toBeDefined();
  });

  it('puts the expiry date on screen, not just a countdown', () => {
    show({
      membership: aMembership({
        status: 'expired',
        daysLeft: -12,
        expiryDate: '2026-08-13T00:00:00.000Z',
      }),
    });

    // The date is the thing a member argues with, so it has to be visible
    // rather than derived from a number of days.
    expect(screen.getByText(/13 Aug 2026/)).toBeDefined();
  });

  it('names the plan they were on', () => {
    show({ membership: aMembership({ planName: 'Annual Gold' }) });

    expect(screen.getByText('Annual Gold')).toBeDefined();
  });

  it('warns about one that is about to run out', () => {
    show({ membership: aMembership({ status: 'expiring', daysLeft: 3 }) });

    expect(screen.getByText(/expires in 3 days/i)).toBeDefined();
  });

  it('says a single day rather than "1 days"', () => {
    show({ membership: aMembership({ status: 'expiring', daysLeft: 1 }) });

    expect(screen.getByText(/expires in 1 day$/i)).toBeDefined();
  });

  it('flags a suspended membership rather than waving them through', () => {
    show({ membership: aMembership({ status: 'suspended' }) });

    expect(screen.getByText(/membership suspended/i)).toBeDefined();
  });

  it('says plainly when there is no membership at all', () => {
    show({ membership: null });

    expect(screen.getByText(/no membership/i)).toBeDefined();
    // Nothing to show a date or a plan for.
    expect(screen.queryByText(/expiry/i)).toBeNull();
  });

  it('still leads with the expiry for somebody scanning twice', () => {
    show({
      alreadyCheckedIn: true,
      membership: aMembership({ status: 'expired', daysLeft: -3 }),
    });

    // Scanning twice is unremarkable; the lapsed membership is not, and must
    // not be displaced by it.
    expect(screen.getByText(/already checked in today/i)).toBeDefined();
    expect(screen.getByText(/membership expired/i)).toBeDefined();
  });
});

describe('getting out of the way', () => {
  it('closes when the desk presses the button', async () => {
    const onClose = vi.fn();
    render(
      <CheckinResultModal
        result={{
          name: 'Ahmed Ali', memberNo: 'MEM-1', photo: null,
          membership: aMembership(), alreadyCheckedIn: false,
        }}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /next member/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('clears itself so a queue is not held up', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <CheckinResultModal
        result={{
          name: 'Ahmed Ali', memberNo: 'MEM-1', photo: null,
          membership: aMembership(), alreadyCheckedIn: false,
        }}
        onClose={onClose}
      />,
    );

    expect(onClose).not.toHaveBeenCalled();
    // Nobody can press a button while somebody is waiting behind. Wrapped in
    // `act` because the countdown drives React state on every tick.
    act(() => { vi.advanceTimersByTime(6100); });
    expect(onClose).toHaveBeenCalled();
  });

  it('announces itself to a screen reader without waiting to be found', () => {
    show({ membership: aMembership({ status: 'expired', daysLeft: -5 }) });

    const dialog = screen.getByRole('alertdialog');
    expect(dialog.getAttribute('aria-live')).toBe('assertive');
    expect(dialog.getAttribute('aria-label')).toContain('Membership expired');
  });
});
