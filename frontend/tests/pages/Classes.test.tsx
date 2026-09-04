import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  aClass, aClassBooking, aSchedule, listPage, mockApi, ownerAuth, renderPage,
  type AuthState,
} from '../helpers';

/**
 * The classes page.
 *
 * Its two confirmed writes look alike and are not: deleting a timetable slot
 * removes a weekly session for everybody, while cancelling a booking frees one
 * member's place. They live on different tabs and hit different endpoints, and
 * the failure worth catching is one reaching the other's — a page that deleted
 * the slot when the desk meant to free a place would empty a class nobody
 * asked to cancel.
 */

const api = vi.hoisted(() => ({
  current: null as ReturnType<typeof import('../helpers')['mockApi']> | null,
}));
const auth = vi.hoisted(() => ({ current: null as unknown as AuthState }));

vi.mock('../../src/api/client', () => ({
  default: {
    get: (...args: unknown[]) => api.current!.get(...args as [string]),
    post: (...args: unknown[]) => api.current!.post(...args as []),
    put: (...args: unknown[]) => api.current!.put(...args as []),
    delete: (...args: unknown[]) => api.current!.delete(...args as []),
  },
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => auth.current }));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const Classes = (await import('../../src/pages/Classes')).default;

/** Two slots, so a page deleting whichever it rendered first cannot pass. */
const yoga = aSchedule({ id: 'sched-yoga', classId: 'class-yoga', className: 'Yoga' });
const spin = aSchedule({ id: 'sched-spin', classId: 'class-spin', className: 'Spin' });

const booking = aClassBooking({
  id: 'booking-ali',
  member: { id: 'mem-ali', name: 'Ali Khan', memberNo: 'MEM-00001' },
  schedule: {
    id: 'sched-yoga',
    className: 'Yoga',
    trainerName: null,
    startTime: '09:00',
    endTime: '10:00',
    dayOfWeek: 1,
  },
});

const setup = () => {
  auth.current = ownerAuth;
  api.current = mockApi({
    '/classes/schedules': [yoga, spin],
    '/classes': listPage([aClass({ id: 'class-yoga', name: 'Yoga' })]),
    '/trainers': listPage([]),
    '/members': listPage([]),
    '/class-bookings': listPage([booking]),
  });
  return api.current;
};

const loaded = () => screen.findAllByText('Yoga');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Classes — deleting a timetable slot', () => {
  /**
   * The slot's delete control is an icon with no text, so it is found by
   * position within its own card rather than by name — the card is what ties
   * it to a class, and that tie is the thing under test.
   */
  const deleteButtonFor = (className: string) => {
    const heading = screen.getAllByText(className)[0]!;
    const card = heading.closest('div.bg-white') ?? heading.parentElement!;
    const buttons = within(card as HTMLElement).getAllByRole('button');
    return buttons[buttons.length - 1]!;
  };

  it('asks first, then removes the slot it was aimed at', async () => {
    const stub = setup();
    renderPage(<Classes />);
    await loaded();

    await userEvent.click(deleteButtonFor('Spin'));
    expect(stub.delete).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/delete schedule slot/i)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(stub.delete).toHaveBeenCalledTimes(1));
    // The schedule endpoint, not the class one: removing the weekly slot must
    // not remove the program it belongs to.
    expect(stub.delete).toHaveBeenCalledWith('/classes/schedules/sched-spin');
  });

  it('removes nothing when the dialog is dismissed', async () => {
    const stub = setup();
    renderPage(<Classes />);
    await loaded();

    await userEvent.click(deleteButtonFor('Yoga'));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /^cancel$/i }),
    );

    expect(stub.delete).not.toHaveBeenCalled();
  });
});

describe('Classes — cancelling a booking', () => {
  it('frees the place with a status change, and deletes nothing', async () => {
    const stub = setup();
    renderPage(<Classes />);
    await loaded();

    await userEvent.click(screen.getByRole('tab', { name: /attending roster/i }));
    await screen.findAllByText('Ali Khan');

    // The roster shows a booking both under its slot and in the day's list, so
    // there are two ways to reach the same cancellation. Either is fine; what
    // matters is what the confirmed one sends.
    const triggers = screen.getAllByRole('button', { name: /cancel booking/i });
    await userEvent.click(triggers[0]!);
    expect(stub.put).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^cancel booking$/i }));

    await waitFor(() => expect(stub.put).toHaveBeenCalledTimes(1));
    // A cancelled booking is a status, not a deletion — the row stays so the
    // gym can still see who gave a place up.
    expect(stub.put).toHaveBeenCalledWith('/class-bookings/booking-ali', {
      status: 'cancelled',
    });
    expect(stub.delete).not.toHaveBeenCalled();
  });
});
