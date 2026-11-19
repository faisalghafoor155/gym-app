import { useEffect, useState, type ReactNode } from 'react';
import CommandPalette from './CommandPalette';
import BranchSwitcher from './BranchSwitcher';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../hooks/useDialog';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { useLanguage } from '../context/LanguageContext';
import OfflineBanner from './OfflineBanner';
import VerifyEmailBanner from './VerifyEmailBanner';
import InstallBanner from './InstallBanner';
import InstallButton from './InstallButton';
import { hasPermission, type PermissionRequirements } from '../utils/permissions';
import { useSubscription } from '../context/SubscriptionContext';
import { SUBSCRIPTIONS_ENABLED, type PlanFeatures } from '../utils/entitlements';
import {
  LayoutDashboard, Users, CalendarCheck, CreditCard,
  LogOut, Shield, ShieldCheck, User, FlaskConical, Menu, X, UserCog, Crown, Tag,
  BarChart3, CalendarRange, Award, Calendar, Wallet, ScrollText, Sparkles, Calculator,
  HandCoins, ClipboardList, Ticket, Gift, UserX, KeyRound, ChevronDown, Settings, PhoneCall, Banknote, UserCheck, Wrench, MessageSquareHeart, Trophy,
  Search, PanelLeftClose, PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const staffNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/members', label: 'Members', icon: Users },
  // Before they are members: who asked, and who to ring back today.
  { to: '/leads', label: 'Leads & Enquiries', icon: PhoneCall },
  // Next to Members: an enquiry is a member who has not happened yet.
  { to: '/referrals', label: 'Referrals', icon: Gift },
  // What members think of the gym, and complaints waiting for a reply.
  { to: '/feedback', label: 'Feedback', icon: MessageSquareHeart },
  // Streaks and weight-loss contests that keep members coming back.
  { to: '/challenges', label: 'Challenges', icon: Trophy },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
  // Staff coming and going, checked in at the same desk as members.
  { to: '/staff-attendance', label: 'Staff Attendance', icon: UserCheck },
  // Paying members who stopped coming — the list to call before they lapse.
  { to: '/inactive', label: 'Inactive Members', icon: UserX },
  // Two different kinds of "plan": what a member buys, and what they train
  // to. Labelled apart so the sidebar does not read as a duplicate.
  { to: '/membership-plans', label: 'Membership Plans', icon: Tag },
  { to: '/promo-codes', label: 'Promo Codes', icon: Ticket },
  { to: '/plans', label: 'Workout & Diet Plans', icon: ClipboardList },
  { to: '/calculator', label: 'Fitness Calculator', icon: Calculator },
  { to: '/supplements', label: 'Supplements', icon: FlaskConical },
  // Machines and their upkeep. Open to all staff, who report faults here.
  { to: '/equipment', label: 'Equipment', icon: Wrench },
  // Taking a fee is counter work, so the page is staff's. What they see on it
  // is not: the server narrows their list to the payments they recorded
  // themselves, and refuses them the gym's totals outright.
  { to: '/payments', label: 'Payments', icon: CreditCard },
  // Who still owes part of a fee — the list the counter collects from.
  { to: '/dues', label: 'Pending Dues', icon: HandCoins },
  // Walk-ins and guests who pay for one visit, outside any membership.
  { to: '/day-passes', label: 'Day Passes', icon: Ticket },
  // Not in the owner-only list below, because an accountant needs it too —
  // the permission gate rather than the role is what decides who sees it.
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  // Who the gym pays each month; payday lands in Expenses as salaries.
  { to: '/salaries', label: 'Staff Salaries', icon: Banknote },
  { to: '/trainers', label: 'Trainers & PT', icon: Award },
  { to: '/lockers', label: 'Lockers', icon: KeyRound },
  { to: '/classes', label: 'Classes & Schedules', icon: Calendar },
];

/**
 * Owner-only entries, appended after the staff ones.
 *
 * The gym's books rather than the day's work — what it has taken in, and who
 * may sign in. Hiding the links is only the polite half of that; the routes
 * themselves are gated server-side.
 */
