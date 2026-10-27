import { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Users, User, Phone, Calendar, CreditCard, CalendarPlus, QrCode, Fingerprint, PauseCircle, PlayCircle, XCircle, Dumbbell, UserPlus, MessageCircle, X, Snowflake, Activity } from 'lucide-react';
import Badge from '../components/Badge';
import ConfirmDialog from '../components/ConfirmDialog';
import FingerprintEnrollModal from '../components/FingerprintEnrollModal';
import MemberFormModal from '../components/members/MemberFormModal';
import MemberQrModal from '../components/members/MemberQrModal';
import RenewModal from '../components/members/RenewModal';
import AssignTrainerModal from '../components/members/AssignTrainerModal';
import FreezeModal from '../components/members/FreezeModal';
import ProgressModal from '../components/members/ProgressModal';
import {
  Page, PageHeader, Card, PageLoader, EmptyState, SegmentedControl,
  inputClass, primaryButton, secondaryButton, focusRing,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { openWhatsApp, createExpiryMessage, createGeneralMessage } from '../utils/whatsapp';
import { useDebounced } from '../hooks/useDebounced';
import { useFingerprintReader } from '../hooks/useFingerprintReader';
import { cachedResponse, cacheResponse } from '../hooks/useFetch';
import type {
  GymSettings, Member, MembershipPlan, MemberCounts, PaginatedMembers, Trainer,
  Paginated,
} from '../types';
import toast from 'react-hot-toast';

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

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
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

/**
 * Pausing is offered on anything still running, and only resuming is offered
 * once it is paused — the same either/or the API enforces, mirrored here so
 * the button is absent rather than failing on click.
 */
const canSuspend = (m: Member): boolean => {
  const status = m.currentMembership?.status;
  return status === 'active' || status === 'expiring' || status === 'expired';
};

const canResume = (m: Member): boolean => m.currentMembership?.status === 'suspended';

/**
 * Freezing stops the clock, so it is offered only while the clock is running
 * and not already stopped — the API refuses an expired, paused or
 * already-frozen membership, and the button is absent rather than failing.
 */
const canFreeze = (m: Member): boolean => {
  const ms = m.currentMembership;
  return !!ms && (ms.status === 'active' || ms.status === 'expiring') && !ms.freeze;
};

const freezeDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });

const PLANS_URL = '/membership-plans?all=true';
const TRAINERS_URL = '/trainers?all=true';
const SETTINGS_URL = '/gym-settings';

