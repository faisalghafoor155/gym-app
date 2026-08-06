import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../hooks/useDialog';
import {
  LayoutDashboard, Users, CalendarCheck, CreditCard,
  Dumbbell, LogOut, Shield, User, FlaskConical, Menu, X, UserCog, Crown,
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
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/plans', label: 'Plans', icon: Dumbbell },
  { to: '/supplements', label: 'Supplements', icon: FlaskConical },
];

/** Owner-only entries, appended after the staff ones. */
const ownerNavItems: NavItem[] = [
  { to: '/team', label: 'Team & Access', icon: UserCog },
];

const memberNavItems: NavItem[] = [
  { to: '/my', label: 'My Membership', icon: User },
];

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

  const navItems = isStaff
    ? [...staffNavItems, ...(isOwner ? ownerNavItems : [])]
    : memberNavItems;

  const sidebar = (
    <>
      {/* Gym Info */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <Dumbbell className="text-white" size={18} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight truncate">{gym?.name || 'GymPro'}</p>
            <p className="text-xs text-gray-400 truncate">{gym?.ownerName}</p>
          </div>
        </div>

        <div className="mt-3">
          {isOwner ? (
            <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full border border-purple-100">
              <Crown size={10} /> Owner
            </span>
          ) : isStaff ? (
            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-100">
              <Shield size={10} /> Staff
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 text-xs font-bold px-2.5 py-1 rounded-full">
              <User size={10} /> Member
            </span>
          )}
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
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-gray-100">
        {user?.email && (
          <p className="text-xs text-gray-400 px-3 mb-2 truncate">{user.email}</p>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors"
        >
          <LogOut size={17} />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh bg-gray-50">

      {/* Desktop sidebar — always present from lg up */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-100 flex-col shadow-sm shrink-0">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="relative flex flex-col w-72 max-w-[85vw] h-full bg-white shadow-xl"
          >
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={20} />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 bg-white border-b border-gray-100 px-4 py-3 shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="text-gray-600 hover:text-gray-900 p-1 -ml-1"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <Dumbbell className="text-white" size={15} />
            </div>
            <p className="font-bold text-gray-900 text-sm truncate">{gym?.name || 'GymPro'}</p>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
