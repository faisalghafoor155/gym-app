import { Cake, PartyPopper, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../ui';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { openWhatsApp, createBirthdayMessage, createAnniversaryMessage } from '../../utils/whatsapp';
import type { Celebrations } from '../../types';

/**
 * Today's birthdays and joining anniversaries.
 *
 * The scheduled job already greets each of them on WhatsApp when the gym's
 * plan sends messages; this is for the desk to say it in person, or to send
 * it by hand where automatic messages are off. Hidden on a day with nobody.
 */
export default function CelebrationsCard() {
  const { gym } = useAuth();
  const { t } = useLanguage();
  const { data } = useFetch<Celebrations>('/dashboard/celebrations', t('Could not load birthdays'));
  if (!data || (data.birthdays.length === 0 && data.anniversaries.length === 0)) return null;

  const send = (phone: string | null, text: string) => {
    if (!phone) { toast.error(t('No phone number recorded for this member')); return; }
    openWhatsApp(phone, text);
  };

  const rows = [
    ...data.birthdays.map(m => ({
      key: `b-${m.id}`, icon: Cake, member: m,
      what: m.turning ? t('Birthday · turning {age}', { age: m.turning }) : t('Birthday'),
      text: createBirthdayMessage({ memberName: m.name, gymName: gym?.name }),
    })),
    ...data.anniversaries.map(m => ({
      key: `a-${m.id}`, icon: PartyPopper, member: m,
      what: t(m.years === 1 ? '{years} year with the gym' : '{years} years with the gym', { years: m.years }),
      text: createAnniversaryMessage({ memberName: m.name, gymName: gym?.name, years: m.years }),
    })),
  ];

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2 mb-3">
        <Cake size={16} className="text-pink-500" /> {t('Celebrating today')}
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300">
          {rows.length}
        </span>
      </h2>
      <ul className="divide-y divide-gray-100 dark:divide-slate-800">
        {rows.map(({ key, icon: Icon, member, what, text }) => (
          <li key={key} className="py-2.5 flex items-center gap-3">
            <Icon size={16} className="text-pink-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">
                {member.name} <span className="text-xs font-medium text-gray-400">{member.memberNo}</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{what}</p>
            </div>
            {member.phone && (
              <button
                type="button"
                onClick={() => send(member.phone, text)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
              >
                <MessageCircle size={13} /> {t('Wish')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
