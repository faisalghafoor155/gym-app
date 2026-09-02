import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SubscriptionProvider, useSubscription } from './context/SubscriptionContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AcceptInvite from './pages/AcceptInvite';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Attendance from './pages/Attendance';
import Payments from './pages/Payments';
import MonthlyCollection from './pages/MonthlyCollection';
import AuditLog from './pages/AuditLog';
import Expenses from './pages/Expenses';
import Plans from './pages/Plans';
import MembershipPlans from './pages/MembershipPlans';
import Supplements from './pages/Supplements';
import SupplementSales from './pages/SupplementSales';
import Team from './pages/Team';
import Trainers from './pages/Trainers';
import Classes from './pages/Classes';
import MyPortal from './pages/MyPortal';
import Security from './pages/Security';
import Analytics from './pages/Analytics';
import Subscription from './pages/Subscription';
import { Spinner } from './components/ui';

/** The whole-app boot state, before the session is known. */
function BootSpinner() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 dark:bg-slate-950">
      <Spinner />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuth, loading } = useAuth();
  if (loading) return <BootSpinner />;
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
}

/** Owner or staff — the pages that run the gym. */
function StaffRoute({ children }: { children: ReactNode }) {
  const { isAuth, isStaff, loading } = useAuth();
  if (loading) return <BootSpinner />;
  if (!isAuth) return <Navigate to="/login" replace />;
  if (!isStaff) return <Navigate to="/my" replace />;
  return <>{children}</>;
}

import { hasPermission, type PermissionRequirements } from './utils/permissions';
import type { PlanFeatures } from './utils/entitlements';

function PermissionRoute({ children, action }: { children: ReactNode; action: keyof PermissionRequirements }) {
  const { isAuth, isStaff, isOwner, user, loading } = useAuth();
  if (loading) return <BootSpinner />;
  if (!isAuth) return <Navigate to="/login" replace />;
  if (!isStaff) return <Navigate to="/my" replace />;
  
  const allowed = isOwner || (user?.staffPermission && hasPermission(user.role, user.staffPermission, action));
  if (!allowed) return <Navigate to="/dashboard" replace />;
  
  return <>{children}</>;
}

/**
 * A page whose feature the gym's plan may not include.
 *
 * Sent to the dashboard rather than shown an upgrade screen, which matches
 * what `PermissionRoute` does with a page somebody may not see: the sidebar
 * already hides the link, so arriving here means a typed URL or a stale tab,
 * and neither is worth a sales page. The API refuses it regardless.
 *
 * Waits for the plan to load before deciding. Without that, a refresh on
 * `/analytics` would bounce a paying gym to the dashboard while the fetch was
 * still in flight.
 */
