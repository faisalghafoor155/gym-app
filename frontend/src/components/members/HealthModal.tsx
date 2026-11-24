import { useEffect, useState, type FormEvent } from 'react';
import { HeartPulse, Printer, X, PenLine, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { apiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { FieldLabel, Spinner, inputClass, primaryButton, secondaryButton } from '../ui';
import { CONDITIONS, CONDITION_LABELS } from '../../utils/health';
import type { HealthCondition, HealthDeclaration, Member, MemberHealth } from '../../types';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-PK', { dateStyle: 'medium' });

/** What was declared and signed, laid out to read on screen or on paper. */
function Declaration({ d }: { d: HealthDeclaration }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{t('Declared conditions')}</p>
        {d.conditions.length === 0 ? (
          <p className="text-green-700 dark:text-green-400 font-medium">{t('None declared')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {d.conditions.map(c => (
              <span key={c} className="rounded-full bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300 px-2.5 py-1 text-xs font-semibold">
                {t(CONDITION_LABELS[c])}
              </span>
            ))}
          </div>
        )}
      </div>
      {d.details && <p><span className="text-gray-500">{t('Details:')}</span> {d.details}</p>}
      {d.medications && <p><span className="text-gray-500">{t('Medicines:')}</span> {d.medications}</p>}
      <details className="rounded-lg bg-gray-50 dark:bg-slate-800/60 px-3 py-2 print:block" open={false}>
        <summary className="cursor-pointer text-xs font-semibold text-gray-600 dark:text-slate-300">{t('Waiver they agreed to')}</summary>
        <p className="mt-2 whitespace-pre-line text-xs text-gray-600 dark:text-slate-400">{d.waiverText}</p>
      </details>
      <div className="flex items-end justify-between gap-4 pt-2">
        <div>
          {/* Only older declarations have a drawn signature. */}
          {d.signature && (
            <img src={d.signature} alt={t('Signature of {name}', { name: d.signedName })} className="h-16 bg-white rounded border border-gray-200" />
          )}
          <p className="text-xs text-gray-500 mt-1">{d.signedName}</p>
        </div>
        <p className="text-xs text-gray-500 text-right">
          {t('Signed {date}', { date: when(d.signedAt) })}
          {d.recordedBy && <><br />{t('Witnessed by {name}', { name: d.recordedBy.name })}</>}
        </p>
      </div>
    </div>
  );
}

/**
 * A member's health questionnaire and waiver: read what they declared, or
 * take a new signing at the desk.
 *
 * Opens straight on the form when they have not signed (or are due to sign
 * again on renewal), and on what they declared otherwise.
 */
export default function HealthModal({ member, prompt, onClose, onSaved }: {
  member: Pick<Member, 'id' | 'name'>;
  /** A line above the form saying why it opened, e.g. after a renewal. */
  prompt?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { t } = useLanguage();
  const { gym } = useAuth();
  const [data, setData] = useState<MemberHealth | null>(null);
  const [signing, setSigning] = useState(false);
  const [conditions, setConditions] = useState<HealthCondition[]>([]);
  const [details, setDetails] = useState('');
  const [medications, setMedications] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signedName, setSignedName] = useState(member.name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let stale = false;
    api.get<MemberHealth>(`/members/${member.id}/health`)
      .then(r => {
        if (stale) return;
        setData(r.data);
        setSigning(r.data.needsSigning);
        // A re-signing starts from what they said last time.
        if (r.data.current) {
          setConditions(r.data.current.conditions);
          setDetails(r.data.current.details ?? '');
          setMedications(r.data.current.medications ?? '');
        }
      })
      .catch(err => { if (!stale) { toast.error(apiError(err, t('Could not load health declaration'))); onClose(); } });
    return () => { stale = true; };
  }, [member.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (c: HealthCondition) =>
    setConditions(cs => (cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/members/${member.id}/health`, {
        conditions, details: details.trim(), medications: medications.trim(),
        signedName: signedName.trim(), waiverAccepted: agreed,
      });
      toast.success(t('Health declaration saved'));
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(apiError(err, t('Could not save health declaration')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="receipt-print-root fixed inset-0 z-50 animate-fade-in flex items-center justify-center p-4 bg-black/40 dark:bg-black/75 print:p-0 print:bg-transparent">
      <div role="dialog" aria-modal="true" aria-labelledby="health-modal-title"
        className="relative bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-scale-in print:border-0 print:shadow-none print:max-h-none">
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800 print:static">
          <h3 id="health-modal-title" className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
            <HeartPulse size={18} className="text-red-500" /> {t('Health & waiver')} · {member.name}
          </h3>
          <button onClick={onClose} aria-label={t('Close')} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 print:hidden">
            <X size={20} />
          </button>
        </div>

        {!data ? (
          <div className="p-10 flex justify-center"><Spinner /></div>
        ) : signing ? (
          <form onSubmit={e => void submit(e)} className="p-5 space-y-4">
            {prompt && <p className="rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 px-3 py-2 text-sm">{prompt}</p>}
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-2">{t('Do you have any of these?')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CONDITIONS.map(c => (
                  <label key={c} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                    conditions.includes(c)
                      ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200'
                      : 'border-gray-200 dark:border-slate-700'
                  }`}>
                    <input type="checkbox" checked={conditions.includes(c)} onChange={() => toggle(c)} />
                    {t(CONDITION_LABELS[c])}
                  </label>
                ))}
              </div>
              {conditions.length === 0 && <p className="mt-1 text-xs text-gray-500">{t('Leave all unticked if none apply.')}</p>}
            </div>
            <div>
              <FieldLabel htmlFor="h-details">{t('Details (what, since when, doctor’s advice)')}</FieldLabel>
              <textarea id="h-details" rows={2} maxLength={1000} value={details} onChange={e => setDetails(e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel htmlFor="h-meds">{t('Medicines taken regularly')}</FieldLabel>
              <input id="h-meds" maxLength={500} value={medications} onChange={e => setMedications(e.target.value)} className={inputClass} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-1">{t('Terms & waiver')}</p>
              <div className="max-h-40 overflow-y-auto rounded-lg bg-gray-50 dark:bg-slate-800/60 p-3 text-xs text-gray-600 dark:text-slate-300 whitespace-pre-line">
                {data.waiverText}
              </div>
              <label className="mt-2 flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5" required checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                {t('I have read and agree to the terms above, and the health information is true.')}
              </label>
            </div>
            <div>
              <FieldLabel htmlFor="h-name" required>{t('Full name')}</FieldLabel>
              <input id="h-name" required maxLength={100} value={signedName} onChange={e => setSignedName(e.target.value)} className={inputClass} />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => (data.current ? setSigning(false) : onClose())} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
              <button type="submit" disabled={saving || !agreed} className={`flex-1 ${primaryButton}`}>{saving ? t('Saving…') : t('Save & sign')}</button>
            </div>
          </form>
        ) : data.current ? (
          <div className="p-5 space-y-4">
            <div className="text-center print:block hidden">
              <p className="text-lg font-bold">{gym?.name}</p>
              <p className="text-sm">{t('Health declaration & waiver')} · {member.name}</p>
            </div>
            <Declaration d={data.current} />
            {data.history.length > 0 && (
              <details className="text-xs text-gray-500 print:hidden">
                <summary className="cursor-pointer">{t('Earlier signings ({count})', { count: data.history.length })}</summary>
                <ul className="mt-2 space-y-1">
                  {data.history.map(h => (
                    <li key={h.id}>
                      {when(h.signedAt)} — {h.conditions.length ? h.conditions.map(c => t(CONDITION_LABELS[c])).join(', ') : t('None declared')}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="flex gap-3 print:hidden">
              <button onClick={() => window.print()} className={`flex-1 ${secondaryButton}`}><Printer size={15} /> {t('Print')}</button>
              <button onClick={() => setSigning(true)} className={`flex-1 ${primaryButton}`}><PenLine size={15} /> {t('Sign again')}</button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <ShieldCheck size={28} className="mx-auto text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">{t('No health declaration yet.')}</p>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page { margin: 12mm; }
          body * { visibility: hidden !important; }
          .receipt-print-root, .receipt-print-root * { visibility: visible !important; }
          .receipt-print-root {
            position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important;
            background: white !important; padding: 0 !important; display: block !important;
          }
          .receipt-print-root details > *:not(summary) { display: block !important; }
        }
      `}</style>
    </div>
  );
}
