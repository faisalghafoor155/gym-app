import type { Member } from '../types';

/**
 * A printable member ID card: credit-card size (85.6 × 54 mm, ISO CR80), with
 * the gym's name and logo, the member's photo, number and validity, and the
 * same check-in QR the front desk scans.
 *
 * Printed from its own window rather than the app's page, so the print is the
 * card alone — no sidebar, no dialog — and a laminated card fits a wallet.
 */

const escape = (s: string): string =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const initials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

export function idCardHtml(member: Member, qrDataUrl: string, gym: { name: string; logo?: string | null }): string {
  const ms = member.currentMembership;
  const validUntil = ms
    ? new Date(ms.expiryDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const photo = member.photo
    ? `<img class="photo" src="${escape(member.photo)}" alt="">`
    : `<div class="photo initials">${escape(initials(member.name))}</div>`;
  const logo = gym.logo ? `<img class="logo" src="${escape(gym.logo)}" alt="">` : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escape(member.name)} — ID card</title>
<style>
  @page { size: 85.6mm 54mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; background: #fff; }
  .card { width: 85.6mm; height: 54mm; padding: 3.5mm; display: flex; flex-direction: column;
    background: linear-gradient(135deg, #1e3a8a, #4f46e5); color: #fff; overflow: hidden;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .top { display: flex; align-items: center; gap: 2mm; }
  .logo { width: 7mm; height: 7mm; border-radius: 1.5mm; object-fit: cover; background: #fff; }
  .gym { font-weight: 800; font-size: 3.6mm; letter-spacing: .2mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tag { margin-left: auto; font-size: 2.2mm; opacity: .8; text-transform: uppercase; letter-spacing: .3mm; }
  .body { flex: 1; display: flex; gap: 3mm; align-items: center; margin-top: 2.5mm; }
  .photo { width: 18mm; height: 22mm; border-radius: 2mm; object-fit: cover; background: rgba(255,255,255,.2); flex-shrink: 0; }
  .initials { display: flex; align-items: center; justify-content: center; font-size: 7mm; font-weight: 800; }
  .info { flex: 1; min-width: 0; }
  .name { font-size: 3.8mm; font-weight: 800; line-height: 1.15; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .no { font-family: ui-monospace, monospace; font-size: 3.2mm; margin-top: 1mm; font-weight: 700; }
  .row { font-size: 2.3mm; opacity: .9; margin-top: .8mm; }
  .qr { width: 21mm; height: 21mm; background: #fff; border-radius: 1.5mm; padding: .8mm; flex-shrink: 0; }
  .qr img { width: 100%; height: 100%; }
  @media screen { body { padding: 10mm; background: #e2e8f0; } .card { border-radius: 3mm; box-shadow: 0 4px 16px rgba(0,0,0,.25); } }
</style></head>
<body>
  <div class="card">
    <div class="top">${logo}<span class="gym">${escape(gym.name)}</span><span class="tag">Member</span></div>
    <div class="body">
      ${photo}
      <div class="info">
        <div class="name">${escape(member.name)}</div>
        <div class="no">${escape(member.memberNo)}</div>
        ${ms ? `<div class="row">${escape(ms.planName)}</div>` : ''}
        <div class="row">Valid until ${escape(validUntil)}</div>
        ${member.phone ? `<div class="row">${escape(member.phone)}</div>` : ''}
      </div>
      <div class="qr"><img src="${qrDataUrl}" alt="Check-in code"></div>
    </div>
  </div>
  <script>
    // Wait for the photo and logo, or the print catches an empty frame.
    window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 150); });
  </script>
</body></html>`;
}

/** Opens the card in its own window and starts printing. False when the
 *  browser blocked the window. */
export function printIdCard(member: Member, qrDataUrl: string, gym: { name: string; logo?: string | null }): boolean {
  const w = window.open('', '_blank', 'width=520,height=420');
  if (!w) return false;
  w.document.open();
  w.document.write(idCardHtml(member, qrDataUrl, gym));
  w.document.close();
  return true;
}
