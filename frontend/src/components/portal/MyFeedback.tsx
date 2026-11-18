import { useEffect, useState, type FormEvent } from 'react';
import { Reply } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { apiError } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { Card, FieldLabel, inputClass, primaryButton } from '../ui';
import Stars from '../feedback/Stars';
import { FEEDBACK_CATEGORIES } from '../../utils/feedback';
import type { FeedbackCategory, MyFeedback as MyFeedbackRow } from '../../types';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The member rates the gym, or complains, and reads the gym's replies to what
 * they sent under their name.
 */
export default function MyFeedback() {
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mine, setMine] = useState<MyFeedbackRow[]>([]);

  const load = () => api.get<MyFeedbackRow[]>('/me/feedback').then(r => setMine(r.data)).catch(() => {});
  useEffect(() => { void load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rating) { toast.error(t('Please choose a star rating')); return; }
    setSaving(true);
    try {
      await api.post('/me/feedback', { rating, category, message: message.trim(), anonymous });
      toast.success(t('Thank you for your feedback!'));
      setRating(0);
      setMessage('');
      setCategory('general');
      setAnonymous(false);
      void load();
    } catch (err) {
      toast.error(apiError(err, t('Could not send feedback')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <form onSubmit={e => void submit(e)} className="space-y-4">
          <div>
            <p className="font-semibold text-gray-900 dark:text-slate-100">{t('How is your experience at the gym?')}</p>
            <div className="mt-2"><Stars value={rating} onChange={setRating} size={30} label={t('Your rating')} /></div>
          </div>
          <div>
            <FieldLabel htmlFor="fb-cat">{t('About')}</FieldLabel>
            <select id="fb-cat" value={category} onChange={e => setCategory(e.target.value as FeedbackCategory)} className={inputClass}>
              {(Object.keys(FEEDBACK_CATEGORIES) as FeedbackCategory[]).map(c => <option key={c} value={c}>{t(FEEDBACK_CATEGORIES[c])}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="fb-msg" required={rating > 0 && rating <= 2}>{t('Tell us more')}</FieldLabel>
            <textarea id="fb-msg" rows={3} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)}
              placeholder={t('What did you like, or what should we fix?')} className={inputClass} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
            <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} />
            {t('Send anonymously (the gym will not see your name, and cannot reply)')}
          </label>
          <button type="submit" disabled={saving} className={`w-full ${primaryButton}`}>{saving ? t('Sending…') : t('Send feedback')}</button>
        </form>
      </Card>

      {mine.length > 0 && (
        <Card className="p-5">
          <p className="font-semibold text-gray-900 dark:text-slate-100 mb-3">{t('What you sent')}</p>
          <ul className="space-y-3">
            {mine.map(f => (
              <li key={f.id} className="text-sm border-b border-gray-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={f.rating} size={13} />
                  <span className="text-xs text-gray-500">{t(FEEDBACK_CATEGORIES[f.category])} · {when(f.createdAt)}</span>
                  <span className={`text-[11px] font-bold ${f.status === 'open' ? 'text-amber-600' : 'text-green-600'}`}>
                    {f.status === 'open' ? t('Being looked at') : t('Resolved')}
                  </span>
                </div>
                {f.message && <p className="mt-1 text-gray-700 dark:text-slate-300">{f.message}</p>}
                {f.response && (
                  <p className="mt-1.5 text-xs rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-200 px-2.5 py-1.5">
                    <Reply size={11} className="inline -mt-0.5 mr-1" />{t('Gym reply:')} {f.response}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