function FeatureRoute({ children, feature }: { children: ReactNode; feature: keyof PlanFeatures }) {
  const { isAuth, isStaff, loading } = useAuth();
  const { has, loading: planLoading } = useSubscription();
  if (loading || planLoading) return <BootSpinner />;
  if (!isAuth) return <Navigate to="/login" replace />;
  if (!isStaff) return <Navigate to="/my" replace />;
  if (!has(feature)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Owner only — account management and ownership. */
function OwnerRoute({ children }: { children: ReactNode }) {
  const { isAuth, isOwner, isStaff, loading } = useAuth();
  if (loading) return <BootSpinner />;
  if (!isAuth) return <Navigate to="/login" replace />;
  if (!isOwner) return <Navigate to={isStaff ? '/dashboard' : '/my'} replace />;
  return <>{children}</>;
}

/**
 * The boundary that sits inside the app chrome.
 *
 * `key` is what makes it recoverable: React discards a component's state when
 * its key changes, so navigating to another page gives this a fresh instance
 * with no error. Calling reset from inside the boundary could not achieve the
 * same thing — it would clear the error and immediately re-render the page
 * that just threw.
 */
function PageErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
}

/** Members have no gym dashboard, so "/" means different things per role. */
function HomeRedirect() {
  const { isStaff, loading } = useAuth();
  if (loading) return <BootSpinner />;
  return <Navigate to={isStaff ? '/dashboard' : '/my'} replace />;
}

function AppRoutes() {
  const { isAuth } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuth ? <HomeRedirect /> : <Login />} />
      <Route path="/register" element={isAuth ? <HomeRedirect /> : <Register />} />
      <Route path="/forgot-password" element={isAuth ? <HomeRedirect /> : <ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Public: the invitee has no session yet, and is signed in on accept. */}
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              {/*
                A second boundary inside the chrome, so one broken page leaves
                the sidebar and nav standing and the user can walk away from it
                — the outer boundary would replace the whole window instead.

                Keyed on the path so navigating away clears the error. Without
                that the boundary keeps rendering its fallback after the route
                changes, and every link looks broken once any page is.
              */}
              <PageErrorBoundary>
              <Routes>
                <Route path="/my" element={<MyPortal />} />
                {/* Every role — the second factor guards an account, not a job. */}
                <Route path="/security" element={<Security />} />
                 <Route path="/dashboard" element={<StaffRoute><Dashboard /></StaffRoute>} />
                <Route path="/attendance" element={<PermissionRoute action="canViewAttendance"><Attendance /></PermissionRoute>} />
                {/* Both gates: whether this person may see reports, and
                    whether the gym's plan includes them. */}
                <Route path="/analytics" element={<PermissionRoute action="canViewReports"><FeatureRoute feature="analytics"><Analytics /></FeatureRoute></PermissionRoute>} />
                <Route path="/plans" element={<PermissionRoute action="canManagePlans"><Plans /></PermissionRoute>} />
                <Route path="/membership-plans" element={<PermissionRoute action="canManageMemberships"><MembershipPlans /></PermissionRoute>} />
                <Route path="/supplements" element={<PermissionRoute action="canManageSupplements"><Supplements /></PermissionRoute>} />
                {/* A report of what the gym earns, rather than a till — so it
                    stays owner-only, matching what the API enforces. */}
                <Route path="/supplement-sales" element={<OwnerRoute><SupplementSales /></OwnerRoute>} />
                <Route path="/members" element={<PermissionRoute action="canManageMembers"><Members /></PermissionRoute>} />
                {/* Open to staff so the counter can take a fee. The page is not
                    the same for both: the API narrows staff to their own
                    entries and withholds the gym's totals. */}
                <Route path="/payments" element={<PermissionRoute action="canViewPayments"><Payments /></PermissionRoute>} />
                {/* Who paid in a given month — the gym's collection rather
                    than one counter's takings, so owner-only like the API. */}
                <Route path="/monthly-collection" element={<OwnerRoute><MonthlyCollection /></OwnerRoute>} />
                {/* Owner-only, matching the API: the trail names which member
                    of staff did what. */}
                <Route path="/audit-log" element={<OwnerRoute><AuditLog /></OwnerRoute>} />
                {/* Permission-gated rather than owner-only: an accountant keeps
                    the books too, and the API gates it the same way. */}
                <Route path="/expenses" element={<PermissionRoute action="canManageExpenses"><Expenses /></PermissionRoute>} />
                <Route path="/team" element={<OwnerRoute><Team /></OwnerRoute>} />
                {/* Owner-only: what the gym pays for is a billing matter. */}
                <Route path="/subscription" element={<OwnerRoute><Subscription /></OwnerRoute>} />
                <Route path="/trainers" element={<PermissionRoute action="canManageTrainers"><Trainers /></PermissionRoute>} />
                <Route path="/classes" element={<PermissionRoute action="canManageClasses"><Classes /></PermissionRoute>} />
                <Route path="*" element={<HomeRedirect />} />
              </Routes>
              </PageErrorBoundary>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Inside the auth provider: the endpoint is behind `auth`, and there
            is no gym to have a plan until somebody is signed in. */}
        <SubscriptionProvider>
          <AppRoutes />
        </SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

