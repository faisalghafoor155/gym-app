import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

import type { GymSettings, Member, MembershipPlan, Trainer } from '../../src/types';

/**
 * Registering a member, and correcting one.
 *
 * The form's own fields are not what is worth testing — a wrong label is
 * visible the first time somebody opens it. What is not visible is the shape
 * of the request it builds, and nearly every rule there is a distinction the
 * server would otherwise get wrong:
 *
 *   - A blank fee is *no payment*, not a payment of nothing.
 *   - A blank trainer fee is "use the usual rate", not "free" — `Number('')`
 *     is 0, which the API would store as a deliberate decision to charge
 *     nothing.
 *   - A plan and a fee only travel when registering; an edit that carried them
 *     would sell a membership to somebody correcting their phone number.
 *
 * The other half is what happens when the save is refused: a duplicate must
 * keep the modal open with everything still typed in it, because the desk has
 * a member standing there and retyping it is how a gym ends up with two.
 */

interface ApiStub {
  get: ReturnType<typeof vi.fn<(url: string, config?: unknown) => Promise<{ data: unknown }>>>;
  post: ReturnType<typeof vi.fn<(url: string, body: unknown) => Promise<{ data: unknown }>>>;
  put: ReturnType<typeof vi.fn<(url: string, body: unknown) => Promise<{ data: unknown }>>>;
}

const api = vi.hoisted(() => ({ current: null as null | ApiStub }));

vi.mock('../../src/api/client', () => ({
  default: {
    get: (url: string, config?: unknown) => api.current!.get(url, config),
    post: (url: string, body: unknown) => api.current!.post(url, body),
    put: (url: string, body: unknown) => api.current!.put(url, body),
  },
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
);
vi.mock('react-hot-toast', () => ({ default: toast }));

const MemberFormModal = (
  await import('../../src/components/members/MemberFormModal')
).default;

const aPlan = (over: Partial<MembershipPlan> = {}): MembershipPlan => ({
  id: 'plan-1',
  gymId: 'gym-1',
  name: 'Monthly',
  price: 2500,
  durationDays: 30,
  isActive: true,
  createdAt: new Date().toISOString(),
  ...over,
});

const aTrainer = (over: Partial<Trainer> = {}): Trainer => ({
  id: 'trainer-1',
  name: 'Bilal',
  phone: null,
  specialization: null,
  commissionPercentage: 0,
  ptFee: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  activeMembersCount: 0,
  ...over,
});

const settings: GymSettings = {
  name: 'Test Gym',
  ownerName: 'Owner',
  phone: null,
  address: null,
  defaultPtFee: 10000,
  joiningFee: 0,
  easypaisaAccount: '0300-1234567',
  jazzcashAccount: null,
  bankAccount: null,
};

const aMember = (over: Partial<Member> = {}): Member => ({
  id: 'member-1',
  gymId: 'gym-1',
  memberNo: 'MEM-00001',
  name: 'Ali Khan',
  email: null,
  phone: '03001234567',
  photo: null,
  gender: null,
  dateOfBirth: null,
  address: null,
  emergencyContact: null,
  whatsappOptOut: false,
  status: 'active',
  storedStatus: 'active',
  currentMembership: null,
  createdAt: new Date().toISOString(),
  ...over,
});

const onClose = vi.fn();
const onSaved = vi.fn();

const renderModal = (
  props: Partial<Parameters<typeof MemberFormModal>[0]> = {},
): ReactElement => {
  const ui = (
    <MemoryRouter>
      <MemberFormModal
        member={null}
        plans={[aPlan()]}
        trainers={[aTrainer()]}
        settings={settings}
        onClose={onClose}
        onSaved={onSaved}
        {...props}
      />
    </MemoryRouter>
  );
  render(ui);
  return ui;
};

/** The body of the one create call the form made. */
const createdWith = (): Record<string, unknown> =>
  api.current!.post.mock.calls[0]![1] as Record<string, unknown>;

/** The body of the one update call the form made. */
const updatedWith = (): Record<string, unknown> =>
  api.current!.put.mock.calls[0]![1] as Record<string, unknown>;

const save = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: /add member|save changes|update/i }));
};

