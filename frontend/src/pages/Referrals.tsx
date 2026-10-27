import { useState, type FormEvent } from 'react';
import { Gift, Trophy, Check, X, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import {
  Page, PageHeader, Card, PageLoader, LoadFailed, EmptyState, Refetching, SegmentedControl,
  FieldLabel, inputClass, primaryButton, secondaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { openWhatsApp } from '../utils/whatsapp';
import type { ReferralList, ReferralReward, ReferralStatus } from '../types';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_STYLE: Record<ReferralStatus, string> = {
  pending: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300',
  granted: 'bg-lime-50 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-slate-700/60 dark:text-slate-300',
};

function GrantModal({ reward, onClose, onDone }: { reward: ReferralReward; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/referrals/${reward.id}/grant`, { note: note.trim() || undefined });
      toast.success(reward.rewardDays > 0 && !note.trim()
        ? t("{days} free days added to {name}'s membership", { days: reward.rewardDays, name: reward.referrer.name })
        : t('Reward marked as given'));
      onDone();
    } catch (err) {
      toast.error(apiError(err, t('Could not grant reward')));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={t('Give referral reward')} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-slate-300">
          {t('{referrer} brought in {referred}.', { referrer: reward.referrer.name, referred: reward.referred.name })}
          {' '}
          {reward.rewardDays > 0
            ? t('{days} free days will be added to their running membership.', { days: reward.rewardDays })
            : t('Write down what they were given.')}
        </p>
        <div>
          <FieldLabel htmlFor="reward-note" required={reward.rewardDays === 0}>
            {reward.rewardDays > 0 ? t('Note (optional — or what was given instead of days)') : t('What was given')}
          </FieldLabel>
          <input id="reward-note" maxLength={200} value={note} onChange={e => setNote(e.target.value)}
            required={reward.rewardDays === 0} placeholder={t('e.g. Shaker bottle, free PT session')}
            className={inputClass} />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
            {saving ? t('Saving…') : t('Give reward')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Who brought friends in, and the rewards that earned them. A referral is
 * recorded when a new member is registered with "Referred by"; the reward is
 * given here, once the desk is happy the friend has actually joined.
 */
export default function Referrals() {
  const { gym } = useAuth();
  const { t } = useLanguage();
  const [tab, setTab] = useState<ReferralStatus | 'all'>('pending');
  const { data, loading, refetching, reload } = useFetch<ReferralList>(
    `/referrals${tab === 'all' ? '' : `?status=${tab}`}`, t('Could not load referrals'),
  );
  const [granting, setGranting] = useState<ReferralReward | null>(null);

  const cancel = async (r: ReferralReward) => {
    try {
      await api.post(`/referrals/${r.id}/cancel`);
      toast.success(t('Reward cancelled'));
      await reload();
    } catch (err) {
      toast.error(apiError(err, t('Could not cancel reward')));
    }
  };

  const thank = (r: ReferralReward) => {
    if (!r.referrer.phone) { toast.error(t('No phone number for this member')); return; }
    openWhatsApp(r.referrer.phone,
      `Assalam-o-Alaikum ${r.referrer.name},\n\nThank you for referring ${r.referred.name} to *${gym?.name ?? 'our gym'}*! 🙏` +
      (r.rewardDays > 0 ? ` We've added *${r.rewardDays} free days* to your membership as a thank-you.` : '') +
      `\n\n*${gym?.name ?? 'GymPro'} Management*`);
  };

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title={t('Could not load referrals')} />;

  return (
    <Page>
      <PageHeader icon={Gift} title={t('Referral Program')}
        subtitle={t('Set the free-days reward under Staff & Logins → Gym settings')} />

      {data.topReferrers.length > 0 && (
        <Card className="p-5 mb-5">
          <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-yellow-500" /> {t('Top referrers')}
          </h2>
          <ol className="flex flex-wrap gap-2">
            {data.topReferrers.map((top, i) => top.member && (
              <li key={top.member.id} className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-slate-800/60 px-3 py-2 text-sm">
                <span className="font-bold text-yellow-600">#{i + 1}</span>
                <span className="font-medium text-gray-800 dark:text-slate-200">{top.member.name}</span>
                <span className="text-xs text-gray-500">
                  {top.referrals === 1
                    ? t('{count} friend', { count: top.referrals })
                    : t('{count} friends', { count: top.referrals })}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="mb-4">
        <SegmentedControl<ReferralStatus | 'all'>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pending', label: t('To reward'), count: data.counts.pending },
            { value: 'granted', label: t('Rewarded'), count: data.counts.granted },
            { value: 'cancelled', label: t('Cancelled'), count: data.counts.cancelled },
            { value: 'all', label: t('All') },
          ]}
        />
      </div>

      {data.data.length === 0 ? (
        <EmptyState icon={Gift} title={tab === 'pending' ? t('No rewards waiting') : t('No referrals here')}
          hint={t('When you register a new member, pick who referred them under "Referred by".')} />
      ) : (
        <Refetching busy={refetching}>
          <Card className="p-2 sm:p-4">
            <ul className="divide-y divide-gray-100 dark:divide-slate-800">
              {data.data.map(r => (
                <li key={r.id} className="py-3 px-2 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-slate-100">
                      <strong>{r.referrer.name}</strong> <span className="text-xs text-gray-400">{r.referrer.memberNo}</span>
                      <span className="text-gray-400"> {t('brought in')} </span>
                      <strong>{r.referred.name}</strong>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {t('Joined {date}', { date: shortDate(r.referred.createdAt) })}
                      {r.rewardDays > 0 && ` · ${t('reward {days} free days', { days: r.rewardDays })}`}
                      {r.grantedAt && ` · ${t('given {date}', { date: shortDate(r.grantedAt) })}`}
                      {r.note && ` · ${r.note}`}
                    </p>
                  </div>
                  <span className={`self-start sm:self-auto text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[r.status]}`}>
                    {r.status === 'pending' ? t('To reward') : r.status === 'granted' ? t('Granted') : t('Cancelled')}
                  </span>
                  <div className="flex gap-2 shrink-0">
                    {r.referrer.phone && (
                      <button onClick={() => thank(r)} className={`${secondaryButton} !py-1.5 !px-2.5 text-xs text-emerald-600`}>
                        <MessageCircle size={13} /> {t('Thank')}
                      </button>
                    )}
                    {r.status === 'pending' && (
                      <>
                        <button onClick={() => void cancel(r)} className={`${secondaryButton} !py-1.5 !px-2.5 text-xs`}>
                          <X size={13} /> {t('Cancel')}
                        </button>
                        <button onClick={() => setGranting(r)} className={`${primaryButton} !py-1.5 !px-2.5 text-xs`}>
                          <Check size={13} /> {t('Give reward')}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </Refetching>
      )}

      {granting && (
        <GrantModal reward={granting} onClose={() => setGranting(null)}
          onDone={() => { setGranting(null); void reload(); }} />
      )}
    </Page>
  );
}
