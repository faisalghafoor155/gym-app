import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AlertCircle, QrCode, Smartphone } from 'lucide-react';
import api, { apiError } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { Card, Spinner } from '../ui';

interface GymQrResponse {
  token: string;
  rotateSeconds: number;
  appUrl: string | null;
}

const isLocalHost = (url: string): boolean =>
  /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);

/**
 * The address a member's phone should open.
 *
 * The page's own origin when the desk reached the app by a real address — that
 * is, by definition, an address that works on this network. When the desk is on
 * `localhost` (the desktop app always is), the server's APP_URL instead: the
 * desktop app sets it to the PC's Wi-Fi address, and `localhost` on a phone
 * would mean the phone.
 */
const phoneBaseUrl = (appUrl: string | null): string => {
  const origin = window.location.origin;
  if (!isLocalHost(origin)) return origin;
  return appUrl && !isLocalHost(appUrl) ? appUrl : origin;
};

/**
 * The gym's own check-in QR, shown on the desk screen.
 *
 * Members scan it with their phone camera; the link opens the app's check-in
 * page, and their signed-in session says who they are. The code changes every
 * few seconds so a photo of it is useless away from the gym.
 *
 * While it is up, the day's list refreshes on its own so the desk sees each
 * member land without touching anything.
 */
export default function GymQrPanel({ onRefreshToday }: { onRefreshToday: () => Promise<unknown> }) {
  const { t } = useLanguage();
  const [qr, setQr] = useState<{ image: string; url: string; base: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const rotateRef = useRef(30);
  // Held in a ref so a parent that re-creates the callback each render does not
  // restart the rotation (and re-fetch the code) on every render.
  const refreshTodayRef = useRef(onRefreshToday);
  refreshTodayRef.current = onRefreshToday;
  // Same for the language: switching it should not restart the rotation.
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    let cancelled = false;
    let rotateTimer: ReturnType<typeof setTimeout> | undefined;

    const refresh = async () => {
      try {
        const { data } = await api.get<GymQrResponse>('/attendance/gym-qr');
        const base = phoneBaseUrl(data.appUrl);
        const url = `${base}/checkin?t=${encodeURIComponent(data.token)}`;
        const image = await QRCode.toDataURL(url, { width: 520, margin: 1, errorCorrectionLevel: 'M' });
        if (cancelled) return;
        rotateRef.current = data.rotateSeconds;
        setQr({ image, url, base });
        setSecondsLeft(data.rotateSeconds);
        setError(null);
        rotateTimer = setTimeout(() => void refresh(), data.rotateSeconds * 1000);
      } catch (err) {
        if (cancelled) return;
        setError(apiError(err, tRef.current('Could not load the check-in QR')));
        // Keep trying: the desk screen is left up all day, and a blip in the
        // network should not leave it showing an error until somebody notices.
        rotateTimer = setTimeout(() => void refresh(), 10_000);
      }
    };
    void refresh();

    const tick = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    const poll = setInterval(() => void refreshTodayRef.current().catch(() => {}), 10_000);
    return () => {
      cancelled = true;
      clearTimeout(rotateTimer);
      clearInterval(tick);
      clearInterval(poll);
    };
  }, []);

  const unreachable = qr !== null && isLocalHost(qr.base);

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <QrCode size={16} className="text-blue-600" />
        {t('Gym Check-In QR')}
      </h2>

      <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
        <div className="relative w-full max-w-[320px] aspect-square rounded-2xl bg-white border border-gray-200 dark:border-slate-700 flex items-center justify-center p-3 shrink-0">
          {qr ? (
            <img src={qr.image} alt={t('Gym check-in QR code')} className="w-full h-full" />
          ) : error ? (
            <AlertCircle size={40} className="text-red-500" />
          ) : (
            <Spinner />
          )}
        </div>

        <div className="space-y-4 max-w-md text-center lg:text-left">
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2 justify-center lg:justify-start">
              <Smartphone size={20} className="text-blue-600" />
              {t('Members: scan with your phone camera')}
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {t('The link opens the gym app and checks you in. Sign in with your member account if asked.')}
            </p>
          </div>

          {qr && (
            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-[width] duration-1000 ease-linear"
                  style={{ width: `${(secondsLeft / rotateRef.current) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                {t('New code in {seconds}s — old codes stop working after two minutes.', { seconds: secondsLeft })}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {unreachable && (
            <p className="text-sm rounded-xl p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
              {t("This code points at localhost, which a phone cannot open. Open this page using the PC's Wi-Fi address (for example http://192.168.1.10:5000), or set APP_URL to it.")}
            </p>
          )}

          {qr && !unreachable && (
            <p className="text-xs text-gray-400 dark:text-slate-500 break-all">
              {t('Phones must be on the same Wi-Fi as this PC')} · {qr.base}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