const ownerNavItems: NavItem[] = [
  // Sits next to Payments in the owner's half of the nav: the counter records
  // fees there, and this is where the month those fees add up to gets read.
  { to: '/monthly-collection', label: 'Monthly Collection', icon: CalendarRange },
  { to: '/supplement-sales', label: 'Supplement Sales', icon: BarChart3 },
  // Named for what the owner comes here to do — add a helper — rather than for
  // the abstraction. "Team & Access" read as settings, so nobody found it.
  { to: '/team', label: 'Staff & Logins', icon: UserCog },
  // Last in the owner's half: it is what you open when you want to know who
  // did something, which is rarely and after the fact.
  { to: '/audit-log', label: 'Audit Log', icon: ScrollText },
  // What the gym is paying for and how close it is to each ceiling. Owner's,
  // because changing it is a billing conversation.
  ...(SUBSCRIPTIONS_ENABLED ? [{ to: '/subscription', label: 'Plan & Usage', icon: Sparkles }] : []),
];

const memberNavItems: NavItem[] = [
  { to: '/my', label: 'My Membership', icon: User },
  { to: '/calculator', label: 'Fitness Calculator', icon: Calculator },
];

/** Account security is everyone's, so it trails whatever list the role gets. */
/** The operator's overview of every gym; only an account on the server's admin list sees it. */
const platformNavItem: NavItem = { to: '/platform', label: 'Platform', icon: Crown };

const securityNavItem: NavItem = { to: '/security', label: 'Security', icon: ShieldCheck };

/**
 * How the sidebar folds. Pages that answer the same kind of question sit under
 * one heading, so twenty-odd links read as a handful of sections.
 *
 * Only grouping: which links a person sees is still decided by role and
 * permission above. A group left with a single visible link renders as that
 * link alone — a heading over one row is a click for nothing. Anything not
 * listed here stays at the top level.
 */
const NAV_GROUPS: { label: string; icon: LucideIcon; paths: string[] }[] = [
  { label: 'Members', icon: Users, paths: ['/members', '/leads', '/inactive', '/referrals', '/lockers', '/feedback', '/challenges'] },
  { label: 'Attendance', icon: CalendarCheck, paths: ['/attendance', '/staff-attendance'] },
  { label: 'Payments', icon: CreditCard, paths: ['/payments', '/dues', '/day-passes', '/monthly-collection', '/expenses', '/salaries'] },
  { label: 'Plans', icon: Tag, paths: ['/membership-plans', '/promo-codes', '/plans'] },
  { label: 'Supplements', icon: FlaskConical, paths: ['/supplements', '/supplement-sales'] },
  { label: 'Training', icon: Award, paths: ['/trainers', '/classes', '/calculator'] },
  { label: 'Settings', icon: Settings, paths: ['/team', '/audit-log', '/subscription', '/security'] },
];

/**
 * Each section's colour, for its icon tile. Finding "Payments" among twenty
 * rows is faster when it is always the green one; the active row still wears
 * the brand gradient whatever its section.
 */
const TONE: Record<string, string> = {
  Dashboard: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Analytics: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  Members: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  Attendance: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  Payments: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  Plans: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  Supplements: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  Training: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  Equipment: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300',
  Settings: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
};
const toneOf = (label: string) => TONE[label] ?? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300';

/** Where the sidebar remembers being folded to icons. */
const COLLAPSE_KEY = 'gymflow.sidebar.collapsed';

type NavEntry =
  | { kind: 'link'; item: NavItem }
  | { kind: 'group'; label: string; icon: LucideIcon; items: NavItem[] };

/** Folds the visible links into groups, each placed where its first link was. */
const groupNav = (items: NavItem[]): NavEntry[] => {
  const entries: NavEntry[] = [];
  const placed = new Set<string>();
  for (const item of items) {
    if (placed.has(item.to)) continue;
    const group = NAV_GROUPS.find(g => g.paths.includes(item.to));
    const members = group
      ? group.paths.flatMap(path => items.filter(i => i.to === path))
      : [];
    if (!group || members.length < 2) {
      entries.push({ kind: 'link', item });
      placed.add(item.to);
      continue;
    }
    members.forEach(m => placed.add(m.to));
    entries.push({ kind: 'group', label: group.label, icon: group.icon, items: members });
  }
  return entries;
};

