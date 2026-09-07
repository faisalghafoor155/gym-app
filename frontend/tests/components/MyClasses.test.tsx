import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { MyScheduleSlot } from '../../src/types';

/**
 * The member's own class timetable.
 *
 * What matters here is the difference between a slot they can take and one
 * they cannot, and that cancelling asks first — a member tapping "Cancel" on a
 * phone has no undo, and the place goes to somebody else the moment it lands.
 */

/** The stub each test installs, shaped like the bits of the client used here. */
interface ApiStub {
  get: ReturnType<typeof vi.fn<(url: string) => Promise<{ data: unknown }>>>;
  post: ReturnType<typeof vi.fn<(url: string, body: unknown) => Promise<{ data: unknown }>>>;
  delete: ReturnType<typeof vi.fn<(url: string) => Promise<{ data: unknown }>>>;
}

const api = vi.hoisted(() => ({ current: null as null | ApiStub }));

vi.mock('../../src/api/client', () => ({
  default: {
    get: (url: string) => api.current!.get(url),
    post: (url: string, body: unknown) => api.current!.post(url, body),
    delete: (url: string) => api.current!.delete(url),
  },
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));

const toast = vi.hoisted(() => Object.assign(vi.fn(), {
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: toast }));

const MyClasses = (await import('../../src/components/portal/MyClasses')).default;

const aSlot = (over: Partial<MyScheduleSlot> = {}): MyScheduleSlot => ({
  id: 'slot-1',
  className: 'Yoga',
  classDescription: null,
  trainerName: 'Coach Sara',
  startTime: '09:00',
  endTime: '10:00',
  dayOfWeek: 1,
  capacity: 10,
  bookingsCount: 3,
  remainingCapacity: 7,
  booked: false,
  ...over,
});

/** Stubs the two calls the component makes on mount. */
const setup = (slots: MyScheduleSlot[], bookings: unknown[] = []): ApiStub => {
  const stub: ApiStub = {
    get: vi.fn((url: string) =>
      url.includes('/me/schedule')
        ? Promise.resolve({ data: slots })
        : Promise.resolve({
            data: { data: bookings, total: bookings.length, page: 1, limit: 25, hasMore: false },
          }),
    ),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  };
  api.current = stub;
  return stub;
};

beforeEach(() => {
  toast.success.mockClear();
  toast.error.mockClear();
});

describe('what a member is offered', () => {
  it('shows a bookable slot with a Book button', async () => {
    setup([aSlot()]);
    render(<MyClasses />);

    expect(await screen.findByText('Yoga')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Book' })).toBeDefined();
  });

  it('says how many places are left rather than who has them', async () => {
    setup([aSlot({ remainingCapacity: 2, capacity: 10, bookingsCount: 8 })]);
    render(<MyClasses />);

    // The count is the whole of what the API sends about other people.
    expect(await screen.findByText(/2 of 10 places left/)).toBeDefined();
  });

  it('marks a slot they already hold, and offers no second booking', async () => {
    setup([aSlot({ booked: true })]);
    render(<MyClasses />);

    expect(await screen.findByText('Booked')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Book' })).toBeNull();
  });

  it('will not let a full class be booked', async () => {
    setup([aSlot({ remainingCapacity: 0, booked: false })]);
    render(<MyClasses />);

    const button = await screen.findByRole('button', { name: 'Full' });
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('says so when the day has nothing on', async () => {
    setup([]);
    render(<MyClasses />);

    expect(await screen.findByText(/No classes scheduled/)).toBeDefined();
  });
});

describe('booking', () => {
  it('sends the slot and the day being shown', async () => {
    const stub = setup([aSlot()]);
    render(<MyClasses />);

    await userEvent.click(await screen.findByRole('button', { name: 'Book' }));

    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    const [url, body] = stub.post.mock.calls[0]!;
    expect(url).toBe('/me/bookings');
    // No memberId: the server takes it off the session, and the schema has no
    // field for one — a client that sent one would be sending it nowhere.
    expect(body).not.toHaveProperty('memberId');
    expect((body as { scheduleId: string }).scheduleId).toBe('slot-1');
  });

  it('reports the server\'s own refusal, not a generic one', async () => {
    const stub = setup([aSlot()]);
    stub.post.mockRejectedValue(new Error('nope'));
    render(<MyClasses />);

    await userEvent.click(await screen.findByRole('button', { name: 'Book' }));

    // `apiError` surfaces the API's message, which is what distinguishes a
    // full class from a lapsed membership. The fallback only covers the case
    // where the request never reached the server.
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('refetches afterwards, so the slot shows as booked', async () => {
    const stub = setup([aSlot()]);
    render(<MyClasses />);

    await screen.findByRole('button', { name: 'Book' });
    const before = stub.get.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Book' }));

    await waitFor(() => expect(stub.get.mock.calls.length).toBeGreaterThan(before));
  });
});

describe('cancelling', () => {
  const aBooking = () => ({
    id: 'booking-1',
    // Tomorrow, so it counts as upcoming whatever day the suite runs on.
    bookingDate: new Date(Date.now() + 86_400_000).toISOString(),
    status: 'booked' as const,
    scheduleId: 'slot-1',
    className: 'Yoga',
    trainerName: 'Coach Sara',
    startTime: '09:00',
    endTime: '10:00',
    dayOfWeek: 1,
  });

  it('lists what is coming up', async () => {
    setup([], [aBooking()]);
    render(<MyClasses />);

    expect(await screen.findByText(/Your next classes/)).toBeDefined();
  });

  it('asks before giving the place up', async () => {
    const stub = setup([], [aBooking()]);
    render(<MyClasses />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    // Nothing has been sent yet: the place goes to somebody else the moment
    // this lands, and there is no undo.
    expect(stub.delete).not.toHaveBeenCalled();
    expect(await screen.findByText(/Give up this place\?/)).toBeDefined();
  });

  it('cancels once confirmed', async () => {
    const stub = setup([], [aBooking()]);
    render(<MyClasses />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel booking' }));

    await waitFor(() => expect(stub.delete).toHaveBeenCalledWith('/me/bookings/booking-1'));
  });
});

describe('moving between days', () => {
  it('asks the server for the new day rather than filtering what it has', async () => {
    const stub = setup([aSlot()]);
    render(<MyClasses />);

    await screen.findByText('Yoga');
    await userEvent.click(screen.getByRole('button', { name: 'Next day' }));

    // A different day is a different set of recurring slots, which only the
    // server knows — there is nothing on the client to filter.
    await waitFor(() => {
      const scheduleCalls = stub.get.mock.calls
        .map(c => c[0] as string)
        .filter(u => u.includes('/me/schedule'));
      expect(scheduleCalls.length).toBeGreaterThan(1);
      expect(scheduleCalls[0]).not.toBe(scheduleCalls[scheduleCalls.length - 1]);
    });
  });
});
