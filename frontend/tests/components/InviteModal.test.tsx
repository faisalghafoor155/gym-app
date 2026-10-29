import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import InviteModal from '../../src/components/team/InviteModal';
import type { SharedInvite } from '../../src/components/team/types';

/**
 * The invite window sends the link straight to the member's WhatsApp chat.
 *
 * Their saved number is filled in, a number typed in local form still opens
 * the right chat, and a half-typed one is refused rather than sending the
 * link to whoever owns those digits.
 */

const invite = (over: Partial<SharedInvite> = {}): SharedInvite => ({
  name: 'Ali', link: 'https://gym.example/accept-invite?token=abc',
  emailed: false, viaWhatsApp: true, ...over,
});

const whatsapp = () => screen.getByRole('link', { name: 'Send on WhatsApp' });

describe('InviteModal', () => {
  it('opens the saved number’s chat', () => {
    render(<InviteModal sharedInvite={invite({ phone: '0300-1234567' })} onClose={vi.fn()} />);

    expect(screen.getByLabelText('WhatsApp number')).toHaveValue('0300-1234567');
    expect(whatsapp().getAttribute('href')).toMatch(/^https:\/\/wa\.me\/923001234567\?text=/);
    expect(decodeURIComponent(whatsapp().getAttribute('href')!)).toContain('token=abc');
  });

  it('uses a number typed in', async () => {
    render(<InviteModal sharedInvite={invite()} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('WhatsApp number'), '03111234567');

    expect(whatsapp().getAttribute('href')).toMatch(/^https:\/\/wa\.me\/923111234567\?text=/);
  });

  it('lets WhatsApp pick the chat when the field is blank', () => {
    render(<InviteModal sharedInvite={invite()} onClose={vi.fn()} />);

    expect(whatsapp().getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  it('refuses a half-typed number', async () => {
    render(<InviteModal sharedInvite={invite()} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('WhatsApp number'), '0300');

    expect(screen.getByText('Enter a full number, like 03001234567')).toBeInTheDocument();
    expect(screen.getByText('Send on WhatsApp').closest('a')).not.toHaveAttribute('href');
  });
});
