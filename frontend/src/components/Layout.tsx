import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../hooks/useDialog';
import ThemeToggle from './ThemeToggle';
import { hasPermission, type PermissionRequirements } from '../utils/permissions';
import {
  LayoutDashboard, Users, CalendarCheck, CreditCard,
  Dumbbell, LogOut, Shield, ShieldCheck, User, FlaskConical, Menu, X, UserCog, Crown, Tag,
  BarChart3, CalendarRange, Award,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const staffNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
  // Two different kinds of "plan": what a member buys, and what they train
  // to. Labelled apart so the sidebar does not read as a duplicate.
  { to: '/membership-plans', label: 'Membership Plans', icon: Tag },
  { to: '/plans', label: 'Workout & Diet', icon: Dumbbell },
  { to: '/supplements', label: 'Supplements', icon: FlaskConical },
  // Taking a fee is counter work, so the page is staff's. What they see on it
  // is not: the server narrows their list to the payments they recorded
  // themselves, and refuses them the gym's totals outright.
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/trainers', label: 'Trainers & PT', icon: Award },
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
];

const memberNavItems: NavItem[] = [
  { to: '/my', label: 'My Membership', icon: User },
];

/** Account security is everyone's, so it trails whatever list the role gets. */
const securityNavItem: NavItem = { to: '/security', label: 'Security', icon: ShieldCheck };

export default function Layout({ children }: { children: ReactNode }) {
  const { gym, user, logout, isStaff, isOwner } = useAuth();
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
    '/attendance': 'canViewAttendance',
    '/membership-plans': 'canManageMemberships',
    '/plans': 'canManagePlans',
    '/supplements': 'canManageSupplements',
    '/payments': 'canViewPayments',
    '/trainers': 'canManageTrainers',
  };

  const navItems = [
    ...(isStaff
      ? [
          ...staffNavItems.filter(item => {
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
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <Dumbbell className="text-white" size={18} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 dark:text-slate-100 text-sm leading-tight truncate">{gym?.name || 'GymPro'}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{gym?.ownerName}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          {isOwner ? (
            <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 text-xs font-bold px-2.5 py-1 rounded-full border border-purple-100 dark:border-purple-500/20">
              <Crown size={10} /> Owner
            </span>
          ) : isStaff ? (
            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-100 dark:border-blue-500/20">
              <Shield size={10} /> Staff
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400 text-xs font-bold px-2.5 py-1 rounded-full">
              <User size={10} /> Member
            </span>
          )}
          {/* Beside the role badge rather than buried at the bottom: it is a
              setting people look for, and the sidebar header is where the rest
              of "who am I and how is this configured" already lives. */}
          <ThemeToggle />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              }`
            }
          >
            <Icon size={17} />
            {label}
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
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/15 dark:hover:text-red-400 w-full transition-colors"
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
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-100 dark:bg-slate-900 dark:border-slate-800 flex-col shadow-sm shrink-0">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40 dark:bg-black/70"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="relative flex flex-col w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 shadow-xl"
          >
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-4 right-4 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1"
            >
              <X size={20} />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 bg-white border-b border-gray-100 dark:bg-slate-900 dark:border-slate-800 px-4 py-3 shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 p-1 -ml-1"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <Dumbbell className="text-white" size={15} />
            </div>
            <p className="font-bold text-gray-900 dark:text-slate-100 text-sm truncate">{gym?.name || 'GymPro'}</p>
          </div>
          {/* On mobile the sidebar is behind a tap, so the toggle is repeated
              here — a theme switch you have to open a drawer to reach is one
              nobody finds. */}
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}
