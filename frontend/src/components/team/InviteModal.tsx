import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { FieldLabel, focusRing, inputClass, primaryButton, secondaryButton } from '../ui';
import { useLanguage } from '../../context/LanguageContext';
import { formatWhatsAppNumber } from '../../utils/whatsapp';
import type { SharedInvite } from './types';

/** The invite as a WhatsApp message: straight to `number`'s chat when there is
 *  one, otherwise WhatsApp asks the owner to pick the chat. */
const whatsappInviteUrl = (invite: SharedInvite, number: string | null) =>
  `https://wa.me/${number ?? ''}?text=${encodeURIComponent(
    `Assalam o Alaikum ${invite.name}, aap ko gym app mein add kar diya gaya hai. ` +
    `Ye link khol kar apna password set karein (48 ghante ke liye, sirf aik dafa):
${invite.link}`,
  )}`;

/** Shown after every invite: the link can also go on WhatsApp, and when
 *  the mail failed it is the only way to hand the account over. */
export default function InviteModal({ sharedInvite, onClose }: {
  sharedInvite: SharedInvite;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [phone, setPhone] = useState(sharedInvite.phone ?? '');
  const number = formatWhatsAppNumber(phone);
  // A half-typed number would open WhatsApp on a stranger's chat, so it is
  // refused; a blank field falls back to picking the chat in WhatsApp.
  const invalid = phone.trim() !== '' && !number;
  return (
    <Modal title={t('Invite for {name}', { name: sharedInvite.name })} onClose={() => onClose()}>
      <div className="space-y-4">
        <p className={`text-sm rounded-xl p-3 ${sharedInvite.emailed || sharedInvite.viaWhatsApp
          ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300'
          : 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300'}`}>
          {sharedInvite.viaWhatsApp
            ? t('Account created. Send them this link on WhatsApp.')
            : sharedInvite.emailed
              ? t('The invite email has been sent. You can also send the link on WhatsApp.')
              : t('The invite email could not be sent. Send them this link on WhatsApp or copy it.')}
        </p>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t('They open the link, choose their own password and are signed in with the access you gave them. It lasts 48 hours and works once.')}
        </p>
        <div className="bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-xl p-3">
          <p className="text-xs text-gray-700 dark:text-slate-300 break-all font-mono leading-relaxed">
            {sharedInvite.link}
          </p>
        </div>
        <div>
          <FieldLabel htmlFor="invite-whatsapp-number">{t('WhatsApp number')}</FieldLabel>
          <input id="invite-whatsapp-number" type="tel" inputMode="tel" value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="03001234567"
            aria-invalid={invalid}
            aria-describedby="invite-whatsapp-hint"
            className={inputClass} />
          <p id="invite-whatsapp-hint" className={`text-xs mt-1 ${invalid ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-slate-500'}`}>
            {invalid
              ? t('Enter a full number, like 03001234567')
              : t('The link opens straight in their WhatsApp chat. Leave blank to pick the chat yourself.')}
          </p>
        </div>
        <a
          href={invalid ? undefined : whatsappInviteUrl(sharedInvite, number)}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={invalid}
          onClick={e => { if (invalid) e.preventDefault(); }}
          className={`flex items-center justify-center w-full rounded-xl py-2.5 font-semibold text-white bg-green-600 hover:bg-green-700 ${focusRing} ${invalid ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {t('Send on WhatsApp')}
        </a>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(sharedInvite.link)
                .then(() => toast.success(t('Link copied')))
                .catch(() => toast.error(t('Could not copy — select the text instead')));
            }}
            className={`flex-1 ${secondaryButton}`}
          >
            {t('Copy link')}
          </button>
          <button type="button" onClick={() => onClose()}
            className={`flex-1 ${primaryButton}`}>
            {t('Done')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
