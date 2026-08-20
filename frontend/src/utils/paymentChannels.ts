import type { GymSettings, PaymentChannel } from '../types';

/** How each channel is written where a person will read it. */
export const CHANNEL_LABELS: Record<PaymentChannel, string> = {
  easypaisa: 'Easypaisa',
  jazzcash: 'JazzCash',
  bank: 'Bank Transfer',
};

/** The order the options are offered in, so both forms match. */
export const CHANNELS: PaymentChannel[] = ['easypaisa', 'jazzcash', 'bank'];

/** The label for a channel off a stored row, which may be null or unknown. */
export const channelLabel = (channel: string | null | undefined): string => {
  if (!channel) return '';
  return (CHANNEL_LABELS as Record<string, string | undefined>)[channel] ?? channel;
};

/**
 * The account details the gym publishes for a channel — what the front desk
 * reads out so the member knows where to send the money.
 *
 * Null when the owner has not filled it in. The channel is still offered in
 * that case: money can arrive by a route nobody wrote down, and refusing to
 * record it would not stop it happening.
 */
export const accountFor = (
  settings: GymSettings | null,
  channel: PaymentChannel | '',
): string | null => {
  if (!settings || !channel) return null;
  const value =
    channel === 'easypaisa' ? settings.easypaisaAccount
      : channel === 'jazzcash' ? settings.jazzcashAccount
        : settings.bankAccount;
  return value?.trim() ? value : null;
};
