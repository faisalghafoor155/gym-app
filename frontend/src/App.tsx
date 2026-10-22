import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SubscriptionProvider, useSubscription } from './context/SubscriptionContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { PageLoader, Spinner } from './components/ui';

/**
 * Every page is loaded on demand rather than imported up front.
 *
 * Eagerly, the whole app was one 1.06MB chunk: a member opening `/my` paid for
 * Analytics, the audit log, the QR scanner and every staff page they will
 * never see. Split, each route fetches its own chunk the first time it is
 * shown, and the libraries only one page uses — the QR scanner on Attendance,
 * the QR writer behind the member modals — go with it rather than into the
 * bundle everybody downloads.
 *
 * It also makes updates cheaper. The service worker precaches the build and
 * `autoUpdate` refetches whatever changed, so a single bundle meant every
 * deploy re-downloaded all of it. Now a change to one page invalidates one
 * chunk.
 *
 * The signed-out pages are split too. They are the first thing anyone loads,
 * and having the whole app sit behind the login screen is what made the first
 * paint expensive to begin with.
 */
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Members = lazy(() => import('./pages/Members'));
const Attendance = lazy(() => import('./pages/Attendance'));
const QrCheckin = lazy(() => import('./pages/QrCheckin'));
const Payments = lazy(() => import('./pages/Payments'));
const MonthlyCollection = lazy(() => import('./pages/MonthlyCollection'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const Expenses = lazy(() => import('./pages/Expenses'));
const MembershipPlans = lazy(() => import('./pages/MembershipPlans'));
const Supplements = lazy(() => import('./pages/Supplements'));
const SupplementSales = lazy(() => import('./pages/SupplementSales'));
const Team = lazy(() => import('./pages/Team'));
const Trainers = lazy(() => import('./pages/Trainers'));
const Classes = lazy(() => import('./pages/Classes'));
const MyPortal = lazy(() => import('./pages/MyPortal'));
const Security = lazy(() => import('./pages/Security'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Subscription = lazy(() => import('./pages/Subscription'));
const FitnessCalculator = lazy(() => import('./pages/FitnessCalculator'));
const Leads = lazy(() => import('./pages/Leads'));
const Dues = lazy(() => import('./pages/Dues'));

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
import { SUBSCRIPTIONS_ENABLED, type PlanFeatures } from './utils/entitlements';

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
    // The signed-out pages render without the chrome, so there is nothing to
    // keep on screen while one loads — BootSpinner is the same thing the app
    // already shows before the session is known.
    <Suspense fallback={<BootSpinner />}>
    <Routes>
      <Route path="/login" element={isAuth ? <HomeRedirect /> : <Login />} />
      <Route path="/register" element={isAuth ? <HomeRedirect /> : <Register />} />
      <Route path="/forgot-password" element={isAuth ? <HomeRedirect /> : <ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Public: the link is opened from an inbox, often on a device that is
          not signed in. The token is the credential. */}
      <Route path="/verify-email" element={<VerifyEmail />} />
      {/* Public: the invitee has no session yet, and is signed in on accept. */}
      <Route path="/accept-invite" element={<AcceptInvite />} />
      {/* Opened by a member's phone from the gym's check-in QR. Handles its own
          sign-in redirect so the scan survives a trip through /login. */}
      <Route path="/checkin" element={<QrCheckin />} />
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
              {/*
                Inside the boundary and inside the chrome, so a page still
                being fetched shows a loader in the content area with the
                sidebar and nav already usable — not a blank window. Nested
                under PageErrorBoundary rather than over it, so a chunk that
                fails to load (a stale tab after a deploy) surfaces as the
                page error the boundary already handles.
              */}
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/my" element={<MyPortal />} />
                {/* Every role — calculator, security and profile are available to all */}
                <Route path="/calculator" element={<FitnessCalculator />} />
                <Route path="/security" element={<Security />} />
                 <Route path="/dashboard" element={<StaffRoute><Dashboard /></StaffRoute>} />
                <Route path="/attendance" element={<PermissionRoute action="canViewAttendance"><Attendance /></PermissionRoute>} />
                {/* Both gates: whether this person may see reports, and
                    whether the gym's plan includes them. */}
                <Route path="/analytics" element={<PermissionRoute action="canViewReports"><FeatureRoute feature="analytics"><Analytics /></FeatureRoute></PermissionRoute>} />
                <Route path="/plans" element={<Navigate to="/calculator" replace />} />
                <Route path="/membership-plans" element={<PermissionRoute action="canManageMemberships"><MembershipPlans /></PermissionRoute>} />
                <Route path="/supplements" element={<PermissionRoute action="canManageSupplements"><Supplements /></PermissionRoute>} />
                {/* A report of what the gym earns, rather than a till — so it
                    stays owner-only, matching what the API enforces. */}
                <Route path="/supplement-sales" element={<OwnerRoute><SupplementSales /></OwnerRoute>} />
                <Route path="/members" element={<PermissionRoute action="canManageMembers"><Members /></PermissionRoute>} />
                <Route path="/leads" element={<PermissionRoute action="canManageMembers"><Leads /></PermissionRoute>} />
                {/* Open to staff so the counter can take a fee. The page is not
                    the same for both: the API narrows staff to their own
                    entries and withholds the gym's totals. */}
                <Route path="/payments" element={<PermissionRoute action="canViewPayments"><Payments /></PermissionRoute>} />
                <Route path="/dues" element={<PermissionRoute action="canViewPayments"><Dues /></PermissionRoute>} />
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
                {SUBSCRIPTIONS_ENABLED && (
                  <Route path="/subscription" element={<OwnerRoute><Subscription /></OwnerRoute>} />
                )}
                <Route path="/trainers" element={<PermissionRoute action="canManageTrainers"><Trainers /></PermissionRoute>} />
                <Route path="/classes" element={<PermissionRoute action="canManageClasses"><Classes /></PermissionRoute>} />
                <Route path="*" element={<HomeRedirect />} />
              </Routes>
              </Suspense>
              </PageErrorBoundary>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
    </Suspense>
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

