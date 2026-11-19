import { useEffect, useState } from 'react';
import { Megaphone, Send, Users, AlertTriangle, CheckCircle2, XCircle, Clock, MinusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, PageLoader, LoadFailed, SegmentedControl, InlineEmpty,
  FieldLabel, inputClass, primaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useDebounced } from '../hooks/useDebounced';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSubscription } from '../context/SubscriptionContext';
import type {
  Broadcast, BroadcastAudience, BroadcastAudienceSummary, BroadcastDetail, BroadcastTemplateKey, BroadcastTemplates,
} from '../types';

/**
 * Ready-made starting points. Each is one of the approved templates with the
 * slots filled in; the desk edits the words before sending.
 */
const PRESETS: { label: string; template: BroadcastTemplateKey; values: Record<string, string> }[] = [
  { label: 'Eid offer', template: 'offer', values: { offer: 'Eid special: 20% off on all 3-month plans', until: '' } },
  { label: 'Offer / discount', template: 'offer', values: {} },
  { label: 'New batch / class', template: 'new_batch', values: {} },
  { label: 'Gym closed notice', template: 'closed', values: { reason: 'Eid holidays' } },
  { label: 'Announcement', template: 'announcement', values: {} },
];

const AUDIENCES: { value: BroadcastAudience; label: string }[] = [
  { value: 'active', label: 'Active members' },
  { value: 'expired', label: 'Expired' },
  { value: 'inactive', label: 'Not coming' },
  { value: 'leads', label: 'Leads' },
];

const when = (iso: string) => new Date(iso).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Fills a template body's {placeholders}, leaving an empty slot visible as [label]. */
const fill = (body: string, values: Record<string, string>, labels: Record<string, string>) =>
  body.replace(/\{(\w+)\}/g, (_, k: string) => values[k]?.trim() || `[${labels[k] ?? k}]`);

/** Sent, failed, skipped and still to go, as one bar. */
function CountsBar({ c }: { c: Broadcast['counts'] }) {
  const pct = (n: number) => `${c.total ? (n / c.total) * 100 : 0}%`;
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden flex">
      <div className="bg-green-500" style={{ width: pct(c.sent) }} />
      <div className="bg-red-500" style={{ width: pct(c.failed) }} />
      <div className="bg-gray-300 dark:bg-slate-600" style={{ width: pct(c.skipped) }} />
    </div>
  );
}

const STATUS_ICON = {
  sent: <CheckCircle2 size={14} className="text-green-600" />,
  failed: <XCircle size={14} className="text-red-600" />,
  skipped: <MinusCircle size={14} className="text-gray-400" />,
  pending: <Clock size={14} className="text-amber-500" />,
  sending: <Clock size={14} className="text-amber-500" />,
} as const;

