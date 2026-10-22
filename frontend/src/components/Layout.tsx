import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../hooks/useDialog';
import ThemeToggle from './ThemeToggle';
import OfflineBanner from './OfflineBanner';
import VerifyEmailBanner from './VerifyEmailBanner';
import InstallBanner from './InstallBanner';
import InstallButton from './InstallButton';
import { hasPermission, type PermissionRequirements } from '../utils/permissions';
import { useSubscription } from '../context/SubscriptionContext';
import { SUBSCRIPTIONS_ENABLED, type PlanFeatures } from '../utils/entitlements';
import {
  LayoutDashboard, Users, CalendarCheck, CreditCard,
  Dumbbell, LogOut, Shield, ShieldCheck, User, FlaskConical, Menu, X, UserCog, Crown, Tag,
  BarChart3, CalendarRange, Award, Calendar, Wallet, ScrollText, Sparkles, Calculator,
  UserPlus, HandCoins, type LucideIcon,
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
  // Next to Members: an enquiry is a member who has not happened yet.
  { to: '/leads', label: 'Leads & Enquiries', icon: UserPlus },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
  // Two different kinds of "plan": what a member buys, and what they train
  // to. Labelled apart so the sidebar does not read as a duplicate.
  { to: '/membership-plans', label: 'Membership Plans', icon: Tag },
  { to: '/calculator', label: 'Fitness Calculator', icon: Calculator },
  { to: '/supplements', label: 'Supplements', icon: FlaskConical },
  // Taking a fee is counter work, so the page is staff's. What they see on it
  // is not: the server narrows their list to the payments they recorded
  // themselves, and refuses them the gym's totals outright.
  { to: '/payments', label: 'Payments', icon: CreditCard },
  // Who still owes part of a fee — the list the counter collects from.
  { to: '/dues', label: 'Pending Dues', icon: HandCoins },
  // Not in the owner-only list below, because an accountant needs it too —
  // the permission gate rather than the role is what decides who sees it.
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/trainers', label: 'Trainers & PT', icon: Award },
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
const securityNavItem: NavItem = { to: '/security', label: 'Security', icon: ShieldCheck };

export default function Layout({ children }: { children: ReactNode }) {
  const { gym, user, logout, isStaff, isOwner } = useAuth();
  const { has } = useSubscription();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Tapping a nav link should reveal the page, not leave the drawer covering it.
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const drawerRef = useDialog(drawerOpen, () => setDrawerOpen(false));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItemPermissions: Record<string, keyof PermissionRequirements> = {
    '/members': 'canManageMembers',
    '/leads': 'canManageMembers',
    '/attendance': 'canViewAttendance',
    '/analytics': 'canViewReports',
    '/membership-plans': 'canManageMemberships',
    '/supplements': 'canManageSupplements',
    '/payments': 'canViewPayments',
    '/dues': 'canViewPayments',
    '/expenses': 'canManageExpenses',
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

  const sidebar = (
    <>
      {/* Gym Info */}
      <div className="p-5 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-blue-600/30 ring-2 ring-white/20 dark:ring-white/10 overflow-hidden">
            {gym?.logo ? (
              <img src={gym.logo} alt={gym.name} className="w-full h-full object-cover" />
            ) : (
              <Dumbbell className="text-white" size={20} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-extrabold text-gray-900 dark:text-slate-100 text-sm leading-tight truncate font-heading">{gym?.name || 'GymPro'}</p>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" title="System Online" />
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">{gym?.ownerName || 'Fitness Portal'}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          {isOwner ? (
            <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 text-xs font-bold px-2.5 py-1 rounded-full border border-purple-100 dark:border-purple-500/20 shadow-2xs">
              <Crown size={11} /> Owner
            </span>
          ) : isStaff ? (
            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-100 dark:border-blue-500/20 shadow-2xs">
              <Shield size={11} /> Staff
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400 text-xs font-bold px-2.5 py-1 rounded-full shadow-2xs">
              <User size={11} /> Member
            </span>
          )}
          <ThemeToggle />
        </div>

        <div className="mt-3">
          <InstallButton variant="sidebar" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/25'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* A short rail on the left edge of the active row. The filled
                    pill alone says which page you are on; against a long nav
                    the rail is what you find without reading, because it is
                    the only mark that breaks the column's left margin. */}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-white/80
                    transition-all ${isActive ? 'h-5 opacity-100' : 'h-0 opacity-0'}`}
                />
                <Icon
                  size={17}
                  className={`shrink-0 transition-transform ${isActive ? '' : 'group-hover:scale-110'}`}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-gray-100 dark:border-slate-800">
        {user?.email && (
          <p className="text-xs text-gray-400 dark:text-slate-500 px-3 mb-2 truncate">{user.email}</p>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/15 dark:hover:text-red-400 w-full transition-all active:scale-[0.98]"
        >
          <LogOut size={17} />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh bg-gray-50 dark:bg-slate-950">

      {/* Desktop sidebar — always present from lg up */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 dark:bg-slate-900 dark:border-slate-800 flex-col shadow-sm shrink-0">
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
            aria-label="Navigation menu"
            className="relative flex flex-col w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 shadow-2xl z-10"
          >
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-4 right-4 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
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
        <header className="flex items-center justify-between gap-2 sm:gap-3 bg-white border-b border-gray-200 dark:bg-slate-900 dark:border-slate-800 px-3.5 sm:px-6 py-2 sm:py-2.5 shrink-0 z-20 shadow-2xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 p-1.5 -ml-1 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 lg:hidden min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm shadow-blue-600/25 overflow-hidden">
                {gym?.logo ? (
                  <img src={gym.logo} alt={gym.name} className="w-full h-full object-cover" />
                ) : (
                  <Dumbbell className="text-white" size={14} />
                )}
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="font-bold text-gray-900 dark:text-slate-100 text-xs sm:text-sm truncate font-heading">{gym?.name || 'GymPro'}</p>
                {pathname === '/members' && (
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 px-1.5 py-0.5 rounded-md shrink-0">
                    Members
                  </span>
                )}
              </div>
            </div>
            {/* Desktop page breadcrumb / status indicator */}
            <div className="hidden lg:flex items-center gap-2.5 text-xs">
              <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200/70 dark:border-emerald-800/40 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                <span>Online</span>
              </div>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{gym?.name || 'GymPro'}</span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="text-slate-500 dark:text-slate-400 font-medium capitalize">
                {pathname.replace('/', '').replace(/-/g, ' ') || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <InstallButton variant="navbar" />
            <div className="lg:hidden">
              <ThemeToggle />
            </div>
            {user?.name && (
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-gray-200 dark:border-slate-800 text-xs text-gray-700 dark:text-slate-200">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shadow-2xs">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <span className="font-semibold truncate max-w-[130px]">{user.name}</span>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-50/70 dark:bg-slate-950 pb-20 lg:pb-0">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar for Instant 1-Tap Switching */}
        <nav
          aria-label="Mobile navigation"
          className="mobile-bottom-nav lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 flex items-center justify-around pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          {isStaff ? (
            <>
              <NavLink
                to="/dashboard"
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
                    <div className={`p-1 rounded-lg transition-transform ${isActive ? 'bg-blue-50 dark:bg-blue-500/15 scale-110 text-blue-600 dark:text-blue-400' : ''}`}>
                      <LayoutDashboard size={18} />
                    </div>
                    <span className="mt-0.5 tracking-tight">Dashboard</span>
                  </>
                )}
              </NavLink>

              <NavLink
                to="/members"
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
                    <div className={`p-1 rounded-lg transition-transform ${isActive ? 'bg-blue-50 dark:bg-blue-500/15 scale-110 text-blue-600 dark:text-blue-400' : ''}`}>
                      <Users size={18} />
                    </div>
                    <span className="mt-0.5 tracking-tight">Members</span>
                  </>
                )}
              </NavLink>

              <NavLink
                to="/attendance"
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
                    <div className={`p-1 rounded-lg transition-transform ${isActive ? 'bg-blue-50 dark:bg-blue-500/15 scale-110 text-blue-600 dark:text-blue-400' : ''}`}>
                      <CalendarCheck size={18} />
                    </div>
                    <span className="mt-0.5 tracking-tight">Check-in</span>
                  </>
                )}
              </NavLink>

              <NavLink
                to="/payments"
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
                    <div className={`p-1 rounded-lg transition-transform ${isActive ? 'bg-blue-50 dark:bg-blue-500/15 scale-110 text-blue-600 dark:text-blue-400' : ''}`}>
                      <CreditCard size={18} />
                    </div>
                    <span className="mt-0.5 tracking-tight">Payments</span>
                  </>
                )}
              </NavLink>

              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[10.5px] font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 active:scale-95 transition-all"
              >
                <div className="p-1 rounded-lg">
                  <Menu size={18} />
                </div>
                <span className="mt-0.5 tracking-tight">More</span>
              </button>
            </>
          ) : (
            <>
              <NavLink
                to="/my"
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
                    <div className={`p-1 rounded-lg transition-transform ${isActive ? 'bg-blue-50 dark:bg-blue-500/15 scale-110 text-blue-600 dark:text-blue-400' : ''}`}>
                      <User size={18} />
                    </div>
                    <span className="mt-0.5 tracking-tight">My Pass</span>
                  </>
                )}
              </NavLink>

              <NavLink
                to="/calculator"
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
                    <div className={`p-1 rounded-lg transition-transform ${isActive ? 'bg-blue-50 dark:bg-blue-500/15 scale-110 text-blue-600 dark:text-blue-400' : ''}`}>
                      <Calculator size={18} />
                    </div>
                    <span className="mt-0.5 tracking-tight">Fitness</span>
                  </>
                )}
              </NavLink>

              <NavLink
                to="/security"
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
                    <div className={`p-1 rounded-lg transition-transform ${isActive ? 'bg-blue-50 dark:bg-blue-500/15 scale-110 text-blue-600 dark:text-blue-400' : ''}`}>
                      <ShieldCheck size={18} />
                    </div>
                    <span className="mt-0.5 tracking-tight">Security</span>
                  </>
                )}
              </NavLink>

              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[10.5px] font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 active:scale-95 transition-all"
              >
                <div className="p-1 rounded-lg">
                  <Menu size={18} />
                </div>
                <span className="mt-0.5 tracking-tight">More</span>
              </button>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
