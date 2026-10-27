import { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { Card, Spinner } from '../ui';
import { useLanguage } from '../../context/LanguageContext';

/**
 * The member's own check-in code, to hold up at the desk.
 *
 * The same code the staff-side modal shows — it encodes the member id, which
 * is what the scanner reads. Generated in the browser rather than fetched:
 * the id is already on the page, and a round trip would only turn a code that
 * works offline into one that does not. That matters here more than on the
 * staff page, since this is the screen somebody opens while standing at a
 * counter with bad signal.
 */
export default function MyCheckInCode({
  memberId,
  memberNo,
  name,
}: {
  memberId: string;
  memberNo: string;
  name: string;
}) {
  const { t } = useLanguage();
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(memberId, {
      width: 280,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    })
      .then(url => { if (!cancelled) setDataUrl(url); })
      .catch(() => {
        if (!cancelled) toast.error(t('Could not generate your check-in code'));
      });
    return () => { cancelled = true; };
  }, [memberId, t]);

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <QrCode size={16} className="text-blue-600" /> {t('Your check-in code')}
      </h2>

      <div className="flex flex-col items-center">
        {dataUrl ? (
          <>
            {/* White always, in both themes: a scanner reads the contrast, and
                a dark-inverted code is one a phone camera will not resolve. */}
            <div className="rounded-2xl bg-white p-3 border border-gray-200">
              <img
                src={dataUrl}
                alt={t('Check-in code for {name}', { name })}
                className="w-56 h-56"
              />
            </div>
            <p className="mt-3 font-bold text-gray-900 dark:text-slate-100">{name}</p>
            <p className="text-sm text-gray-500 dark:text-slate-400">{memberNo}</p>
            <p className="mt-3 text-xs text-gray-400 dark:text-slate-500 text-center max-w-xs">
              {t('Show this at the front desk to check in. Your member number works too if the scanner is busy.')}
            </p>
          </>
        ) : (
          <div className="py-16">
            <Spinner className="w-6 h-6" />
          </div>
        )}
      </div>
    </Card>
  );
}
