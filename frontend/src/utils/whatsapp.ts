/**
 * WhatsApp message helpers for 1-click messaging and reminders.
 */

export function formatWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  // Already 923xxxxxxxxx
  if (digits.startsWith('92')) {
    return digits;
  }
  // Local 03xxxxxxxxx -> 923xxxxxxxxx
  if (digits.startsWith('03')) {
    return '92' + digits.slice(1);
  }
  // 3xxxxxxxxx (10 digits)
  if (digits.length === 10 && digits.startsWith('3')) {
    return '92' + digits;
  }
  // 0092...
  if (digits.startsWith('0092')) {
    return digits.slice(2);
  }

  return digits.length >= 10 ? digits : null;
}

export function openWhatsApp(phone: string | null | undefined, text: string) {
  const formatted = formatWhatsAppNumber(phone);
  if (!formatted) {
    alert('Invalid phone number for WhatsApp');
    return;
  }
  const encoded = encodeURIComponent(text);
  const url = `https://wa.me/${formatted}?text=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function createExpiryMessage({
  memberName,
  gymName,
  planName,
  daysLeft,
  expiryDate,
}: {
  memberName: string;
  gymName?: string;
  planName?: string;
  daysLeft?: number;
  expiryDate?: string;
}): string {
  const gym = gymName || 'GymPro';
  const plan = planName ? ` (${planName})` : '';

  if (daysLeft !== undefined && daysLeft < 0) {
    return `Assalam-o-Alaikum ${memberName},\n\nYour gym membership at *${gym}*${plan} has expired (${Math.abs(daysLeft)} days ago). Please visit the counter or renew your membership to continue your workout smoothly.\n\nThank you,\n*${gym} Management*`;
  }

  if (daysLeft === 0) {
    return `Assalam-o-Alaikum ${memberName},\n\nYour gym membership at *${gym}*${plan} expires *TODAY*! Kindly visit the counter to renew your plan and avoid any interruption.\n\nThank you,\n*${gym} Management*`;
  }

  const dateStr = expiryDate
    ? new Date(expiryDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return `Assalam-o-Alaikum ${memberName},\n\nThis is a friendly reminder that your gym membership at *${gym}*${plan} will expire in *${daysLeft ?? 2} days*${dateStr ? ` (${dateStr})` : ''}. Kindly renew your membership on time.\n\nThank you,\n*${gym} Management*`;
}

export function createGeneralMessage({
  memberName,
  gymName,
}: {
  memberName: string;
  gymName?: string;
}): string {
  const gym = gymName || 'GymPro';
  return `Assalam-o-Alaikum ${memberName},\n\nHope you are doing well. Message from *${gym}*.\n\n`;
}

/** A call-back to somebody who enquired but has not joined. */
export function createLeadFollowUpMessage({
  name,
  gymName,
  interest,
}: {
  name: string;
  gymName?: string;
  interest?: string | null;
}): string {
  const gym = gymName || 'GymPro';
  const about = interest ? ` about *${interest}*` : '';
  return `Assalam-o-Alaikum ${name},\n\nThank you for your interest in *${gym}*${about}. We would love to have you train with us — feel free to visit for a trial session or reply here with any questions about plans and timings.\n\nThank you,\n*${gym} Management*`;
}

/** A balance still owed on a membership or charge. */
export function createDuesMessage({
  memberName,
  gymName,
  amount,
  forWhat,
}: {
  memberName: string;
  gymName?: string;
  amount: number;
  forWhat?: string;
}): string {
  const gym = gymName || 'GymPro';
  const what = forWhat ? ` for *${forWhat}*` : '';
  return `Assalam-o-Alaikum ${memberName},\n\nThis is a gentle reminder that *Rs. ${amount.toLocaleString('en-PK')}* is still pending${what} at *${gym}*. Kindly clear it at the counter at your convenience.\n\nThank you,\n*${gym} Management*`;
}

export function createBirthdayMessage({
  memberName,
  gymName,
}: {
  memberName: string;
  gymName?: string;
}): string {
  const gym = gymName || 'GymPro';
  return `Happy Birthday ${memberName}! 🎉\n\nEveryone at *${gym}* wishes you a healthy, strong and happy year ahead. Keep crushing your goals! 💪\n\n*${gym} Family*`;
}

export function createAnniversaryMessage({
  memberName,
  gymName,
  years,
}: {
  memberName: string;
  gymName?: string;
  years: number;
}): string {
  const gym = gymName || 'GymPro';
  return `Congratulations ${memberName}! 🎉\n\nToday marks *${years} year${years === 1 ? '' : 's'}* since you joined *${gym}*. Thank you for training with us — here's to many more!\n\n*${gym} Family*`;
}
