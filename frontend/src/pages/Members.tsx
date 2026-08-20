import { useEffect, useState, useRef, useMemo, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Users, User, Phone, Calendar, CreditCard, Camera, CalendarPlus, QrCode, Fingerprint } from 'lucide-react';
import Badge from '../components/Badge';
import ConfirmDialog from '../components/ConfirmDialog';
import FingerprintEnrollModal from '../components/FingerprintEnrollModal';
import {
  Page, PageHeader, Card, PageLoader, EmptyState, SegmentedControl,
  FieldLabel, inputClass, primaryButton, secondaryButton, focusRing,
} from '../components/ui';
import type { AxiosError } from 'axios';
import api, { apiError } from '../api/client';
import { useDialog } from '../hooks/useDialog';
import { useDebounced } from '../hooks/useDebounced';
import type { FingerprintStatus, Gender, GymSettings, Member, MembershipPlan, MemberCounts, PaginatedMembers, PaymentChannel, PaymentMethod, Trainer } from '../types';
import { CHANNELS, CHANNEL_LABELS, accountFor } from '../utils/paymentChannels';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

interface MemberForm {
  name: string;
  email: string;
  phone: string;
  photo: string;
  gender: Gender | '';
  dateOfBirth: string;
  address: string;
  emergencyContact: string;
  /** Only sent when adding — an existing member's membership is changed from
   *  the membership flow, not by editing the person. */
  planId: string;
  startDate: string;
  trainerId: string;
  /** What was agreed for the trainer, when it was haggled. Blank means "use
   *  the trainer's rate, then the gym's" — not "free". */
  ptFee: string;
  /** Whether the fee was taken at the counter. False records a due. */
  ptFeePaid: boolean;
  /** The joining fee handed over at the counter. Blank means none was taken —
   *  the member is registered and can be billed from the Payments page. */
  feeAmount: string;
  feeMethod: PaymentMethod;
  /** Which wallet, when the money came in online. */
  feeChannel: PaymentChannel | '';
  /** The wallet's transaction id, when the front desk was given one. */
  feeReference: string;
}

/** What the desk fills in to renew: the next period, and the money for it. */
interface RenewForm {
  /** Blank means the same plan again. */
  planId: string;
  amount: string;
  method: PaymentMethod;
  channel: PaymentChannel | '';
  reference: string;
}

const emptyForm: MemberForm = {
  name: '', email: '', phone: '', photo: '',
  gender: '', dateOfBirth: '', address: '', emergencyContact: '',
  planId: '', startDate: '', trainerId: '', ptFee: '', ptFeePaid: false,
  feeAmount: '', feeMethod: 'cash', feeChannel: '', feeReference: '',
};

/** The filters worth offering. The stored statuses a member never sees
 *  (`superseded`) are not among them. */
const FILTERS = ['all', 'active', 'expiring', 'expired', 'lapsed', 'none'] as const;
type StatusFilter = (typeof FILTERS)[number];

const isFilter = (v: string | null): v is StatusFilter =>
  !!v && (FILTERS as readonly string[]).includes(v);

/** '' is "everyone", which includes members whose gender was never recorded. */
const GENDER_FILTERS = ['', 'male', 'female', 'other'] as const;
type GenderFilter = (typeof GENDER_FILTERS)[number];

const isGenderFilter = (v: string | null): v is GenderFilter =>
  v !== null && (GENDER_FILTERS as readonly string[]).includes(v);

/** Members per request. The rest arrive on demand rather than up front — a
 *  member row carries a photo, so a full roster is expensive to ship. */
const PAGE_SIZE = 24;

/**
 * Reads a 409 from the member endpoints back into the field warning the form
 * shows. Anything else — a 500, a network failure — is not a duplicate and is
 * left to the generic error path.
 */