export default function Layout({ children }: { children: ReactNode }) {
  const { gym, user, logout, isStaff, isOwner } = useAuth();
  const { t } = useLanguage();
  const { has } = useSubscription();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Desktop only: the sidebar folded down to a rail of icons.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const toggleCollapsed = () => setCollapsed(c => {
    try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* ignore */ }
    return !c;
  });
  // Ctrl+K / ⌘K opens the page search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Groups opened by hand. The one holding the current page is open regardless,
  // so landing on a deep link never hides where you are.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (label: string) => setOpenGroups(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  // Tapping a nav link should reveal the page, not leave the drawer covering it.
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const drawerRef = useDialog(drawerOpen, () => setDrawerOpen(false));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItemPermissions: Record<string, keyof PermissionRequirements> = {
    '/members': 'canManageMembers',
    '/referrals': 'canManageMembers',
    '/leads': 'canManageMembers',
    '/lockers': 'canManageMembers',
    '/inactive': 'canViewAttendance',
    '/promo-codes': 'canManageMemberships',
    '/plans': 'canManagePlans',
    '/attendance': 'canViewAttendance',
    '/staff-attendance': 'canCheckIn',
    '/feedback': 'canManageMembers',
    '/challenges': 'canManageMembers',
    '/analytics': 'canViewReports',
    '/membership-plans': 'canManageMemberships',
    '/supplements': 'canManageSupplements',
    '/payments': 'canViewPayments',
    '/dues': 'canViewPayments',
    '/day-passes': 'canRecordPayments',
    '/expenses': 'canManageExpenses',
    '/salaries': 'canManageExpenses',
    '/trainers': 'canManageTrainers',
    '/classes': 'canManageClasses',
  };

  /**
   * Nav entries whose page needs a feature the plan may not include.
   *
   * Hidden rather than shown-and-refused: a link that leads to "upgrade to see
   * this" teaches people to distrust the sidebar. The route itself still
   * checks, and the API refuses regardless — this is the courtesy half.
   */
  const navItemFeatures: Record<string, keyof PlanFeatures> = {
    '/analytics': 'analytics',
  };

  const navItems = [
    ...(user?.isPlatformAdmin ? [platformNavItem] : []),
    ...(isStaff
      ? [
          ...staffNavItems.filter(item => {
            const reqFeature = navItemFeatures[item.to];
            if (reqFeature && !has(reqFeature)) return false;

            const reqPerm = navItemPermissions[item.to];
            if (!reqPerm) return true; // dashboard is always allowed
            return isOwner || (user?.staffPermission && hasPermission(user.role, user.staffPermission, reqPerm));
          }),
          ...(isOwner ? ownerNavItems : [])
        ]
      : memberNavItems),
    securityNavItem,
  ];

  // The breadcrumb names the page by its sidebar label, so it follows the
  // language along with the sidebar.
  const currentNav = [...staffNavItems, ...ownerNavItems, ...memberNavItems, platformNavItem, securityNavItem]
    .find(i => i.to === pathname);

  /**
   * One nav row. `tone` is its section's colour; a row inside a group passes
   * none and gets a small dot instead of a tile, so the group reads as one
   * block. The active row wears the brand gradient — the one thing on the
   * sidebar you find without reading.
   */
  const renderLink = ({ to, label, icon: Icon }: NavItem, opts: { tone?: string; rail?: boolean } = {}) => (
    <NavLink
      key={to}
      to={to}
      title={opts.rail ? t(label) : undefined}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl text-[13.5px] font-medium transition-all duration-150 ${
          opts.rail ? 'justify-center p-2' : opts.tone ? 'px-2 py-1.5' : 'px-3 py-2'
        } ${
          isActive
            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-600/25'
            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {opts.tone || opts.rail ? (
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-[transform,background-color,color] duration-200 group-hover:scale-110 group-hover:-rotate-3 ${
              isActive ? 'bg-white/20 text-white' : opts.tone ?? toneOf(label)}`}>
              <Icon size={16} strokeWidth={2.2} />
            </span>
          ) : (
            <Icon size={16} strokeWidth={2.1} aria-hidden="true" className={`shrink-0 transition-[transform,color] duration-200 group-hover:scale-110 ${
              isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-200'}`} />
          )}
          {!opts.rail && (
            <span className={`truncate transition-transform duration-200 ${isActive ? '' : 'group-hover:translate-x-0.5'}`}>{t(label)}</span>
          )}
        </>
      )}
    </NavLink>
  );

  const roleBadge = isOwner ? (
    <span className="shrink-0 inline-flex items-center gap-1 bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
      <Crown size={9} /> {t('Owner')}
    </span>
  ) : isStaff ? (
    <span className="shrink-0 inline-flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
      <Shield size={9} /> {t('Staff')}
    </span>
  ) : (
    <span className="shrink-0 inline-flex items-center gap-1 bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
      <User size={9} /> {t('Member')}
    </span>
  );

  const gymLogo = (className: string) => (
    <div className={`${className} bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 overflow-hidden`}>
      <img src={gym?.logo || '/logo.svg'} alt={gym?.logo ? gym.name : 'GymFlow'} className="w-full h-full object-cover" />
    </div>
  );

  const sidebar = (
    <>
      {/* Gym Info */}
      <div className={collapsed ? 'hidden lg:flex flex-col items-center gap-3 pt-5 pb-3' : 'hidden'}>
        {gymLogo('w-10 h-10 rounded-xl ring-1 ring-black/5 shadow-md dark:ring-white/10')}
        <button type="button" onClick={() => setPaletteOpen(true)} title={t('Search pages…')}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-400">
          <Search size={17} />
        </button>
      </div>
      <div className={`px-4 pt-5 pb-3 ${collapsed ? 'lg:hidden' : ''}`}>
        <div className="flex items-center gap-3 p-2 -m-2 rounded-xl">
          {gymLogo('w-11 h-11 rounded-2xl ring-2 ring-white shadow-lg shadow-blue-600/20 dark:ring-white/10 dark:shadow-black/30')}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight truncate font-heading">{gym?.name || 'GymFlow'}</p>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] shrink-0" title={t('System Online')} />
            </div>
            <div className="flex items-center gap-1.5 mt-1 min-w-0">
              {roleBadge}
              <p className="text-[11px] text-slate-500 dark:text-slate-500 truncate">{gym?.ownerName || t('Fitness Portal')}</p>
            </div>
          </div>
        </div>
        {user?.role !== 'member' && <BranchSwitcher />}
        {/* Page search: the quickest way to any of twenty-odd pages. */}
        <button type="button" onClick={() => setPaletteOpen(true)}
          className="mt-3 w-full flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white hover:border-slate-300 px-3 py-2 text-left text-xs text-slate-400 transition-colors dark:bg-white/[0.03] dark:border-white/10 dark:hover:bg-white/[0.06]">
          <Search size={14} />
          <span className="flex-1">{t('Search pages…')}</span>
          <kbd className="font-sans text-[10px] font-semibold text-slate-400 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5">Ctrl K</kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className={`flex-1 pb-3 space-y-1 overflow-y-auto sidebar-scroll ${collapsed ? 'px-3 lg:px-2.5' : 'px-3'}`}>
        <p className={`px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-600 ${collapsed ? 'lg:hidden' : ''}`}>{t('Menu')}</p>
        {groupNav(navItems).map(entry => {
          if (entry.kind === 'link') {
            return (
              <div key={entry.item.to}>
                <div className={collapsed ? 'lg:hidden' : ''}>{renderLink(entry.item, { tone: toneOf(entry.item.label) })}</div>
                {collapsed && <div className="hidden lg:block">{renderLink(entry.item, { rail: true })}</div>}
              </div>
            );
          }
          const holdsCurrent = entry.items.some(i => pathname.startsWith(i.to));
          const open = holdsCurrent || openGroups.has(entry.label);
          const GroupIcon = entry.icon;
          return (
            <div key={entry.label}>
              {/* Folded to a rail, a section is its icon: a tap unfolds the
                  sidebar with the section open. */}
              {collapsed && (
                <button type="button" title={t(entry.label)}
                  onClick={() => { toggleCollapsed(); if (!open) toggleGroup(entry.label); }}
                  className={`hidden lg:flex w-full justify-center p-2 rounded-xl transition-colors ${holdsCurrent ? 'bg-blue-50 dark:bg-white/10' : 'hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    holdsCurrent ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-600/25' : toneOf(entry.label)}`}>
                    <GroupIcon size={16} strokeWidth={2.2} />
                  </span>
                </button>
              )}
              <div className={collapsed ? 'lg:hidden' : ''}>
                <button
                  type="button"
                  onClick={() => toggleGroup(entry.label)}
                  aria-expanded={open}
                  className={`group w-full flex items-center gap-3 px-2 py-1.5 rounded-xl text-[13.5px] font-semibold transition-colors ${
                    holdsCurrent
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${toneOf(entry.label)}`}>
                    <GroupIcon size={16} strokeWidth={2.2} />
                  </span>
                  <span className="flex-1 text-left">{t(entry.label)}</span>
                  <ChevronDown size={14} className={`shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </button>
                {/* Grid rows 0fr → 1fr is the one way to animate to an
                    unknown height in CSS; `inert` keeps the folded links out
                    of the tab order. */}
                <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                  inert={!open}>
                  <div className="overflow-hidden">
                    <div className="mt-1 mb-1.5 ml-[1.45rem] pl-2 border-l-2 border-slate-100 dark:border-white/10 space-y-0.5">
                      {entry.items.map(i => renderLink(i))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom: fold the sidebar (desktop), who is signed in, the way out */}
      <div className="hidden lg:block px-3 pt-2">
        <button type="button" onClick={toggleCollapsed}
          title={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}
          className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/5 dark:hover:text-slate-200 transition-colors ${collapsed ? 'justify-center px-0' : ''}`}>
          {collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} /> {t('Collapse sidebar')}</>}
        </button>
      </div>
      <div className={`p-3 border-t border-slate-200/70 dark:border-white/5 ${collapsed ? 'lg:px-2' : ''}`}>
        <div className={`flex items-center gap-3 p-2 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/80 shadow-xs dark:from-white/[0.05] dark:to-white/[0.02] dark:border-white/5 ${collapsed ? 'lg:flex-col lg:gap-2 lg:p-1.5' : ''}`}>
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-md shadow-blue-600/20">
            {(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900" aria-hidden="true" />
          </div>
          <div className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
            <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">{user?.name || user?.email}</p>
            {user?.email && <p className="text-[11px] text-slate-500 truncate">{user.email}</p>}
          </div>
          <button
            onClick={handleLogout}
            aria-label={t('Logout')}
            title={t('Logout')}
            className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400 transition-colors shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  const bottomLinks: { to: string; label: string; icon: LucideIcon }[] = isStaff
    ? [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/members', label: 'Members', icon: Users },
        { to: '/attendance', label: 'Check-in', icon: CalendarCheck },
        { to: '/payments', label: 'Payments', icon: CreditCard },
      ]
    : [
        { to: '/my', label: 'My Pass', icon: User },
        { to: '/calculator', label: 'Fitness', icon: Calculator },
        { to: '/security', label: 'Security', icon: ShieldCheck },
      ];

  return (
    <div className="app-canvas flex h-dvh">

      {/* Desktop sidebar — always present from lg up */}
      <aside className={`hidden lg:flex ${collapsed ? 'w-[76px]' : 'w-[272px]'} flex-col shrink-0 transition-[width] duration-200 bg-white/85 backdrop-blur-xl border-r border-slate-200/70 dark:bg-slate-950/80 dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/40 dark:border-white/5`}>
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('Navigation menu')}
            className="relative flex flex-col w-72 max-w-[85vw] h-full bg-white dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/40 shadow-2xl z-10"
          >
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label={t('Close navigation menu')}
              className="absolute top-5 right-3 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/10 p-1.5 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Above the mobile top bar and the content both: it applies to the
            whole app, not to whatever page happens to be open. */}
        <OfflineBanner />
        <VerifyEmailBanner />

        {/* Only ever rendered inside the app, so it cannot appear over the
            login or invite-acceptance screens — those do not use Layout. */}
        <InstallBanner />

        {/* Universal Top Header Bar (Mobile + Desktop) */}
        <header className="flex items-center justify-between gap-2 sm:gap-3 h-14 sm:h-16 bg-white/75 backdrop-blur-xl border-b border-slate-200/70 dark:bg-slate-900/75 dark:border-slate-800 px-3.5 sm:px-6 shrink-0 z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label={t('Open navigation menu')}
              className="lg:hidden text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 p-1.5 -ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 lg:hidden min-w-0">
              {gymLogo('w-7 h-7 sm:w-8 sm:h-8 rounded-lg')}
              <p className="font-bold text-gray-900 dark:text-slate-100 text-sm truncate font-heading">{gym?.name || 'GymFlow'}</p>
            </div>
            {/* Desktop: where you are, as a title with its trail above it */}
            <div className="hidden lg:flex items-center gap-3 min-w-0">
              {currentNav && (
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${toneOf(currentNav.label)}`}>
                  <currentNav.icon size={17} strokeWidth={2.2} />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate">
                  {gym?.name || 'GymFlow'}
                </p>
                <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-tight capitalize truncate font-heading">
                  {currentNav ? t(currentNav.label) : pathname.replace('/', '').replace(/-/g, ' ') || t('Dashboard')}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button type="button" onClick={() => setPaletteOpen(true)} aria-label={t('Search pages…')}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 hover:bg-white px-2.5 sm:px-3 py-2 text-xs text-slate-400 transition-colors dark:bg-slate-800/60 dark:border-slate-700 dark:hover:bg-slate-800">
              <Search size={15} />
              <span className="hidden md:inline pr-6">{t('Search pages…')}</span>
              <kbd className="hidden md:inline font-sans text-[10px] font-semibold border border-slate-200 dark:border-slate-600 rounded px-1.5">Ctrl K</kbd>
            </button>
            <div className="hidden 2xl:flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-200/70 dark:border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t('Online')}
            </div>
            <LanguageToggle />
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <InstallButton variant="navbar" />
            {user?.name && (
              <div className="hidden sm:flex items-center gap-2 pl-3 ml-0.5 border-l border-slate-200 dark:border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm ring-2 ring-white dark:ring-slate-900 shadow-md shadow-blue-600/20">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden md:block leading-tight">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[130px]">{user.name}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {t(isOwner ? 'Owner' : isStaff ? 'Staff' : 'Member')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto pb-24 lg:pb-0">
          <div key={pathname} className="animate-page">{children}</div>
        </main>

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          items={navItems.map(i => ({
            ...i,
            group: NAV_GROUPS.find(g => g.paths.includes(i.to))?.label,
          }))}
        />

        {/* Mobile Bottom Navigation Bar for Instant 1-Tap Switching */}
        <nav
          aria-label={t('Mobile navigation')}
          className="mobile-bottom-nav lg:hidden fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] inset-x-3 z-30 bg-white/90 backdrop-blur-xl dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-[0_10px_30px_-8px_rgba(15,23,42,0.25)] px-1.5 py-1.5 flex items-center justify-around"
        >
          {bottomLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[10.5px] font-semibold transition-all ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`px-3.5 py-1 rounded-xl transition-all ${isActive ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-600/30 animate-pop' : ''}`}>
                    <Icon size={18} />
                  </div>
                  <span className="mt-0.5 tracking-tight">{t(label)}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[10.5px] font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 active:scale-95 transition-all"
          >
            <div className="px-3 py-1 rounded-full">
              <Menu size={18} />
            </div>
            <span className="mt-0.5 tracking-tight">{t('More')}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