beforeEach(() => {
  vi.clearAllMocks();
  api.current = {
    // No duplicate, so the blur check never interferes with a save.
    get: vi.fn(() => Promise.resolve({ data: { duplicate: false } })),
    post: vi.fn(() => Promise.resolve({ data: aMember() })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
  };
});

describe('registering somebody', () => {
  it('sends what was typed', async () => {
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await userEvent.type(screen.getByLabelText(/^phone$/i), '03211234567');
    await save();

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    expect(createdWith()).toMatchObject({
      name: 'Sana Tariq',
      phone: '03211234567',
    });
  });

  it('hands the created member back, because enrolment needs its id', async () => {
    // The id does not exist until the save returns, and offering the
    // fingerprint scan is the page's decision rather than the form's.
    const created = aMember({ id: 'new-member' });
    api.current!.post = vi.fn(() => Promise.resolve({ data: created }));
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await save();

    // No reader attached, so the fingerprint option is off.
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created, false));
  });

  it('asks for the fingerprint scan when a reader is there and the option is left on', async () => {
    const created = aMember({ id: 'new-member' });
    api.current!.post = vi.fn(() => Promise.resolve({ data: created }));
    renderModal({ fingerprintReady: true });

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await save();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created, true));
  });

  it('skips the fingerprint scan when the option is unticked', async () => {
    const created = aMember({ id: 'new-member' });
    api.current!.post = vi.fn(() => Promise.resolve({ data: created }));
    renderModal({ fingerprintReady: true });

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await userEvent.click(screen.getByRole('checkbox', { name: /add fingerprint/i }));
    await save();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created, false));
  });

  it('shows the fingerprint option but cannot tick it without a reader', () => {
    renderModal();

    expect(screen.getByRole('checkbox', { name: /add fingerprint/i })).toBeDisabled();
  });

  it('does not ask for a date of birth or address when registering', () => {
    renderModal();

    expect(screen.queryByLabelText(/date of birth/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^address$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/emergency contact/i)).toBeInTheDocument();
  });

  it('fills in the fixed joining fee and sends it with the registration', async () => {
    renderModal({ settings: { ...settings, joiningFee: 3000 } });

    expect(screen.getByLabelText(/fee collected/i)).toHaveValue(3000);
    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await save();

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    expect(createdWith()).toMatchObject({ feeAmount: 3000 });
  });

  it('omits a date of birth that was never filled in', async () => {
    // The API rejects "" for a date, so an unset one has to be absent rather
    // than empty.
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await save();

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    expect(createdWith()).not.toHaveProperty('dateOfBirth');
  });

  it('does not send whatsappOptOut, which the create endpoint would reject', async () => {
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await save();

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    expect(createdWith()).not.toHaveProperty('whatsappOptOut');
  });
});

describe('the joining fee', () => {
  it('sends nothing when the amount is left blank', async () => {
    // Blank means no money changed hands — the member is registered and can be
    // billed later. Sending a zero would record a payment of nothing.
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await save();

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    const body = createdWith();
    expect(body).not.toHaveProperty('feeAmount');
    expect(body).not.toHaveProperty('feeMethod');
  });

  it('sends nothing when the amount is zero', async () => {
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await userEvent.type(screen.getByLabelText(/fee collected/i), '0');
    await save();

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    expect(createdWith()).not.toHaveProperty('feeAmount');
  });

  it('sends the fee as a number once money is taken', async () => {
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await userEvent.type(screen.getByLabelText(/fee collected/i), '2500');
    await save();

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    expect(createdWith()).toMatchObject({ feeAmount: 2500, feeMethod: 'cash' });
  });

  it('keeps the wallet fields out of a cash payment', async () => {
    // A channel and a reference describe money that arrived online. Attaching
    // them to cash would put a transaction id on a note handed over a counter.
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await userEvent.type(screen.getByLabelText(/fee collected/i), '2500');
    await save();

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    const body = createdWith();
    expect(body).not.toHaveProperty('feeChannel');
    expect(body).not.toHaveProperty('feeReference');
  });
});