export default function Members() {
  const { gym } = useAuth();
  const { t } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>(
    () => cachedResponse<Paginated<MembershipPlan>>(PLANS_URL)?.data ?? [],
  );
  const [loading, setLoading] = useState(true);

  const handleWhatsApp = (m: Member) => {
    if (!m.phone) {
      toast.error('No phone number recorded for this member');
      return;
    }
    const ms = m.currentMembership;
    const text = ms && (ms.status === 'expiring' || ms.status === 'expired')
      ? createExpiryMessage({
          memberName: m.name,
          gymName: gym?.name,
          planName: ms.planName,
          daysLeft: ms.daysLeft,
          expiryDate: ms.expiryDate,
        })
      : createGeneralMessage({
          memberName: m.name,
          gymName: gym?.name,
        });
    openWhatsApp(m.phone, text);
  };
  const [showModal, setShowModal] = useState(false);
  /** The member whose check-in code is on screen. The code itself is the
   *  modal's business. */
  const [qrMember, setQrMember] = useState<Member | null>(null);
  const [assignTrainerMember, setAssignTrainerMember] = useState<Member | null>(null);
  const [fingerprintMember, setFingerprintMember] = useState<Member | null>(null);
  /** True when the dialog opened itself after a registration rather than being
   *  asked for from the roster — only affects its wording. */
  const [fingerprintAfterRegister, setFingerprintAfterRegister] = useState(false);
  /** Whether a reader is attached at all. Gates the prompt after registering a
   *  member: a gym with no reader should not be shown a dialog offering a scan
   *  it cannot take. The dialog asks again when it opens — this is only about
   *  whether to offer it. */
  const { status: reader } = useFingerprintReader();
  const fingerprintReady = reader?.configured ?? false;
  /** The member being edited, or null when the form is registering a new one.
   *  What is typed about them is the modal's business. */
  const [editing, setEditing] = useState<Member | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>(
    () => cachedResponse<Paginated<Trainer>>(TRAINERS_URL)?.data ?? [],
  );
  /** Who can still be given a member, as opposed to who can be filtered by. */
  const activeTrainers = useMemo(() => trainers.filter(t => t.isActive), [trainers]);
  /** The gym's own settings: the default PT rate, and the accounts members are
   *  told to send money to. */
  const [settings, setSettings] = useState<GymSettings | null>(
    () => cachedResponse<GymSettings>(SETTINGS_URL) ?? null,
  );
  /** The delete alone. The form's own save lives in the form. */
  const [deletingBusy, setDeletingBusy] = useState(false);
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
  /**
   * Whose members to show. '' is everyone; 'none' is the members nobody has
   * been given, which is a question in its own right — it is the list you work
   * through when handing them out.
   */
  const [filterTrainer, setFilterTrainer] = useState<string>(
    () => params.get('trainerId') ?? '',
  );
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
  /** The member being renewed. What is taken for it lives in the modal. */
  const [renewing, setRenewing] = useState<Member | null>(null);
  const [statusChange, setStatusChange] =
    useState<{ member: Member; verb: 'suspend' | 'resume' | 'cancel' } | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [freezing, setFreezing] = useState<Member | null>(null);
  const [unfreezing, setUnfreezing] = useState<Member | null>(null);
  const [progressMember, setProgressMember] = useState<Member | null>(null);

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
    if (filterTrainer) q.set('trainerId', filterTrainer);
    q.set('limit', String(PAGE_SIZE));
    return `?${q.toString()}`;
  }, [debouncedSearch, filterStatus, filterGender, filterTrainer]);

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
  const show = (body: PaginatedMembers) => {
    setMembers(body.data);
    setCounts(body.counts);
    setTotal(body.total);
    setHasMore(body.hasMore);
    setPage(1);
  };

  const load = useMemo(() => (isStale: () => boolean = () => false) =>
    api.get<PaginatedMembers>(`/members${query}`)
      .then(r => {
        cacheResponse(`/members${query}`, r.data);
        if (isStale()) return;
        show(r.data);
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
    // Seen before this session: paint it now, and let the fetch below refresh
    // it under the usual dimming instead of opening on a spinner.
    const seen = cachedResponse<PaginatedMembers>(`/members${query}`);
    if (seen) {
      show(seen);
      setLoading(false);
    }
    setRefetching(true);
    void load(() => cancelled).finally(() => { if (!cancelled) setRefetching(false); });
    return () => { cancelled = true; };
    // `show` only calls setters; `load` is rebuilt whenever `query` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, query]);

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
    void api.get<Paginated<MembershipPlan>>(PLANS_URL)
      .then(r => {
        cacheResponse(PLANS_URL, r.data);
        setPlans(r.data.data);
        // The dashboard's "Add Member" shortcut arrives as ?new=1. Opening
        // after the plans land is what lets the form preselect one — both
        // updates land in the same render, so the modal mounts with the list
        // already set rather than seeing an empty one. The param is then
        // cleared so a refresh does not reopen the modal.
        if (params.get('new')) {
          openAdd();
          setParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete('new');
            return next;
          }, { replace: true });
        }
      })
      .catch(err => toast.error(apiError(err, 'Could not load membership plans')));

    // Worth a toast, unlike the settings below: without this the trainer filter
    // and the assign-trainer picker are simply absent, which reads as the gym
    // having no trainers rather than as a failure to load them.
    void api.get<Paginated<Trainer>>(TRAINERS_URL)
      .then(r => {
        cacheResponse(TRAINERS_URL, r.data);
        setTrainers(r.data.data);
      })
      .catch(err => toast.error(apiError(err, 'Could not load trainers')));

    // The fee field's placeholder and the account line under the channel
    // picker. A failure is not worth a toast — the form still works, the hints
    // are just missing.
    void api.get<GymSettings>(SETTINGS_URL)
      .then(r => {
        cacheResponse(SETTINGS_URL, r.data);
        setSettings(r.data);
      })
      .catch(() => { /* the hints simply say nothing */ });

    // Deliberately once on mount: this is a landing hint, not a live binding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => { setEditing(null); setShowModal(true); };
  const openEdit = (m: Member) => { setEditing(m); setShowModal(true); };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await api.delete(`/members/${deleting.id}`);
      toast.success('Member deleted');
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete'));
    } finally {
      setDeletingBusy(false);
    }
  };

  /**
   * Suspend, resume and cancel share one call: the three differ only in the
   * verb and what to say afterwards, and keeping them together is what stops
   * the confirm dialog and the request drifting apart.
   */
  const handleMembershipAction = async () => {
    if (!statusChange) return;
    const { member, verb } = statusChange;
    const membershipId = member.currentMembership?.id;
    if (!membershipId) return;

    setStatusBusy(true);
    try {
      await api.post(`/members/${member.id}/memberships/${membershipId}/${verb}`);
      toast.success(
        verb === 'suspend' ? 'Membership suspended'
          : verb === 'resume' ? 'Membership resumed'
            : 'Membership cancelled',
      );
      setStatusChange(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, `Could not ${verb} membership`));
    } finally {
      setStatusBusy(false);
    }
  };

  /** Ends a freeze early; the server hands back only the unused days. */
  const handleUnfreeze = async () => {
    const membershipId = unfreezing?.currentMembership?.id;
    if (!unfreezing || !membershipId) return;
    setStatusBusy(true);
    try {
      await api.post(`/members/${unfreezing.id}/memberships/${membershipId}/unfreeze`);
      toast.success('Freeze ended');
      setUnfreezing(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not end freeze'));
    } finally {
      setStatusBusy(false);
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
          <button onClick={() => openAdd()} className={`${primaryButton} shrink-0 !py-1.5 !px-3 sm:!py-2 sm:!px-4 text-xs sm:text-sm gap-1 sm:gap-2`}>
            <Plus size={16} />
            <span className="hidden sm:inline">{t('Add Member')}</span><span className="sm:hidden font-bold">{t('Add')}</span>
          </button>
        }
      />

      {/* Filters and Navigation Bar */}
      <Card className="p-2.5 sm:p-4 mb-4 sm:mb-5">
        <div className="flex flex-col gap-2.5 sm:gap-3">
          {/* Status Tabs Navbar */}
          <div className="w-full min-w-0 overflow-x-auto no-scrollbar -mx-0.5 px-0.5">
            <SegmentedControl
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'active', label: 'Active', count: counts.active },
                { value: 'expiring', label: 'Expiring', count: counts.expiring },
                { value: 'expired', label: 'Expired', count: counts.expired },
                { value: 'lapsed', label: 'Lapsed', count: counts.lapsed },
                { value: 'none', label: 'No plan', count: counts.none },
              ]}
            />
          </div>

          {/* Search & Filter Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search Input - Full width on mobile for easy typing */}
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, ID or phone..."
                aria-label="Search members"
                className={`${inputClass} pl-9 pr-8 text-xs sm:text-sm py-2`}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Gender & Trainer dropdowns - side-by-side on mobile, inline on desktop */}
            <div className={`grid ${trainers.length > 0 ? 'grid-cols-2' : 'grid-cols-1'} sm:flex items-center gap-2 shrink-0`}>
              <select
                value={filterGender}
                onChange={e => setFilterGender(e.target.value as GenderFilter)}
                aria-label="Filter members by gender"
                className={`${inputClass} text-xs sm:text-sm py-2 sm:w-auto`}
              >
                <option value="">All genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>

              {trainers.length > 0 && (
                <select
                  value={filterTrainer}
                  onChange={e => setFilterTrainer(e.target.value)}
                  aria-label="Filter members by trainer"
                  className={`${inputClass} text-xs sm:text-sm py-2 sm:w-auto`}
                >
                  <option value="">All trainers</option>
                  <option value="none">Not assigned</option>
                  {trainers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.isActive ? t.name : `${t.name} (left)`}
                    </option>
                  ))}
                </select>
              )}
            </div>
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                        <Phone size={11} /> {m.phone || 'No phone'}
                      </p>
                      {m.phone && (
                        <button
                          type="button"
                          onClick={() => handleWhatsApp(m)}
                          title="Message on WhatsApp"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                        >
                          <MessageCircle size={11} className="fill-emerald-500/20" />
                          <span>WhatsApp</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {lapsed
                    ? <Badge status="lapsed" />
                    : ms && <Badge status={ms.status} />}
                </div>

                {ms ? (
                  <div className="space-y-2 text-xs text-gray-500 dark:text-slate-400">
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">
                      <span className="flex items-center gap-1.5"><Calendar size={12} /> {t('Plan')}</span>
                      <span className="font-semibold text-gray-800 dark:text-slate-200">{ms.planName}</span>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">
                      <span className="flex items-center gap-1.5"><CreditCard size={12} /> {t('Fee')}</span>
                      <span className="font-semibold text-gray-800 dark:text-slate-200">
                        Rs. {ms.pricePaid.toLocaleString()}
                      </span>
                    </div>
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      ms.status === 'expired' ? 'bg-red-100 dark:bg-red-500/15' :
                      ms.status === 'expiring' ? 'bg-yellow-100 dark:bg-yellow-500/15' : 'bg-green-50 dark:bg-green-500/15'
                    }`}>
                      <span className="flex items-center gap-1.5">
                        <Calendar size={12} /> {t('Expiry')}
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
                    {ms.freeze && (
                      <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300">
                        <span className="flex items-center gap-1.5"><Snowflake size={12} /> {t('Frozen')}</span>
                        <span className="font-semibold text-xs">
                          {new Date(ms.freeze.from) > new Date()
                            ? `${freezeDate(ms.freeze.from)} – ${freezeDate(ms.freeze.until)}`
                            : `until ${freezeDate(ms.freeze.until)}`}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 px-3 py-4 text-center text-xs text-gray-400 dark:text-slate-500">
                    {t('No membership yet')}
                  </div>
                )}

                {/* Trainer Assignment */}
                {m.trainer ? (
                  <div className="mt-3 px-3 py-1.5 rounded-lg bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 text-xs flex items-center justify-between text-purple-700 dark:text-purple-300">
                    <span className="font-semibold flex items-center gap-1.5 truncate mr-2">
                      <Dumbbell size={13} className="shrink-0 text-purple-600 dark:text-purple-400" />
                      <span className="truncate">{m.trainer.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAssignTrainerMember(m)}
                      className="shrink-0 font-medium text-[11px] underline hover:text-purple-900 dark:hover:text-purple-200 transition-colors"
                      title="Change or remove assigned trainer"
                    >
                      {t('Change / Remove')}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 px-3 py-1.5 rounded-lg bg-gray-50/80 dark:bg-slate-800/40 border border-dashed border-gray-200 dark:border-slate-700/60 text-xs flex items-center justify-between text-gray-500 dark:text-slate-400">
                    <span className="text-[11px] flex items-center gap-1.5 text-gray-400 dark:text-slate-500">
                      <Dumbbell size={12} className="opacity-60" />
                      <span>{t('No Trainer')}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAssignTrainerMember(m)}
                      className="font-semibold text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1 transition-colors"
                    >
                      <UserPlus size={11} /> {t('+ Add Trainer')}
                    </button>
                  </div>
                )}

                <div className="mt-4 pt-3.5 border-t border-gray-100 dark:border-slate-800 space-y-2">
                  {/* Primary Row: QR, Fingerprint, Edit, WhatsApp, Renew */}
                  <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                    <button
                      onClick={() => setQrMember(m)}
                      aria-label={`Show ${m.name}'s check-in code`}
                      title="Check-in QR Code"
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-medium border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 active:scale-95 transition-all shrink-0 ${focusRing}`}
                    >
                      <QrCode size={14} />
                    </button>
                    <button
                      onClick={() => { setFingerprintAfterRegister(false); setFingerprintMember(m); }}
                      aria-label={m.fingerprint ? `Manage ${m.name}'s fingerprint` : `Enrol ${m.name}'s fingerprint`}
                      title={m.fingerprint ? 'Fingerprint enrolled' : 'No fingerprint enrolled'}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-medium border active:scale-95 transition-all shrink-0 ${focusRing} ${
                        m.fingerprint
                          ? 'border-blue-200 dark:border-blue-500/30 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50'
                          : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <Fingerprint size={14} />
                    </button>
                    <button
                      onClick={() => setProgressMember(m)}
                      aria-label={`${m.name}'s progress`}
                      title="Progress & measurements"
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-medium border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 active:scale-95 transition-all shrink-0 ${focusRing}`}
                    >
                      <Activity size={14} />
                    </button>
                    <button
                      onClick={() => openEdit(m)}
                      aria-label={`Edit ${m.name}`}
                      className={`flex-1 min-w-[70px] min-h-[36px] flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800/60 active:scale-95 transition-all ${focusRing}`}
                    >
                      <Pencil size={12} /> {t('Edit')}
                    </button>
                    {m.phone && (
                      <button
                        onClick={() => handleWhatsApp(m)}
                        aria-label={`Send WhatsApp message to ${m.name}`}
                        title={ms?.status === 'expiring' || ms?.status === 'expired' ? 'Send WhatsApp expiry reminder' : 'Send WhatsApp message'}
                        className={`min-h-[36px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border active:scale-95 transition-all shrink-0 ${focusRing} ${
                          ms?.status === 'expiring' || ms?.status === 'expired'
                            ? 'border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100'
                            : 'border-gray-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <MessageCircle size={13} className="fill-emerald-500/20" />
                        <span>{t('Chat')}</span>
                      </button>
                    )}
                    {canRenew(m) && (
                      <button
                        onClick={() => setRenewing(m)}
                        aria-label={`Renew ${m.name}'s membership`}
                        className={`min-h-[36px] flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs active:scale-95 transition-all shrink-0 ${focusRing}`}
                      >
                        <CalendarPlus size={12} /> {t('Renew')}
                      </button>
                    )}
                  </div>

                  {/* Secondary Management Row: Suspend, Resume, Cancel, Delete */}
                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {canFreeze(m) && (
                        <button
                          onClick={() => setFreezing(m)}
                          aria-label={`Freeze ${m.name}'s membership`}
                          title="Freeze for travel, injury or Ramadan — the expiry moves forward"
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-medium border border-sky-200 dark:border-sky-500/20 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors ${focusRing}`}
                        >
                          <Snowflake size={12} /> {t('Freeze')}
                        </button>
                      )}
                      {m.currentMembership?.freeze && (
                        <button
                          onClick={() => setUnfreezing(m)}
                          aria-label={`End ${m.name}'s freeze`}
                          title="End the freeze early"
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-medium border border-sky-200 dark:border-sky-500/20 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors ${focusRing}`}
                        >
                          <Snowflake size={12} /> {t('Unfreeze')}
                        </button>
                      )}
                      {canSuspend(m) && (
                        <button
                          onClick={() => setStatusChange({ member: m, verb: 'suspend' })}
                          aria-label={`Suspend ${m.name}'s membership`}
                          title="Pause this membership"
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-medium border border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors ${focusRing}`}
                        >
                          <PauseCircle size={12} /> {t('Suspend')}
                        </button>
                      )}
                      {canResume(m) && (
                        <button
                          onClick={() => setStatusChange({ member: m, verb: 'resume' })}
                          aria-label={`Resume ${m.name}'s membership`}
                          title="Put this membership back into service"
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-medium border border-green-200 dark:border-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors ${focusRing}`}
                        >
                          <PlayCircle size={12} /> {t('Resume')}
                        </button>
                      )}
                      {(canSuspend(m) || canResume(m)) && (
                        <button
                          onClick={() => setStatusChange({ member: m, verb: 'cancel' })}
                          aria-label={`Cancel ${m.name}'s membership`}
                          title="Cancel this membership"
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-medium border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors ${focusRing}`}
                        >
                          <XCircle size={12} /> {t('Cancel')}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setDeleting(m)}
                      aria-label={`Delete ${m.name}`}
                      title="Delete member"
                      className={`p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0 ${focusRing}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
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
        <MemberFormModal
          member={editing}
          plans={plans}
          // Only trainers still at the gym can be given a member — the server
          // refuses the rest — so offering them here would be offering a
          // choice that fails on save. The filter above keeps the full list,
          // because a departed trainer's members still have to be findable.
          trainers={activeTrainers}
          settings={settings}
          fingerprintReady={fingerprintReady}
          onClose={() => setShowModal(false)}
          onSaved={(created, enrolFingerprint) => {
            setShowModal(false);
            // Enrolment needs a member id, which only exists once the save has
            // returned — so the scan cannot happen inside the form and has to
            // follow it. Opening the dialog here keeps it one errand for the
            // front desk instead of two: register the member, take their
            // finger, done. The form's "Add fingerprint" option decides
            // whether it opens; it is still skippable once it has.
            if (created && enrolFingerprint) {
              setFingerprintAfterRegister(true);
              setFingerprintMember(created);
            }
            void load();
          }}
        />
      )}

      {/* Renew Modal. Nothing renews on its own — a membership sits expired
          until somebody here takes the fee and presses the button. */}
      {renewing?.currentMembership && (
        <RenewModal
          member={renewing as Member & { currentMembership: NonNullable<Member['currentMembership']> }}
          plans={plans}
          trainers={activeTrainers}
          settings={settings}
          onClose={() => setRenewing(null)}
          onRenewed={() => { setRenewing(null); void load(); }}
        />
      )}

      {/* Assign, change or remove personal trainer */}
      {assignTrainerMember && (
        <AssignTrainerModal
          member={assignTrainerMember}
          trainers={activeTrainers}
          onClose={() => setAssignTrainerMember(null)}
          onAssigned={() => {
            setAssignTrainerMember(null);
            void load();
          }}
        />
      )}

      {/* Suspending, resuming and calling a membership off. The wording spells
          out the consequence each time, because suspending does not stop the
          clock and cancelling cannot be undone. */}
      {statusChange && (
        <ConfirmDialog
          title={
            statusChange.verb === 'suspend' ? 'Suspend membership'
              : statusChange.verb === 'resume' ? 'Resume membership'
                : 'Cancel membership'
          }
          message={
            statusChange.verb === 'suspend'
              ? `Suspend ${statusChange.member.name}'s membership? The expiry date keeps running while it is paused, so the days still count down. You can resume it at any time.`
              : statusChange.verb === 'resume'
                ? `Put ${statusChange.member.name}'s membership back into service? If it ran out while paused it will show as expired, ready to renew.`
                : `Cancel ${statusChange.member.name}'s membership for good? It stays in their history and any payments already taken are kept, but it cannot be resumed or renewed afterwards.`
          }
          // Named for the act, rather than left on the component's "Delete"
          // default: a dialog headed "Cancel membership" whose button said
          // "Delete" invited the reader to hunt for the difference between the
          // two, and "Cancel" beside "Cancel" is worse still — one abandons
          // the dialog and the other ends the membership.
          confirmLabel={
            statusChange.verb === 'suspend' ? 'Suspend membership'
              : statusChange.verb === 'resume' ? 'Resume membership'
                : 'Cancel membership'
          }
          // Resuming gives a membership back; only the other two take
          // something away.
          tone={statusChange.verb === 'resume' ? 'primary' : 'danger'}
          busy={statusBusy}
          onConfirm={() => void handleMembershipAction()}
          onCancel={() => setStatusChange(null)}
        />
      )}

      {freezing?.currentMembership && (
        <FreezeModal
          member={freezing as Member & { currentMembership: NonNullable<Member['currentMembership']> }}
          onClose={() => setFreezing(null)}
          onFrozen={() => { setFreezing(null); void load(); }}
        />
      )}

      {unfreezing?.currentMembership?.freeze && (
        <ConfirmDialog
          title="End freeze"
          message={`End ${unfreezing.name}'s freeze now? Only the days not yet used come off the expiry.`}
          confirmLabel="End freeze"
          tone="primary"
          busy={statusBusy}
          onConfirm={() => void handleUnfreeze()}
          onCancel={() => setUnfreezing(null)}
        />
      )}

      {progressMember && (
        <ProgressModal member={progressMember} onClose={() => setProgressMember(null)} />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete member"
          message={`Delete ${deleting.name} (${deleting.memberNo})? Their memberships, attendance and payment history go with them, and this cannot be undone.`}
          busy={deletingBusy}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}

      {/* QR Code Modal */}
      {qrMember && (
        <MemberQrModal member={qrMember} onClose={() => setQrMember(null)} />
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
