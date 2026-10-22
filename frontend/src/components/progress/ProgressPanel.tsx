import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Activity, Camera, Plus, Ruler, Scale, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Card, FieldLabel, InlineEmpty, IconButton, SegmentedControl, Spinner,
  inputClass, primaryButton, secondaryButton,
} from '../ui';
import ConfirmDialog from '../ConfirmDialog';
import api, { apiError } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import type { Measurement } from '../../types';

/**
 * A member's weigh-ins: a trend chart, before/after photos, the history, and
 * the form to log a new one.
 *
 * Shared by the staff side (`/members/:id/measurements`) and the member's own
 * portal (`/me/measurements`) — the two differ only in the url and in which
 * rows may be deleted, so both are passed in rather than branched on here.
 */

type Metric = 'weightKg' | 'bodyFatPct' | 'chestCm' | 'waistCm' | 'hipsCm' | 'armCm' | 'thighCm';

const METRICS: readonly { value: Metric; label: string; unit: string; max: number }[] = [
  { value: 'weightKg', label: 'Weight', unit: 'kg', max: 400 },
  { value: 'bodyFatPct', label: 'Body fat', unit: '%', max: 75 },
  { value: 'chestCm', label: 'Chest', unit: 'cm', max: 300 },
  { value: 'waistCm', label: 'Waist', unit: 'cm', max: 300 },
  { value: 'hipsCm', label: 'Hips', unit: 'cm', max: 300 },
  { value: 'armCm', label: 'Arm', unit: 'cm', max: 150 },
  { value: 'thighCm', label: 'Thigh', unit: 'cm', max: 200 },
];

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });

const longDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

const today = (): string => new Date().toISOString().split('T')[0]!;

/**
 * Shrinks a phone photo before it is sent. A camera image is 3–8MB, the API
 * takes 4MB of base64 at most, and a progress photo shown at card size needs
 * nowhere near that many pixels.
 */
async function downscale(file: File, maxSide = 1080): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * A line scaled to the series' own range rather than from zero: a weight
 * going 82 → 78 kg drawn from zero is a flat line, and the four kilos are the
 * whole point.
 */