describe('assigning a trainer', () => {
  it('sends the trainer, and null for a fee that was not haggled', async () => {
    // Blank means "use the trainer's rate, then the gym's". `Number('')` is 0,
    // which the server would read as a deliberate decision to charge nothing —
    // so blank has to reach the API as null, not as a number.
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await userEvent.selectOptions(
      screen.getByLabelText(/personal trainer/i),
      'trainer-1',
    );
    await save();

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    expect(createdWith()).toMatchObject({ trainerId: 'trainer-1', ptFee: null });
  });

  it('sends an agreed fee as the number it is', async () => {
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await userEvent.selectOptions(
      screen.getByLabelText(/personal trainer/i),
      'trainer-1',
    );
    await userEvent.type(screen.getByLabelText(/trainer fee/i), '8000');
    await save();

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    expect(createdWith()).toMatchObject({ ptFee: 8000 });
  });

  it('sends a deliberate zero as zero, not as null', async () => {
    // The one case where 0 is meant: this trainer is not charging for this
    // member. Collapsing it into null would silently bill the usual rate.
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await userEvent.selectOptions(
      screen.getByLabelText(/personal trainer/i),
      'trainer-1',
    );
    await userEvent.type(screen.getByLabelText(/trainer fee/i), '0');
    await save();

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    expect(createdWith()).toMatchObject({ ptFee: 0 });
  });

  it('sends no trainer fee when no trainer was picked', async () => {
    // A fee without a trainer bills nobody for nothing.
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await save();

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    const body = createdWith();
    expect(body).toMatchObject({ trainerId: null });
    expect(body).not.toHaveProperty('ptFee');
    expect(body).not.toHaveProperty('ptFeePaid');
  });
});

describe('editing an existing member', () => {
  it('updates rather than creating', async () => {
    renderModal({ member: aMember() });

    await save();

    await waitFor(() => expect(api.current!.put).toHaveBeenCalled());
    expect(api.current!.put.mock.calls[0]![0]).toBe('/members/member-1');
    expect(api.current!.post).not.toHaveBeenCalled();
  });

  it('sends whatsappOptOut, which only an edit may change', async () => {
    renderModal({ member: aMember() });

    await save();

    await waitFor(() => expect(api.current!.put).toHaveBeenCalled());
    expect(updatedWith()).toHaveProperty('whatsappOptOut');
  });

  it('never sells a membership from a profile edit', async () => {
    // Changing what an existing member bought is its own action. A plan or a
    // fee riding along on an edit would charge somebody for correcting their
    // phone number.
    renderModal({ member: aMember() });

    await save();

    await waitFor(() => expect(api.current!.put).toHaveBeenCalled());
    const body = updatedWith();
    expect(body).not.toHaveProperty('planId');
    expect(body).not.toHaveProperty('startDate');
    expect(body).not.toHaveProperty('feeAmount');
  });

  it('offers no membership section at all', async () => {
    renderModal({ member: aMember() });

    expect(screen.queryByText(/membership plan/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/fee collected/i)).not.toBeInTheDocument();
  });

  it('creates nobody, so the caller is handed null', async () => {
    renderModal({ member: aMember() });

    await save();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(null, false));
  });

  it('offers no fee field for a trainer the member already had', async () => {
    // Re-saving a profile must not charge for an assignment that was billed
    // when it was made, so the form does not offer to price it again — a field
    // inviting a second fee would be a trap. The server refuses it regardless,
    // guarding on `trainerId !== existing.trainerId`, so this is the front
    // half of a rule enforced in both places.
    renderModal({ member: aMember({ trainerId: 'trainer-1' }) });

    expect(screen.queryByLabelText(/trainer fee/i)).not.toBeInTheDocument();

    await save();

    await waitFor(() => expect(api.current!.put).toHaveBeenCalled());
    // Whatever travels, it cannot be a haggled figure — none could be typed.
    expect(updatedWith().ptFee).toBeNull();
  });

  it('asks for a fee when the trainer actually changes', async () => {
    renderModal({ member: aMember({ trainerId: 'trainer-1' }), trainers: [
      aTrainer(),
      aTrainer({ id: 'trainer-2', name: 'Hamza' }),
    ] });

    await userEvent.selectOptions(
      screen.getByLabelText(/personal trainer/i),
      'trainer-2',
    );

    expect(screen.getByLabelText(/trainer fee/i)).toBeInTheDocument();
  });
});