function isDuplicateError(err: unknown): { field: 'phone' | 'name'; message: string } | null {
  const res = (err as AxiosError<{ error?: string; field?: 'phone' | 'name' }>)?.response;
  if (res?.status !== 409 || !res.data?.field || !res.data.error) return null;
  return { field: res.data.field, message: res.data.error };
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/** Local preview of what the server will calculate. The server's answer is
 *  the one that counts — this only saves the user a round trip to see it. */
function previewExpiry(startDate: string, durationDays: number): string {
  if (!startDate) return '';
  const d = new Date(startDate);
  d.setDate(d.getDate() + durationDays);
  return d.toISOString().split('T')[0]!;
}

/**
 * When a renewal's new period will begin — the day after the current expiry,
 * or today if that has already passed.
 *
 * Mirrors `renewalStart` on the server so the modal can say what the member is
 * buying before they pay for it. The server's answer is still the one stored.
 */
function renewalStart(expiryDate: string): Date {
  const dayAfter = new Date(expiryDate);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const now = new Date();
  return dayAfter > now ? dayAfter : now;
}

/** What the renewal will run to, given the plan picked. */
function previewRenewal(expiryDate: string, durationDays: number): string {
  const d = renewalStart(expiryDate);
  d.setDate(d.getDate() + durationDays);
  return d.toLocaleDateString('en-PK', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/**
 * Whether to offer Renew on a member's row.
 *
 * Only once renewing is actually the next thing to do: the last week of the
 * term, or any time after it has run out. Offering it against a membership
 * with three weeks left puts a button on every row in the gym, which is the
 * same as having no button at all — the ones that need attention stop
 * standing out.
 *
 * Keyed off the status the server already derives rather than a day count of
 * its own. `expiring` is its word for "a week or less left", so the button and
 * the yellow badge turn on together and cannot drift apart if that week is
 * ever changed to something else.
 *
 * Superseded and cancelled are closed history — the same rule the API
 * enforces, mirrored here so the button is absent rather than failing on
 * click.
 */
const canRenew = (m: Member): boolean => {
  // `expired` covers the lapsed too: lapsing describes the member, not the
  // thing they bought, so a membership that ran out six months ago still
  // reads as expired here — and somebody who drifted away is exactly who the
  // desk wants to sell a renewal to when they reappear.
  const status = m.currentMembership?.status;
  return status === 'expiring' || status === 'expired';
};

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [qrMember, setQrMember] = useState<Member | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [fingerprintMember, setFingerprintMember] = useState<Member | null>(null);
  /** True when the dialog opened itself after a registration rather than being
   *  asked for from the roster — only affects its wording. */
  const [fingerprintAfterRegister, setFingerprintAfterRegister] = useState(false);
  /** Whether a reader is attached at all. Gates the prompt after registering a
   *  member: a gym with no reader should not be shown a dialog offering a scan
   *  it cannot take. */
  const [fingerprintReady, setFingerprintReady] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  /** The trainer the member already had, so a re-save is told apart from a
   *  new assignment — only the latter is billed. */
  const [originalTrainerId, setOriginalTrainerId] = useState('');
  /** The gym's fallback rate, shown as the blank field's placeholder so staff
   *  can see what leaving it empty will charge. */
  /** The gym's own settings: the default PT rate, and the accounts members are
   *  told to send money to. */
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const gymPtFee = settings?.defaultPtFee ?? null;
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [params, setParams] = useSearchParams();
  // The dashboard deep-links here with a tab already chosen, e.g. the
  // follow-up panel's "View all" landing on Expired.
  const [filterStatus, setFilterStatus] = useState<StatusFilter>(() => {
    const s = params.get('status');
    return isFilter(s) ? s : 'all';
  });
  // Read from the URL like the status tab is, so a filtered roster survives a
  // refresh and can be linked to.
  const [filterGender, setFilterGender] = useState<GenderFilter>(() => {
    const g = params.get('gender');
    return isGenderFilter(g) ? g : '';
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** How many members match the filters, not how many are on screen. */
  const [total, setTotal] = useState(0);
  /**
   * The tab counts, from the server. They cover the whole roster rather than
   * the loaded page — a tab that counted only what had been fetched would climb
   * as you pressed Show more.
   */
  const [counts, setCounts] = useState<MemberCounts>(
    { all: 0, active: 0, expiring: 0, expired: 0, lapsed: 0, none: 0 },
  );
  // First paint shows a spinner; later fetches dim the old list instead.
  const [refetching, setRefetching] = useState(false);
  const [deleting, setDeleting] = useState<Member | null>(null);
  /** The member being renewed, and what the desk is taking for it. */
  const [renewing, setRenewing] = useState<Member | null>(null);
  const [renewForm, setRenewForm] = useState<RenewForm>({
    planId: '', amount: '', method: 'cash', channel: '', reference: '',
  });
  const photoRef = useRef<HTMLInputElement>(null);
  const modalRef = useDialog(showModal, () => setShowModal(false));
  const renewRef = useDialog(!!renewing, () => setRenewing(null));

  const debouncedSearch = useDebounced(search);

  /**
   * The filters, as the server takes them. Searching and the status tabs both
   * run there now: a page that filters what it was handed can only ever search
   * the rows it already has, which stops being a search at all once the gym
   * outgrows one page.
   */
  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (debouncedSearch.trim()) q.set('search', debouncedSearch.trim());
    if (filterStatus !== 'all') q.set('status', filterStatus);
    if (filterGender) q.set('gender', filterGender);
    q.set('limit', String(PAGE_SIZE));
    return `?${q.toString()}`;
  }, [debouncedSearch, filterStatus, filterGender]);

  // Read by in-flight requests to tell whether the filters they were issued
  // under are still the ones on screen. A ref rather than the value itself:
  // `loadMore` closes over `query` at the moment it was clicked.
  const queryRef = useRef(query);
  queryRef.current = query;

  /**
   * Replaces the list from page one, under the filters in force.
   *
   * Always page one: adding or editing a member can move them out of the
   * current tab entirely, and refetching some later page would leave a hole
   * above whatever came back.
   */
  const load = useMemo(() => (isStale: () => boolean = () => false) =>
    api.get<PaginatedMembers>(`/members${query}`)
      .then(r => {
        if (isStale()) return;
        setMembers(r.data.data);
        setCounts(r.data.counts);
        setTotal(r.data.total);
        setHasMore(r.data.hasMore);
        setPage(1);
      })
      .catch(err => {
        if (!isStale()) toast.error(apiError(err, 'Could not load members'));
      })
      .finally(() => { if (!isStale()) setLoading(false); }),
  [query]);

  // Refetched whenever the filters change. The old list is dimmed rather than
  // blanked, so typing in the search box does not empty the page.
  useEffect(() => {
    // A slow earlier response must not overwrite a newer one: typing in the
    // search box leaves the previous request in flight, and landing it after
    // this one would put stale rows under the current filters.
    let cancelled = false;
    setRefetching(true);
    void load(() => cancelled).finally(() => { if (!cancelled) setRefetching(false); });
    return () => { cancelled = true; };
  }, [load]);

  /** Appends the next page rather than replacing what is on screen. */
  const loadMore = () => {
    const next = page + 1;
    // The filters this page was asked for. If they change while it is in
    // flight the rows belong to a list that is no longer on screen, and
    // appending them would mix two different result sets.
    const asked = query;
    setLoadingMore(true);
    api.get<PaginatedMembers>(`/members${query}&page=${next}`)
      .then(r => {
        if (asked !== queryRef.current) return;
        setMembers(prev => [...prev, ...r.data.data]);
        setHasMore(r.data.hasMore);
        setPage(next);
      })
      .catch(err => toast.error(apiError(err, 'Could not load more members')))
      .finally(() => setLoadingMore(false));
  };

  useEffect(() => {
    // The gym's own price list, so the plan picker offers what this gym
    // actually sells rather than three hardcoded durations.
    void api.get<MembershipPlan[]>('/membership-plans')
      .then(r => {
        setPlans(r.data);
        // The dashboard's "Add Member" shortcut arrives as ?new=1. Opening
        // after the plans land is what lets the form preselect one; the param
        // is then cleared so a refresh does not reopen the modal.
        if (params.get('new')) {
          openAdd(r.data);
          setParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete('new');
            return next;
          }, { replace: true });
        }
      })
      .catch(err => toast.error(apiError(err, 'Could not load membership plans')));

    void api.get<Trainer[]>('/trainers')
      .then(r => setTrainers(r.data))
      .catch(err => console.error('Could not load trainers', err));

    // The fee field's placeholder and the account line under the channel
    // picker. A failure is not worth a toast — the form still works, the hints
    // are just missing.
    void api.get<GymSettings>('/gym-settings')
      .then(r => setSettings(r.data))
      .catch(() => { /* the hints simply say nothing */ });

    // Whether to offer enrolment after registering somebody. Silent on
    // failure: the fallback is not prompting, which is what a gym without a
    // reader wants anyway.
    void api.get<FingerprintStatus>('/fingerprint/status')
      .then(r => setFingerprintReady(r.data.configured))
      .catch(() => setFingerprintReady(false));
    // Deliberately once on mount: this is a landing hint, not a live binding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof MemberForm>(k: K) => (v: MemberForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  /**
   * Whether what has been typed so far already belongs to somebody, and under
   * which field to say so. Cleared as soon as the offending field is edited,
   * so a corrected number stops complaining without waiting for a round trip.
   */
  const [duplicate, setDuplicate] = useState<{ field: 'phone' | 'name'; message: string } | null>(null);

  /** Guards against a slow answer landing after the field has moved on. */
  const dupCheckSeq = useRef(0);

  /**
   * Asks the server whether this would be a duplicate, on leaving a field
   * rather than on every keystroke.
   *
   * Only ever a hint: the save re-checks server-side, so a failure here is
   * swallowed. Blocking a registration because a lookup timed out would be a
   * worse bug than the duplicate it was trying to prevent.
   */
  const checkDuplicate = async (next: MemberForm) => {
    const phone = next.phone.trim();
    const name = next.name.trim();
    const dob = next.dateOfBirth;
    if (!phone && !(name && dob)) { setDuplicate(null); return; }

    const seq = ++dupCheckSeq.current;
    try {
      const { data } = await api.get<{
        duplicate: boolean;
        field?: 'phone' | 'name';
        message?: string;
      }>('/members/check-duplicate', {
        params: {
          ...(phone && { phone }),
          ...(name && { name }),
          ...(dob && { dateOfBirth: dob }),
          // An edit must not find the member being edited.
          ...(editing && { excludeId: editing }),
        },
      });
      // A newer check has been asked for since; this answer is about text the
      // user has already replaced.
      if (seq !== dupCheckSeq.current) return;
      setDuplicate(
        data.duplicate && data.field && data.message
          ? { field: data.field, message: data.message }
          : null,
      );
    } catch {
      // Fail open — let the save attempt decide.
      if (seq === dupCheckSeq.current) setDuplicate(null);
    }
  };

  /** Editing a flagged field clears its warning; the blur will re-ask. */
  const setChecked = <K extends 'name' | 'phone' | 'dateOfBirth'>(k: K) => (v: MemberForm[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setDuplicate(d => {
      if (!d) return null;
      return (d.field === 'phone' && k === 'phone') ||
        (d.field === 'name' && (k === 'name' || k === 'dateOfBirth'))
        ? null
        : d;
    });
  };

  /**
   * What leaving the fee blank will actually charge — the same trainer-then-gym
   * resolution the server does, so the hint cannot promise one number while the
   * API bills another.
   */
  const ptFeePlaceholder = (() => {
    const trainer = trainers.find(t => t.id === form.trainerId);
    const rate = trainer?.ptFee ?? gymPtFee;
    if (rate === null || rate === undefined) return 'Usual rate';
    return rate === 0 ? 'No charge' : `Usual rate — ${rate.toLocaleString('en-PK')}`;
  })();

  const selectedPlan = plans.find(p => p.id === form.planId);
  const expiryPreview = selectedPlan
    ? previewExpiry(form.startDate, selectedPlan.durationDays)
    : '';

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => set('photo')(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // `from` lets the caller pass a freshly-fetched list: on the ?new=1 path the
  // plans have arrived but `plans` state has not repainted yet, and reading it
  // there would preselect nothing.
  const openAdd = (from: MembershipPlan[] = plans) => {
    const today = new Date().toISOString().split('T')[0]!;
    setEditing(null);
    setForm({
      ...emptyForm,
      startDate: today,
      // Preselect the cheapest offered plan so the common case is one click.
      planId: from[0]?.id ?? '',
    });
    // A new member has no trainer yet, so picking one is always a fresh
    // assignment and the fee field should show.
    setOriginalTrainerId('');
    setDuplicate(null);
    setShowModal(true);
  };

  const openEdit = (m: Member) => {
    setEditing(m.id);
    // Built on `emptyForm` rather than listing every field: an edit only fills
    // in what the member already has, and the rest — the plan and the fee,
    // which belong to registration — should stay at their blank defaults
    // whatever fields the form grows later.
    setForm({
      ...emptyForm,
      name: m.name, email: m.email || '', phone: m.phone || '',
      photo: m.photo || '',
      gender: m.gender ?? '',
      dateOfBirth: m.dateOfBirth ? m.dateOfBirth.split('T')[0]! : '',
      address: m.address ?? '',
      emergencyContact: m.emergencyContact ?? '',
      trainerId: m.trainerId || '',
    });
    // Remembered so the fee field appears only when the trainer is actually
    // changing — re-saving a member with the trainer they already have raises
    // no charge, and a field offering to set one would be lying.
    setOriginalTrainerId(m.trainerId || '');
    setDuplicate(null);
    setShowModal(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        photo: form.photo,
        gender: form.gender,
        // The API rejects "" for a date, so omit an unset one.
        ...(form.dateOfBirth && { dateOfBirth: form.dateOfBirth }),
        address: form.address,
        emergencyContact: form.emergencyContact,
        trainerId: form.trainerId || null,
        // Only meaningful alongside a trainer, and blank has to reach the API
        // as null: `Number('')` is 0, which the server would read as a
        // deliberate decision to charge nothing.
        ...(form.trainerId && {
          ptFee: form.ptFee.trim() === '' ? null : Number(form.ptFee),
          ptFeePaid: form.ptFeePaid,
        }),
      };
      if (editing) {
        await api.put(`/members/${editing}`, payload);
        toast.success('Member updated');
        setShowModal(false);
      } else {
        // A plan sells the membership in the same call; without one the member
        // is registered and can be given a membership later.
        const { data: created } = await api.post<Member>('/members', {
          ...payload,
          ...(form.planId && { planId: form.planId, startDate: form.startDate }),
          // Only sent when money actually changed hands. A blank amount means
          // no payment was taken, not a payment of nothing.
          ...(form.feeAmount.trim() !== '' && Number(form.feeAmount) > 0 && {
            feeAmount: Number(form.feeAmount),
            feeMethod: form.feeMethod,
            ...(form.feeMethod === 'online' && {
              feeChannel: form.feeChannel || null,
              feeReference: form.feeReference.trim() || null,
            }),
          }),
        });
        toast.success('Member added successfully');
        setShowModal(false);

        // Enrolment needs a member id, which only exists now — so the scan
        // cannot happen inside the form and has to follow the save. Opening
        // the dialog here keeps it one errand for the front desk instead of
        // two: register the member, take their finger, done. It is skippable,
        // and only offered when a reader is actually attached — a gym without
        // one should not be shown a dialog it can do nothing with.
        if (fingerprintReady) {
          setFingerprintAfterRegister(true);
          setFingerprintMember(created);
        }
      }
      await load();
    } catch (err) {
      // The server found a duplicate the live check missed — either it was
      // never asked, or somebody else registered this person in between. Keep
      // the modal and the typed data, and point at the field at fault.
      const conflict = isDuplicateError(err);
      if (conflict) {
        setDuplicate(conflict);
        toast.error(conflict.message);
      } else {
        toast.error(apiError(err, 'Error saving member'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.delete(`/members/${deleting.id}`);
      toast.success('Member deleted');
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete'));
    } finally {
      setSaving(false);
    }
  };

  const openRenew = (m: Member) => {
    const plan = plans.find(p => p.id === m.currentMembership?.planId);
    setRenewForm({
      // Same plan again is the common case, so it is preselected.
      planId: m.currentMembership?.planId ?? plans[0]?.id ?? '',
      // Prefilled from the plan's price, and editable — a haggled renewal is
      // recorded at what was actually taken, not what the list says.
      amount: plan ? String(plan.price) : '',
      method: 'cash',
      channel: '',
      reference: '',
    });
    setRenewing(m);
  };

  const handleRenew = async (e: FormEvent) => {
    e.preventDefault();
    const ms = renewing?.currentMembership;
    if (!renewing || !ms) return;
    setSaving(true);
    try {
      await api.post(`/members/${renewing.id}/memberships/${ms.id}/renew`, {
        ...(renewForm.planId && { planId: renewForm.planId }),
        amount: Number(renewForm.amount),
        method: renewForm.method,
        ...(renewForm.method === 'online' && {
          channel: renewForm.channel || null,
          reference: renewForm.reference.trim() || null,
        }),
      });
      toast.success('Membership renewed');
      setRenewing(null);
      await load();
    } catch (err) {
      // The modal stays open with its values, so a mistyped amount can be
      // corrected without retyping the rest.
      toast.error(apiError(err, 'Could not renew membership'));
    } finally {
      setSaving(false);
    }
  };

  // Searching, filtering and counting all happen on the server now — what
  // arrives in `members` is already the page being shown.
  if (loading) return <PageLoader />;

  const hasFilters = filterStatus !== 'all' || search !== '';
  const clearFilters = () => { setFilterStatus('all'); setSearch(''); };

  // counts.all rather than `total`: the header describes the roster, not
  // whatever the current tab or search has narrowed it to.
  const rosterSize = counts.all;

  return (
    <Page>
      <PageHeader
        icon={Users}
        title="Members"
        subtitle={`${rosterSize} ${rosterSize === 1 ? 'member' : 'members'} on the books`}
        action={
          <button onClick={() => openAdd()} className={primaryButton}>
            <Plus size={16} />
            <span className="hidden sm:inline">Add Member</span><span className="sm:hidden">Add</span>
          </button>
        }
      />

      {/* Filters */}
      <Card className="p-3 sm:p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'active', label: 'Active', count: counts.active },
              { value: 'expiring', label: 'Expiring', count: counts.expiring },
              { value: 'expired', label: 'Expired', count: counts.expired },
              { value: 'lapsed', label: 'Lapsed', count: counts.lapsed },
              { value: 'none', label: 'No membership', count: counts.none },
            ]}
          />
          {/* Narrows the roster to one gender — for working through the
              women's list on ladies' day, or counting either side of the
              floor. "All" keeps members whose gender was never recorded,
              which is most of the older rows.

              Full width on a phone, where it wraps onto its own line under the
              tabs; it only shrinks to its content once there is room beside
              the search box. */}
          <select
            value={filterGender}
            onChange={e => setFilterGender(e.target.value as GenderFilter)}
            aria-label="Filter members by gender"
            className={`${inputClass} sm:w-auto sm:ml-auto`}
          >
            <option value="">All genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <div className="relative flex-1 min-w-50 sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, ID or phone..."
              aria-label="Search members"
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
      </Card>

      {/* Members Grid */}
      {members.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Search}
            title="No members match these filters"
            hint="Try a different status tab, or clear the search."
            action={
              <button onClick={clearFilters} className={secondaryButton}>Clear filters</button>
            }
          />
        ) : (
          <EmptyState
            icon={User}
            title="No members yet"
            hint="Register the first member to start tracking memberships, attendance and fees."
            action={
              <button onClick={() => openAdd()} className={primaryButton}>
                <Plus size={16} /> Add the first member
              </button>
            }
          />
        )
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 transition-opacity ${
          refetching ? 'opacity-60' : ''
        }`}>
          {members.map(m => {
            const ms = m.currentMembership;
            // A lapsed card should recede, not shout — the red treatment is
            // for members somebody is still chasing.
            const lapsed = m.status === 'inactive';
            return (
              <Card key={m.id} className={`p-5 hover:shadow-md transition-shadow ${
                lapsed ? 'border-slate-200 bg-slate-50/60 opacity-75' :
                ms?.status === 'expired' ? 'border-red-200 dark:border-red-500/20 bg-red-50/30' :
                ms?.status === 'expiring' ? 'border-yellow-200 dark:border-yellow-500/20 bg-yellow-50/30' : ''
              }`}>
                <div className="flex items-start gap-3 mb-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    {m.photo
                      ? <img src={m.photo} alt={m.name} className="w-full h-full object-cover" />
                      : <span className="text-white font-bold text-sm">{getInitials(m.name)}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-slate-100 truncate">{m.name}</h3>
                    <p className="text-xs font-medium text-gray-400 dark:text-slate-500 mt-0.5">{m.memberNo}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <Phone size={11} /> {m.phone || 'No phone'}
                    </p>
                  </div>
                  {lapsed
                    ? <Badge status="lapsed" />
                    : ms && <Badge status={ms.status} />}
                </div>

                {ms ? (
                  <div className="space-y-2 text-xs text-gray-500 dark:text-slate-400">
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">
                      <span className="flex items-center gap-1.5"><Calendar size={12} /> Plan</span>
                      <span className="font-semibold text-gray-800 dark:text-slate-200">{ms.planName}</span>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">
                      <span className="flex items-center gap-1.5"><CreditCard size={12} /> Fee</span>
                      <span className="font-semibold text-gray-800 dark:text-slate-200">
                        Rs. {ms.pricePaid.toLocaleString()}
                      </span>
                    </div>
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      ms.status === 'expired' ? 'bg-red-100 dark:bg-red-500/15' :
                      ms.status === 'expiring' ? 'bg-yellow-100 dark:bg-yellow-500/15' : 'bg-green-50 dark:bg-green-500/15'
                    }`}>
                      <span className="flex items-center gap-1.5">
                        <Calendar size={12} /> Expiry
                      </span>
                      <span className={`font-bold text-xs ${
                        ms.status === 'expired' ? 'text-red-600' :
                        ms.status === 'expiring' ? 'text-yellow-700' : 'text-green-700'
                      }`}>
                        {ms.status === 'expired'
                          ? `Expired ${Math.abs(ms.daysLeft)}d ago`
                          : ms.status === 'expiring'
                          ? `${ms.daysLeft}d left`
                          : new Date(ms.expiryDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
                        }
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 px-3 py-4 text-center text-xs text-gray-400 dark:text-slate-500">
                    No membership yet
                  </div>
                )}

                {/* Trainer Assignment */}
                {m.trainer && (
                  <div className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 text-xs flex items-center justify-between text-indigo-700 dark:text-indigo-400">
                    <span className="font-semibold flex items-center gap-1.5">🏋️ Trainer</span>
                    <span className="font-bold">{m.trainer.name}</span>
                  </div>
                )}

                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <button onClick={() => {
                      setQrMember(m);
                      QRCode.toDataURL(m.id, { width: 280, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } })
                        .then(url => setQrDataUrl(url))
                        .catch(() => toast.error('Failed to generate QR code'));
                    }}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors ${focusRing}`}>
                    <QrCode size={12} />
                  </button>
                  {/* Filled when enrolled, outlined when not — the desk can see
                      at a glance who can use the reader without opening it. */}
                  <button onClick={() => { setFingerprintAfterRegister(false); setFingerprintMember(m); }}
                    aria-label={m.fingerprint
                      ? `Manage ${m.name}'s fingerprint`
                      : `Enrol ${m.name}'s fingerprint`}
                    title={m.fingerprint ? 'Fingerprint enrolled' : 'No fingerprint enrolled'}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${focusRing} ${
                      m.fingerprint
                        ? 'border-blue-200 dark:border-blue-500/30 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                        : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60'
                    }`}>
                    <Fingerprint size={12} />
                  </button>
                  <button onClick={() => openEdit(m)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors ${focusRing}`}>
                    <Pencil size={12} /> Edit
                  </button>
                  {canRenew(m) && (
                    <button onClick={() => openRenew(m)} aria-label={`Renew ${m.name}'s membership`}
                      className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-100 dark:border-blue-500/20 text-blue-600 hover:bg-blue-50 transition-colors ${focusRing}`}>
                      <CalendarPlus size={12} /> Renew
                    </button>
                  )}
                  <button onClick={() => setDeleting(m)} aria-label={`Delete ${m.name}`}
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-100 dark:border-red-500/20 text-red-500 hover:bg-red-50 transition-colors ${focusRing}`}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center mt-5">
          <button onClick={loadMore} disabled={loadingMore} className={secondaryButton}>
            {loadingMore ? 'Loading…' : `Show more · ${total - members.length} left`}
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} aria-hidden="true" />
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-modal-title"
            className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg sm:mx-4 max-h-[92dvh] flex flex-col"
          >
            <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
              <h2 id="member-modal-title" className="text-lg font-bold text-gray-900 dark:text-slate-100">
                {editing ? 'Edit Member' : 'Add New Member'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                {editing ? 'Update member details' : 'Fill in details — expiry auto-calculated'}
              </p>
            </div>

            <form onSubmit={e => void handleSave(e)} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              {/* Photo Upload */}
              <div className="flex flex-col items-center gap-3">
                <div
                  onClick={() => photoRef.current?.click()}
                  className="w-20 h-20 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center cursor-pointer overflow-hidden relative group"
                >
                  {form.photo
                    ? <img src={form.photo} alt="preview" className="w-full h-full object-cover" />
                    : <span className="text-white font-bold text-lg">
                        {form.name ? getInitials(form.name) : <Camera size={24} className="text-white/70" />}
                      </span>
                  }
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera size={18} className="text-white" />
                  </div>
                </div>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <button type="button" onClick={() => photoRef.current?.click()}
                  className="text-xs text-blue-600 font-medium hover:underline">
                  {form.photo ? 'Change photo' : 'Upload photo (optional)'}
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Full Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setChecked('name')(e.target.value)}
                  onBlur={() => void checkDuplicate(form)}
                  placeholder="Ahmed Khan"
                  aria-invalid={duplicate?.field === 'name'}
                  className={inputClass}
                />
                {duplicate?.field === 'name' && (
                  <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                    {duplicate.message}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Phone</label>
                <input
                  value={form.phone}
                  onChange={e => setChecked('phone')(e.target.value)}
                  onBlur={() => void checkDuplicate(form)}
                  placeholder="03001234567"
                  aria-invalid={duplicate?.field === 'phone'}
                  className={inputClass}
                />
                {duplicate?.field === 'phone' && (
                  <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                    {duplicate.message}
                  </p>
                )}
              </div>

              {/* Gender + Date of birth */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="member-gender" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Gender</label>
                  <select
                    id="member-gender"
                    value={form.gender}
                    onChange={e => set('gender')(e.target.value as Gender | '')}
                    className={inputClass}
                  >
                    <option value="">Not specified</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {/* Half of the name+DOB duplicate rule, so the form has to be
                    able to set it — a rule keyed on a field nobody can fill
                    would never fire. */}
                <div>
                  <label htmlFor="member-dob" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Date of Birth</label>
                  <input
                    id="member-dob"
                    type="date"
                    value={form.dateOfBirth}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setChecked('dateOfBirth')(e.target.value)}
                    onBlur={() => void checkDuplicate(form)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Personal Trainer Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Personal Trainer (PT)</label>
                <select
                  value={form.trainerId}
                  onChange={e => set('trainerId')(e.target.value)}
                  className={inputClass}
                >
                  <option value="">No trainer assigned</option>
                  {trainers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.specialization || 'General'})</option>
                  ))}
                </select>
              </div>

              {/* The fee is only asked for when a trainer is actually being
                  assigned, and only when it is a *new* assignment — re-saving
                  a member who already has this trainer bills nothing, so a
                  field offering to charge them again would be a trap. */}
              {form.trainerId && form.trainerId !== originalTrainerId && (
                <div>
                  <label htmlFor="member-ptfee" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                    Trainer Fee (Rs.)
                  </label>
                  <input
                    id="member-ptfee"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder={ptFeePlaceholder}
                    value={form.ptFee}
                    onChange={e => set('ptFee')(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    Charged once. Leave blank for the usual rate, or type what you
                    agreed — enter 0 to charge nothing.
                  </p>

                  <label className="flex items-start gap-2.5 mt-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.ptFeePaid}
                      onChange={e => set('ptFeePaid')(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 shrink-0"
                    />
                    <span className="text-sm text-gray-700 dark:text-slate-300">
                      Fee collected now
                      <span className="block text-xs text-gray-400 dark:text-slate-500">
                        {/* Unticked is the safe default: recording money that never
                            arrived is worse than leaving a real payment to be settled
                            on the Payments page. */}
                        {form.ptFeePaid
                          ? 'Recorded as paid — it will not show as outstanding.'
                          : 'Left as a due for the member to settle later.'}
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {/* Address */}
              <div>
                <label htmlFor="member-address" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Address</label>
                <input
                  id="member-address"
                  value={form.address}
                  onChange={e => set('address')(e.target.value)}
                  placeholder="House 12, Street 4, Lahore"
                  className={inputClass}
                />
              </div>

              {/* Emergency contact */}
              <div>
                <label htmlFor="member-emergency" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Emergency Contact</label>
                <input
                  id="member-emergency"
                  value={form.emergencyContact}
                  onChange={e => set('emergencyContact')(e.target.value)}
                  placeholder="Brother — 03009876543"
                  className={inputClass}
                />
              </div>

              {/* Membership — only when registering. Changing what an existing
                  member bought is its own action, not a profile edit. */}
              {!editing && (
                <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Membership Plan</label>
                    {plans.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800/60 rounded-xl px-3 py-3">
                        No plans set up yet — register the member now and give them
                        a membership later, or{' '}
                        <Link to="/membership-plans" className="text-blue-600 font-medium hover:underline">
                          add a plan first
                        </Link>.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button"
                          onClick={() => set('planId')('')}
                          className={`border rounded-xl py-2.5 px-2 text-center transition-all ${focusRing} ${
                            form.planId === ''
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700'
                              : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:border-gray-300'
                          }`}>
                          <p className="font-semibold text-xs">None</p>
                          <p className="text-xs opacity-60 mt-0.5">Add later</p>
                        </button>
                        {plans.map(p => (
                          <button key={p.id} type="button"
                            onClick={() => set('planId')(p.id)}
                            className={`border rounded-xl py-2.5 px-2 text-center transition-all ${focusRing} ${
                              form.planId === p.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700'
                                : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:border-gray-300'
                            }`}>
                            <p className="font-semibold text-xs truncate">{p.name}</p>
                            <p className="text-xs opacity-60 mt-0.5">
                              {p.durationDays}d · Rs. {p.price.toLocaleString()}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {form.planId && (
                    <div>
                      <label htmlFor="member-start" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Start Date *</label>
                      <input
                        id="member-start"
                        type="date"
                        required
                        value={form.startDate}
                        onChange={e => set('startDate')(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  )}

                  {/* Preview of what the server will calculate — the server's
                      answer is the one that is stored. */}
                  {expiryPreview && (
                    <div className="bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/20 rounded-xl p-3 flex items-center gap-2">
                      <Calendar size={15} className="text-blue-600 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-blue-800">Auto-calculated expiry</p>
                        <p className="text-sm font-bold text-blue-700">
                          {new Date(expiryPreview).toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Fee taken at the counter. Always offered, plan or no plan:
                      a gym takes a registration fee from somebody who has not
                      picked a package yet, and that money still has to land in
                      the books. Leaving the amount blank records no payment. */}
                  <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-3">
                    <div>
                      <label htmlFor="member-fee" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                        Fee Collected (Rs.)
                      </label>
                      <input
                        id="member-fee"
                        type="number"
                        min="0"
                        step="1"
                        value={form.feeAmount}
                        onChange={e => set('feeAmount')(e.target.value)}
                        placeholder={
                          selectedPlan
                            ? `Plan price — ${selectedPlan.price.toLocaleString('en-PK')}`
                            : 'Leave blank if nothing was paid yet'
                        }
                        className={inputClass}
                      />
                      <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                        Leave blank to register without taking payment.
                      </p>
                    </div>

                    {/* The rest of the section is only meaningful once there is
                        money to describe. */}
                    {form.feeAmount.trim() !== '' && Number(form.feeAmount) > 0 && (
                      <>
                        <div>
                          <FieldLabel>Paid by</FieldLabel>
                          <div className="grid grid-cols-2 gap-2">
                            {(['cash', 'online'] as PaymentMethod[]).map(m => (
                              <button key={m} type="button"
                                onClick={() => {
                                  set('feeMethod')(m);
                                  // Cash carries no channel; drop anything a
                                  // previous online selection left behind.
                                  if (m === 'cash') { set('feeChannel')(''); set('feeReference')(''); }
                                }}
                                className={`border rounded-xl py-2.5 px-2 text-center transition-all ${focusRing} ${
                                  form.feeMethod === m
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700'
                                    : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:border-gray-300'
                                }`}>
                                <p className="font-semibold text-xs capitalize">{m}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {form.feeMethod === 'online' && (
                          <>
                            <div>
                              <label htmlFor="member-fee-channel" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                                Received in
                              </label>
                              <select
                                id="member-fee-channel"
                                value={form.feeChannel}
                                onChange={e => set('feeChannel')(e.target.value as PaymentChannel | '')}
                                className={inputClass}
                              >
                                <option value="">Select account</option>
                                {CHANNELS.map(c => (
                                  <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                                ))}
                              </select>
                              {/* What the front desk reads out to the member.
                                  Absent when the owner has not published this
                                  channel's details in Settings. */}
                              {accountFor(settings, form.feeChannel) && (
                                <div className="mt-2 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/20 rounded-xl px-3 py-2">
                                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Send to</p>
                                  <p className="text-sm font-bold text-blue-700 dark:text-blue-200 break-words">
                                    {accountFor(settings, form.feeChannel)}
                                  </p>
                                </div>
                              )}
                              {form.feeChannel && !accountFor(settings, form.feeChannel) && (
                                <p className="mt-1.5 text-xs text-gray-400 dark:text-slate-500">
                                  No account saved for this — the owner can add one in Team &rsaquo; Gym Settings.
                                </p>
                              )}
                            </div>

                            <div>
                              <label htmlFor="member-fee-ref" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                                Transaction ID <span className="font-normal text-gray-400">(optional)</span>
                              </label>
                              <input
                                id="member-fee-ref"
                                value={form.feeReference}
                                onChange={e => set('feeReference')(e.target.value)}
                                placeholder="e.g. 4429183756"
                                className={inputClass}
                              />
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className={`flex-1 ${secondaryButton}`}>
                  Cancel
                </button>
                <button type="submit" disabled={saving || duplicate !== null} className={`flex-1 ${primaryButton}`}>
                  {saving ? 'Saving...' : editing ? 'Update Member' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Modal. Nothing renews on its own — a membership sits expired
          until somebody here takes the fee and presses the button. */}
      {renewing?.currentMembership && (() => {
        const ms = renewing.currentMembership;
        const picked = plans.find(p => p.id === renewForm.planId);
        return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRenewing(null)} aria-hidden="true" />
          <div
            ref={renewRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="renew-modal-title"
            className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md sm:mx-4 max-h-[92dvh] flex flex-col"
          >
            <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
              <h2 id="renew-modal-title" className="text-lg font-bold text-gray-900 dark:text-slate-100">
                Renew membership
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                {renewing.name} · {renewing.memberNo}
              </p>
            </div>

            <form onSubmit={e => void handleRenew(e)} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 px-3 py-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Current plan</span>
                  <span className="font-semibold text-gray-800 dark:text-slate-200">{ms.planName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Expires</span>
                  <span className="font-semibold text-gray-800 dark:text-slate-200">
                    {new Date(ms.expiryDate)
                      .toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Status</span>
                  <span className="font-semibold text-gray-800 dark:text-slate-200">
                    {ms.daysLeft < 0
                      ? `Expired ${Math.abs(ms.daysLeft)}d ago`
                      : `${ms.daysLeft}d left`}
                  </span>
                </div>
              </div>

              <div>
                <FieldLabel required>Plan</FieldLabel>
                <select
                  value={renewForm.planId}
                  onChange={e => {
                    const planId = e.target.value;
                    const plan = plans.find(p => p.id === planId);
                    // The price follows the plan, so switching plans does not
                    // leave the old plan's figure sitting in the amount.
                    setRenewForm(f => ({
                      ...f, planId, ...(plan && { amount: String(plan.price) }),
                    }));
                  }}
                  className={inputClass}
                >
                  {/* The member's own plan stays offered even if it has since
                      been retired — renewing what they already hold is not
                      buying something new. */}
                  {!plans.some(p => p.id === ms.planId) && (
                    <option value={ms.planId}>{ms.planName} (current)</option>
                  )}
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — Rs. {p.price.toLocaleString('en-PK')} / {p.durationDays}d
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel required>Fee collected (Rs.)</FieldLabel>
                <input
                  type="number" min={1} step={1} required
                  value={renewForm.amount}
                  onChange={e => setRenewForm(f => ({ ...f, amount: e.target.value }))}
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  Change it if a different amount was agreed.
                </p>
              </div>

              <div>
                <FieldLabel required>Paid by</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {(['cash', 'online'] as PaymentMethod[]).map(m => (
                    <button key={m} type="button"
                      onClick={() => setRenewForm(f => ({
                        ...f, method: m,
                        // Cash carries no wallet; drop what an earlier online
                        // selection left behind.
                        ...(m === 'cash' && { channel: '' as const, reference: '' }),
                      }))}
                      className={`border rounded-xl py-2.5 px-2 text-center transition-all ${focusRing} ${
                        renewForm.method === m
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700'
                          : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:border-gray-300'
                      }`}>
                      <p className="font-semibold text-xs capitalize">{m}</p>
                    </button>
                  ))}
                </div>
              </div>

              {renewForm.method === 'online' && (
                <>
                  <div>
                    <FieldLabel>Received in</FieldLabel>
                    <select
                      value={renewForm.channel}
                      onChange={e => setRenewForm(f => ({ ...f, channel: e.target.value as PaymentChannel | '' }))}
                      className={inputClass}
                    >
                      <option value="">Select account</option>
                      {CHANNELS.map(c => (
                        <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                      ))}
                    </select>
                    {accountFor(settings, renewForm.channel) && (
                      <div className="mt-2 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/20 rounded-xl px-3 py-2">
                        <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Send to</p>
                        <p className="text-sm font-bold text-blue-700 dark:text-blue-200 break-words">
                          {accountFor(settings, renewForm.channel)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <FieldLabel>Transaction ID <span className="font-normal text-gray-400">(optional)</span></FieldLabel>
                    <input
                      type="text" maxLength={100}
                      value={renewForm.reference}
                      onChange={e => setRenewForm(f => ({ ...f, reference: e.target.value }))}
                      placeholder="e.g. 4429183756"
                      className={inputClass}
                    />
                  </div>
                </>
              )}

              {/* Says what the member is buying before they pay for it. Days
                  still on the clock are carried, so renewing early costs them
                  nothing. */}
              {picked && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/20 px-3 py-2.5">
                  <p className="text-xs font-semibold text-blue-800">New expiry</p>
                  <p className="text-sm font-bold text-blue-900 mt-0.5">
                    {previewRenewal(ms.expiryDate, picked.durationDays)}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {ms.daysLeft > 0
                      ? `Starts when the current one ends — their ${ms.daysLeft} remaining day${ms.daysLeft === 1 ? '' : 's'} are kept.`
                      : 'Starts today.'}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setRenewing(null)}
                  className={`flex-1 ${secondaryButton}`}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
                  {saving ? 'Renewing...' : 'Renew'}
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {deleting && (
        <ConfirmDialog
          title="Delete member"
          message={`Delete ${deleting.name} (${deleting.memberNo})? Their memberships, attendance and payment history go with them, and this cannot be undone.`}
          busy={saving}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}

      {/* QR Code Modal */}
      {qrMember && qrDataUrl && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
             onClick={() => { setQrMember(null); setQrDataUrl(''); }}>
          <div className="w-full max-w-xs p-6 text-center bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 overflow-hidden">
              {qrMember.photo
                ? <img src={qrMember.photo} alt={qrMember.name} className="w-full h-full object-cover" />
                : <span className="text-white text-lg font-bold">{qrMember.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</span>
              }
            </div>
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">{qrMember.name}</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-5">{qrMember.memberNo} · {qrMember.phone || 'No phone'}</p>
            <div className="bg-white p-3 rounded-xl inline-block shadow-sm border border-gray-100">
              <img src={qrDataUrl} alt={`QR Code for ${qrMember.name}`} className="w-56 h-56" />
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-4">Scan this code at the front desk for instant check-in</p>
            <button
              onClick={() => { setQrMember(null); setQrDataUrl(''); }}
              className={`mt-4 w-full ${secondaryButton}`}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Fingerprint enrolment */}
      {fingerprintMember && (
        <FingerprintEnrollModal
          member={fingerprintMember}
          existing={fingerprintMember.fingerprint ?? null}
          justRegistered={fingerprintAfterRegister}
          onClose={() => { setFingerprintMember(null); setFingerprintAfterRegister(false); }}
          // Reload so the button's enrolled state matches what just happened.
          onChanged={() => { void load(); }}
        />
      )}
    </Page>
  );
}
