import { useEffect, useState, type FormEvent } from 'react';
import {
  Wrench, Plus, Pencil, Trash2, AlertTriangle, CalendarClock, CheckCircle2, ShieldCheck, History, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, StatTile, PageLoader, LoadFailed, EmptyState, Refetching, SegmentedControl,
  FieldLabel, IconButton, Spinner, inputClass, primaryButton, secondaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { hasPermission } from '../utils/permissions';
import ReportFaultModal from '../components/equipment/ReportFaultModal';
import type { Equipment as Machine, EquipmentCategory, EquipmentDetail, EquipmentFault, EquipmentList } from '../types';

const money = (n: number) => `Rs. ${n.toLocaleString()}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const when = (iso: string) => new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

const CATEGORIES: Record<EquipmentCategory, string> = {
  cardio: 'Cardio', strength: 'Strength machine', free_weights: 'Free weights', functional: 'Functional', other: 'Other',
};

/** Where a machine's service schedule stands, as a small coloured line. */
function ServiceBadge({ m }: { m: Machine }) {
  const { t } = useLanguage();
  const { state, daysLeft, dueOn } = m.service;
  if (state === 'none') return <span className="text-xs text-gray-400">{t('No service schedule')}</span>;
  const tone = state === 'overdue' ? 'text-red-600' : state === 'due_soon' ? 'text-amber-600' : 'text-green-600';
  const text = state === 'overdue'
    ? t('Service overdue by {days} days', { days: Math.abs(daysLeft!) })
    : daysLeft === 0 ? t('Service due today')
      : state === 'due_soon' ? t('Service due in {days} days', { days: daysLeft! })
        : t('Next service {date}', { date: day(dueOn!) });
  return <span className={`text-xs font-semibold ${tone}`}>{text}</span>;
}

// --- forms -------------------------------------------------------------------------

function MachineModal({ machine, onClose, onDone }: { machine: Machine | null; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [f, setF] = useState({
    name: machine?.name ?? '',
    category: machine?.category ?? 'strength' as EquipmentCategory,
    brand: machine?.brand ?? '',
    model: machine?.model ?? '',
    serialNo: machine?.serialNo ?? '',
    location: machine?.location ?? '',
    purchasedOn: machine?.purchasedOn?.slice(0, 10) ?? '',
    cost: machine?.cost != null ? String(machine.cost) : '',
    warrantyUntil: machine?.warrantyUntil?.slice(0, 10) ?? '',
    serviceEveryDays: machine?.serviceEveryDays != null ? String(machine.serviceEveryDays) : '',
    lastServicedOn: machine?.lastServicedOn?.slice(0, 10) ?? '',
    notes: machine?.notes ?? '',
  });
  const [isActive, setIsActive] = useState(machine?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(v => ({ ...v, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      ...f,
      name: f.name.trim(),
      purchasedOn: f.purchasedOn || null,
      warrantyUntil: f.warrantyUntil || null,
      lastServicedOn: f.lastServicedOn || null,
      cost: f.cost === '' ? null : Number(f.cost),
      serviceEveryDays: f.serviceEveryDays === '' ? null : Number(f.serviceEveryDays),
      ...(machine && { isActive }),
    };
    try {
      if (machine) await api.put(`/equipment/${machine.id}`, body);
      else await api.post('/equipment', body);
      toast.success(machine ? t('Saved') : t('{name} added', { name: body.name }));
      onDone();
    } catch (err) {
      toast.error(apiError(err, t('Could not save')));
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof typeof f, label: string, props: Record<string, unknown> = {}) => (
    <div>
      <FieldLabel htmlFor={`eq-${k}`}>{t(label)}</FieldLabel>
      <input id={`eq-${k}`} value={f[k]} onChange={set(k)} className={inputClass} {...props} />
    </div>
  );

  return (
    <Modal title={machine ? t('Edit machine') : t('Add machine')} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="eq-name" required>{t('Name')}</FieldLabel>
            <input id="eq-name" required autoFocus maxLength={100} value={f.name} onChange={set('name')} placeholder={t('e.g. Treadmill 2')} className={inputClass} />
          </div>
          <div>
            <FieldLabel htmlFor="eq-category">{t('Type')}</FieldLabel>
            <select id="eq-category" value={f.category} onChange={set('category')} className={inputClass}>
              {(Object.keys(CATEGORIES) as EquipmentCategory[]).map(c => <option key={c} value={c}>{t(CATEGORIES[c])}</option>)}
            </select>
          </div>
          {field('brand', 'Brand', { maxLength: 60 })}
          {field('model', 'Model', { maxLength: 60 })}
          {field('serialNo', 'Serial no.', { maxLength: 60 })}
          {field('location', 'Location', { maxLength: 60, placeholder: t('e.g. Cardio zone') })}
          {field('purchasedOn', 'Purchase date', { type: 'date', max: today() })}
          {field('cost', 'Cost (Rs.)', { type: 'number', min: 0, inputMode: 'numeric' })}
          {field('warrantyUntil', 'Warranty until', { type: 'date' })}
          {field('serviceEveryDays', 'Service every (days)', { type: 'number', min: 1, max: 730, placeholder: t('e.g. 90') })}
          {field('lastServicedOn', 'Last serviced', { type: 'date', max: today() })}
        </div>
        {field('notes', 'Notes', { maxLength: 300 })}
        {machine && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            {t('In use (untick to retire it)')}
          </label>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>{saving ? t('Saving…') : t('Save')}</button>
        </div>
      </form>
    </Modal>
  );
}

function ServiceModal({ machine, onClose, onDone }: { machine: Machine; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [servicedOn, setServicedOn] = useState(today);
  const [cost, setCost] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/equipment/${machine.id}/services`, {
        servicedOn, cost: cost === '' ? null : Number(cost), vendor: vendor.trim(), notes: notes.trim(),
      });
      toast.success(t('Service recorded'));
      onDone();
    } catch (err) {
      toast.error(apiError(err, t('Could not save')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('Record service · {name}', { name: machine.name })} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="sv-on" required>{t('Serviced on')}</FieldLabel>
            <input id="sv-on" type="date" required max={today()} value={servicedOn} onChange={e => setServicedOn(e.target.value)} className={inputClass} />
          </div>
          <div>
            <FieldLabel htmlFor="sv-cost">{t('Cost (Rs.)')}</FieldLabel>
            <input id="sv-cost" type="number" min={0} inputMode="numeric" value={cost} onChange={e => setCost(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="sv-vendor">{t('Done by')}</FieldLabel>
          <input id="sv-vendor" maxLength={100} value={vendor} onChange={e => setVendor(e.target.value)} placeholder={t('Technician or company')} className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="sv-notes">{t('Notes')}</FieldLabel>
          <input id="sv-notes" maxLength={300} value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} />
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400">{t('A cost is added to Expenses under Maintenance.')}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>{saving ? t('Saving…') : t('Save')}</button>
        </div>
      </form>
    </Modal>
  );
}

function FixModal({ fault, onClose, onDone }: { fault: EquipmentFault; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [repairCost, setRepairCost] = useState('');
  const [fixNotes, setFixNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/equipment/faults/${fault.id}/fix`, {
        repairCost: repairCost === '' ? null : Number(repairCost), fixNotes: fixNotes.trim(),
      });
      toast.success(t('Marked fixed'));
      onDone();
    } catch (err) {
      toast.error(apiError(err, t('Could not save')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('Mark fixed · {name}', { name: fault.equipment.name })} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <p className="rounded-lg bg-gray-50 dark:bg-slate-800/60 px-3 py-2 text-sm">{fault.description}</p>
        <div>
          <FieldLabel htmlFor="fx-cost">{t('Repair cost (Rs.)')}</FieldLabel>
          <input id="fx-cost" type="number" min={0} inputMode="numeric" value={repairCost} onChange={e => setRepairCost(e.target.value)} placeholder={t('0 if it cost nothing')} className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="fx-notes">{t('What was done')}</FieldLabel>
          <input id="fx-notes" maxLength={300} value={fixNotes} onChange={e => setFixNotes(e.target.value)} className={inputClass} />
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400">{t('A cost is added to Expenses under Maintenance.')}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>{saving ? t('Saving…') : t('Mark fixed')}</button>
        </div>
      </form>
    </Modal>
  );
}

/** One machine's details with its service and fault history. */
function HistoryModal({ id, canBook, onClose, onChanged }: { id: string; canBook: boolean; onClose: () => void; onChanged: () => void }) {
  const { t } = useLanguage();
  const [data, setData] = useState<EquipmentDetail | null>(null);
  const load = () => api.get<EquipmentDetail>(`/equipment/${id}`).then(r => setData(r.data))
    .catch(err => { toast.error(apiError(err, t('Could not load'))); onClose(); });
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeService = async (serviceId: string) => {
    try {
      await api.delete(`/equipment/services/${serviceId}`);
      await load();
      onChanged();
    } catch (err) {
      toast.error(apiError(err, t('Could not remove')));
    }
  };

  return (
    <Modal title={data?.name ?? t('Loading…')} onClose={onClose}>
      {!data ? <div className="py-8 flex justify-center"><Spinner /></div> : (
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {([
              ['Type', t(CATEGORIES[data.category])],
              ['Brand', [data.brand, data.model].filter(Boolean).join(' ')],
              ['Serial no.', data.serialNo],
              ['Location', data.location],
              ['Purchase date', data.purchasedOn && day(data.purchasedOn)],
              ['Cost', data.cost != null && money(data.cost)],
              ['Warranty until', data.warrantyUntil && day(data.warrantyUntil)],
              ['Service every', data.serviceEveryDays && t('{days} days', { days: data.serviceEveryDays })],
            ] as [string, string | null | false][]).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt className="text-xs text-gray-500">{t(k)}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
          <ServiceBadge m={data} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{t('Services')}</p>
            {data.services.length === 0 ? <p className="text-gray-400 text-xs">{t('None recorded yet')}</p> : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {data.services.map(s => (
                  <li key={s.id} className="py-1.5 flex items-center gap-2">
                    <span className="flex-1">
                      {day(s.servicedOn)}{s.vendor && ` · ${s.vendor}`}{s.notes && ` · ${s.notes}`}
                    </span>
                    {s.cost != null && <span className="font-semibold tabular-nums">{money(s.cost)}</span>}
                    {canBook && <IconButton icon={X} label={t('Remove')} tone="red" onClick={() => void removeService(s.id)} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{t('Faults')}</p>
            {data.faults.length === 0 ? <p className="text-gray-400 text-xs">{t('No faults reported')}</p> : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {data.faults.map(f => (
                  <li key={f.id} className="py-1.5">
                    <span className={`mr-2 text-[11px] font-bold ${f.status === 'open' ? 'text-red-600' : 'text-green-600'}`}>
                      {f.status === 'open' ? t('Open') : t('Fixed')}
                    </span>
                    {when(f.reportedAt)} · {f.description}
                    {f.repairCost != null && <span className="text-gray-500"> · {money(f.repairCost)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// --- tabs ---------------------------------------------------------------------------

function FaultsTab({ canBook, version, onChanged }: { canBook: boolean; version: number; onChanged: () => void }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<'open' | 'fixed' | 'all'>('open');
  const [fixing, setFixing] = useState<EquipmentFault | null>(null);
  const [deleting, setDeleting] = useState<EquipmentFault | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, refetching, reload } = useFetch<EquipmentFault[]>(`/equipment/faults?status=${status}`, t('Could not load faults'));
  useEffect(() => { if (version > 0) void reload(); }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/equipment/faults/${deleting.id}`);
      setDeleting(null);
      await reload();
      onChanged();
    } catch (err) {
      toast.error(apiError(err, t('Could not delete')));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title={t('Could not load faults')} onRetry={() => void reload()} />;

  return (
    <>
      <div className="mb-3">
        <SegmentedControl value={status} onChange={setStatus}
          options={[{ value: 'open', label: 'Open' }, { value: 'fixed', label: 'Fixed' }, { value: 'all', label: 'All' }]} />
      </div>
      <Refetching busy={refetching}>
        {data.length === 0 ? (
          <EmptyState icon={CheckCircle2} title={status === 'open' ? t('Nothing broken right now') : t('No faults here')}
            hint={t('Staff and members can report a broken machine; it shows here until it is fixed.')} />
        ) : (
          <div className="space-y-2">
            {data.map(f => (
              <Card key={f.id} className="p-3 sm:p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-slate-100">
                    {f.equipment.name}
                    <span className={`ml-2 text-[11px] font-bold ${f.status === 'open' ? 'text-red-600' : 'text-green-600'}`}>
                      {f.status === 'open' ? t('Open') : t('Fixed')}
                    </span>
                  </p>
                  <p className="text-sm text-gray-700 dark:text-slate-300">{f.description}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {[
                      t('Reported {date}', { date: when(f.reportedAt) }),
                      f.reportedBy && t('reported by {name}', { name: f.reportedBy.name }),
                      f.reportedByMember && t('by member {name}', { name: f.reportedByMember.name }),
                      f.fixedAt && t('Fixed {date}', { date: when(f.fixedAt) }),
                      f.fixNotes,
                      f.repairCost != null && money(f.repairCost),
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {canBook && f.status === 'open' && (
                  <button onClick={() => setFixing(f)} className={primaryButton}><CheckCircle2 size={15} /> {t('Mark fixed')}</button>
                )}
                {canBook && <IconButton icon={Trash2} label={t('Delete')} tone="red" onClick={() => setDeleting(f)} />}
              </Card>
            ))}
          </div>
        )}
      </Refetching>
      {fixing && <FixModal fault={fixing} onClose={() => setFixing(null)} onDone={() => { setFixing(null); void reload(); onChanged(); }} />}
      {deleting && (
        <ConfirmDialog title={t('Delete fault')}
          message={t('Delete this fault report? Its repair cost, if any, is removed from Expenses.')}
          confirmLabel={t('Delete')} tone="danger" busy={busy}
          onConfirm={() => void remove()} onCancel={() => setDeleting(null)} />
      )}
    </>
  );
}

/**
 * The gym's machines: what it owns, when each is due a service, and what is
 * broken.
 *
 * Every staff member can see the list and report a fault. Adding machines,
 * recording services and fixing faults cost money, so they need the expenses
 * permission.
 */
export default function Equipment() {
  const { t } = useLanguage();
  const { user, isOwner } = useAuth();
  const canBook = isOwner || (!!user?.staffPermission && hasPermission(user.role, user.staffPermission, 'canManageExpenses'));
  const [tab, setTab] = useState<'machines' | 'faults'>('machines');
  const [editing, setEditing] = useState<Machine | 'new' | null>(null);
  const [servicing, setServicing] = useState<Machine | null>(null);
  const [reporting, setReporting] = useState<{ machineId?: string } | null>(null);
  const [history, setHistory] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Machine | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const { data, loading, refetching, reload } = useFetch<EquipmentList>('/equipment', t('Could not load equipment'));

  const changed = () => { setVersion(v => v + 1); void reload(); };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/equipment/${deleting.id}`);
      setDeleting(null);
      changed();
    } catch (err) {
      toast.error(apiError(err, t('Could not delete')));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!data) return <LoadFailed title={t('Could not load equipment')} onRetry={() => void reload()} />;

  const active = data.data.filter(m => m.isActive);

  return (
    <Page>
      <PageHeader icon={Wrench} title={t('Equipment')} subtitle={t('Machines, service schedule and repairs')}
        action={
          <div className="flex gap-2">
            <button onClick={() => setReporting({})} className={secondaryButton}><AlertTriangle size={16} /> {t('Report a fault')}</button>
            {canBook && <button onClick={() => setEditing('new')} className={primaryButton}><Plus size={16} /> {t('Add machine')}</button>}
          </div>
        } />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatTile icon={Wrench} label={t('Machines')} value={data.totals.machines} tone="blue" />
        <StatTile icon={CalendarClock} label={t('Service overdue')} value={data.totals.overdue} tone="red" />
        <StatTile icon={CalendarClock} label={t('Service due this week')} value={data.totals.dueSoon} tone="yellow" />
        <StatTile icon={AlertTriangle} label={t('Open faults')} value={data.totals.openFaults} tone="purple" />
      </div>

      <div className="mb-4">
        <SegmentedControl value={tab} onChange={setTab}
          options={[{ value: 'machines', label: 'Machines' }, { value: 'faults', label: 'Faults', count: data.totals.openFaults }]} />
      </div>

      {tab === 'faults' ? <FaultsTab canBook={canBook} version={version} onChanged={() => void reload()} /> : (
        <Refetching busy={refetching}>
          {data.data.length === 0 ? (
            <EmptyState icon={Wrench} title={t('No machines yet')}
              hint={t('Add your machines with their service schedule — the dashboard reminds you when one is due.')}
              action={canBook ? <button onClick={() => setEditing('new')} className={primaryButton}><Plus size={16} /> {t('Add machine')}</button> : undefined} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {data.data.map(m => (
                <Card key={m.id} className={`p-4 flex flex-col gap-2 ${m.isActive ? '' : 'opacity-60'} ${
                  m.isActive && m.service.state === 'overdue' ? 'border-red-200 dark:border-red-500/30' : ''}`}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                        {m.name}
                        {!m.isActive && <span className="ml-2 text-[11px] text-gray-400">{t('Retired')}</span>}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {[t(CATEGORIES[m.category]), [m.brand, m.model].filter(Boolean).join(' '), m.location].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {m.openFaults > 0 && (
                      <span className="shrink-0 rounded-full bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300 px-2 py-0.5 text-[11px] font-bold">
                        {t('{count} open fault(s)', { count: m.openFaults })}
                      </span>
                    )}
                  </div>
                  {m.isActive && <ServiceBadge m={m} />}
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {[
                      m.cost != null && money(m.cost),
                      m.purchasedOn && t('Bought {date}', { date: day(m.purchasedOn) }),
                      m.warrantyUntil && (m.underWarranty
                        ? t('Warranty till {date}', { date: day(m.warrantyUntil) })
                        : t('Warranty ended')),
                    ].filter(Boolean).join(' · ')}
                    {m.underWarranty && <ShieldCheck size={12} className="inline ml-1 -mt-0.5 text-green-600" />}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t border-gray-100 dark:border-slate-800">
                    <IconButton icon={History} label={t('History')} onClick={() => setHistory(m.id)} />
                    {m.isActive && <IconButton icon={AlertTriangle} label={t('Report a fault')} tone="red" onClick={() => setReporting({ machineId: m.id })} />}
                    {canBook && m.isActive && (
                      <button onClick={() => setServicing(m)} className={`flex-1 ${secondaryButton}`}><Wrench size={14} /> {t('Record service')}</button>
                    )}
                    {canBook && <IconButton icon={Pencil} label={t('Edit {name}', { name: m.name })} onClick={() => setEditing(m)} />}
                    {canBook && <IconButton icon={Trash2} label={t('Delete {name}', { name: m.name })} tone="red" onClick={() => setDeleting(m)} />}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Refetching>
      )}

      {editing && <MachineModal machine={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
        onDone={() => { setEditing(null); changed(); }} />}
      {servicing && <ServiceModal machine={servicing} onClose={() => setServicing(null)}
        onDone={() => { setServicing(null); changed(); }} />}
      {reporting && <ReportFaultModal machines={active} machineId={reporting.machineId} onClose={() => setReporting(null)}
        onDone={() => { setReporting(null); changed(); }} />}
      {history && <HistoryModal id={history} canBook={canBook} onClose={() => setHistory(null)} onChanged={changed} />}
      {deleting && (
        <ConfirmDialog title={t('Delete machine')}
          message={t('Delete {name}? Only a machine added by mistake can be deleted — one with history is retired instead (Edit → untick “In use”).', { name: deleting.name })}
          confirmLabel={t('Delete')} tone="danger" busy={busy}
          onConfirm={() => void remove()} onCancel={() => setDeleting(null)} />
      )}
    </Page>
  );
}