describe('when the member is already on the books', () => {
  /** A 409 as the members endpoints send it. */
  const conflict = (field: 'phone' | 'name', message: string) =>
    Object.assign(new Error('conflict'), {
      response: { status: 409, data: { field, error: message } },
    });

  it('keeps everything typed when the save is refused', async () => {
    // The desk has somebody standing there. Clearing the form would mean
    // retyping it, which is how a gym ends up with two of the same member.
    api.current!.post = vi.fn(() =>
      Promise.reject(conflict('phone', 'Ali Khan already uses this number')),
    );
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await userEvent.type(screen.getByLabelText(/^phone$/i), '03211234567');
    await save();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Sana Tariq');
    expect(screen.getByLabelText(/^phone$/i)).toHaveValue('03211234567');
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('points at the field at fault', async () => {
    api.current!.post = vi.fn(() =>
      Promise.reject(conflict('phone', 'Ali Khan already uses this number')),
    );
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await save();

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Ali Khan already uses this number');
    expect(screen.getByLabelText(/^phone$/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('stops complaining as soon as the number is corrected', async () => {
    // Waiting for a round trip to clear the warning would leave it sitting
    // under a field that is already right.
    api.current!.post = vi.fn(() =>
      Promise.reject(conflict('phone', 'Ali Khan already uses this number')),
    );
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await save();
    await screen.findByRole('alert');

    await userEvent.type(screen.getByLabelText(/^phone$/i), '9');

    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
  });

  it('will not let a known duplicate be forced through', async () => {
    // While the warning stands the save is disabled: pressing again would send
    // the same request to be refused the same way. Correcting the field is the
    // way out, which is what clears it.
    api.current!.post = vi.fn(() =>
      Promise.reject(conflict('name', 'Somebody with this name and birthday exists')),
    );
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await save();
    await screen.findByRole('alert');

    expect(screen.getByRole('button', { name: /add member/i })).toBeDisabled();
  });

  it('lets the save be retried once the name is corrected', async () => {
    api.current!.post = vi.fn(() =>
      Promise.reject(conflict('name', 'Somebody with this name and birthday exists')),
    );
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await save();
    await screen.findByRole('alert');

    // Editing the flagged field clears the warning and re-enables the save.
    api.current!.post = vi.fn(() => Promise.resolve({ data: aMember() }));
    await userEvent.type(screen.getByLabelText(/full name/i), ' Malik');
    await save();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('treats a server error as an error, not as a duplicate', async () => {
    // Only a 409 carrying a field is a duplicate. A 500 must not put a warning
    // under a field that is perfectly fine.
    api.current!.post = vi.fn(() =>
      Promise.reject(Object.assign(new Error('boom'), { response: { status: 500 } })),
    );
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await save();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('the duplicate hint', () => {
  it('warns on leaving the phone field, before anything is saved', async () => {
    api.current!.get = vi.fn(() =>
      Promise.resolve({
        data: {
          duplicate: true,
          field: 'phone',
          message: 'Ali Khan already uses this number',
        },
      }),
    );
    renderModal();

    await userEvent.type(screen.getByLabelText(/^phone$/i), '03001234567');
    await userEvent.tab();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ali Khan already uses this number',
    );
    expect(api.current!.post).not.toHaveBeenCalled();
  });

  it('excludes the member being edited from its own duplicate check', async () => {
    // Without this an edit finds itself and refuses to save.
    renderModal({ member: aMember() });

    await userEvent.type(screen.getByLabelText(/^phone$/i), '9');
    await userEvent.tab();

    await waitFor(() => expect(api.current!.get).toHaveBeenCalled());
    const [, config] = api.current!.get.mock.calls[0]!;
    expect((config as { params: Record<string, unknown> }).params).toMatchObject({
      excludeId: 'member-1',
    });
  });

  it('lets the save proceed when the check itself fails', async () => {
    // Fail open. Blocking a registration because a lookup timed out is a worse
    // bug than the duplicate it was guarding against — and the save re-checks
    // server-side anyway.
    api.current!.get = vi.fn(() => Promise.reject(new Error('offline')));
    renderModal();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Sana Tariq');
    await userEvent.type(screen.getByLabelText(/^phone$/i), '03211234567');
    await userEvent.tab();
    await save();

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('the photo', () => {
  it('refuses one over 2MB rather than sending it', async () => {
    // The API caps the body at 4MB and base64 adds a third, so an oversized
    // photo comes back as a 413 the desk cannot act on.
    renderModal();

    const big = new File(['x'.repeat(2 * 1024 * 1024 + 1)], 'big.jpg', {
      type: 'image/jpeg',
    });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, big);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Photo must be under 2MB'),
    );
  });
});
