import type { ReactNode } from 'react';
import { Users, CreditCard, CalendarCheck, MessageCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const FEATURES = [
  { icon: Users, title: 'Members & memberships', text: 'Every member, plan and renewal in one list.' },
  { icon: CreditCard, title: 'Fees & dues', text: 'Record payments and see who still owes, at a glance.' },
  { icon: CalendarCheck, title: 'Attendance', text: 'QR and fingerprint check-ins, counted for you.' },
  { icon: MessageCircle, title: 'WhatsApp reminders', text: 'Expiry and dues reminders go out on their own.' },
] as const;

/**
 * The frame every signed-out page sits in: the brand panel on the left from
 * `lg` up, and the page's own card centred on the right. Below `lg` the panel
 * is dropped and the card is all there is, so a phone shows the form first.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="min-h-dvh flex bg-slate-50 dark:bg-slate-950">
      <aside className="hidden lg:flex lg:w-[45%] xl:w-1/2 relative overflow-hidden bg-slate-950 text-white flex-col justify-between p-10 xl:p-14">
        <img
          src="/exercises/deadlift.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-20 [mask-image:linear-gradient(to_top,black,transparent_85%)]"
        />
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-500/25 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-indigo-500/20 blur-3xl" aria-hidden="true" />

        <div className="relative flex items-center gap-2.5">
          <img src="/logo.svg" alt="" className="w-10 h-10" />
          <span className="text-2xl font-extrabold tracking-tight font-heading">
            Gym<span className="text-blue-400">Flow</span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight font-heading">
            {t('Run your whole gym from one place.')}
          </h2>
          <p className="mt-3 text-slate-300 text-[15px] leading-relaxed">
            {t('Members, fees, attendance and reminders — simple enough for the front desk, clear enough for the owner.')}
          </p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 text-blue-300 flex items-center justify-center shrink-0 backdrop-blur-xs">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{t(title)}</span>
                  <span className="block text-[13px] text-slate-400">{t(text)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          © {new Date().getFullYear()} GymFlow · {t('English & Roman Urdu')}
        </p>
      </aside>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        {children}
      </main>
    </div>
  );
}
