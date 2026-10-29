import toast from 'react-hot-toast';
import Modal from '../Modal';
import { focusRing, primaryButton, secondaryButton } from '../ui';
import { useLanguage } from '../../context/LanguageContext';
import type { SharedInvite } from './types';

/** A WhatsApp message the owner forwards; no number, so they pick the chat. */
const whatsappInviteUrl = (invite: SharedInvite) =>
  `https://wa.me/?text=${encodeURIComponent(
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
        <a
          href={whatsappInviteUrl(sharedInvite)}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center w-full rounded-xl py-2.5 font-semibold text-white bg-green-600 hover:bg-green-700 ${focusRing}`}
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
