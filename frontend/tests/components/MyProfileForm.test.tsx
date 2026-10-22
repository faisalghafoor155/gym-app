import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { MyProfile } from '../../src/types';

/**
 * The contact details a member maintains themselves.
 *
 * What matters here is what the form refuses to do: send a request when
 * nothing changed, offer the email as editable, or lose what the member typed
 * when the server says no.
 */

interface ApiStub {
  put: ReturnType<typeof vi.fn<(url: string, body: unknown) => Promise<{ data: unknown }>>>;
}

const api = vi.hoisted(() => ({ current: null as null | ApiStub }));

vi.mock('../../src/api/client', () => ({
  default: { put: (url: string, body: unknown) => api.current!.put(url, body) },
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));

const toast = vi.hoisted(() => Object.assign(vi.fn(), {
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: toast }));

const MyProfileForm = (await import('../../src/components/portal/MyProfileForm')).default;

const aMember = (over: Partial<MyProfile['member']> = {}): MyProfile['member'] => ({
  id: 'mem-1',
  memberNo: 'MEM-00125',
  name: 'Ayesha Khan',
  email: 'ayesha@example.com',
  phone: '03001234567',
  photo: null,
  gender: null,
  dateOfBirth: null,
  address: 'House 5, Gulberg',
  emergencyContact: 'Bilal 03009876543',
  whatsappOptOut: false,
  storedStatus: 'active',
  currentMembership: null,
  ...over,
} as MyProfile['member']);

const setup = (over: Partial<MyProfile['member']> = {}) => {
  const stub: ApiStub = {
    put: vi.fn(() => Promise.resolve({ data: { member: aMember(over) } })),
  };
  api.current = stub;
  const onSaved = vi.fn();
  render(<MyProfileForm member={aMember(over)} onSaved={onSaved} />);
  return { stub, onSaved };
};

const saveButton = () => screen.getByRole('button', { name: /save changes/i });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('a member editing their own details', () => {
  it('fills the form from the record it was handed', () => {
    setup();

    expect(screen.getByLabelText(/phone/i)).toHaveValue('03001234567');
    expect(screen.getByLabelText(/address/i)).toHaveValue('House 5, Gulberg');
    expect(screen.getByLabelText(/emergency contact/i))
      .toHaveValue('Bilal 03009876543');
  });

  it('saves nothing until something changes', async () => {
    const { stub } = setup();

    // The one request the server answers with a 400 is the one that changed
    // nothing, so the form does not let it be made.
    expect(saveButton()).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/phone/i), '8');
    expect(saveButton()).toBeEnabled();

    expect(stub.put).not.toHaveBeenCalled();
  });

  it('sends only the fields a member owns', async () => {
    const { stub, onSaved } = setup();

    await userEvent.clear(screen.getByLabelText(/phone/i));
    await userEvent.type(screen.getByLabelText(/phone/i), '03111111111');
    await userEvent.click(saveButton());

    await waitFor(() => expect(stub.put).toHaveBeenCalledTimes(1));
    const [url, body] = stub.put.mock.calls[0];
    expect(url).toBe('/me');
    expect(body).toEqual({
      phone: '03111111111',
      address: 'House 5, Gulberg',
      emergencyContact: 'Bilal 03009876543',
      dateOfBirth: null,
    });
    // Email is never in the payload, however the server would treat it.
    expect(body).not.toHaveProperty('email');
    expect(onSaved).toHaveBeenCalled();
  });

  it('lets the member set their own birthday', async () => {
    const { stub } = setup();

    await userEvent.type(screen.getByLabelText(/date of birth/i), '1998-03-14');
    await userEvent.click(saveButton());

    await waitFor(() => expect(stub.put).toHaveBeenCalledTimes(1));
    expect(stub.put.mock.calls[0][1]).toMatchObject({ dateOfBirth: '1998-03-14' });
  });

  it('will not let the member edit the email they sign in with', () => {
    setup();

    const email = screen.getByLabelText(/email/i);
    expect(email).toHaveValue('ayesha@example.com');
    expect(email).toBeDisabled();
  });

  it('clears a field by sending null rather than an empty string', async () => {
    const { stub } = setup();

    await userEvent.clear(screen.getByLabelText(/address/i));
    await userEvent.click(saveButton());

    await waitFor(() => expect(stub.put).toHaveBeenCalledTimes(1));
    // Blank is a real edit — "clear it" — and null is how the server is told
    // that, as against leaving the field alone.
    expect(stub.put.mock.calls[0][1]).toMatchObject({ address: null });
  });

  it('keeps what was typed when the save is refused', async () => {
    const { stub, onSaved } = setup();
    stub.put.mockRejectedValueOnce(new Error('nope'));

    await userEvent.clear(screen.getByLabelText(/emergency contact/i));
    await userEvent.type(screen.getByLabelText(/emergency contact/i), 'Sana 0300');
    await userEvent.click(saveButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    // A rejected save is usually one field the server did not like; wiping the
    // form would take the others with it.
    expect(screen.getByLabelText(/emergency contact/i)).toHaveValue('Sana 0300');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('puts back the saved values when the edit is abandoned', async () => {
    setup();

    await userEvent.clear(screen.getByLabelText(/phone/i));
    await userEvent.type(screen.getByLabelText(/phone/i), '0399');
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByLabelText(/phone/i)).toHaveValue('03001234567');
    expect(saveButton()).toBeDisabled();
  });

  it('shows an empty form for a member with nothing on file', () => {
    setup({ phone: null, address: null, emergencyContact: null, email: null });

    expect(screen.getByLabelText(/phone/i)).toHaveValue('');
    expect(screen.getByLabelText(/address/i)).toHaveValue('');
    expect(saveButton()).toBeDisabled();
  });
});
