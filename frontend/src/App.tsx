import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Attendance from './pages/Attendance';
import Payments from './pages/Payments';
import Plans from './pages/Plans';
import MembershipPlans from './pages/MembershipPlans';
import Supplements from './pages/Supplements';
import Team from './pages/Team';
import MyPortal from './pages/MyPortal';
import { Spinner } from './components/ui';

/** The whole-app boot state, before the session is known. */
function BootSpinner() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50">
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

/** Owner only — account management and ownership. */
function OwnerRoute({ children }: { children: ReactNode }) {
  const { isAuth, isOwner, isStaff, loading } = useAuth();
  if (loading) return <BootSpinner />;
  if (!isAuth) return <Navigate to="/login" replace />;
  if (!isOwner) return <Navigate to={isStaff ? '/dashboard' : '/my'} replace />;
  return <>{children}</>;
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
      <Route path="/" element={<HomeRedirect />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/my" element={<MyPortal />} />
                <Route path="/dashboard" element={<StaffRoute><Dashboard /></StaffRoute>} />
                <Route path="/attendance" element={<StaffRoute><Attendance /></StaffRoute>} />
                <Route path="/plans" element={<StaffRoute><Plans /></StaffRoute>} />
                <Route path="/membership-plans" element={<StaffRoute><MembershipPlans /></StaffRoute>} />
                <Route path="/supplements" element={<StaffRoute><Supplements /></StaffRoute>} />
                <Route path="/members" element={<StaffRoute><Members /></StaffRoute>} />
                {/* Money is owner-only — the same rule the API enforces. */}
                <Route path="/payments" element={<OwnerRoute><Payments /></OwnerRoute>} />
                <Route path="/team" element={<OwnerRoute><Team /></OwnerRoute>} />
                <Route path="*" element={<HomeRedirect />} />
              </Routes>
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
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