function TrendChart({ points, unit }: { points: { label: string; value: number }[]; unit: string }) {
  if (points.length < 2) {
    return (
      <InlineEmpty message={points.length === 1
        ? 'One entry so far — log another to see the trend.'
        : 'Nothing logged for this measurement yet.'} />
    );
  }
  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Padding so the line never sits on the edge; a flat series gets a band.
  const pad = (max - min) * 0.15 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => (i / (points.length - 1)) * 100;
  const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');
  const first = points[0]!;
  const last = points.at(-1)!;
  const change = Math.round((last.value - first.value) * 10) / 10;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-2xl font-extrabold text-gray-900 dark:text-slate-100 font-heading">
          {last.value} <span className="text-sm font-medium text-gray-400">{unit}</span>
        </p>
        <p className={`text-sm font-semibold ${
          change === 0 ? 'text-gray-500 dark:text-slate-400'
            : change < 0 ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'
        }`}>
          {change > 0 ? '+' : ''}{change} {unit} since {first.label}
        </p>
      </div>
      <div className="relative h-36">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible text-blue-600 dark:text-blue-400"
          role="img"
          aria-label={`From ${first.value} ${unit} on ${first.label} to ${last.value} ${unit} on ${last.label}`}
        >
          <path
            d={line} fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          />
        </svg>
        {points.map((p, i) => (
          <span
            key={i}
            title={`${p.label}: ${p.value} ${unit}`}
            className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full bg-blue-600 dark:bg-blue-400 ring-2 ring-white dark:ring-slate-900"
            style={{ left: `${x(i)}%`, top: `${y(p.value)}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-slate-500">
        <span>{first.label}</span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}

type FormState = Record<Metric, string> & { measuredOn: string; notes: string; photo: string };

const emptyForm = (): FormState => ({
  measuredOn: today(), notes: '', photo: '',
  weightKg: '', bodyFatPct: '', chestCm: '', waistCm: '', hipsCm: '', armCm: '', thighCm: '',
});

function LogForm({ url, onSaved, onCancel }: { url: string; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const handlePhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const photo = await downscale(file);
      setForm(f => ({ ...f, photo }));
    } catch {
      toast.error('Could not read that image');
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const hasAny = METRICS.some(m => form[m.value].trim() !== '') || form.photo;
    if (!hasAny) {
      toast.error('Enter at least one measurement or add a photo');
      return;
    }
    setSaving(true);
    try {
      await api.post(url, {
        measuredOn: form.measuredOn || undefined,
        ...Object.fromEntries(METRICS.map(m => [m.value, form[m.value].trim()])),
        photo: form.photo || undefined,
        notes: form.notes.trim() || undefined,
      });
      toast.success('Progress saved');
      onSaved();
    } catch (err) {
      toast.error(apiError(err, 'Could not save measurement'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={e => void submit(e)} className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel htmlFor="m-date">Date</FieldLabel>
          <input
            id="m-date" type="date" max={today()} value={form.measuredOn}
            onChange={e => setForm(f => ({ ...f, measuredOn: e.target.value }))}
            className={inputClass}
          />
        </div>
        {METRICS.map(m => (
          <div key={m.value}>
            <FieldLabel htmlFor={`m-${m.value}`}>{m.label} ({m.unit})</FieldLabel>
            <input
              id={`m-${m.value}`} type="number" inputMode="decimal" step="0.1" min="0" max={m.max}
              value={form[m.value]}
              onChange={e => setForm(f => ({ ...f, [m.value]: e.target.value }))}
              className={inputClass}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <FieldLabel htmlFor="m-notes">Notes</FieldLabel>
          <input
            id="m-notes" type="text" maxLength={500} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="e.g. after Ramadan, started cutting"
            className={inputClass}
          />
        </div>
        <div className="shrink-0">
          <FieldLabel>Progress photo</FieldLabel>
          <div className="flex items-center gap-2">
            {form.photo && (
              <div className="relative w-11 h-11">
                <img src={form.photo} alt="Progress preview" className="w-11 h-11 rounded-lg object-cover" />
                <button
                  type="button" aria-label="Remove photo"
                  onClick={() => setForm(f => ({ ...f, photo: '' }))}
                  className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full p-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => void handlePhoto(e)} />
            <button type="button" onClick={() => photoRef.current?.click()} className={secondaryButton}>
              <Camera size={14} /> {form.photo ? 'Change' : 'Add photo'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving ? 'Saving…' : 'Save entry'}
        </button>
      </div>
    </form>
  );
}

interface Props {
  /** Where the history lives — the member's own, or a member named by staff. */
  url: string;
  /** Whether this viewer may remove a given entry. */
  canDelete: (row: Measurement) => boolean;
  /** Whether this viewer may log new entries. */
  canAdd?: boolean;
}

export default function ProgressPanel({ url, canDelete, canAdd = true }: Props) {
  const { data, loading, reload } = useFetch<{ data: Measurement[] }>(url, 'Could not load progress');
  const [metric, setMetric] = useState<Metric>('weightKg');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Measurement | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => data?.data ?? [], [data]);
  // The API sends newest first; the chart reads left to right in time.
  const chronological = useMemo(() => [...rows].reverse(), [rows]);

  const unit = METRICS.find(m => m.value === metric)!.unit;
  const points = chronological
    .filter(r => r[metric] != null)
    .map(r => ({ label: shortDate(r.measuredOn), value: r[metric]! }));

  // Only offer the measurements somebody has actually logged, plus weight so
  // a brand-new history still has a tab.
  const offered = METRICS.filter(m => m.value === 'weightKg' || rows.some(r => r[m.value] != null));

  const photos = chronological.filter(r => r.photo);
  const before = photos[0];
  const after = photos.length > 1 ? photos.at(-1) : undefined;

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`${url}/${deleting.id}`);
      toast.success('Entry removed');
      setDeleting(null);
      await reload();
    } catch (err) {
      toast.error(apiError(err, 'Could not remove entry'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Spinner /></div>;
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Activity size={16} className="text-blue-600 dark:text-blue-400" /> Progress
          </h2>
          {canAdd && !adding && (
            <button onClick={() => setAdding(true)} className={primaryButton}>
              <Plus size={15} /> Log measurements
            </button>
          )}
        </div>

        {adding && (
          <div className="mb-5 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 p-4">
            <LogForm
              url={url}
              onCancel={() => setAdding(false)}
              onSaved={() => { setAdding(false); void reload(); }}
            />
          </div>
        )}

        {rows.length === 0 ? (
          <InlineEmpty message="No measurements yet. Log weight, body fat or a tape measurement to start tracking progress." />
        ) : (
          <>
            {offered.length > 1 && (
              <div className="mb-4">
                <SegmentedControl
                  value={metric}
                  onChange={setMetric}
                  options={offered.map(m => ({ value: m.value, label: m.label }))}
                />
              </div>
            )}
            <TrendChart points={points} unit={unit} />
          </>
        )}
      </Card>

      {before && (
        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-4">
            <Camera size={16} className="text-blue-600 dark:text-blue-400" /> Before &amp; after
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[before, after].map((r, i) => r ? (
              <figure key={r.id}>
                <img src={r.photo!} alt={`${i === 0 ? 'Before' : 'After'} — ${longDate(r.measuredOn)}`}
                  className="w-full aspect-[3/4] object-cover rounded-xl bg-gray-100 dark:bg-slate-800" />
                <figcaption className="text-xs text-gray-500 dark:text-slate-400 mt-1.5 text-center">
                  <strong>{i === 0 ? 'Before' : 'Latest'}</strong> · {longDate(r.measuredOn)}
                  {r.weightKg != null && ` · ${r.weightKg} kg`}
                </figcaption>
              </figure>
            ) : (
              <div key="pending" className="aspect-[3/4] rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs text-gray-400 dark:text-slate-500 text-center p-4">
                Add another photo later to compare
              </div>
            ))}
          </div>
        </Card>
      )}

      {rows.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Ruler size={16} className="text-blue-600 dark:text-blue-400" /> History
          </h2>
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {rows.map(r => {
              const values = METRICS.filter(m => r[m.value] != null)
                .map(m => `${m.label} ${r[m.value]}${m.unit === '%' ? '%' : ` ${m.unit}`}`);
              return (
                <li key={r.id} className="py-3 flex items-start gap-3">
                  {r.photo
                    ? <img src={r.photo} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    : <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-gray-400"><Scale size={16} /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">{longDate(r.measuredOn)}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{values.join(' · ') || 'Photo only'}</p>
                    {r.notes && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 italic">{r.notes}</p>}
                    {r.recordedBy && (
                      <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">by {r.recordedBy.name}</p>
                    )}
                  </div>
                  {canDelete(r) && (
                    <IconButton icon={Trash2} label="Remove entry" tone="red" onClick={() => setDeleting(r)} />
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {deleting && (
        <ConfirmDialog
          title="Remove entry"
          message={`Remove the measurements from ${longDate(deleting.measuredOn)}? This cannot be undone.`}
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