function BroadcastModal({ id, templates, onClose }: { id: string; templates: BroadcastTemplates; onClose: () => void }) {
  const { t } = useLanguage();
  const [b, setB] = useState<BroadcastDetail | null>(null);
  useEffect(() => {
    let stop = false;
    const load = () => api.get<BroadcastDetail>(`/broadcasts/${id}`).then(r => {
      if (stop) return;
      setB(r.data);
      if (r.data.status === 'sending') setTimeout(() => void load(), 3000);
    }).catch(err => { toast.error(apiError(err, t('Could not load broadcast'))); onClose(); });
    void load();
    return () => { stop = true; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const tpl = b && templates.templates.find(x => x.key === b.template);
  return (
    <Modal title={tpl ? t(tpl.label) : t('Broadcast')} onClose={onClose}>
      {!b || !tpl ? <div className="py-8 text-center text-sm text-gray-500">{t('Loading…')}</div> : (
        <div className="space-y-4">
          <p className="text-sm rounded-xl bg-green-50 dark:bg-green-500/10 text-gray-800 dark:text-slate-200 px-3 py-2">
            {fill(tpl.body, { ...b.values, gym: '…', name: '…' }, {})}
          </p>
          <div className="space-y-1.5">
            <CountsBar c={b.counts} />
            <p className="text-xs text-gray-600 dark:text-slate-300">
              {t('{sent} sent · {failed} failed · {skipped} skipped', b.counts)}
              {b.counts.waiting > 0 && ` · ${t('{count} still to go', { count: b.counts.waiting })}`}
            </p>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 max-h-80 overflow-y-auto">
            {b.recipients.map(r => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                {STATUS_ICON[r.status]}
                <span className="flex-1 truncate">{r.name}{r.leadId && <span className="ml-1 text-[11px] text-purple-600">{t('lead')}</span>}</span>
                <span className="text-xs text-gray-500 tabular-nums">{r.phone}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-gray-500 dark:text-slate-400">
            {t('"Sent" means WhatsApp, or SMS when WhatsApp failed, accepted the message. Whether it was delivered and read is not tracked yet.')}
          </p>
        </div>
      )}
    </Modal>
  );
}

/**
 * Bulk WhatsApp: pick a message, fill in the details, choose who gets it, and
 * watch it go out in the send log.
 */
export default function Broadcasts() {
  const { t } = useLanguage();
  const { gym } = useAuth();
  const { status: plan, has } = useSubscription();
  const tpls = useFetch<BroadcastTemplates>('/broadcasts/templates', t('Could not load broadcasts'));
  const log = useFetch<Broadcast[]>('/broadcasts', t('Could not load broadcasts'));

  const [preset, setPreset] = useState(0);
  const [template, setTemplate] = useState<BroadcastTemplateKey>(PRESETS[0]!.template);
  const [values, setValues] = useState<Record<string, string>>(PRESETS[0]!.values);
  const [audience, setAudience] = useState<BroadcastAudience>('active');
  const [inactiveDays, setInactiveDays] = useState('30');
  const days = useDebounced(inactiveDays);
  const [summary, setSummary] = useState<BroadcastAudienceSummary | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    setSummary(null);
    void api.get<BroadcastAudienceSummary>('/broadcasts/audience', { params: { audience, inactiveDays: days || 30 } })
      .then(r => { if (!stale) setSummary(r.data); })
      .catch(() => { if (!stale) setSummary(null); });
    return () => { stale = true; };
  }, [audience, days]);

  // Keep the log moving while something is being sent.
  const busy = log.data?.some(b => b.status === 'sending') ?? false;
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => void log.reload(), 3000);
    return () => clearInterval(timer);
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  if (tpls.loading || log.loading) return <PageLoader />;
  if (!tpls.data || !log.data) return <LoadFailed title={t('Could not load broadcasts')} onRetry={() => { void tpls.reload(); void log.reload(); }} />;

  const catalogue = tpls.data;
  const tpl = catalogue.templates.find(x => x.key === template)!;
  const labels = Object.fromEntries(tpl.fields.map(f => [f.key, t(f.label)]));
  const missing = tpl.fields.some(f => !values[f.key]?.trim());
  const blockedByPlan = !!plan && !has('whatsapp');

  const choose = (i: number) => {
    setPreset(i);
    setTemplate(PRESETS[i]!.template);
    setValues(PRESETS[i]!.values);
  };

  const send = async () => {
    setSending(true);
    try {
      const res = await api.post<{ id: string; recipients: number }>('/broadcasts', {
        template, audience, inactiveDays: Number(inactiveDays) || 30,
        values: Object.fromEntries(tpl.fields.map(f => [f.key, values[f.key]?.trim() ?? ''])),
      });
      toast.success(t('Sending to {count} people', { count: res.data.recipients }));
      setConfirming(false);
      void log.reload();
    } catch (err) {
      toast.error(apiError(err, t('Could not send')));
      setConfirming(false);
    } finally {
      setSending(false);
    }
  };

  const audienceLabel = (a: BroadcastAudience, d: number | null) =>
    a === 'inactive' ? t('Not coming for {days}+ days', { days: d ?? 30 }) : t(AUDIENCES.find(x => x.value === a)!.label);

  return (
    <Page>
      <PageHeader icon={Megaphone} title={t('WhatsApp Broadcast')} subtitle={t('Offers and notices to a whole group of members or leads at once')} />

      {(!catalogue.canSend || blockedByPlan) && (
        <Card className="p-4 mb-4 border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10">
          <p className="text-sm text-amber-800 dark:text-amber-300 flex gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            {blockedByPlan
              ? t('WhatsApp is not included in your plan. Upgrade to send broadcasts.')
              : t('WhatsApp is not set up on this install yet. You can prepare a message, but nothing can be sent until it is.')}
          </p>
        </Card>
      )}

      <div className="grid lg:grid-cols-5 gap-4 mb-6">
        <Card className="p-5 lg:col-span-3 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{t('1. Message')}</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p, i) => (
                <button key={p.label} type="button" onClick={() => choose(i)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${i === preset
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                    : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                  {t(p.label)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {tpl.fields.map(f => (
              <div key={f.key} className={tpl.fields.length === 1 ? 'sm:col-span-2' : ''}>
                <FieldLabel htmlFor={`bc-${f.key}`} required>{t(f.label)}</FieldLabel>
                <input id={`bc-${f.key}`} maxLength={200} value={values[f.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value.replace(/[\r\n\t]/g, ' ') }))}
                  placeholder={`${t('e.g.')} ${f.example}`} className={inputClass} />
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{t('2. Who gets it')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl value={audience} onChange={setAudience} options={AUDIENCES} />
              {audience === 'inactive' && (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                  {t('away for')}
                  <input type="number" min={7} max={365} value={inactiveDays} onChange={e => setInactiveDays(e.target.value)}
                    className={`${inputClass} w-20`} aria-label={t('Days away')} />
                  {t('days or more')}
                </label>
              )}
            </div>
            <div className="mt-3 text-sm">
              {!summary ? <span className="text-gray-400">{t('Counting…')}</span> : (
                <>
                  <p className="font-semibold text-gray-900 dark:text-slate-100">
                    <Users size={15} className="inline -mt-0.5 mr-1.5 text-blue-600" />
                    {t('{count} people will get this', { count: summary.reachable })}
                  </p>
                  {(summary.optedOut > 0 || summary.noNumber > 0 || summary.duplicates > 0) && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {[
                        summary.optedOut > 0 && t('{count} asked not to be messaged', { count: summary.optedOut }),
                        summary.noNumber > 0 && t('{count} have no mobile number', { count: summary.noNumber }),
                        summary.duplicates > 0 && t('{count} share a number (sent once)', { count: summary.duplicates }),
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <button type="button" onClick={() => setConfirming(true)}
            disabled={missing || !summary?.reachable || !catalogue.canSend || blockedByPlan || busy}
            className={`w-full ${primaryButton}`}>
            <Send size={16} /> {busy ? t('Another broadcast is still sending…') : t('Send to {count} people', { count: summary?.reachable ?? 0 })}
          </button>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">{t('Preview')}</p>
          <div className="rounded-2xl bg-[#e5ddd5] dark:bg-slate-800 p-4">
            <div className="max-w-[90%] rounded-xl rounded-tl-none bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 shadow-sm whitespace-pre-line">
              {fill(tpl.body, { ...values, name: summary?.sample[0] ?? 'Ali', gym: gym?.name ?? '' }, labels)}
              {'\n\n'}<span className="text-gray-500 dark:text-slate-400">Reply STOP to opt out of these messages.</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
            {t('WhatsApp only allows messages from templates approved by Meta, so the wording around your details is fixed. Each member sees their own name.')}
          </p>
        </Card>
      </div>

      <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">{t('Send log')}</h2>
      {log.data.length === 0 ? (
        <InlineEmpty message={t('Nothing sent yet.')} />
      ) : (
        <div className="space-y-2">
          {log.data.map(b => {
            const label = catalogue.templates.find(x => x.key === b.template)?.label ?? b.template;
            return (
              <button key={b.id} onClick={() => setOpen(b.id)} className="w-full text-left">
                <Card hover className="p-3 sm:p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold text-sm text-gray-900 dark:text-slate-100">{t(label)}</span>
                    <span className="text-xs text-gray-500">{audienceLabel(b.audience, b.inactiveDays)}</span>
                    <span className="text-xs text-gray-500">{when(b.createdAt)}{b.createdBy && ` · ${b.createdBy.name}`}</span>
                    {b.status === 'sending' && <span className="text-[11px] font-bold text-amber-600">{t('Sending…')}</span>}
                  </div>
                  <CountsBar c={b.counts} />
                  <p className="text-xs text-gray-600 dark:text-slate-300">
                    {t('{sent} sent · {failed} failed · {skipped} skipped', b.counts)}
                    {b.counts.waiting > 0 && ` · ${t('{count} still to go', { count: b.counts.waiting })}`}
                  </p>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title={t('Send to {count} people?', { count: summary?.reachable ?? 0 })}
          message={t('Each message is charged by WhatsApp and cannot be taken back once sent.')}
          confirmLabel={t('Send')}
          tone="primary"
          busy={sending}
          onConfirm={() => void send()}
          onCancel={() => setConfirming(false)}
        />
      )}
      {open && <BroadcastModal id={open} templates={catalogue} onClose={() => setOpen(null)} />}
    </Page>
  );
}
